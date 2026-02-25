const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticate, authorize } = require('../middleware/auth');

// Tất cả routes yêu cầu đăng nhập
router.use(authenticate);

// List files — cần quyền READ
router.get('/list', authorize('READ_FILES', 'BROWSE_FILES'), fileController.listFiles);
router.get('/download', authorize('DOWNLOAD_FILES', 'READ_FILES'), fileController.downloadFile);

const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
});

// Management routes
router.post('/mkdir', authorize('WRITE_FILES', 'MANAGE_FILES'), fileController.createDirectory);
router.put('/rename', authorize('WRITE_FILES', 'MANAGE_FILES'), fileController.renameItem);
router.delete('/delete', authorize('DELETE_FILES', 'MANAGE_FILES'), fileController.deleteItem);
router.post('/upload', authorize('WRITE_FILES', 'MANAGE_FILES'), upload.single('file'), fileController.uploadFile);

module.exports = router;
