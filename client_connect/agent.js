#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           NAS Manager Agent v2.0                         ║
 * ║  Chạy trên máy remote để chia sẻ thư mục với server     ║
 * ║  Hỗ trợ: SSH check, auto-bind, file ops, search, preview║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Usage:
 *   node agent.js --server ws://192.168.1.x:3001/ws/agent --machine-id 1
 *   node agent.js --setup --server ws://192.168.1.x:3001/ws/agent
 * 
 * Options:
 *   --server       WebSocket URL of the NAS server (required)
 *   --machine-id   Machine ID from the NAS system
 *   --paths        Comma-separated list of directories to share
 *   --name         Custom name for this agent (default: hostname)
 *   --setup        Run setup wizard: check SSH, detect IPs, bind to server
 *   --ssh-user     SSH username to report to server (for auto-bind)
 *   --ssh-pass     SSH password to report to server (for auto-bind)
 *   --ssh-port     SSH port (default: 22)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execSync } = require('child_process');

// Config file path
const CONFIG_FILE = path.join(__dirname, 'agent.config.json');

// ==================== PARSE ARGUMENTS ====================
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        server: null,
        machineId: null,
        paths: [process.cwd()],
        name: os.hostname(),
        setup: false,
        sshUser: null,
        sshPass: null,
        sshPort: 22
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--server':
            case '-s':
                config.server = args[++i];
                break;
            case '--machine-id':
            case '-m':
                config.machineId = parseInt(args[++i]);
                break;
            case '--paths':
            case '-p':
                config.paths = args[++i].split(',').map(p => p.trim());
                break;
            case '--name':
            case '-n':
                config.name = args[++i];
                break;
            case '--setup':
                config.setup = true;
                break;
            case '--ssh-user':
                config.sshUser = args[++i];
                break;
            case '--ssh-pass':
                config.sshPass = args[++i];
                break;
            case '--ssh-port':
                config.sshPort = parseInt(args[++i]);
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    // Load saved config if exists
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            // CLI args override saved config
            if (!config.server && saved.server) config.server = saved.server;
            if (!config.machineId && saved.machineId) config.machineId = saved.machineId;
            if (config.paths.length === 1 && config.paths[0] === process.cwd() && saved.paths) config.paths = saved.paths;
            if (config.name === os.hostname() && saved.name) config.name = saved.name;
            if (!config.sshUser && saved.sshUser) config.sshUser = saved.sshUser;
            if (!config.sshPass && saved.sshPass) config.sshPass = saved.sshPass;
            if (config.sshPort === 22 && saved.sshPort) config.sshPort = saved.sshPort;
        } catch (e) {
            // Ignore parse error
        }
    }

    if (!config.server) {
        console.error('❌ Error: --server is required');
        printHelp();
        process.exit(1);
    }

    return config;
}

function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║           NAS Manager Agent v2.0                         ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  node agent.js --server <ws_url> --machine-id <id> [options]
  node agent.js --setup --server <ws_url>

Options:
  -s, --server <url>      WebSocket URL (required)
                          Example: ws://192.168.1.100:3001/ws/agent
  -m, --machine-id <id>   Machine ID in NAS system
  -p, --paths <dirs>      Directories to share, comma-separated
                          Default: current directory
  -n, --name <name>       Agent name (default: hostname)
  --setup                 Run setup wizard (check SSH, bind to server)
  --ssh-user <user>       SSH username for auto-bind
  --ssh-pass <pass>       SSH password for auto-bind
  --ssh-port <port>       SSH port (default: 22)
  -h, --help              Show this help

Examples:
  node agent.js -s ws://192.168.1.100:3001/ws/agent -m 1
  node agent.js --setup -s ws://192.168.1.100:3001/ws/agent
  node agent.js -s ws://server:3001/ws/agent -m 2 -p "/home/user,/var/data"
  node agent.js -s ws://server:3001/ws/agent --ssh-user root --ssh-pass mypass
`);
}

// ==================== SYSTEM DIAGNOSTICS ====================

/**
 * Lấy tất cả IP addresses của máy này
 */
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({
                    interface: name,
                    address: iface.address,
                    netmask: iface.netmask,
                    mac: iface.mac
                });
            }
        }
    }
    return ips;
}

/**
 * Kiểm tra SSH service có đang chạy trên máy local không
 */
function checkLocalSSH(port = 22) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);

        socket.on('connect', () => {
            // Đọc SSH banner
            socket.once('data', (data) => {
                const banner = data.toString().trim();
                socket.destroy();
                resolve({
                    available: true,
                    port,
                    banner,
                    version: banner.split(' ')[0] || 'unknown'
                });
            });

            // Timeout nếu không nhận banner
            setTimeout(() => {
                socket.destroy();
                resolve({ available: true, port, banner: 'SSH (no banner)', version: 'unknown' });
            }, 2000);
        });

        socket.on('error', () => {
            resolve({ available: false, port, error: 'Connection refused' });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ available: false, port, error: 'Connection timed out' });
        });

        socket.connect(port, '127.0.0.1');
    });
}

/**
 * Kiểm tra SSH service trên Windows (sshd service)
 */
function checkSSHServiceWindows() {
    try {
        const result = execSync('sc query sshd 2>nul', { encoding: 'utf8', timeout: 5000 });
        const running = result.includes('RUNNING');
        const state = running ? 'running' : 'stopped';
        return { installed: true, running, state };
    } catch {
        return { installed: false, running: false, state: 'not installed' };
    }
}

/**
 * Kiểm tra SSH service trên Linux
 */
function checkSSHServiceLinux() {
    try {
        const result = execSync('systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null', {
            encoding: 'utf8', timeout: 5000
        }).trim();
        return { installed: true, running: result === 'active', state: result };
    } catch {
        // Thử check process
        try {
            execSync('pgrep -x sshd', { timeout: 3000 });
            return { installed: true, running: true, state: 'running (via pgrep)' };
        } catch {
            return { installed: false, running: false, state: 'not found' };
        }
    }
}

/**
 * Full system diagnostic
 */
async function runDiagnostics(sshPort = 22) {
    const platform = os.platform();
    const ips = getLocalIPs();
    const sshCheck = await checkLocalSSH(sshPort);
    const sshService = platform === 'win32' ? checkSSHServiceWindows() : checkSSHServiceLinux();

    // Disk info
    let disks = [];
    try {
        if (platform === 'win32') {
            const result = execSync('wmic logicaldisk get caption,size,freespace /format:csv 2>nul', {
                encoding: 'utf8', timeout: 5000
            });
            result.split('\n').forEach(line => {
                const parts = line.trim().split(',');
                if (parts.length >= 4 && parts[1]) {
                    disks.push({
                        drive: parts[1],
                        freeSpace: parseInt(parts[2]) || 0,
                        totalSize: parseInt(parts[3]) || 0
                    });
                }
            });
        } else {
            const result = execSync("df -B1 --output=target,size,avail 2>/dev/null | tail -n +2", {
                encoding: 'utf8', timeout: 5000
            });
            result.split('\n').forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    disks.push({
                        drive: parts[0],
                        totalSize: parseInt(parts[1]) || 0,
                        freeSpace: parseInt(parts[2]) || 0
                    });
                }
            });
        }
    } catch {
        // Ignore disk errors
    }

    return {
        hostname: os.hostname(),
        platform: platform,
        arch: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        cpus: os.cpus().length,
        ips,
        ssh: {
            ...sshCheck,
            service: sshService
        },
        disks
    };
}

// ==================== SETUP WIZARD ====================

async function runSetup(config) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           NAS Manager Agent — Setup Wizard               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Step 1: System diagnostics
    console.log('🔍 Step 1: Running system diagnostics...\n');
    const diagnostics = await runDiagnostics(config.sshPort);

    console.log(`  Hostname:     ${diagnostics.hostname}`);
    console.log(`  Platform:     ${diagnostics.platform} ${diagnostics.arch}`);
    console.log(`  CPUs:         ${diagnostics.cpus}`);
    console.log(`  Memory:       ${(diagnostics.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB total, ${(diagnostics.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB free`);
    console.log(`  Uptime:       ${(diagnostics.uptime / 3600).toFixed(1)} hours`);

    // Step 2: Network
    console.log('\n🌐 Step 2: Network interfaces\n');
    if (diagnostics.ips.length === 0) {
        console.log('  ⚠️  No network interfaces found');
    } else {
        diagnostics.ips.forEach(ip => {
            console.log(`  ✅ ${ip.interface}: ${ip.address} (${ip.netmask})`);
        });
    }

    // Step 3: SSH check
    console.log('\n🔐 Step 3: SSH service check\n');
    if (diagnostics.ssh.available) {
        console.log(`  ✅ SSH is AVAILABLE on port ${diagnostics.ssh.port}`);
        console.log(`     Banner: ${diagnostics.ssh.banner}`);
        console.log(`     Service: ${diagnostics.ssh.service.state}`);
    } else {
        console.log(`  ❌ SSH is NOT available on port ${config.sshPort}`);
        console.log(`     Service: ${diagnostics.ssh.service.state}`);
        console.log('');
        if (diagnostics.platform === 'win32') {
            console.log('  💡 To enable SSH on Windows:');
            console.log('     1. Settings → Apps → Optional Features → Add: OpenSSH Server');
            console.log('     2. Run: Start-Service sshd');
            console.log('     3. Run: Set-Service -Name sshd -StartupType Automatic');
        } else {
            console.log('  💡 To enable SSH on Linux:');
            console.log('     1. sudo apt install openssh-server');
            console.log('     2. sudo systemctl enable --now sshd');
        }
    }

    // Step 4: Disks
    if (diagnostics.disks.length > 0) {
        console.log('\n💾 Step 4: Storage\n');
        diagnostics.disks.forEach(d => {
            const totalGB = (d.totalSize / 1024 / 1024 / 1024).toFixed(1);
            const freeGB = (d.freeSpace / 1024 / 1024 / 1024).toFixed(1);
            const usedPercent = d.totalSize > 0 ? ((1 - d.freeSpace / d.totalSize) * 100).toFixed(0) : 0;
            console.log(`  ${d.drive}: ${freeGB} GB free / ${totalGB} GB total (${usedPercent}% used)`);
        });
    }

    // Step 5: Bind to server
    console.log('\n📡 Step 5: Connecting to NAS server...\n');
    console.log(`  Server: ${config.server}`);

    const bindResult = await bindToServer(config, diagnostics);

    if (bindResult.success) {
        console.log(`  ✅ ${bindResult.message}`);
        if (bindResult.machineId) {
            console.log(`  Machine ID: ${bindResult.machineId}`);
            config.machineId = bindResult.machineId;
        }
    } else {
        console.log(`  ❌ ${bindResult.message}`);
    }

    // Step 6: Save config
    const savedConfig = {
        server: config.server,
        machineId: config.machineId,
        paths: config.paths,
        name: config.name,
        sshUser: config.sshUser,
        sshPass: config.sshPass,
        sshPort: config.sshPort
    };

    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfig, null, 2));
        console.log(`\n💾 Config saved to: ${CONFIG_FILE}`);
    } catch (e) {
        console.error(`\n⚠️  Could not save config: ${e.message}`);
    }

    // Summary
    console.log('\n' + '═'.repeat(55));
    console.log('  Setup Complete');
    console.log('═'.repeat(55));
    console.log(`  SSH:          ${diagnostics.ssh.available ? '✅ Available' : '❌ Not available'}`);
    console.log(`  Server:       ${bindResult.success ? '✅ Connected' : '❌ Failed'}`);
    console.log(`  Machine ID:   ${config.machineId || 'Not assigned'}`);
    console.log(`  Network IPs:  ${diagnostics.ips.map(ip => ip.address).join(', ') || 'None'}`);
    console.log('═'.repeat(55));

    if (config.machineId) {
        console.log(`\n🚀 To start the agent, run:`);
        console.log(`   node agent.js -s ${config.server} -m ${config.machineId}\n`);
        console.log(`   Or simply: node agent.js  (uses saved config)\n`);
    }

    return { config, diagnostics };
}

/**
 * Kết nối WebSocket 1 lần để bind agent vào server
 */
function bindToServer(config, diagnostics) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve({ success: false, message: 'Connection timed out (10s)' });
        }, 10000);

        try {
            const ws = new WebSocket(config.server);

            ws.on('open', () => {
                // Register with full diagnostics
                ws.send(JSON.stringify({
                    type: 'register',
                    data: {
                        machineId: config.machineId,
                        machineName: config.name,
                        hostname: diagnostics.hostname,
                        platform: diagnostics.platform,
                        sharedPaths: config.paths,
                        // Extended bind info
                        setup: true,
                        networkInfo: {
                            ips: diagnostics.ips,
                            primaryIP: diagnostics.ips[0]?.address || null
                        },
                        sshInfo: {
                            available: diagnostics.ssh.available,
                            port: config.sshPort,
                            banner: diagnostics.ssh.banner || null,
                            username: config.sshUser || null,
                            password: config.sshPass || null
                        },
                        systemInfo: {
                            cpus: diagnostics.cpus,
                            totalMemory: diagnostics.totalMemory,
                            freeMemory: diagnostics.freeMemory,
                            arch: diagnostics.arch,
                            disks: diagnostics.disks
                        }
                    }
                }));
            });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'registered') {
                        clearTimeout(timeout);
                        ws.close();
                        resolve({
                            success: true,
                            message: msg.data.message,
                            machineId: msg.data.machineId
                        });
                    }
                } catch { /* ignore */ }
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                resolve({ success: false, message: `Connection error: ${err.message}` });
            });

            ws.on('close', () => {
                clearTimeout(timeout);
            });
        } catch (err) {
            clearTimeout(timeout);
            resolve({ success: false, message: err.message });
        }
    });
}

// ==================== FILE OPERATIONS ====================

/**
 * Liệt kê files trong thư mục
 */
function listFiles(targetPath) {
    try {
        let resolvedPath = targetPath;
        if (targetPath === '.' || targetPath === '' || !targetPath) {
            resolvedPath = process.cwd();
        } else if (!path.isAbsolute(targetPath)) {
            resolvedPath = path.resolve(process.cwd(), targetPath);
        }

        if (!fs.existsSync(resolvedPath)) {
            return { error: `Path not found: ${targetPath}` };
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isDirectory()) {
            return { error: `Not a directory: ${targetPath}` };
        }

        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
        const files = entries.map(entry => {
            let size = 0;
            let modifiedAt = null;
            try {
                const fileStat = fs.statSync(path.join(resolvedPath, entry.name));
                size = fileStat.size;
                modifiedAt = fileStat.mtime.toISOString();
            } catch (e) {
                // Skip stat errors
            }

            return {
                name: entry.name,
                isDirectory: entry.isDirectory(),
                size: entry.isFile() ? size : 0,
                modifiedAt,
                path: path.join(targetPath === '.' ? '' : targetPath, entry.name).replace(/\\/g, '/')
            };
        });

        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        return files;
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Đọc file content (base64)
 */
function readFile(filePath) {
    try {
        let resolvedPath = filePath;
        if (!path.isAbsolute(filePath)) {
            resolvedPath = path.resolve(process.cwd(), filePath);
        }

        if (!fs.existsSync(resolvedPath)) {
            return { error: `File not found: ${filePath}` };
        }

        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
            return { error: 'Cannot read directory as file' };
        }

        if (stat.size > 100 * 1024 * 1024) {
            return { error: 'File too large (max 100MB)' };
        }

        const content = fs.readFileSync(resolvedPath);
        return {
            content: content.toString('base64'),
            size: stat.size,
            name: path.basename(resolvedPath)
        };
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Lấy thông tin hệ thống
 */
async function getSystemInfo() {
    const diagnostics = await runDiagnostics();
    return diagnostics;
}

// ==================== SEARCH ====================

/**
 * Tìm kiếm files recursive
 */
function searchFiles(params) {
    try {
        const { path: searchPath, query, extensions, minSize, maxSize, type } = params;
        let basePath = searchPath || process.cwd();
        if (!path.isAbsolute(basePath)) basePath = path.resolve(process.cwd(), basePath);

        if (!fs.existsSync(basePath)) {
            return { error: `Path not found: ${searchPath}` };
        }

        const results = [];
        const maxResults = 100;
        const maxDepth = 5;

        function walk(dir, depth) {
            if (depth > maxDepth || results.length >= maxResults) return;

            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                if (results.length >= maxResults) break;

                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
                const isDir = entry.isDirectory();

                if (type === 'file' && isDir) { if (isDir) walk(fullPath, depth + 1); continue; }
                if (type === 'directory' && !isDir) { continue; }

                let matches = true;

                if (query && !entry.name.toLowerCase().includes(query.toLowerCase())) {
                    matches = false;
                }

                if (matches && extensions && extensions.length > 0 && !isDir) {
                    const ext = entry.name.split('.').pop().toLowerCase();
                    if (!extensions.map(e => e.toLowerCase()).includes(ext)) matches = false;
                }

                if (matches && !isDir) {
                    try {
                        const stat = fs.statSync(fullPath);
                        if (minSize && stat.size < minSize) matches = false;
                        if (maxSize && stat.size > maxSize) matches = false;

                        if (matches) {
                            results.push({
                                name: entry.name,
                                path: relativePath,
                                isDirectory: false,
                                size: stat.size,
                                modifiedAt: stat.mtime.toISOString()
                            });
                        }
                    } catch { /* skip */ }
                } else if (matches && isDir) {
                    results.push({
                        name: entry.name,
                        path: relativePath,
                        isDirectory: true,
                        size: 0,
                        modifiedAt: null
                    });
                }

                if (isDir) walk(fullPath, depth + 1);
            }
        }

        walk(basePath, 0);
        return results;
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Preview file content
 */
function previewFile(params) {
    try {
        const { path: filePath, type: previewType, maxSize } = params;
        let resolvedPath = filePath;
        if (!path.isAbsolute(filePath)) resolvedPath = path.resolve(process.cwd(), filePath);

        if (!fs.existsSync(resolvedPath)) {
            return { error: `File not found: ${filePath}` };
        }

        const stat = fs.statSync(resolvedPath);
        const limit = maxSize || 50000;

        if (stat.size > limit) {
            if (previewType === 'text') {
                const fd = fs.openSync(resolvedPath, 'r');
                const buffer = Buffer.alloc(limit);
                fs.readSync(fd, buffer, 0, limit, 0);
                fs.closeSync(fd);
                return { content: buffer.toString('utf8'), truncated: true, totalSize: stat.size };
            }
            return { error: `File too large for preview (${(stat.size / 1024 / 1024).toFixed(1)}MB)` };
        }

        if (previewType === 'text') {
            const content = fs.readFileSync(resolvedPath, 'utf8');
            return { content, truncated: false, totalSize: stat.size };
        }

        if (previewType === 'image') {
            const content = fs.readFileSync(resolvedPath);
            return { content: content.toString('base64'), totalSize: stat.size };
        }

        return { error: 'Unsupported preview type' };
    } catch (err) {
        return { error: err.message };
    }
}

// ==================== WEBSOCKET CLIENT ====================

class NASAgent {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.reconnectDelay = 2000;
        this.maxReconnectDelay = 30000;
        this.isShuttingDown = false;
        this.diagnosticsCache = null;
    }

    async connect() {
        if (this.isShuttingDown) return;

        // Run diagnostics on first connect
        if (!this.diagnosticsCache) {
            this.diagnosticsCache = await runDiagnostics(this.config.sshPort);
        }

        console.log(`\n🔌 Connecting to ${this.config.server}...`);

        try {
            this.ws = new WebSocket(this.config.server);
        } catch (err) {
            console.error('❌ Connection error:', err.message);
            this._scheduleReconnect();
            return;
        }

        this.ws.on('open', () => {
            console.log('✅ Connected to NAS Server!');
            this.reconnectDelay = 2000;

            // Register with server — bao gồm thông tin SSH + network
            this._send({
                type: 'register',
                data: {
                    machineId: this.config.machineId,
                    machineName: this.config.name,
                    hostname: os.hostname(),
                    platform: os.platform(),
                    sharedPaths: this.config.paths,
                    // Extended info for server binding
                    networkInfo: {
                        ips: this.diagnosticsCache.ips,
                        primaryIP: this.diagnosticsCache.ips[0]?.address || null
                    },
                    sshInfo: {
                        available: this.diagnosticsCache.ssh.available,
                        port: this.config.sshPort,
                        banner: this.diagnosticsCache.ssh.banner || null,
                        username: this.config.sshUser || null,
                        password: this.config.sshPass || null
                    },
                    systemInfo: {
                        cpus: this.diagnosticsCache.cpus,
                        totalMemory: this.diagnosticsCache.totalMemory,
                        freeMemory: this.diagnosticsCache.freeMemory,
                        arch: this.diagnosticsCache.arch,
                        disks: this.diagnosticsCache.disks
                    }
                }
            });
        });

        this.ws.on('message', (data) => {
            this._handleMessage(data);
        });

        this.ws.on('close', () => {
            if (!this.isShuttingDown) {
                console.log('⚠️  Disconnected from server');
                this._scheduleReconnect();
            }
        });

        this.ws.on('error', (err) => {
            console.error('❌ WebSocket error:', err.message);
        });
    }

    _handleMessage(rawData) {
        try {
            const message = JSON.parse(rawData.toString());

            switch (message.type) {
                case 'registered':
                    console.log(`📋 ${message.data.message}`);
                    console.log(`⏰ Server time: ${message.data.serverTime}`);
                    // Update machineId if assigned by server
                    if (message.data.machineId && !this.config.machineId) {
                        this.config.machineId = message.data.machineId;
                        console.log(`🔗 Machine ID assigned: ${message.data.machineId}`);
                        // Save updated config
                        this._saveConfig();
                    }
                    this._printStatus();
                    break;

                case 'request':
                    this._handleRequest(message);
                    break;

                case 'heartbeat_ack':
                    break;

                default:
                    console.log('📨 Unknown message:', message.type);
            }
        } catch (err) {
            console.error('Error parsing message:', err.message);
        }
    }

    async _handleRequest(message) {
        const { requestId, action, params } = message;

        let result;
        switch (action) {
            case 'list_files':
                console.log(`📂 List files: ${params.path}`);
                result = listFiles(params.path);
                break;

            case 'read_file':
                console.log(`📄 Read file: ${params.path}`);
                result = readFile(params.path);
                break;

            case 'search_files':
                console.log(`🔍 Search: "${params.query}" in ${params.path}`);
                result = searchFiles(params);
                break;

            case 'preview_file':
                console.log(`👁️ Preview: ${params.path}`);
                result = previewFile(params);
                break;

            case 'system_info':
                console.log('💻 System info requested');
                result = await getSystemInfo();
                break;

            case 'check_ssh':
                console.log('🔐 SSH check requested');
                result = await checkLocalSSH(params.port || this.config.sshPort);
                break;

            // === FILE MANIPULATION ===
            case 'create_directory':
                try {
                    console.log(`📁 Create directory: ${params.path}`);
                    if (!params.path) throw new Error('Path required');
                    const target = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);
                    if (fs.existsSync(target)) throw new Error('Directory already exists');
                    fs.mkdirSync(target, { recursive: true });
                    result = { success: true, path: target };
                } catch (e) { result = { error: e.message }; }
                break;

            case 'rename_item':
                try {
                    console.log(`✏️ Rename: ${params.path} -> ${params.newName}`);
                    if (!params.path || !params.newName) throw new Error('Path and newName required');

                    const oldPath = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);
                    if (!fs.existsSync(oldPath)) throw new Error('Source path not found');

                    const dir = path.dirname(oldPath);
                    const newPath = path.join(dir, params.newName);

                    if (fs.existsSync(newPath)) throw new Error('Destination path already exists');

                    fs.renameSync(oldPath, newPath);
                    result = { success: true, newPath };
                } catch (e) { result = { error: e.message }; }
                break;

            case 'delete_item':
                try {
                    console.log(`🗑️ Delete: ${params.path}`);
                    if (!params.path) throw new Error('Path required');
                    const target = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);

                    if (!fs.existsSync(target)) throw new Error('Path not found');

                    // Safety check: Don't delete root or critical system paths
                    if (path.parse(target).root === target) throw new Error('Cannot delete root directory');

                    const stat = fs.statSync(target);
                    if (stat.isDirectory()) {
                        fs.rmSync(target, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(target);
                    }
                    result = { success: true };
                } catch (e) { result = { error: e.message }; }
                break;

            case 'write_file':
                try {
                    console.log(`💾 Write file: ${params.path} (${(params.content.length * 0.75 / 1024).toFixed(1)} KB)`);
                    if (!params.path || !params.content) throw new Error('Path and content required');

                    const target = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);
                    // Ensure directory exists
                    const dir = path.dirname(target);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    const buffer = Buffer.from(params.content, 'base64');
                    fs.writeFileSync(target, buffer);

                    result = { success: true, size: buffer.length };
                } catch (e) { result = { error: e.message }; }
                break;

            default:
                result = { error: `Unknown action: ${action}` };
        }

        if (result && result.error) {
            this._send({ type: 'response', requestId, error: result.error });
        } else {
            this._send({ type: 'response', requestId, data: result });
        }
    }

    _send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    _scheduleReconnect() {
        if (this.isShuttingDown) return;

        console.log(`🔄 Reconnecting in ${this.reconnectDelay / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }

    _printStatus() {
        const ssh = this.diagnosticsCache?.ssh;
        const ips = this.diagnosticsCache?.ips || [];

        console.log('\n' + '═'.repeat(55));
        console.log('  NAS Agent v2.0 — Status');
        console.log('═'.repeat(55));
        console.log(`  Machine ID:   ${this.config.machineId || 'Not assigned'}`);
        console.log(`  Agent Name:   ${this.config.name}`);
        console.log(`  Hostname:     ${os.hostname()}`);
        console.log(`  Platform:     ${os.platform()} ${os.arch()}`);
        console.log(`  Network IPs:  ${ips.map(ip => ip.address).join(', ') || 'None'}`);
        console.log(`  SSH:          ${ssh?.available ? `✅ Port ${ssh.port}` : '❌ Not available'}`);
        console.log(`  Shared Paths: ${this.config.paths.join(', ')}`);
        console.log(`  Server:       ${this.config.server}`);
        console.log(`  Status:       🟢 Connected`);
        console.log('═'.repeat(55) + '\n');
    }

    _saveConfig() {
        const savedConfig = {
            server: this.config.server,
            machineId: this.config.machineId,
            paths: this.config.paths,
            name: this.config.name,
            sshUser: this.config.sshUser,
            sshPass: this.config.sshPass,
            sshPort: this.config.sshPort
        };
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfig, null, 2));
        } catch { /* ignore */ }
    }

    shutdown() {
        this.isShuttingDown = true;
        console.log('\n👋 Agent shutting down...');
        if (this.ws) {
            this.ws.close();
        }
        process.exit(0);
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this._send({ type: 'heartbeat' });
            }
        }, 25000);
    }
}

// ==================== MAIN ====================

async function main() {
    const config = parseArgs();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           NAS Manager Agent v2.0                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Setup mode
    if (config.setup) {
        const { config: updatedConfig } = await runSetup(config);
        // Hỏi có muốn chạy agent luôn không
        if (updatedConfig.machineId) {
            console.log('\n🚀 Starting agent with saved config...\n');
            const agent = new NASAgent(updatedConfig);
            await agent.connect();
            agent.startHeartbeat();

            process.on('SIGINT', () => agent.shutdown());
            process.on('SIGTERM', () => agent.shutdown());
        }
        return;
    }

    // Normal mode
    if (!config.machineId) {
        console.log('\n⚠️  No machine-id specified. Running --setup to bind.');
        console.log('    Or provide: --machine-id <ID>\n');
        const { config: updatedConfig } = await runSetup(config);
        if (!updatedConfig.machineId) {
            console.log('\n❌ Cannot start without machine ID. Exiting.');
            process.exit(1);
        }
        config.machineId = updatedConfig.machineId;
    }

    const agent = new NASAgent(config);
    await agent.connect();
    agent.startHeartbeat();

    process.on('SIGINT', () => agent.shutdown());
    process.on('SIGTERM', () => agent.shutdown());
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
});
