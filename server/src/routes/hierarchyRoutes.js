const express = require('express');
const router = express.Router();
const hierarchyController = require('../controllers/hierarchyController');
const { authenticate, authorize } = require('../middleware/auth');

// Tất cả routes yêu cầu đăng nhập
router.use(authenticate);

// Get full tree — mọi user đều xem được
router.get('/', hierarchyController.getFullHierarchy);

// Create/Update/Delete — cần quyền WRITE hoặc MANAGE
router.post('/floors', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.createFloor);
router.post('/rooms', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.createRoom);
router.post('/machines', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.createMachine);
router.put('/machines/:id', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.updateMachine);

router.post('/mounts', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.createMountPoint);
router.put('/mounts/:id', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.updateMountPoint);
router.delete('/mounts/:id', authorize('MANAGE_HIERARCHY', 'WRITE_HIERARCHY'), hierarchyController.deleteMountPoint);

module.exports = router; 
