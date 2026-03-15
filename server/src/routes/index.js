const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const hierarchyRoutes = require('./hierarchyRoutes');
const fileRoutes = require('./fileRoutes');
const userRoutes = require('./userRoutes');
const agentRoutes = require('./agentRoutes');
const sshRoutes = require('./sshRoutes');
const networkRoutes = require('./networkRoutes');
const systemRoutes = require('./systemRoutes');
const savedPathsRoutes = require('./savedPathsRoutes');
const activityLogRoutes = require('./activityLogRoutes');
const spreadsheetRoutes = require('./spreadsheetRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hierarchy', hierarchyRoutes);
router.use('/files', fileRoutes);
router.use('/agents', agentRoutes);
router.use('/ssh', sshRoutes);
router.use('/network', networkRoutes);
router.use('/system', systemRoutes);
router.use('/saved-paths', savedPathsRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/spreadsheet', spreadsheetRoutes);

// Deep Health Check (Server Management)
router.get('/health', async (req, res) => {
    try {
        const prisma = require('../utils/prisma');
        const agentManager = require('../utils/agentManager');
        const localAgentSpawner = require('../utils/localAgentSpawner');

        // Test database connection
        await prisma.$queryRaw`SELECT 1`;

        const agents = agentManager.getConnectedAgents();
        const spawner = localAgentSpawner.getInstance();

        res.status(200).json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            database: 'connected',
            memoryUsage: process.memoryUsage(),
            agents: {
                connected: agents.length,
                list: agents.map(a => ({
                    id: a.id,
                    name: a.machineName,
                    hostname: a.hostname,
                    platform: a.platform,
                    status: a.status,
                    connectedAt: a.connectedAt
                }))
            },
            localAgent: spawner ? spawner.getStatus() : { available: false }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database check failed',
            error: error.message
        });
    }
});

module.exports = router;
