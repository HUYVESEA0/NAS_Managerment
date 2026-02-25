const WebSocket = require('ws');
const prisma = require('./prisma');

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

    /**
     * Khởi tạo WebSocket server gắn vào HTTP server
     */
    init(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws/agent' });

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

        if (machine) {
            // Cập nhật machine status + SSH info nếu agent gửi lên
            const updateData = { status: 'online' };

            // Auto-bind SSH credentials từ agent
            if (sshInfo) {
                if (sshInfo.available && sshInfo.username && sshInfo.password) {
                    updateData.username = sshInfo.username;
                    updateData.password = sshInfo.password;
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

            // Lưu agent connection theo machineId
            this.agents.set(machine.id, { ws, info: agentInfo });
            console.log(`✅ Agent registered for machine: ${machine.name} (ID: ${machine.id})`);

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

        // Gửi xác nhận
        this._sendToAgent(ws, {
            type: 'registered',
            data: {
                machineId: machine?.id || null,
                serverTime: new Date().toISOString(),
                message: machine
                    ? `Linked to machine: ${machine.name}`
                    : 'Registered but not linked to any machine. Please set machineId.'
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

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (error) {
            pending.reject(new Error(error));
        } else {
            pending.resolve(data);
        }
    }

    /**
     * Agent ngắt kết nối
     */
    async _handleDisconnect(ws) {
        if (!ws._agentInfo) return;

        const { machineId, machineName } = ws._agentInfo;
        console.log(`❌ Agent disconnected: ${machineName}`);

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
