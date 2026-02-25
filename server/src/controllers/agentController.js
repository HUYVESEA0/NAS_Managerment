const agentManager = require('../utils/agentManager');

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
                step1: 'Copy the agent folder to the remote machine',
                step2: 'Run: npm install',
                step3: `Run: node agent.js --server ${wsUrl} --machine-id ${machineId}`,
                step4: 'The agent will auto-connect and register with the server'
            },
            command: `node agent.js --server ${wsUrl} --machine-id ${machineId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
