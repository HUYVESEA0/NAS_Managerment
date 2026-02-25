const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Lấy danh sách agents đang kết nối
router.get('/', agentController.getConnectedAgents);

// Kiểm tra agent status cho machine
router.get('/status/:machineId', agentController.getAgentStatus);

// Lấy setup instructions cho machine
router.get('/setup/:machineId', authorize('MANAGE_HIERARCHY'), agentController.getAgentSetup);

module.exports = router;
