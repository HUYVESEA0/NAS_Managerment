const express = require('express');
const router = express.Router();
const savedPathsController = require('../controllers/savedPathsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', savedPathsController.list);
router.post('/', savedPathsController.create);
router.put('/reorder', savedPathsController.reorder);
router.put('/:id', savedPathsController.update);
router.delete('/:id', savedPathsController.remove);

module.exports = router;
