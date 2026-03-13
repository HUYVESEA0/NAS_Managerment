const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { logActivity } = require('../utils/activityService');

const SECRET_KEY = process.env.JWT_SECRET || 'secret_dev_key';

/**
 * Middleware xác thực JWT token
 * Gắn user object vào req.user nếu token hợp lệ
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, SECRET_KEY);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { role: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        // Gắn thông tin user vào request
        req.user = {
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role.name,
            permissions: JSON.parse(user.role.permissions)
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        return res.status(500).json({ error: 'Authentication failed.' });
    }
};

/**
 * Middleware kiểm tra permission
 * @param  {...string} requiredPermissions - Danh sách quyền cần có (OR logic: chỉ cần 1 trong các quyền)
 */
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const userPermissions = req.user.permissions;

        // Admin có quyền ALL => bypass mọi kiểm tra
        if (userPermissions.includes('ALL')) {
            return next();
        }

        // Kiểm tra user có ít nhất 1 permission cần thiết
        const hasPermission = requiredPermissions.some(perm =>
            userPermissions.includes(perm)
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Forbidden. Insufficient permissions.',
                required: requiredPermissions,
                your_permissions: userPermissions
            });
        }

        next();
    };
};

/**
 * Extract machine IDs from request (query/body/params).
 * Supports: machineId, fromMachineId, toMachineId, :machineId
 */
function extractMachineIds(req) {
    const ids = [];
    const sources = [req.params || {}, req.query || {}, req.body || {}];
    const keys = ['machineId', 'fromMachineId', 'toMachineId'];

    for (const src of sources) {
        for (const key of keys) {
            if (src[key] !== undefined && src[key] !== null && src[key] !== '') {
                ids.push(String(src[key]));
            }
        }
    }

    return [...new Set(ids)];
}

/**
 * Machine-level scope guard.
 * - Admin/ALL: always allow
 * - Non-admin: if permissions contain MACHINE:<id>, request machineIds must be in that set.
 * - If no MACHINE:* permissions:
 *    + ENFORCE_MACHINE_SCOPES=true => deny
 *    + otherwise allow (backward compatible)
 */
const authorizeMachineScope = () => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const userPermissions = req.user.permissions || [];
        if (userPermissions.includes('ALL') || req.user.roleName === 'Admin') {
            return next();
        }

        const machineIds = extractMachineIds(req);
        if (machineIds.length === 0) {
            return next();
        }

        // Validate IDs format
        for (const id of machineIds) {
            if (id !== 'master' && !/^\d+$/.test(id)) {
                logActivity({
                    level: 'warn',
                    category: 'auth',
                    action: 'machine_scope_invalid_id',
                    message: `Invalid machineId format blocked for user "${req.user?.username}"`,
                    userId: req.user?.id,
                    ipAddress: req.ip,
                    meta: { machineId: id, path: req.originalUrl }
                });
                return res.status(400).json({ error: `Invalid machineId: ${id}` });
            }
        }

        const scopedMachineIds = new Set(
            userPermissions
                .map(p => {
                    const m = String(p).match(/^MACHINE:(\d+)$/);
                    return m ? m[1] : null;
                })
                .filter(Boolean)
        );

        const enforceScopes = String(process.env.ENFORCE_MACHINE_SCOPES || '').toLowerCase() === 'true';
        if (scopedMachineIds.size === 0) {
            if (enforceScopes) {
                logActivity({
                    level: 'warn',
                    category: 'auth',
                    action: 'machine_scope_missing',
                    message: `Machine-scoped access blocked for user "${req.user?.username}" (no MACHINE:* permissions)`,
                    userId: req.user?.id,
                    ipAddress: req.ip,
                    meta: { machineIds, path: req.originalUrl }
                });
                return res.status(403).json({ error: 'Machine scope not configured for this user.' });
            }
            return next();
        }

        const forbidden = machineIds.filter(id => id !== 'master' && !scopedMachineIds.has(id));
        if (forbidden.length > 0) {
            logActivity({
                level: 'warn',
                category: 'auth',
                action: 'machine_scope_denied',
                message: `Machine access denied for user "${req.user?.username}"`,
                userId: req.user?.id,
                ipAddress: req.ip,
                meta: { forbiddenMachineIds: forbidden, path: req.originalUrl }
            });
            return res.status(403).json({
                error: 'Forbidden. Machine access denied.',
                machineIds: forbidden
            });
        }

        next();
    };
};

/**
 * Middleware chỉ cho phép Admin
 */
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const userPermissions = req.user.permissions;
    if (!userPermissions.includes('ALL') && req.user.roleName !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }

    next();
};

module.exports = { authenticate, authorize, adminOnly, authorizeMachineScope };
