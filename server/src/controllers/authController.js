const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/activityService');

const SECRET_KEY = process.env.JWT_SECRET || 'secret_dev_key';
const MAX_FAILED_LOGINS = parseInt(process.env.MAX_FAILED_LOGINS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10);
const loginFailures = new Map();

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function getFailureKey(req, username) {
    return `${getClientIp(req)}::${String(username || '').toLowerCase()}`;
}

function registerFailure(key) {
    const now = Date.now();
    const prev = loginFailures.get(key) || { count: 0, lockUntil: 0 };
    const nextCount = prev.count + 1;
    const lockUntil = nextCount >= MAX_FAILED_LOGINS ? now + LOCKOUT_MINUTES * 60 * 1000 : 0;
    const value = { count: nextCount, lockUntil };
    loginFailures.set(key, value);
    return value;
}

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Basic input length guard
        if (typeof username !== 'string' || username.length > 64 ||
            typeof password !== 'string' || password.length > 128) {
            return res.status(400).json({ error: 'Invalid input.' });
        }

        const failureKey = getFailureKey(req, username);
        const state = loginFailures.get(failureKey);
        if (state?.lockUntil && state.lockUntil > Date.now()) {
            return res.status(429).json({
                error: 'Account temporarily locked due to too many failed attempts.',
                retryAfterSeconds: Math.ceil((state.lockUntil - Date.now()) / 1000)
            });
        }

        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true }
        });

        if (!user) {
            registerFailure(failureKey);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            const failed = registerFailure(failureKey);
            logActivity({ level: 'warn', category: 'auth', action: 'login_failed', message: `Login failed for user "${username}"`, ipAddress: req.ip });
            if (failed.lockUntil) {
                logActivity({ level: 'warn', category: 'auth', action: 'login_locked', message: `Login temporarily locked for user "${username}"`, ipAddress: req.ip, meta: { lockUntil: new Date(failed.lockUntil).toISOString() } });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        loginFailures.delete(failureKey);

        logActivity({ level: 'info', category: 'auth', action: 'login', message: `User "${username}" logged in`, userId: user.id, ipAddress: req.ip });

        const token = jwt.sign(
            { userId: user.id, roleId: user.roleId },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                roleId: user.roleId,
                roleName: user.role.name,
                permissions: JSON.parse(user.role.permissions)
            }
        });
    } catch (error) {
        const isProd = process.env.NODE_ENV === 'production';
        res.status(500).json({ error: isProd ? 'Internal server error' : error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, password, roleId } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Kiểm tra username đã tồn tại
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(409).json({ error: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Default role = User (id=2) nếu không chỉ định
        const finalRoleId = roleId || 2;

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                roleId: finalRoleId
            },
            include: { role: true }
        });

        res.status(201).json({
            message: 'User created',
            user: {
                id: user.id,
                username: user.username,
                roleId: user.roleId,
                roleName: user.role.name
            }
        });
    } catch (error) {
        const isProd = process.env.NODE_ENV === 'production';
        res.status(400).json({ error: isProd ? 'Registration failed' : error.message });
    }
};
