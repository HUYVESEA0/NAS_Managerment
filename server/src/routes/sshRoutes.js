const express = require('express');
const router = express.Router();
const sshUserController = require('../controllers/sshUserController');
const { authenticate, authorize, adminOnly, authorizeMachineScope } = require('../middleware/auth');

router.use(authenticate);

// Liệt kê SSH users trên machine
router.get('/:machineId/users', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), sshUserController.listSSHUsers);

// Tạo SSH user
router.post('/:machineId/users', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), sshUserController.createSSHUser);

// Xóa SSH user
router.delete('/:machineId/users/:username', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), sshUserController.deleteSSHUser);

// Đổi password SSH user
router.put('/:machineId/users/:username/password', authorize('MANAGE_HIERARCHY'), authorizeMachineScope(), sshUserController.changeSSHUserPassword);

// Chạy lệnh SSH (admin only)
router.post('/:machineId/exec', adminOnly, authorizeMachineScope(), sshUserController.execSSHCommand);

module.exports = router;
