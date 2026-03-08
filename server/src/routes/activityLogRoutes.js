const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const activityLogController = require('../controllers/activityLogController');

router.get('/', authenticate, activityLogController.list);
router.delete('/clear', authenticate, authorize('Admin'), activityLogController.clear);

module.exports = router;
