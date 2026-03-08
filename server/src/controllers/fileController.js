const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const agentManager = require('../utils/agentManager');
const notificationHub = require('../utils/notificationHub');
const { logActivity } = require('../utils/activityService');

// Base storage directory for simulation
const STORAGE_ROOT = path.join(__dirname, '../../storage');

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
        if (!isMaster && machine.ipAddress && machine.username && machine.password) {
            const sshService = require('../utils/sshService');
            const remotePath = queryPath || '.';

            try {
                const files = await sshService.listFiles({
                    host: machine.ipAddress,
                    port: machine.port,
                    username: machine.username,
                    password: machine.password
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
        if (!isMaster && machine.ipAddress && machine.username && machine.password) {
            const sshService = require('../utils/sshService');
            try {
                const { stream, size, name } = await sshService.downloadFile({
                    host: machine.ipAddress,
                    port: machine.port,
                    username: machine.username,
                    password: machine.password
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
