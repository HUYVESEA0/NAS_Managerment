#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                NASHub Agent v2.0                         ║
 * ║  Chạy trên máy remote để chia sẻ thư mục với server     ║
 * ║  Hỗ trợ: SSH check, auto-bind, file ops, search, preview║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Usage:
 *   node client_connect.js --server ws://192.168.1.x:3001/ws/agent --machine-id 1
 *   node client_connect.js --setup --server ws://192.168.1.x:3001/ws/agent
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
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execSync } = require('child_process');

// ==================== FILE LOGGER ====================
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = {
    _write(level, msg, meta) {
        const ts = new Date().toISOString();
        const line = meta && Object.keys(meta).length > 0
            ? `[${ts}] [${level}] ${msg} ${JSON.stringify(meta)}`
            : `[${ts}] [${level}] ${msg}`;
        const date = ts.slice(0, 10);
        fs.appendFile(path.join(LOG_DIR, `agent-${date}.log`), line + '\n', () => {});
        if (level === 'ERROR') console.error(line);
        else if (level === 'WARN') console.warn(line);
        else console.log(line);
    },
    info(msg, meta) { this._write('INFO', msg, meta); },
    warn(msg, meta) { this._write('WARN', msg, meta); },
    error(msg, meta) { this._write('ERROR', msg, meta); },
};

// Config file path
const CONFIG_FILE = path.join(__dirname, 'client_connect.config.json');

// ==================== PATH SECURITY ====================

/**
 * Kiểm tra xem requestedPath có nằm trong danh sách allowedPaths không.
 * Bảo vệ khỏi path traversal (../../etc/passwd)
 * @param {string} requestedPath
 * @param {string[]} allowedPaths
 * @returns {{ allowed: boolean, resolved: string|null }}
 */
function isPathAllowed(requestedPath, allowedPaths) {
    if (!allowedPaths || allowedPaths.length === 0) return { allowed: true, resolved: requestedPath };

    let resolved = requestedPath;
    if (!path.isAbsolute(requestedPath)) {
        resolved = path.resolve(process.cwd(), requestedPath);
    }
    resolved = path.normalize(resolved);

    for (const allowed of allowedPaths) {
        const normalizedAllowed = path.normalize(path.resolve(allowed));
        // Path must be exactly the allowed dir, or a child of it
        if (resolved === normalizedAllowed || resolved.startsWith(normalizedAllowed + path.sep)) {
            return { allowed: true, resolved };
        }
    }
    return { allowed: false, resolved };
}

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
  node client_connect.js --server <ws_url> --machine-id <id> [options]
  node client_connect.js --setup --server <ws_url>

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
  node client_connect.js -s ws://192.168.1.100:3001/ws/agent -m 1
  node client_connect.js --setup -s ws://192.168.1.100:3001/ws/agent
  node client_connect.js -s ws://server:3001/ws/agent -m 2 -p "/home/user,/var/data"
  node client_connect.js -s ws://server:3001/ws/agent --ssh-user root --ssh-pass mypass
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
    console.log('║              NASHub Agent — Setup Wizard                 ║');
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
        console.log(`   node client_connect.js -s ${config.server} -m ${config.machineId}\n`);
        console.log(`   Or simply: node client_connect.js  (uses saved config)\n`);
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
function listFiles(targetPath, allowedPaths) {
    // Path check
    const raw = (!targetPath || targetPath === '.' || targetPath === '')
        ? (allowedPaths && allowedPaths.length > 0 ? null : process.cwd())
        : targetPath;

    // If path is '.' or empty and we have allowedPaths — list root entries of each allowed path
    if (!raw && allowedPaths && allowedPaths.length > 0) {
        const entries = [];
        for (const ap of allowedPaths) {
            const norm = path.normalize(path.resolve(ap));
            if (!fs.existsSync(norm)) continue;
            entries.push({
                name: norm.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || norm,
                isDirectory: true,
                size: 0,
                modifiedAt: null,
                path: norm.replace(/\\/g, '/'),
                isRoot: true
            });
        }
        return entries;
    }

    // Enforce allowed paths
    if (allowedPaths && allowedPaths.length > 0) {
        const { allowed, resolved } = isPathAllowed(raw, allowedPaths);
        if (!allowed) return { error: `Access denied: '${raw}' is outside allowed paths` };
    }

    let resolvedPath = raw;
    if (!path.isAbsolute(raw)) resolvedPath = path.resolve(process.cwd(), raw);

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
}

/**
 * Đọc file content (base64)
 */
async function readFile(filePath) {
    try {
        let resolvedPath = filePath;
        if (!path.isAbsolute(filePath)) {
            resolvedPath = path.resolve(process.cwd(), filePath);
        }

        if (!fs.existsSync(resolvedPath)) {
            return { error: `File not found: ${filePath}` };
        }

        const stat = await fs.promises.stat(resolvedPath);
        if (stat.isDirectory()) {
            return { error: 'Cannot read directory as file' };
        }

        if (stat.size > 100 * 1024 * 1024) {
            return { error: 'File too large (max 100MB)' };
        }

        const content = await fs.promises.readFile(resolvedPath);
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
 * Tìm kiếm files recursive (Async + Non-blocking)
 */
async function searchFiles(params) {
    try {
        const { path: searchPath, query, extensions, minSize, maxSize, type, configPaths } = params;

        // Xác định danh sách đường dẫn cần lùng sục
        let pathsToSearch = [];
        if (!searchPath || searchPath === '/' || searchPath === '.') {
            pathsToSearch = (configPaths && configPaths.length > 0) ? configPaths : [process.cwd()];
        } else {
            let basePath = searchPath;
            if (!path.isAbsolute(basePath)) basePath = path.resolve(process.cwd(), basePath);
            pathsToSearch = [basePath];
        }

        const results = [];
        const maxResults = 100;
        const maxDepth = 8;
        let filesScanned = 0;

        async function walk(dir, depth, basePathForRelative) {
            if (depth > maxDepth || results.length >= maxResults) return;

            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                if (results.length >= maxResults) break;

                // Tránh block event loop (để agent vẫn phản hồi heartbeat của server)
                filesScanned++;
                if (filesScanned % 100 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }

                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(basePathForRelative, fullPath).replace(/\\/g, '/');
                const isDir = entry.isDirectory();

                if (type === 'file' && isDir) { await walk(fullPath, depth + 1, basePathForRelative); continue; }
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
                        const stat = await fs.promises.stat(fullPath);
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

                if (isDir) {
                    await walk(fullPath, depth + 1, basePathForRelative);
                }
            }
        }

        for (const basePath of pathsToSearch) {
            if (results.length >= maxResults) break;
            if (fs.existsSync(basePath)) {
                await walk(basePath, 0, basePath);
            }
        }

        return results;
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Preview file content
 */
async function previewFile(params) {
    try {
        const { path: filePath, type: previewType, maxSize } = params;
        let resolvedPath = filePath;
        if (!path.isAbsolute(filePath)) resolvedPath = path.resolve(process.cwd(), filePath);

        if (!fs.existsSync(resolvedPath)) {
            return { error: `File not found: ${filePath}` };
        }

        const stat = await fs.promises.stat(resolvedPath);
        const limit = maxSize || 50000;

        if (stat.size > limit) {
            if (previewType === 'text') {
                const handle = await fs.promises.open(resolvedPath, 'r');
                const buffer = Buffer.alloc(limit);
                await handle.read(buffer, 0, limit, 0);
                await handle.close();
                return { content: buffer.toString('utf8'), truncated: true, totalSize: stat.size };
            }
            return { error: `File too large for preview (${(stat.size / 1024 / 1024).toFixed(1)}MB)` };
        }

        if (previewType === 'text') {
            const content = await fs.promises.readFile(resolvedPath, 'utf8');
            return { content, truncated: false, totalSize: stat.size };
        }

        if (previewType === 'image') {
            const content = await fs.promises.readFile(resolvedPath);
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
            logger.error('Connection error', { error: err.message });
            this._scheduleReconnect();
            return;
        }

        this.ws.on('open', () => {
            logger.info('Connected to NASHub Server');
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
                logger.warn('Disconnected from server');
                this._scheduleReconnect();
            }
        });

        this.ws.on('error', (err) => {
            logger.error('WebSocket error', { error: err.message });
        });
    }

    _handleMessage(rawData) {
        try {
            const message = JSON.parse(rawData.toString());

            switch (message.type) {
                case 'registered':
                    logger.info(`Registered: ${message.data.message}`);
                    console.log(`⏰ Server time: ${message.data.serverTime}`);
                    // Update machineId if assigned by server
                    if (message.data.machineId && !this.config.machineId) {
                        this.config.machineId = message.data.machineId;
                        logger.info(`Machine ID assigned: ${message.data.machineId}`);
                        this._saveConfig();
                    }
                    // Server pushes configured paths — override local
                    if (message.data.configuredPaths && Array.isArray(message.data.configuredPaths)) {
                        this.config.paths = message.data.configuredPaths;
                        logger.info('Paths configured by server', { paths: this.config.paths });
                        this._saveConfig();
                    }
                    this._printStatus();
                    break;

                case 'update_paths':
                    if (message.data && Array.isArray(message.data.paths)) {
                        this.config.paths = message.data.paths;
                        logger.info('Paths updated by server', { paths: this.config.paths });
                        this._saveConfig();
                    }
                    break;

                case 'request':
                    if (!this._verifyRequestSecurity(message)) {
                        this._send({
                            type: 'response',
                            requestId: message.requestId,
                            error: 'Invalid request signature'
                        });
                        return;
                    }
                    this._handleRequest(message);
                    break;

                case 'heartbeat_ack':
                    break;

                default:
                    logger.warn('Unknown message type', { type: message.type });
            }
        } catch (err) {
            logger.error('Error parsing message', { error: err.message });
        }
    }

    _verifyRequestSecurity(message) {
        const secret = process.env.WS_AGENT_SHARED_SECRET;
        if (!secret) return true; // Backward compatibility when shared secret is not configured

        const sec = message.security || {};
        if (!sec.ts || !sec.sig) {
            logger.warn('Rejected unsigned request', { requestId: message.requestId, action: message.action });
            return false;
        }

        const skewMs = Math.abs(Date.now() - Number(sec.ts));
        if (Number.isNaN(skewMs) || skewMs > 5 * 60 * 1000) {
            logger.warn('Rejected request outside signature time window', { requestId: message.requestId, action: message.action });
            return false;
        }

        const payload = `${message.requestId}|${message.action}|${sec.ts}|${JSON.stringify(message.params || {})}`;
        const expectedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        const expected = Buffer.from(expectedHex, 'hex');
        const actual = Buffer.from(String(sec.sig), 'hex');
        if (expected.length !== actual.length) return false;

        return crypto.timingSafeEqual(expected, actual);
    }

    async _handleRequest(message) {
        const { requestId, action, params } = message;

        const configPaths = params.isAdmin ? null : this.config.paths;
        if (params.isAdmin && action !== 'system_info') {
            logger.info('Admin bypass: configured paths restrictions skipped', { action });
        }

        let result;
        switch (action) {
            case 'list_files':
                logger.info(`List files: ${params.path}`);
                result = listFiles(params.path, configPaths);
                break;

            case 'read_file': {
                logger.info(`Read file: ${params.path}`);
                if (configPaths && configPaths.length > 0) {
                    const { allowed } = isPathAllowed(params.path, configPaths);
                    if (!allowed) { result = { error: `Access denied: '${params.path}' is outside allowed paths` }; break; }
                }
                result = await readFile(params.path);
                break;
            }

            case 'search_files':
                console.log(`🔍 Search: "${params.query}" in ${params.path}`);
                result = await searchFiles({ ...params, configPaths: configPaths });
                break;

            case 'preview_file':
                console.log(`👁️ Preview: ${params.path}`);
                result = await previewFile(params);
                break;

            case 'system_info':
                logger.info('System info requested');
                result = await getSystemInfo();
                break;

            case 'check_ssh':
                logger.info('SSH check requested');
                result = await checkLocalSSH(params.port || this.config.sshPort);
                break;

            // === FILE MANIPULATION ===
            case 'create_directory':
                try {
                    logger.info(`Create directory: ${params.path}`);
                    if (!params.path) throw new Error('Path required');
                    if (configPaths && configPaths.length > 0) {
                        const { allowed } = isPathAllowed(params.path, configPaths);
                        if (!allowed) throw new Error(`Access denied: outside allowed paths`);
                    }
                    const target = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);
                    if (fs.existsSync(target)) throw new Error('Directory already exists');
                    fs.mkdirSync(target, { recursive: true });
                    result = { success: true, path: target };
                } catch (e) { result = { error: e.message }; }
                break;

            case 'rename_item':
                try {
                    logger.info(`Rename: ${params.path} -> ${params.newName}`);
                    if (!params.path || !params.newName) throw new Error('Path and newName required');
                    if (configPaths && configPaths.length > 0) {
                        const { allowed } = isPathAllowed(params.path, configPaths);
                        if (!allowed) throw new Error(`Access denied: outside allowed paths`);
                    }
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
                    logger.info(`Delete: ${params.path}`);
                    if (!params.path) throw new Error('Path required');
                    if (configPaths && configPaths.length > 0) {
                        const { allowed } = isPathAllowed(params.path, configPaths);
                        if (!allowed) throw new Error(`Access denied: outside allowed paths`);
                    }
                    const target = path.isAbsolute(params.path) ? params.path : path.resolve(process.cwd(), params.path);
                    if (!fs.existsSync(target)) throw new Error('Path not found');
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
                    logger.info(`Write file: ${params.path}`, { size: `${(params.content.length * 0.75 / 1024).toFixed(1)} KB` });
                    if (!params.path || !params.content) throw new Error('Path and content required');
                    const writePath = path.normalize(params.path.replace(/\/+/g, '/').replace(/\\+/g, '\\'));
                    if (configPaths && configPaths.length > 0) {
                        const { allowed } = isPathAllowed(writePath, configPaths);
                        if (!allowed) throw new Error(`Access denied: outside allowed paths`);
                    }
                    const target = path.isAbsolute(writePath) ? writePath : path.resolve(process.cwd(), writePath);
                    const dir = path.dirname(target);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    const buffer = Buffer.from(params.content, 'base64');
                    fs.writeFileSync(target, buffer);
                    result = { success: true, size: buffer.length };
                } catch (e) { result = { error: e.message }; }
                break;

            case 'receive_file_stream': {
                // Receive incoming file sent chunk-by-chunk from server relay
                // params: { path, chunkIndex, totalChunks, data (base64), complete }
                try {
                    if (!params.path) throw new Error('Path required');
                    // Normalize: collapse double slashes, convert forward→back on Windows
                    const recvPath = path.normalize(params.path.replace(/\/+/g, '/').replace(/\\+/g, '\\'));
                    if (configPaths && configPaths.length > 0) {
                        const { allowed } = isPathAllowed(recvPath, configPaths);
                        if (!allowed) throw new Error(`Access denied: '${recvPath}' is outside allowed paths`);
                    }
                    const absPath = path.isAbsolute(recvPath) ? recvPath : path.resolve(process.cwd(), recvPath);
                    const dir = path.dirname(absPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    const chunkBuf = Buffer.from(params.data || '', 'base64');

                    if (params.chunkIndex === 0 && !params.append) {
                        // First chunk — (over)write file
                        fs.writeFileSync(absPath, chunkBuf);
                    } else {
                        // Subsequent chunks — append
                        fs.appendFileSync(absPath, chunkBuf);
                    }

                    if (params.complete) {
                        logger.info(`receive_file_stream complete: ${absPath}`);
                        result = { success: true, path: absPath };
                    } else {
                        result = { success: true, chunkIndex: params.chunkIndex };
                    }
                } catch (e) { result = { error: e.message }; }
                break;
            }

            case 'download_file_stream': {
                // Chunked streaming download — handles files of any size
                const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk
                const targetPath = path.normalize((params.path || '').replace(/\/+/g, '/').replace(/\\+/g, '\\'));
                logger.info(`Stream download: ${targetPath}`);

                if (configPaths && configPaths.length > 0) {
                    const { allowed } = isPathAllowed(targetPath, configPaths);
                    if (!allowed) {
                        this._send({ type: 'response', requestId, error: `Access denied: '${targetPath}' is outside allowed paths` });
                        return;
                    }
                }

                let fileStat;
                try {
                    fileStat = await fs.promises.stat(targetPath);
                } catch {
                    this._send({ type: 'response', requestId, error: `File not found: ${targetPath}` });
                    return;
                }

                if (fileStat.isDirectory()) {
                    this._send({ type: 'response', requestId, error: 'Cannot download a directory' });
                    return;
                }

                // Send metadata first so server can prepare the HTTP response
                this._send({
                    type: 'response',
                    requestId,
                    data: { status: 'streaming', size: fileStat.size, name: path.basename(targetPath) }
                });

                // Stream file in chunks
                const readStream = fs.createReadStream(targetPath, { highWaterMark: CHUNK_SIZE });
                readStream.on('data', (chunk) => {
                    readStream.pause();
                    this._send({ type: 'stream_chunk', requestId, data: chunk.toString('base64'), last: false });
                    // Small delay to avoid flooding the WebSocket buffer
                    setImmediate(() => readStream.resume());
                });
                readStream.on('end', () => {
                    this._send({ type: 'stream_chunk', requestId, data: '', last: true });
                    logger.info(`Stream download complete: ${targetPath}`);
                });
                readStream.on('error', (err) => {
                    this._send({ type: 'response', requestId, error: `Read error: ${err.message}` });
                });
                return; // Skip normal result handling
            }

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
        logger.info(`Reconnecting in ${this.reconnectDelay / 1000}s`);
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }

    _printStatus() {
        const ssh = this.diagnosticsCache?.ssh;
        const ips = this.diagnosticsCache?.ips || [];

        console.log('\n' + '═'.repeat(55));
        console.log('  NASHub Agent v2.0 — Status');
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
    console.log('║                   NASHub Agent v2.0                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Setup mode — chỉ cấu hình, không chạy agent
    if (config.setup) {
        const { config: updatedConfig } = await runSetup(config);
        if (updatedConfig.machineId) {
            console.log('\n✅ Setup hoàn tất. Dùng lệnh sau để chạy client connect:');
            console.log(`   node client_connect.js\n`);
        }
        process.exit(0);
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
