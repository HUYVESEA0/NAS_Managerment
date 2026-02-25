const express = require('express');
const router = express.Router();
const sshUserController = require('../controllers/sshUserController');
const { authenticate, authorize, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// Liệt kê SSH users trên machine
router.get('/:machineId/users', authorize('MANAGE_HIERARCHY'), sshUserController.listSSHUsers);

// Tạo SSH user
router.post('/:machineId/users', authorize('MANAGE_HIERARCHY'), sshUserController.createSSHUser);

// Xóa SSH user
router.delete('/:machineId/users/:username', authorize('MANAGE_HIERARCHY'), sshUserController.deleteSSHUser);

// Đổi password SSH user
router.put('/:machineId/users/:username/password', authorize('MANAGE_HIERARCHY'), sshUserController.changeSSHUserPassword);

// Chạy lệnh SSH (admin only)
router.post('/:machineId/exec', adminOnly, sshUserController.execSSHCommand);

module.exports = router;
