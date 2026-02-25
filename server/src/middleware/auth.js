const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

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

module.exports = { authenticate, authorize, adminOnly };
