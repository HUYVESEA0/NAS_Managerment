const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const agentManager = require('../utils/agentManager');

// Base storage directory for simulation
const STORAGE_ROOT = path.join(__dirname, '../../storage');

// List files in a directory
exports.listFiles = async (req, res) => {
    try {
        const { machineId, path: queryPath } = req.query;

        // Validate machine exists
        const machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // === PRIORITY 1: Agent WebSocket (máy remote đã bind) ===
        if (agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const remotePath = queryPath || '.';
                const files = await agentManager.sendRequest(parseInt(machineId), 'list_files', {
                    path: remotePath
                });

                return res.json(files);
            } catch (agentError) {
                console.error('Agent Error:', agentError.message);
                return res.status(502).json({ error: `Agent Error: ${agentError.message}` });
            }
        }

        // === PRIORITY 2: SSH Connection ===
        if (machine.ipAddress && machine.username && machine.password) {
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

        // === PRIORITY 3: Local Simulation ===
        const safeQueryPath = queryPath ? path.normalize(queryPath).replace(/^(\.\.[\/\\])+/, '') : '';
        // Fix: Windows drive letter (e.g. "C:") cannot be a folder name. Remove colon.
        const safePath = safeQueryPath.replace(/:/g, '');

        const absolutePath = path.join(STORAGE_ROOT, `machine-${machineId}`, safePath);

        if (!fs.existsSync(absolutePath)) {
            fs.mkdirSync(absolutePath, { recursive: true });
        }

        const files = fs.readdirSync(absolutePath, { withFileTypes: true }).map(dirent => ({
            name: dirent.name,
            isDirectory: dirent.isDirectory(),
            size: dirent.isFile() ? fs.statSync(path.join(absolutePath, dirent.name)).size : 0,
            path: path.join(safePath, dirent.name).replace(/\\/g, '/')
        }));

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

        const machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // Agent download
        if (agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const result = await agentManager.sendRequest(parseInt(machineId), 'read_file', {
                    path: filePath
                }, 30000);

                if (result.content) {
                    const fileName = path.basename(filePath);
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    // Content is base64 encoded from agent
                    const buffer = Buffer.from(result.content, 'base64');
                    return res.send(buffer);
                }

                return res.status(404).json({ error: 'File not found on agent' });
            } catch (agentError) {
                return res.status(502).json({ error: `Agent Error: ${agentError.message}` });
            }
        }

        res.status(501).json({ message: 'Download not available for this connection type' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Directory
exports.createDirectory = async (req, res) => {
    try {
        const { machineId, path: dirPath } = req.body;
        if (!machineId || !dirPath) return res.status(400).json({ error: 'Missing parameters' });

        if (agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'create_directory', { path: dirPath });
            if (result.error) return res.status(400).json({ error: result.error });
            return res.json(result);
        }
        res.status(501).json({ error: 'Operaton only supported via Agent connection' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Rename Item
exports.renameItem = async (req, res) => {
    try {
        const { machineId, path: itemPath, newName } = req.body;
        if (!machineId || !itemPath || !newName) return res.status(400).json({ error: 'Missing parameters' });

        if (agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'rename_item', {
                path: itemPath,
                newName
            });
            if (result.error) return res.status(400).json({ error: result.error });
            return res.json(result);
        }
        res.status(501).json({ error: 'Operaton only supported via Agent connection' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Item
exports.deleteItem = async (req, res) => {
    try {
        const { machineId, path: itemPath } = req.body;
        if (!machineId || !itemPath) return res.status(400).json({ error: 'Missing parameters' });

        if (agentManager.isAgentConnected(parseInt(machineId))) {
            const result = await agentManager.sendRequest(parseInt(machineId), 'delete_item', { path: itemPath });
            if (result.error) return res.status(400).json({ error: result.error });
            return res.json(result);
        }
        res.status(501).json({ error: 'Operaton only supported via Agent connection' });
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

        if (agentManager.isAgentConnected(parseInt(machineId))) {
            const content = file.buffer.toString('base64');

            // Construct target path. Replace backslashes for consistency
            const safeDirPath = dirPath.replace(/\\/g, '/');
            const targetPath = safeDirPath.endsWith('/') ? `${safeDirPath}${file.originalname}` : `${safeDirPath}/${file.originalname}`;

            const result = await agentManager.sendRequest(parseInt(machineId), 'write_file', {
                path: targetPath,
                content
            }, 60000);

            if (result.error) return res.status(400).json({ error: result.error });
            return res.json({ success: true, path: targetPath });
        }
        res.status(501).json({ error: 'Operation only supported via Agent connection' });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
};
