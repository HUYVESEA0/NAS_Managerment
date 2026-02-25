const express = require('express');
const router = express.Router();
const networkController = require('../controllers/networkController');
const { authenticate, authorize, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// Tìm kiếm files
router.get('/search', authorize('READ_FILES', 'BROWSE_FILES'), networkController.searchFiles);
router.get('/search-global', authorize('READ_FILES', 'BROWSE_FILES'), networkController.searchGlobalFiles);

// Quét mạng
router.get('/scan', authorize('MANAGE_HIERARCHY'), networkController.scanNetwork);

// Preview file
router.get('/preview', authorize('READ_FILES', 'BROWSE_FILES'), networkController.previewFile);

module.exports = router;
