const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secret_dev_key';

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

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
        res.status(500).json({ error: error.message });
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
        res.status(400).json({ error: error.message });
    }
};
