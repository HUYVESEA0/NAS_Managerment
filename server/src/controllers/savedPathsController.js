const prisma = require('../utils/prisma');
const notificationHub = require('../utils/notificationHub');

/**
 * CRUD đường dẫn đã lưu cho user hiện tại
 */

// GET /api/saved-paths — lấy tất cả saved paths của user (optional filter by machineId)
exports.list = async (req, res) => {
    try {
        const userId = req.user.id;
        const { machineId } = req.query;

        const where = { userId };
        if (machineId) {
            where.machineId = machineId === 'global' ? null : parseInt(machineId);
        }

        const paths = await prisma.savedPath.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
        });

        res.json(paths);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/saved-paths — tạo mới
exports.create = async (req, res) => {
    try {
        const userId = req.user.id;
        const { label, path, machineId, color } = req.body;

        if (!label || !label.trim()) {
            return res.status(400).json({ error: 'Label is required' });
        }
        if (!path || !path.trim()) {
            return res.status(400).json({ error: 'Path is required' });
        }

        // Get max sortOrder for this user
        const maxSort = await prisma.savedPath.aggregate({
            where: { userId },
            _max: { sortOrder: true }
        });

        const saved = await prisma.savedPath.create({
            data: {
                label: label.trim(),
                path: path.trim(),
                machineId: machineId ? parseInt(machineId) : null,
                userId,
                color: color || null,
                sortOrder: (maxSort._max.sortOrder || 0) + 1
            }
        });

        notificationHub.broadcast('paths:updated', { userId, action: 'created', savedPath: saved });
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/saved-paths/:id — cập nhật
exports.update = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { label, path, machineId, color, sortOrder } = req.body;

        // Verify ownership
        const existing = await prisma.savedPath.findFirst({
            where: { id: parseInt(id), userId }
        });
        if (!existing) return res.status(404).json({ error: 'Saved path not found' });

        const updateData = {};
        if (label !== undefined) updateData.label = label.trim();
        if (path !== undefined) updateData.path = path.trim();
        if (machineId !== undefined) updateData.machineId = machineId ? parseInt(machineId) : null;
        if (color !== undefined) updateData.color = color;
        if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);

        const updated = await prisma.savedPath.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        notificationHub.broadcast('paths:updated', { userId, action: 'updated', savedPath: updated });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/saved-paths/:id — xóa
exports.remove = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Verify ownership
        const existing = await prisma.savedPath.findFirst({
            where: { id: parseInt(id), userId }
        });
        if (!existing) return res.status(404).json({ error: 'Saved path not found' });

        await prisma.savedPath.delete({ where: { id: parseInt(id) } });

        notificationHub.broadcast('paths:updated', { userId, action: 'deleted', savedPathId: parseInt(id) });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/saved-paths/reorder — sắp xếp lại thứ tự
exports.reorder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderedIds } = req.body; // [3, 1, 5, 2] — array of SavedPath IDs in new order

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds must be an array' });
        }

        // Batch update sortOrder
        await Promise.all(
            orderedIds.map((id, index) =>
                prisma.savedPath.updateMany({
                    where: { id: parseInt(id), userId },
                    data: { sortOrder: index }
                })
            )
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
