const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authenticate, authorize, authorizeMachineScope } = require('../middleware/auth');

router.use(authenticate);

// Tổng quan trạng thái agents + local spawner
router.get('/summary', agentController.getAgentsSummary);

// Lấy danh sách agents đang kết nối
router.get('/', agentController.getConnectedAgents);

// Kiểm tra agent status cho machine
router.get('/status/:machineId', authorizeMachineScope(), agentController.getAgentStatus);

// Lấy setup instructions cho machine
router.get('/setup/:machineId', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), agentController.getAgentSetup);

// Cập nhật shared paths cho machine (admin only)
router.put('/paths/:machineId', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), agentController.updateSharedPaths);

module.exports = router;
