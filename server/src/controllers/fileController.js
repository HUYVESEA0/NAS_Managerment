const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const agentManager = require('../utils/agentManager');
const notificationHub = require('../utils/notificationHub');
const { logActivity } = require('../utils/activityService');
const { decryptSecret } = require('../utils/credentialCrypto');

// Base storage directory for simulation
const STORAGE_ROOT = path.join(__dirname, '../../storage');

// Allowed text extensions for file editing (whitelist — backend-enforced)
const EDITABLE_EXTENSIONS = new Set([
    '.txt', '.md', '.json', '.js', '.cjs', '.mjs', '.ts', '.jsx', '.tsx',
    '.css', '.scss', '.sass', '.less', '.html', '.htm', '.xml', '.svg',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
    '.sh', '.bash', '.zsh', '.fish', '.bat', '.ps1', '.cmd',
    '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
    '.go', '.rs', '.swift', '.kt', '.cs', '.sql', '.log', '.csv', '.tsv',
    '.gradle', '.gitignore', '.dockerignore', '.editorconfig'
]);

// Max content size allowed for text editing (5 MB)
const MAX_EDIT_BYTES = 5 * 1024 * 1024;

/**
 * Sanitize a path input to block null-byte injection.
 * @param {string} inputPath
 * @returns {string} trimmed path
 * @throws if path is empty, not a string, or contains null bytes
 */
function sanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        const err = new Error('Invalid path');
        err.status = 400;
        throw err;
    }
    if (inputPath.includes('\0')) {
        const err = new Error('Invalid path: null byte detected');
        err.status = 400;
        throw err;
    }
    return inputPath.trim();
}

function getDecryptedMachinePassword(machine) {
    if (!machine?.password) return null;
    return decryptSecret(machine.password);
}

// List files in a directory
exports.listFiles = async (req, res) => {
    try {
        const { machineId, path: queryPath } = req.query;

        if (!machineId) return res.status(400).json({ error: 'machineId is required' });

        // Validate machine exists
        const isMaster = machineId === 'master';
        const machine = isMaster
            ? { id: 'master', name: 'Master Node', ipAddress: null, username: null, password: null }
            : await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket (máy remote đã bind) ===
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const remotePath = queryPath || '.';
                const files = await agentManager.sendRequest(parseInt(machineId), 'list_files', {
                    path: remotePath,
                    isAdmin: isAdminUser
                });

                return res.json(files);
            } catch (agentError) {
                console.error('Agent Error:', agentError.message);
                return res.status(502).json({ error: `Agent Error: ${agentError.message}` });
            }
        }

        // === PRIORITY 2: SSH Connection ===
        const machinePassword = getDecryptedMachinePassword(machine);
        if (!isMaster && machine.ipAddress && machine.username && machinePassword) {
            const sshService = require('../utils/sshService');
            const remotePath = queryPath || '.';

            try {
                const files = await sshService.listFiles({
                    host: machine.ipAddress,
                    port: machine.port,
                    username: machine.username,
                    password: machinePassword
                }, remotePath);

                const normalizedFiles = files.map(f => ({
                    ...f,
                    path: f.path.replace(/\\/g, '/')
                }));

                return res.json(normalizedFiles);
            } catch (sshError) {
                console.error(`SSH Error on Machine ${machineId}:`, sshError.message);
                // Fallthrough to Local Simulation
            }
        }

        // === PRIORITY 3: Local Simulation / Master Node ===
        let absolutePath;
        if (isMaster) {
            const raw = (!queryPath || queryPath === '.' || queryPath === '') ? process.cwd() : queryPath;
            absolutePath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
        } else {
            const safeQueryPath = queryPath ? path.normalize(queryPath).replace(/^(\.\.[\/\\])+/, '') : '';
            const safePath = safeQueryPath.replace(/:/g, ''); // Fix: Windows drive letter cannot be a folder name
            absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safePath);
        }

        if (!fs.existsSync(absolutePath)) {
            if (!isMaster) fs.mkdirSync(absolutePath, { recursive: true });
            else return res.status(404).json({ error: 'Path not found on Master Node' });
        }

        const files = fs.readdirSync(absolutePath, { withFileTypes: true }).map(dirent => {
            let size = 0;
            if (dirent.isFile()) {
                try { size = fs.statSync(path.join(absolutePath, dirent.name)).size; } catch (e) { }
            }
            return {
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                size,
                path: isMaster ? path.join(absolutePath, dirent.name).replace(/\\/g, '/') : path.join(queryPath ? queryPath.replace(/:/g, '') : '', dirent.name).replace(/\\/g, '/')
            }
        });

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Download file
exports.downloadFile = async (req, res) => {
    try {
        const { machineId, path: filePath } = req.query;

        if (!machineId || !filePath) {
            return res.status(400).json({ error: 'machineId and path are required' });
        }

        try { sanitizePath(filePath); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

        const isMaster = machineId === 'master';
        const machine = isMaster
            ? { id: 'master', name: 'Master Node', ipAddress: null, username: null, password: null }
            : await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket (chunked streaming — no size limit) ===
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const { stream, size, name } = await agentManager.streamDownload(
                    parseInt(machineId), filePath, isAdminUser
                );
                const fileName = name || path.basename(filePath);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                if (size) res.setHeader('Content-Length', size);
                logActivity({ category: 'file', action: 'download', message: `Downloaded "${fileName}" from machine ${machineId}`, userId: req.user?.id, machineId: parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
                stream.on('error', () => { /* response may already be streaming */ });
                return stream.pipe(res);
            } catch (agentError) {
                const msg = agentError.message;
                if (msg.includes('not found') || msg.includes('Not found')) {
                    return res.status(404).json({ error: msg });
                }
                if (msg.includes('Access denied') || msg.includes('outside allowed') || msg.includes('directory')) {
                    return res.status(400).json({ error: msg });
                }
                return res.status(502).json({ error: `Agent Error: ${msg}` });
            }
        }

        // === PRIORITY 2: SSH / SFTP ===
        const machinePassword = getDecryptedMachinePassword(machine);
        if (!isMaster && machine.ipAddress && machine.username && machinePassword) {
            const sshService = require('../utils/sshService');
            try {
                const { stream, size, name } = await sshService.downloadFile({
                    host: machine.ipAddress,
                    port: machine.port,
                    username: machine.username,
                    password: machinePassword
                }, filePath);

                res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                if (size) res.setHeader('Content-Length', size);
                logActivity({ category: 'file', action: 'download', message: `Downloaded "${name}" from machine ${machineId} via SSH`, userId: req.user?.id, machineId: parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
                return stream.pipe(res);
            } catch (sshError) {
                console.error(`SSH Download Error on machine ${machineId}:`, sshError.message);
                return res.status(503).json({ error: `Cannot download file: ${sshError.message}` });
            }
        }

        // === PRIORITY 3: Local Simulation / Master Node ===
        // For non-master machines, only use local simulation for relative/simulation paths.
        // If the path looks like a real absolute path (has drive letter e.g. D:/...) and
        // neither agent nor SSH is available, return a clear 503 instead of a confusing 404.
        if (!isMaster) {
            const isRealAbsolutePath = /^[a-zA-Z]:[/\\]/.test(filePath) || (filePath.startsWith('/') && filePath.length > 1);
            if (isRealAbsolutePath) {
                return res.status(503).json({
                    error: `Machine ${machine.name || machineId} is offline and no SSH credentials are configured. Cannot download "${path.basename(filePath)}".`
                });
            }
        }

        let absolutePath;
        if (isMaster) {
            absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        } else {
            const safeFilePath = path.normalize(filePath.replace(/:/g, '')).replace(/^(\.\.[/\\])+/, '');
            absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safeFilePath);
        }

        if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
            return res.status(404).json({ error: 'File not found' });
        }
        const fileName = path.basename(absolutePath);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        logActivity({ category: 'file', action: 'download', message: `Downloaded "${fileName}" from machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
        return res.sendFile(absolutePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Transfer file between two machines — server acts as relay (LAN-to-LAN aware)
// POST /api/files/transfer  body: { fromMachineId, toMachineId, sourcePath, destPath }
//
// Priority system (best for LAN):
//   1. SSH → SSH   : SFTP stream piped directly (fastest, no WebSocket overhead)
//   2. Agent → SSH : WebSocket download + SFTP upload
//   3. Agent → Agent: WebSocket relay (both in sendRequest chunks — works everywhere)
exports.transferFile = async (req, res) => {
    try {
        const { fromMachineId, toMachineId, sourcePath, destPath } = req.body;

        if (!fromMachineId || !toMachineId || !sourcePath || !destPath) {
            return res.status(400).json({ error: 'fromMachineId, toMachineId, sourcePath and destPath are required' });
        }
        if (String(fromMachineId) === String(toMachineId)) {
            return res.status(400).json({ error: 'Source and destination machines must be different' });
        }

        const srcMachine = await prisma.machine.findUnique({ where: { id: parseInt(fromMachineId) } });
        const dstMachine = await prisma.machine.findUnique({ where: { id: parseInt(toMachineId) } });
        if (!srcMachine) return res.status(404).json({ error: `Source machine ${fromMachineId} not found` });
        if (!dstMachine) return res.status(404).json({ error: `Destination machine ${toMachineId} not found` });

        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        const srcPassword = getDecryptedMachinePassword(srcMachine);
        const dstPassword = getDecryptedMachinePassword(dstMachine);
        const srcHasSSH  = !!(srcMachine.ipAddress && srcMachine.username && srcPassword);
        const dstHasSSH  = !!(dstMachine.ipAddress && dstMachine.username && dstPassword);
        const srcHasAgent = agentManager.isAgentConnected(parseInt(fromMachineId));
        const dstHasAgent = agentManager.isAgentConnected(parseInt(toMachineId));

        // Must have at least one way to access each machine
        if (!srcHasSSH && !srcHasAgent) {
            return res.status(503).json({ error: `Source machine "${srcMachine.name}" is offline and has no SSH credentials` });
        }
        if (!dstHasSSH && !dstHasAgent) {
            return res.status(503).json({ error: `Destination machine "${dstMachine.name}" is offline and has no SSH credentials` });
        }

        const sshService = require('../utils/sshService');
        let size = 0;
        let name = path.basename(sourcePath);
        let method = '';

        // ── PRIORITY 1: SSH → SSH  (LAN optimal — direct SFTP pipe) ──
        if (srcHasSSH && dstHasSSH) {
            method = 'sftp→sftp';
            const srcConfig = { host: srcMachine.ipAddress, port: srcMachine.port, username: srcMachine.username, password: srcPassword };
            const dstConfig = { host: dstMachine.ipAddress, port: dstMachine.port, username: dstMachine.username, password: dstPassword };
            const { stream: srcStream, size: srcSize, name: srcName } = await sshService.downloadFile(srcConfig, sourcePath);
            name = srcName;
            const result = await sshService.uploadFile(dstConfig, destPath, srcStream, srcSize);
            size = result.size;

        // ── PRIORITY 2: Agent → SSH  (source online via agent, dest via SFTP) ──
        } else if (srcHasAgent && dstHasSSH) {
            method = 'agent→sftp';
            const dstConfig = { host: dstMachine.ipAddress, port: dstMachine.port, username: dstMachine.username, password: dstPassword };
            const { stream: srcStream, size: srcSize, name: srcName } = await agentManager.streamDownload(parseInt(fromMachineId), sourcePath, isAdminUser);
            name = srcName;
            const result = await sshService.uploadFile(dstConfig, destPath, srcStream, srcSize);
            size = result.size;

        // ── PRIORITY 3: SSH → Agent  (source via SFTP, dest via agent receive_file_stream) ──
        } else if (srcHasSSH && dstHasAgent) {
            method = 'sftp→agent';
            const srcConfig = { host: srcMachine.ipAddress, port: srcMachine.port, username: srcMachine.username, password: srcPassword };
            const { stream: srcStream, size: srcSize, name: srcName } = await sshService.downloadFile(srcConfig, sourcePath);
            name = srcName;
            const { PassThrough } = require('stream');
            // Collect stream into buffer then relay as chunks to agent
            const chunks = [];
            await new Promise((resolve, reject) => {
                srcStream.on('data', c => chunks.push(c));
                srcStream.on('end', resolve);
                srcStream.on('error', reject);
            });
            const totalBuf = Buffer.concat(chunks);
            size = totalBuf.length;
            const CHUNK = 2 * 1024 * 1024;
            const totalChunks = Math.ceil(size / CHUNK);
            for (let i = 0; i < totalChunks; i++) {
                const slice = totalBuf.slice(i * CHUNK, (i + 1) * CHUNK);
                await agentManager.sendRequest(parseInt(toMachineId), 'receive_file_stream', {
                    path: destPath,
                    chunkIndex: i,
                    append: i > 0,
                    data: slice.toString('base64'),
                    complete: i === totalChunks - 1,
                    isAdmin: isAdminUser
                }, 60000);
            }

        // ── PRIORITY 4: Agent → Agent  (WebSocket relay — universal fallback) ──
        } else {
            method = 'agent→agent';
            const result = await agentManager.relayFile(parseInt(fromMachineId), parseInt(toMachineId), sourcePath, destPath, isAdminUser);
            size = result.size;
            name = result.name;
        }

        logActivity({
            category: 'file',
            action: 'transfer',
            message: `Transferred "${name}" from "${srcMachine.name}" to "${dstMachine.name}" via ${method}`,
            userId: req.user?.id,
            ipAddress: req.ip,
            meta: { fromMachineId, toMachineId, sourcePath, destPath, size, method }
        });

        notificationHub.broadcast('file:created', { machineId: toMachineId, path: destPath });
        return res.json({ success: true, name, size, destPath, method });
    } catch (error) {
        console.error('Transfer error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Create Directory
exports.createDirectory = async (req, res) => {
    try {
        const { machineId, path: dirPath } = req.body;
        if (!machineId || !dirPath) return res.status(400).json({ error: 'Missing parameters' });

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket ===
        const isMaster = machineId === 'master';
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'create_directory', {
                path: dirPath,
                isAdmin: isAdminUser
            });
            if (result.error) return res.status(400).json({ error: result.error });
            notificationHub.broadcast('file:created', { machineId, path: dirPath });
            logActivity({ category: 'file', action: 'create_directory', message: `Created directory "${dirPath}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: dirPath } });
            return res.json(result);
        }

        // === PRIORITY 2 / PRIORITY 3: Local Simulation (master + fallback) ===
        let absolutePath;
        if (isMaster) {
            absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
        } else {
            const safePath = path.normalize(dirPath.replace(/:/g, '')).replace(/^(\.\.[\/\\])+/, '');
            absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safePath);
        }
        fs.mkdirSync(absolutePath, { recursive: true });
        notificationHub.broadcast('file:created', { machineId, path: dirPath });
        logActivity({ category: 'file', action: 'create_directory', message: `Created directory "${dirPath}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: dirPath } });
        return res.json({ success: true, path: dirPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Rename Item
exports.renameItem = async (req, res) => {
    try {
        const { machineId, path: itemPath, newName } = req.body;
        if (!machineId || !itemPath || !newName) return res.status(400).json({ error: 'Missing parameters' });

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket ===
        const isMaster = machineId === 'master';
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'rename_item', {
                path: itemPath,
                newName,
                isAdmin: isAdminUser
            });
            if (result.error) return res.status(400).json({ error: result.error });
            notificationHub.broadcast('file:renamed', { machineId, oldPath: itemPath, newPath: newName });
            logActivity({ category: 'file', action: 'rename', message: `Renamed "${itemPath}" to "${newName}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, oldPath: itemPath, newName } });
            return res.json(result);
        }

        // === PRIORITY 2 / PRIORITY 3: Local Simulation (master + fallback) ===
        let oldAbsolute, newAbsolute;
        if (machineId === 'master') {
            oldAbsolute = path.isAbsolute(itemPath) ? itemPath : path.resolve(process.cwd(), itemPath);
            newAbsolute = path.join(path.dirname(oldAbsolute), newName);
        } else {
            const safeOld = path.normalize(itemPath.replace(/:/g, '')).replace(/^(\.\.[/\\])+/, '');
            oldAbsolute = path.join(STORAGE_ROOT, `machine-${machineId}`, safeOld);
            newAbsolute = path.join(path.dirname(oldAbsolute), newName);
        }
        if (!fs.existsSync(oldAbsolute)) return res.status(404).json({ error: 'Item not found' });
        fs.renameSync(oldAbsolute, newAbsolute);
        notificationHub.broadcast('file:renamed', { machineId, oldPath: itemPath, newPath: newName });
        logActivity({ category: 'file', action: 'rename', message: `Renamed "${itemPath}" to "${newName}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, oldPath: itemPath, newName } });
        return res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Item
exports.deleteItem = async (req, res) => {
    try {
        const { machineId, path: itemPath } = req.body;
        if (!machineId || !itemPath) return res.status(400).json({ error: 'Missing parameters' });

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket ===
        const isMaster = machineId === 'master';
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'delete_item', {
                path: itemPath,
                isAdmin: isAdminUser
            });
            if (result.error) return res.status(400).json({ error: result.error });
            notificationHub.broadcast('file:deleted', { machineId, path: itemPath });
            logActivity({ category: 'file', action: 'delete', message: `Deleted "${itemPath}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: itemPath } });
            return res.json(result);
        }

        // === PRIORITY 2 / PRIORITY 3: Local Simulation (master + fallback) ===
        let absolutePath;
        if (machineId === 'master') {
            absolutePath = path.isAbsolute(itemPath) ? itemPath : path.resolve(process.cwd(), itemPath);
        } else {
            const safePath = path.normalize(itemPath.replace(/:/g, '')).replace(/^(\.\.[\/\\])+/, '');
            absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safePath);
        }
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Item not found' });

        if (fs.statSync(absolutePath).isDirectory()) {
            fs.rmSync(absolutePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(absolutePath);
        }
        notificationHub.broadcast('file:deleted', { machineId, path: itemPath });
        logActivity({ category: 'file', action: 'delete', message: `Deleted "${itemPath}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: itemPath } });
        return res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Upload File
exports.uploadFile = async (req, res) => {
    try {
        // Log request info for debug
        console.log(`📥 Upload request: ${req.file?.originalname} to ${req.body.path} on machine ${req.body.machineId}`);

        const { machineId, path: dirPath } = req.body;
        const file = req.file;

        if (!machineId || !dirPath || !file) {
            return res.status(400).json({ error: 'Missing parameters or file' });
        }

        // === CHECK ADMIN STATUS ===
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));

        // === PRIORITY 1: Agent WebSocket ===
        const isMaster = machineId === 'master';
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            const content = file.buffer.toString('base64');
            const safeDirPath = dirPath.replace(/\\/g, '/');
            const targetPath = safeDirPath.endsWith('/') ? `${safeDirPath}${file.originalname}` : `${safeDirPath}/${file.originalname}`;
            const result = await agentManager.sendRequest(parseInt(machineId), 'write_file', {
                path: targetPath,
                content,
                isAdmin: isAdminUser
            }, 60000);
            if (result.error) return res.status(400).json({ error: result.error });
            notificationHub.broadcast('file:uploaded', { machineId, path: targetPath });
            logActivity({ category: 'file', action: 'upload', message: `Uploaded "${file.originalname}" to machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: targetPath, size: file.size } });
            return res.json({ success: true, path: targetPath });
        }

        // === PRIORITY 2 / PRIORITY 3: Local Simulation (master + fallback) ===
        let targetDir, resultPath;
        if (machineId === 'master') {
            targetDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
            resultPath = `${dirPath.replace(/\\/g, '/')}/${file.originalname}`;
        } else {
            const safeDirPath = path.normalize(dirPath.replace(/:/g, '')).replace(/^(\.\.[/\\])+/, '');
            targetDir = path.join(STORAGE_ROOT, `machine-${machineId}`, safeDirPath);
            resultPath = `${safeDirPath}/${file.originalname}`.replace(/\\/g, '/');
        }

        fs.mkdirSync(targetDir, { recursive: true });
        const targetFile = path.join(targetDir, file.originalname);
        fs.writeFileSync(targetFile, file.buffer);

        notificationHub.broadcast('file:uploaded', { machineId, path: resultPath });
        logActivity({ category: 'file', action: 'upload', message: `Uploaded "${file.originalname}" to machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: resultPath, size: file.size } });
        return res.json({ success: true, path: resultPath });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Edit (overwrite) file content
// PUT /api/files/edit  body: { machineId, path, content (plain text) }
exports.editFile = async (req, res) => {
    try {
        const { machineId, path: filePath, content } = req.body;
        if (!machineId || !filePath || content === undefined) {
            return res.status(400).json({ error: 'machineId, path, and content are required' });
        }

        // --- Security checks ---
        try { sanitizePath(filePath); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

        const ext = path.extname(filePath).toLowerCase();
        if (!EDITABLE_EXTENSIONS.has(ext)) {
            return res.status(403).json({ error: `File type "${ext || '(none)'}" is not allowed for editing` });
        }

        if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_EDIT_BYTES) {
            return res.status(413).json({ error: 'Content too large (max 5 MB)' });
        }
        // -----------------------

        const isMaster = machineId === 'master';
        const isAdminUser = req.user && (req.user.roleName === 'Admin' || req.user.permissions?.includes('ALL'));
        const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

        // === PRIORITY 1: Agent WebSocket ===
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'write_file', {
                path: filePath,
                content: contentBase64,
                isAdmin: isAdminUser
            }, 30000);
            if (result.error) return res.status(400).json({ error: result.error });
            notificationHub.broadcast('file:edited', { machineId, path: filePath });
            logActivity({ category: 'file', action: 'edit', message: `Edited "${path.basename(filePath)}" on machine ${machineId}`, userId: req.user?.id, machineId: parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
            return res.json({ success: true });
        }

        // === PRIORITY 2: SSH ===
        const machine = isMaster ? null : await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        const machinePassword = getDecryptedMachinePassword(machine);
        if (!isMaster && machine?.ipAddress && machine?.username && machinePassword) {
            const sshService = require('../utils/sshService');
            const { Readable } = require('stream');
            const buf = Buffer.from(content, 'utf8');
            const stream = Readable.from(buf);
            try {
                await sshService.uploadFile({
                    host: machine.ipAddress,
                    port: machine.port,
                    username: machine.username,
                    password: machinePassword
                }, filePath, stream, buf.length);
                notificationHub.broadcast('file:edited', { machineId, path: filePath });
                logActivity({ category: 'file', action: 'edit', message: `Edited "${path.basename(filePath)}" on machine ${machineId} via SSH`, userId: req.user?.id, machineId: parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
                return res.json({ success: true });
            } catch (sshErr) {
                return res.status(503).json({ error: `SSH write failed: ${sshErr.message}` });
            }
        }

        // === PRIORITY 3: Local / Master ===
        let absolutePath;
        if (isMaster) {
            absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        } else {
            const safe = path.normalize(filePath.replace(/:/g, '')).replace(/^(\.\.[/\\])+/, '');
            absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safe);
        }

        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(absolutePath, content, 'utf8');

        notificationHub.broadcast('file:edited', { machineId, path: filePath });
        logActivity({ category: 'file', action: 'edit', message: `Edited "${path.basename(filePath)}" on machine ${machineId}`, userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId), ipAddress: req.ip, meta: { machineId, path: filePath } });
        return res.json({ success: true });
    } catch (error) {
        const isProd = process.env.NODE_ENV === 'production';
        res.status(error.status || 500).json({ error: isProd ? 'Internal server error' : error.message });
    }
};
