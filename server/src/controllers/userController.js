const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');

// ==================== USER CRUD ====================

/**
 * Lấy danh sách tất cả users (Admin only)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { role: true },
            orderBy: { createdAt: 'desc' }
        });

        // Không trả về password
        const safeUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            roleId: u.roleId,
            roleName: u.role.name,
            permissions: JSON.parse(u.role.permissions),
            createdAt: u.createdAt,
            updatedAt: u.updatedAt
        }));

        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Lấy thông tin user hiện tại (từ token)
 */
exports.getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { role: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role.name,
            permissions: JSON.parse(user.role.permissions),
            createdAt: user.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tạo user mới (Admin only)
 */
exports.createUser = async (req, res) => {
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

        // Kiểm tra role tồn tại
        const role = await prisma.role.findUnique({ where: { id: roleId || 2 } });
        if (!role) {
            return res.status(400).json({ error: 'Invalid role ID.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                roleId: roleId || 2
            },
            include: { role: true }
        });

        res.status(201).json({
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role.name,
            permissions: JSON.parse(user.role.permissions)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Cập nhật user (Admin only)
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, roleId } = req.body;

        const updateData = {};
        if (username) updateData.username = username;
        if (password) updateData.password = await bcrypt.hash(password, 10);
        if (roleId) updateData.roleId = parseInt(roleId);

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: { role: true }
        });

        res.json({
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role.name,
            permissions: JSON.parse(user.role.permissions)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Xóa user (Admin only, không cho xóa chính mình)
 */
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account.' });
        }

        await prisma.user.delete({ where: { id: userId } });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Đổi mật khẩu (user tự đổi cho chính mình)
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(currentPassword, user.password);

        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ==================== ROLE CRUD ====================

/**
 * Lấy danh sách tất cả roles
 */
exports.getAllRoles = async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { _count: { select: { users: true } } },
            orderBy: { id: 'asc' }
        });

        const rolesWithParsed = roles.map(r => ({
            id: r.id,
            name: r.name,
            permissions: JSON.parse(r.permissions),
            userCount: r._count.users
        }));

        res.json(rolesWithParsed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tạo role mới (Admin only)
 */
exports.createRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;

        if (!name || !permissions) {
            return res.status(400).json({ error: 'Name and permissions are required.' });
        }

        const role = await prisma.role.create({
            data: {
                name,
                permissions: JSON.stringify(permissions)
            }
        });

        res.status(201).json({
            id: role.id,
            name: role.name,
            permissions: JSON.parse(role.permissions)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Cập nhật role (Admin only)
 */
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (permissions) updateData.permissions = JSON.stringify(permissions);

        const role = await prisma.role.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({
            id: role.id,
            name: role.name,
            permissions: JSON.parse(role.permissions)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Xóa role (Admin only, không được xóa role có user đang dùng)
 */
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const roleId = parseInt(id);

        // Kiểm tra có user nào đang dùng role này không
        const usersWithRole = await prisma.user.count({ where: { roleId } });
        if (usersWithRole > 0) {
            return res.status(400).json({
                error: `Cannot delete role. ${usersWithRole} user(s) are using this role.`
            });
        }

        await prisma.role.delete({ where: { id: roleId } });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
