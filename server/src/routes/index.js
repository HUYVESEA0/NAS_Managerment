const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const hierarchyRoutes = require('./hierarchyRoutes');
const fileRoutes = require('./fileRoutes');
const userRoutes = require('./userRoutes');
const agentRoutes = require('./agentRoutes');
const sshRoutes = require('./sshRoutes');
const networkRoutes = require('./networkRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hierarchy', hierarchyRoutes);
router.use('/files', fileRoutes);
router.use('/agents', agentRoutes);
router.use('/ssh', sshRoutes);
router.use('/network', networkRoutes);

module.exports = router;
