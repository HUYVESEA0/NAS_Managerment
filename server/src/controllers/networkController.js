const prisma = require('../utils/prisma');
const agentManager = require('../utils/agentManager');
const sshService = require('../utils/sshService');
const { exec } = require('child_process');
const os = require('os');
const net = require('net');
const dns = require('dns').promises;

/**
 * Tìm kiếm files trên machine (SSH hoặc Agent)
 */
exports.searchFiles = async (req, res) => {
    try {
        const { machineId, query, extensions, minSize, maxSize, path: searchPath, type } = req.query;

        if (!machineId) return res.status(400).json({ error: 'machineId is required' });
        if (!query && !extensions) return res.status(400).json({ error: 'query or extensions is required' });

        const machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        const basePath = searchPath || '.';

        // === Agent ===
        if (agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const results = await agentManager.sendRequest(parseInt(machineId), 'search_files', {
                    path: basePath,
                    query: query || '',
                    extensions: extensions ? extensions.split(',') : [],
                    minSize: minSize ? parseInt(minSize) : null,
                    maxSize: maxSize ? parseInt(maxSize) : null,
                    type: type || 'all' // all, file, directory
                }, 180000); // Tăng timeout lên 3 phút cho deep search ổn định

                return res.json(results);
            } catch (err) {
                return res.status(502).json({ error: `Agent error: ${err.message}` });
            }
        }

        // === SSH ===
        if (machine.ipAddress && machine.username && machine.password) {
            const sshConfig = {
                host: machine.ipAddress,
                port: machine.port || 22,
                username: machine.username,
                password: machine.password
            };

            // Build find command
            let findCmd = `find "${basePath}" -maxdepth 5`;

            // Type filter
            if (type === 'file') findCmd += ' -type f';
            else if (type === 'directory') findCmd += ' -type d';

            // Name filter
            if (query) findCmd += ` -iname "*${query}*"`;

            // Extensions filter
            if (extensions) {
                const exts = extensions.split(',').map(e => `-iname "*.${e.trim()}"`).join(' -o ');
                findCmd += ` \\( ${exts} \\)`;
            }

            // Size filters
            if (minSize) findCmd += ` -size +${minSize}c`;
            if (maxSize) findCmd += ` -size -${maxSize}c`;

            // Limit results and get details
            findCmd += ` 2>/dev/null | head -100`;

            const result = await sshService.execCommand(sshConfig, findCmd);

            if (!result.stdout.trim()) {
                return res.json([]);
            }

            // Get file details
            const paths = result.stdout.trim().split('\n').filter(Boolean);
            const detailCmd = paths.map(p => `stat --printf="%n|%s|%Y|%F\\n" "${p}" 2>/dev/null`).join('; ');
            const details = await sshService.execCommand(sshConfig, detailCmd);

            const files = details.stdout.trim().split('\n').filter(Boolean).map(line => {
                const [filePath, size, mtime, fileType] = line.split('|');
                return {
                    name: filePath.split('/').pop(),
                    path: filePath,
                    size: parseInt(size) || 0,
                    modifiedAt: mtime ? new Date(parseInt(mtime) * 1000).toISOString() : null,
                    isDirectory: fileType === 'directory'
                };
            });

            return res.json(files);
        }

        res.status(400).json({ error: 'No connection method available for this machine' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tìm kiếm Deep Search trên toàn bộ server (SSH hoặc Agent)
 */
exports.searchGlobalFiles = async (req, res) => {
    try {
        const { query, extensions, type } = req.query;
        if (!query && !extensions) return res.status(400).json({ error: 'query or extensions is required' });

        const machines = await prisma.machine.findMany();
        const allResults = [];

        await Promise.all(machines.map(async (machine) => {
            try {
                if (agentManager.isAgentConnected(machine.id)) {
                    const results = await agentManager.sendRequest(machine.id, 'search_files', {
                        path: '/', // Agent sẽ tự map '/' thành shared paths của nó
                        query: query || '',
                        extensions: extensions ? extensions.split(',') : [],
                        type: type || 'all'
                    }, 180000); // Tăng timeout lên 3 phút cho deep search ổn định

                    results.forEach(r => allResults.push({ ...r, machineName: machine.name, machineId: machine.id }));
                    return;
                }

                if (machine.ipAddress && machine.username && machine.password) {
                    const sshConfig = { host: machine.ipAddress, port: machine.port || 22, username: machine.username, password: machine.password };
                    let findCmd = `find /home /mnt /media /srv /var/www -maxdepth 5`;
                    if (type === 'file') findCmd += ' -type f';
                    if (query) findCmd += ` -iname "*${query}*"`;
                    if (extensions) {
                        const exts = extensions.split(',').map(e => `-iname "*.${e.trim()}"`).join(' -o ');
                        findCmd += ` \\( ${exts} \\)`;
                    }
                    findCmd += ` 2>/dev/null | head -50`;

                    const result = await sshService.execCommand(sshConfig, findCmd);
                    if (!result.stdout.trim()) return;

                    const paths = result.stdout.trim().split('\n').filter(Boolean);
                    const detailCmd = paths.map(p => `stat --printf="%n|%s|%Y|%F\\n" "${p}" 2>/dev/null`).join('; ');
                    const details = await sshService.execCommand(sshConfig, detailCmd);

                    details.stdout.trim().split('\n').filter(Boolean).forEach(line => {
                        const [filePath, size, mtime, fileType] = line.split('|');
                        allResults.push({
                            name: filePath.split('/').pop(),
                            path: filePath,
                            size: parseInt(size) || 0,
                            modifiedAt: mtime ? new Date(parseInt(mtime) * 1000).toISOString() : null,
                            isDirectory: fileType === 'directory',
                            machineName: machine.name,
                            machineId: machine.id
                        });
                    });
                }
            } catch (e) {
                console.error(`Global search error on machine ${machine.id}:`, e.message);
            } // Ignore individual machine errors
        }));

        res.json(allResults);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Quét mạng LAN - tìm thiết bị đang online
 */
exports.scanNetwork = async (req, res) => {
    try {
        const { subnet } = req.query;

        // Tự detect subnet nếu không được chỉ định
        let targetSubnet = subnet;
        if (!targetSubnet) {
            const nets = os.networkInterfaces();
            // Ưu tiên 192.168.x.x, sau đó đến 10.x.x.x, rồi 172.x.x.x
            const candidates = [];
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        candidates.push(net.address);
                    }
                }
            }

            // Sort ưu tiên
            candidates.sort((a, b) => {
                if (a.startsWith('192.168')) return -1;
                if (b.startsWith('192.168')) return 1;
                if (a.startsWith('10.')) return -1;
                if (b.startsWith('10.')) return 1;
                return 0;
            });

            if (candidates.length > 0) {
                const parts = candidates[0].split('.');
                targetSubnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }

        if (!targetSubnet) {
            return res.status(400).json({ error: 'Could not detect network subnet' });
        }

        // Lấy machines đã có trong DB
        const existingMachines = await prisma.machine.findMany({
            select: { id: true, name: true, ipAddress: true, status: true }
        });
        const existingIPs = new Set(existingMachines.map(m => m.ipAddress));

        // Hàm ping bất đồng bộ
        const platform = os.platform();
        const pingHost = (ip) => {
            return new Promise((resolve) => {
                const cmd = platform === 'win32'
                    ? `ping -n 1 -w 200 ${ip}` // Fast ping
                    : `ping -c 1 -W 1 ${ip}`;

                exec(cmd, (error) => {
                    resolve({ ip, online: !error });
                });
            });
        };

        // 1. Quét Ping (Batch Processing)
        const pingResults = [];
        const ipList = [];
        for (let i = 1; i <= 254; i++) ipList.push(`${targetSubnet}.${i}`);

        // Limit concurrency to 25
        const BATCH_SIZE = 25;
        for (let i = 0; i < ipList.length; i += BATCH_SIZE) {
            const batch = ipList.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(ip => pingHost(ip)));
            pingResults.push(...batchResults);
        }

        const onlineIPs = pingResults.filter(r => r.online).map(r => r.ip);

        // 2. Scan chi tiết: Hostname + SSH (Batch Processing)
        const devices = [];

        for (let i = 0; i < onlineIPs.length; i += BATCH_SIZE) {
            const batch = onlineIPs.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (ip) => {
                let hostname = null;
                let sshOpen = false;

                // Check SSH
                try {
                    sshOpen = await new Promise((resolve) => {
                        const socket = new net.Socket();
                        socket.setTimeout(600);
                        socket.on('connect', () => { socket.destroy(); resolve(true); });
                        socket.on('error', () => { socket.destroy(); resolve(false); });
                        socket.on('timeout', () => { socket.destroy(); resolve(false); });
                        socket.connect(22, ip);
                    });
                } catch { sshOpen = false; }

                // Hostname Resolution Strategy:

                // 1. Try Windows 'ping -a' (Resolve hostname) - Very effective on Windows Server
                if (!hostname && platform === 'win32') {
                    try {
                        await new Promise((resolve) => {
                            exec(`ping -a -n 1 -w 200 ${ip}`, { timeout: 1000 }, (err, stdout) => {
                                if (!err && stdout) {
                                    // Output format: "Pinging HOSTNAME [IP] with..."
                                    const match = stdout.match(/Pinging\s+([^\s\[]+)\s+\[/);
                                    if (match && match[1] !== ip) hostname = match[1];
                                }
                                resolve();
                            });
                        });
                    } catch { }
                }

                // 2. DNS Reverse Lookup (Standard)
                if (!hostname) {
                    try {
                        const hostnames = await dns.reverse(ip);
                        if (hostnames && hostnames.length > 0) hostname = hostnames[0];
                    } catch (e) { /* ignore */ }
                }

                // 3. Windows NetBIOS (Fallback) - Strict Mode for UNIQUE names
                if (!hostname && platform === 'win32') {
                    try {
                        await new Promise((resolve) => {
                            exec(`nbtstat -A ${ip}`, { timeout: 1500 }, (err, stdout) => {
                                if (!err && stdout) {
                                    // Look for: "NAME   <00>  UNIQUE"
                                    const lines = stdout.split('\n');
                                    for (const line of lines) {
                                        if (line.includes('<00>') && line.includes('UNIQUE')) {
                                            const match = line.match(/^\s*(\S+)/);
                                            if (match) {
                                                hostname = match[1];
                                                break;
                                            }
                                        }
                                    }
                                }
                                resolve();
                            });
                        });
                    } catch { }
                }

                const existingMachine = existingMachines.find(m => m.ipAddress === ip);

                return {
                    ip,
                    hostname: hostname || (existingMachine ? existingMachine.name : null),
                    sshAvailable: sshOpen,
                    isRegistered: existingIPs.has(ip),
                    machine: existingMachine || null
                };
            });

            const batchResults = await Promise.all(batchPromises);
            devices.push(...batchResults);
        }

        // Sort: registered first, check SSH, then numeric IP
        devices.sort((a, b) => {
            if (a.isRegistered && !b.isRegistered) return -1;
            if (!a.isRegistered && b.isRegistered) return 1;

            // Sort IP numeric
            const ipA = a.ip.split('.').map(Number);
            const ipB = b.ip.split('.').map(Number);
            for (let i = 0; i < 4; i++) {
                if (ipA[i] < ipB[i]) return -1;
                if (ipA[i] > ipB[i]) return 1;
            }
            return 0;
        });

        res.json({
            subnet: targetSubnet,
            totalOnline: devices.length,
            devices
        });
    } catch (error) {
        console.error('Network scan error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Preview file: đọc nội dung text hoặc ảnh nhỏ
 */
exports.previewFile = async (req, res) => {
    try {
        const { machineId, path: filePath } = req.query;

        if (!machineId || !filePath) {
            return res.status(400).json({ error: 'machineId and path are required' });
        }

        const machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        const ext = filePath.split('.').pop().toLowerCase();
        const textExts = ['txt', 'log', 'md', 'json', 'xml', 'csv', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'sh', 'bash', 'py', 'js', 'html', 'css'];
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

        let previewType = 'unsupported';
        if (textExts.includes(ext)) previewType = 'text';
        else if (imageExts.includes(ext)) previewType = 'image';

        if (previewType === 'unsupported') {
            return res.json({ type: 'unsupported', message: 'Preview not available for this file type' });
        }

        // Agent
        if (agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const result = await agentManager.sendRequest(parseInt(machineId), 'preview_file', {
                    path: filePath,
                    type: previewType,
                    maxSize: previewType === 'text' ? 50000 : 5 * 1024 * 1024 // 50KB text, 5MB image
                }, 15000);

                return res.json({ type: previewType, ext, ...result });
            } catch (err) {
                return res.status(502).json({ error: err.message });
            }
        }

        // SSH
        if (machine.ipAddress && machine.username && machine.password) {
            const sshConfig = {
                host: machine.ipAddress,
                port: machine.port || 22,
                username: machine.username,
                password: machine.password
            };

            if (previewType === 'text') {
                const result = await sshService.execCommand(sshConfig, `head -c 50000 "${filePath}"`);
                return res.json({ type: 'text', ext, content: result.stdout });
            }

            if (previewType === 'image') {
                const result = await sshService.execCommand(sshConfig, `base64 "${filePath}" | head -c 7000000`);
                return res.json({ type: 'image', ext, content: result.stdout });
            }
        }

        res.status(400).json({ error: 'No connection available' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
