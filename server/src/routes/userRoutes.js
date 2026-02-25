const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, adminOnly } = require('../middleware/auth');

// ========== User Routes ==========
// Tất cả routes đều yêu cầu đăng nhập
router.use(authenticate);

// Lấy thông tin bản thân
router.get('/me', userController.getMe);

// Đổi mật khẩu
router.put('/change-password', userController.changePassword);

// ========== Admin-only Routes ==========
// Quản lý users
router.get('/', adminOnly, userController.getAllUsers);
router.post('/', adminOnly, userController.createUser);
router.put('/:id', adminOnly, userController.updateUser);
router.delete('/:id', adminOnly, userController.deleteUser);

// Quản lý roles
router.get('/roles', adminOnly, userController.getAllRoles);
router.post('/roles', adminOnly, userController.createRole);
router.put('/roles/:id', adminOnly, userController.updateRole);
router.delete('/roles/:id', adminOnly, userController.deleteRole);

module.exports = router;
