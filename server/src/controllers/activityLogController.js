const prisma = require('../utils/prisma');

// GET /api/activity-logs?category=file&limit=50&offset=0
exports.list = async (req, res) => {
    try {
        const { category, level, limit = 50, offset = 0 } = req.query;
        const where = {};
        if (category) where.category = category;
        if (level) where.level = level;

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Math.min(parseInt(limit) || 50, 200),
                skip: parseInt(offset) || 0,
                include: { user: { select: { id: true, username: true } } },
            }),
            prisma.activityLog.count({ where }),
        ]);

        res.json({ logs, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/activity-logs/clear?before=ISO_DATE
exports.clear = async (req, res) => {
    try {
        const { before } = req.query;
        const where = before ? { createdAt: { lt: new Date(before) } } : {};
        const result = await prisma.activityLog.deleteMany({ where });
        res.json({ deleted: result.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
