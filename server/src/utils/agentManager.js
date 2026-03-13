const WebSocket = require('ws');
const crypto = require('crypto');
const prisma = require('./prisma');
const notificationHub = require('./notificationHub');
const { logActivity } = require('./activityService');
const { encryptSecret } = require('./credentialCrypto');

/**
 * AgentManager - Quản lý kết nối WebSocket từ các agent remote
 * 
 * Flow:
 * 1. Agent kết nối WebSocket đến server
 * 2. Agent gửi message "register" kèm machineId hoặc thông tin máy
 * 3. Server lưu connection, cập nhật machine status = "online"
 * 4. Khi user browse files, server gửi request qua WebSocket đến agent
 * 5. Agent đọc file/directory trên máy local và gửi kết quả về
 */
class AgentManager {
    constructor() {
        this.wss = null;
        // Map: machineId -> { ws, info, lastHeartbeat }
        this.agents = new Map();
        // Map: requestId -> { resolve, reject, timeout }
        this.pendingRequests = new Map();
        this.requestCounter = 0;
    }

    _getAgentSharedSecret() {
        return process.env.WS_AGENT_SHARED_SECRET || '';
    }

    _signRequestEnvelope({ requestId, action, params, ts }) {
        const secret = this._getAgentSharedSecret();
        if (!secret) return null;
        const payload = `${requestId}|${action}|${ts}|${JSON.stringify(params || {})}`;
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    /**
     * Khởi tạo WebSocket server gắn vào HTTP server
     */
    init(wssInstance) {
        if (wssInstance) {
            this.wss = wssInstance;
        }

        this.wss.on('connection', (ws, req) => {
            console.log('🔌 New agent connection from:', req.socket.remoteAddress);

            ws._isAlive = true;
            ws._agentInfo = null;

            ws.on('message', (data) => this._handleMessage(ws, data));
            ws.on('close', () => this._handleDisconnect(ws));
            ws.on('error', (err) => {
                console.error('Agent WebSocket error:', err.message);
            });
            ws.on('pong', () => { ws._isAlive = true; });
        });

        // Heartbeat interval - kiểm tra agents còn sống
        this._heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach(ws => {
                if (!ws._isAlive) {
                    console.log('💀 Agent heartbeat timeout, disconnecting');
                    return ws.terminate();
                }
                ws._isAlive = false;
                ws.ping();
            });
        }, 30000); // 30s

        console.log('🌐 Agent WebSocket server initialized at /ws/agent');
    }

    /**
     * Xử lý message từ agent
     */
    async _handleMessage(ws, rawData) {
        try {
            const message = JSON.parse(rawData.toString());

            switch (message.type) {
                case 'register':
                    await this._handleRegister(ws, message);
                    break;

                case 'response':
                    this._handleResponse(message);
                    break;

                case 'stream_chunk':
                    this._handleStreamChunk(message);
                    break;

                case 'heartbeat':
                    ws._isAlive = true;
                    this._sendToAgent(ws, { type: 'heartbeat_ack' });
                    break;

                default:
                    console.log('Unknown message type from agent:', message.type);
            }
        } catch (err) {
            console.error('Error handling agent message:', err.message);
        }
    }

    /**
     * Agent đăng ký với server
     */
    async _handleRegister(ws, message) {
        const {
            machineId, machineName, sharedPaths, hostname, platform,
            setup, networkInfo, sshInfo, systemInfo
        } = message.data;

        // Nếu agent gửi machineId, liên kết với machine trong DB
        let machine = null;
        if (machineId) {
            machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        }

        const agentInfo = {
            machineId: machine?.id || null,
            machineName: machineName || hostname || 'Unknown',
            hostname: hostname || 'unknown',
            platform: platform || 'unknown',
            sharedPaths: sharedPaths || ['.'],
            connectedAt: new Date(),
            remoteAddress: ws._socket?.remoteAddress || 'unknown',
            // Extended info
            networkInfo: networkInfo || null,
            sshInfo: sshInfo || null,
            systemInfo: systemInfo || null
        };

        ws._agentInfo = agentInfo;

        let configuredPaths = null;

        if (machine) {
            // Cập nhật machine status + SSH info nếu agent gửi lên
            const updateData = { status: 'online' };

            // Auto-bind SSH credentials từ agent
            if (sshInfo) {
                if (sshInfo.available && sshInfo.username && sshInfo.password) {
                    updateData.username = sshInfo.username;
                    try {
                        updateData.password = encryptSecret(sshInfo.password);
                    } catch (e) {
                        console.warn(`⚠️ Could not encrypt SSH password for machine ${machine.name}: ${e.message}`);
                    }
                    console.log(`  🔐 SSH credentials updated for machine ${machine.name}`);
                }
                if (sshInfo.port && sshInfo.port !== 22) {
                    updateData.port = sshInfo.port;
                }
            }

            // Auto-bind IP từ network info
            if (networkInfo && networkInfo.primaryIP && !machine.ipAddress) {
                updateData.ipAddress = networkInfo.primaryIP;
                console.log(`  🌐 IP auto-set to ${networkInfo.primaryIP} for machine ${machine.name}`);
            }

            await prisma.machine.update({
                where: { id: machine.id },
                data: updateData
            });

            // Load sharedPaths từ DB và push xuống agent
            const freshMachine = await prisma.machine.findUnique({ where: { id: machine.id } });
            configuredPaths = freshMachine.sharedPaths
                ? JSON.parse(freshMachine.sharedPaths)
                : null;

            // Lưu agent connection theo machineId
            this.agents.set(machine.id, { ws, info: agentInfo });
            console.log(`✅ Agent registered for machine: ${machine.name} (ID: ${machine.id})`);

            // Broadcast agent online event
            notificationHub.broadcast('agent:online', {
                machineId: machine.id,
                machineName: machine.name
            });
            logActivity({ category: 'agent', action: 'connect', message: `Agent "${machine.name}" connected`, meta: { machineId: machine.id, hostname, platform } });

            if (sshInfo) {
                console.log(`   SSH: ${sshInfo.available ? '✅ Available' : '❌ Not available'} (port ${sshInfo.port || 22})`);
            }
            if (networkInfo?.ips?.length > 0) {
                console.log(`   IPs: ${networkInfo.ips.map(ip => ip.address).join(', ')}`);
            }
        } else {
            // Agent chưa được liên kết với machine, dùng temporary ID
            const tempId = `temp_${Date.now()}`;
            this.agents.set(tempId, { ws, info: agentInfo });
            console.log(`✅ Unlinked agent registered: ${agentInfo.machineName} (temp: ${tempId})`);
        }

        // Gửi xác nhận + push configured paths nếu có
        this._sendToAgent(ws, {
            type: 'registered',
            data: {
                machineId: machine?.id || null,
                serverTime: new Date().toISOString(),
                message: machine
                    ? `Linked to machine: ${machine.name}`
                    : 'Registered but not linked to any machine. Please set machineId.',
                // Push configured paths xuống agent (override agent-side paths)
                configuredPaths: configuredPaths || null
            }
        });
    }

    /**
     * Xử lý response từ agent cho pending request
     */
    _handleResponse(message) {
        const { requestId, data, error } = message;
        const pending = this.pendingRequests.get(requestId);

        if (!pending) {
            console.warn('No pending request for:', requestId);
            return;
        }

        if (error) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.reject(new Error(error));
            return;
        }

        // Streaming response: don't clear pending — chunks will follow
        if (data && data.status === 'streaming') {
            if (pending.onStreamStart) {
                pending.onStreamStart(data);
            }
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
        pending.resolve(data);
    }

    /**
     * Xử lý từng chunk dữ liệu file từ agent
     */
    _handleStreamChunk(message) {
        const { requestId, data, last } = message;
        const pending = this.pendingRequests.get(requestId);
        if (!pending || !pending.onChunk) return;

        // Always invoke onChunk — including the final empty sentinel (data='', last=true).
        // The original `if (data)` guard caused onChunk to be skipped on the last chunk,
        // leaving streamDownload's PassThrough unclosed and relayFile's Promise unsettled.
        pending.onChunk(Buffer.from(data || '', 'base64'), !!last);

        if (last) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
        }
    }

    /**
     * Stream download file từ agent theo từng chunk (không bị giới hạn kích thước)
     * @returns {Promise<{ stream: PassThrough, size: number, name: string }>}
     */
    streamDownload(machineId, filePath, isAdmin = false) {
        const { PassThrough } = require('stream');
        return new Promise((resolve, reject) => {
            const agent = this.agents.get(machineId);
            if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('Agent not connected'));
            }

            const requestId = `req_${++this.requestCounter}_${Date.now()}`;
            const passThrough = new PassThrough();

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                passThrough.destroy(new Error('Stream timed out'));
                reject(new Error('Agent stream timed out'));
            }, 300000); // 5 minutes for large files

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                onStreamStart: (meta) => {
                    resolve({ stream: passThrough, size: meta.size, name: meta.name });
                },
                onChunk: (buffer, last) => {
                    if (buffer.length > 0) passThrough.write(buffer);
                    if (last) passThrough.end();
                }
            });

            this._sendToAgent(agent.ws, {
                type: 'request',
                requestId,
                action: 'download_file_stream',
                params: { path: filePath, isAdmin }
            });
        });
    }

    /**
     * Relay file từ fromMachineId → toMachineId qua server làm trung gian
     * Server nhận stream từng chunk từ source agent, gửi từng chunk đến dest agent
     *
     * @param {number} fromMachineId  - ID máy nguồn
     * @param {number} toMachineId    - ID máy đích
     * @param {string} sourcePath     - Đường dẫn file trên máy nguồn
     * @param {string} destPath       - Đường dẫn lưu trên máy đích
     * @param {boolean} isAdmin
     * @param {function} onProgress   - Callback(transferred, total) — tuỳ chọn
     * @returns {Promise<{ size: number, name: string }>}
     */
    relayFile(fromMachineId, toMachineId, sourcePath, destPath, isAdmin = false, onProgress = null) {
        return new Promise((resolve, reject) => {
            const srcAgent = this.agents.get(fromMachineId);
            const dstAgent = this.agents.get(toMachineId);

            if (!srcAgent || srcAgent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error(`Source agent (machine ${fromMachineId}) is not connected`));
            }
            if (!dstAgent || dstAgent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error(`Destination agent (machine ${toMachineId}) is not connected`));
            }

            const requestId = `relay_${++this.requestCounter}_${Date.now()}`;
            let chunkIndex = 0;
            let totalSize = 0;
            let transferred = 0;
            let fileName = require('path').basename(sourcePath);
            const pendingWrites = []; // Queue chunk-write promises (serial)
            let streamEnded = false;

            // Helper: gửi 1 chunk đến dest agent và chờ ack
            const sendChunkToDest = (base64Data, complete) => {
                return this.sendRequest(toMachineId, 'receive_file_stream', {
                    path: destPath,
                    chunkIndex: chunkIndex++,
                    append: chunkIndex > 1,
                    data: base64Data,
                    complete,
                    isAdmin
                }, 60000); // 60s per chunk
            };

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Relay timed out'));
            }, 30 * 60 * 1000); // 30 min max

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                onStreamStart: (meta) => {
                    totalSize = meta.size || 0;
                    fileName = meta.name || fileName;
                    // Reset chunkIndex & write state
                    chunkIndex = 0;
                },
                onChunk: async (buffer, last) => {
                    try {
                        transferred += buffer.length;
                        const base64 = buffer.toString('base64');
                        await sendChunkToDest(base64, last);

                        if (onProgress && totalSize > 0) {
                            onProgress(transferred, totalSize);
                        }

                        if (last) {
                            clearTimeout(timeout);
                            this.pendingRequests.delete(requestId);
                            resolve({ size: transferred, name: fileName });
                        }
                    } catch (writeErr) {
                        clearTimeout(timeout);
                        this.pendingRequests.delete(requestId);
                        reject(writeErr);
                    }
                }
            });

            // Khởi động stream từ source agent
            this._sendToAgent(srcAgent.ws, {
                type: 'request',
                requestId,
                action: 'download_file_stream',
                params: { path: sourcePath, isAdmin }
            });
        });
    }

    /**
     * Agent ngắt kết nối
     */
    async _handleDisconnect(ws) {
        if (!ws._agentInfo) return;

        const { machineId, machineName } = ws._agentInfo;
        console.log(`❌ Agent disconnected: ${machineName}`);

        // Broadcast agent offline event
        notificationHub.broadcast('agent:offline', { machineId, machineName });
        logActivity({ level: 'warn', category: 'agent', action: 'disconnect', message: `Agent "${machineName}" disconnected`, meta: { machineId } });

        if (machineId) {
            this.agents.delete(machineId);
            // Cập nhật machine status = offline
            try {
                await prisma.machine.update({
                    where: { id: machineId },
                    data: { status: 'offline' }
                });
            } catch (err) {
                console.error('Error updating machine status:', err.message);
            }
        } else {
            // Tìm và xóa temp agent
            for (const [key, agent] of this.agents) {
                if (agent.ws === ws) {
                    this.agents.delete(key);
                    break;
                }
            }
        }
    }

    /**
     * Push updated paths to a connected agent at runtime
     * @param {number} machineId
     * @param {string[]} paths
     */
    pushPaths(machineId, paths) {
        const agent = this.agents.get(machineId);
        if (!agent || agent.ws.readyState !== 1) return false;
        this._sendToAgent(agent.ws, {
            type: 'update_paths',
            data: { paths }
        });
        // Update in-memory info as well
        agent.info.sharedPaths = paths;
        console.log(`📂 Pushed paths to agent ${machineId}:`, paths);
        return true;
    }

    /**
     * Gửi request đến agent và chờ response
     * @param {number} machineId - Machine ID
     * @param {string} action - Action name (list_files, read_file, download_file)
     * @param {object} params - Parameters
     * @param {number} timeoutMs - Timeout in ms
     * @returns {Promise<any>}
     */
    sendRequest(machineId, action, params = {}, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const agent = this.agents.get(machineId);
            if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('Agent not connected'));
            }

            const requestId = `req_${++this.requestCounter}_${Date.now()}`;

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Agent request timed out'));
            }, timeoutMs);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            this._sendToAgent(agent.ws, {
                type: 'request',
                requestId,
                action,
                params
            });
        });
    }

    /**
     * Kiểm tra agent có đang kết nối cho machine không
     */
    isAgentConnected(machineId) {
        const agent = this.agents.get(machineId);
        return agent && agent.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Lấy thông tin tất cả agents đang kết nối
     */
    getConnectedAgents() {
        const result = [];
        for (const [key, agent] of this.agents) {
            if (agent.ws.readyState === WebSocket.OPEN) {
                result.push({
                    id: key,
                    ...agent.info,
                    status: 'connected'
                });
            }
        }
        return result;
    }

    /**
     * Gửi message đến agent
     */
    _sendToAgent(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            if (data?.type === 'request') {
                const ts = Date.now();
                const sig = this._signRequestEnvelope({
                    requestId: data.requestId,
                    action: data.action,
                    params: data.params,
                    ts
                });
                if (sig) {
                    data.security = { ts, sig };
                }
            }
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}

// Singleton instance
const agentManager = new AgentManager();
module.exports = agentManager;
