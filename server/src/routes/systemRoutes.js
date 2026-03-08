const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { authenticate } = require('../middleware/auth');

// Lấy toàn bộ thông tin tĩnh của hệ thống (OS, CPU info, MEM, Disk, Network interfaces)
router.get('/info', authenticate, systemController.getSystemInfo);

// Lấy thông số động (mức sử dụng CPU, RAM rảnh, tốc độ mạng, tốc độ ổ cứng)
router.get('/stats', authenticate, systemController.getSystemStats);

// Lấy danh sách tiến trình đang chạy (tương tự Task Manager)
router.get('/processes', authenticate, systemController.getProcesses);

module.exports = router;
