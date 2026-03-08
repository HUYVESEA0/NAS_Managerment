const prisma = require('./prisma');
const notificationHub = require('./notificationHub');
const { createLogger } = require('./logger');

const fileLogger = createLogger('activity');

/**
 * Write an activity log entry to the database and broadcast to clients.
 *
 * @param {object} opts
 * @param {string} opts.level    - 'info' | 'warn' | 'error'
 * @param {string} opts.category - 'auth' | 'file' | 'agent' | 'hierarchy' | 'system'
 * @param {string} opts.action   - e.g. 'login', 'upload', 'delete', 'connect'
 * @param {string} opts.message  - Human-readable description
 * @param {object} [opts.meta]   - Extra context data
 * @param {number} [opts.userId] - User who performed the action
 * @param {string} [opts.ipAddress]
 */
async function logActivity({ level = 'info', category, action, message, meta, userId, ipAddress }) {
    // 1. Write to file log
    fileLogger[level] ? fileLogger[level](message, { category, action, ...meta }) : fileLogger.info(message, { category, action, ...meta });

    // 2. Write to DB (best-effort, don't block callers)
    try {
        await prisma.activityLog.create({
            data: {
                level,
                category,
                action,
                message,
                meta: meta ? JSON.stringify(meta) : null,
                userId: userId || null,
                ipAddress: ipAddress || null,
            },
        });
    } catch (err) {
        fileLogger.error('Failed to write activity log to DB', { error: err.message });
    }

    // 3. Broadcast to dashboard clients
    notificationHub.broadcast('activity:new', {
        level,
        category,
        action,
        message,
        meta: meta || {},
        userId,
        timestamp: Date.now(),
    });
}

module.exports = { logActivity };
