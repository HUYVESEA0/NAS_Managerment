const agentManager = require('../utils/agentManager');
const localAgentSpawner = require('../utils/localAgentSpawner');
const prisma = require('../utils/prisma');


/**
 * Lấy danh sách agents đang kết nối
 */
exports.getConnectedAgents = async (req, res) => {
    try {
        const agents = agentManager.getConnectedAgents();
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tổng quan trạng thái tất cả agents + local spawner
 */
exports.getAgentsSummary = async (req, res) => {
    try {
        const agents = agentManager.getConnectedAgents();
        const spawner = localAgentSpawner.getInstance();
        const machines = await prisma.machine.findMany({
            select: { id: true, name: true, status: true }
        });

        res.json({
            agents: agents.map(a => ({
                id: a.id,
                name: a.machineName,
                hostname: a.hostname,
                platform: a.platform,
                connectedAt: a.connectedAt
            })),
            totalConnected: agents.length,
            totalMachines: machines.length,
            machines: machines.map(m => ({
                id: m.id,
                name: m.name,
                status: m.status,
                agentConnected: agentManager.isAgentConnected(m.id)
            })),
            localSpawner: spawner ? spawner.getStatus() : { available: false }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Kiểm tra agent status cho một machine
 */
exports.getAgentStatus = async (req, res) => {
    try {
        const { machineId } = req.params;
        const connected = agentManager.isAgentConnected(parseInt(machineId));
        res.json({
            machineId: parseInt(machineId),
            agentConnected: connected
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tạo agent token/config cho machine
 * Trả về script và hướng dẫn cài đặt agent
 */
exports.getAgentSetup = async (req, res) => {
    try {
        const { machineId } = req.params;

        // Lấy server address
        const host = req.headers.host || `localhost:${process.env.PORT || 3001}`;
        const protocol = req.protocol === 'https' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${host}/ws/agent`;

        res.json({
            machineId: parseInt(machineId),
            wsUrl,
            setupInstructions: {
                step1: 'Copy the client_connect folder to the remote machine',
                step2: 'Run: npm install (or use the bundled node_modules)',
                step3: `Run: node client_connect.js --server ${wsUrl} --machine-id ${machineId}`,
                step4: 'The client will auto-connect and register with the server'
            },
            command: `node client_connect.js --server ${wsUrl} --machine-id ${machineId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Cập nhật shared paths cho machine
 * Lưu DB + push live đến agent nếu đang online
 */
exports.updateSharedPaths = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { paths } = req.body;

        if (!Array.isArray(paths)) {
            return res.status(400).json({ error: 'paths must be an array of strings' });
        }

        const id = parseInt(machineId);
        const machine = await prisma.machine.findUnique({ where: { id } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // Lưu vào DB
        await prisma.machine.update({
            where: { id },
            data: { sharedPaths: JSON.stringify(paths) }
        });

        // Push live tới agent nếu đang online
        const pushed = agentManager.pushPaths(id, paths);

        res.json({
            success: true,
            machineId: id,
            paths,
            agentUpdated: pushed  // true nếu agent đang connected và đã nhận paths mới
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

