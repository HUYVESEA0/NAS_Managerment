const prisma = require('../utils/prisma');
const sshService = require('../utils/sshService');

/**
 * Helper: lấy SSH config từ machine
 */
async function getMachineSSHConfig(machineId) {
    const machine = await prisma.machine.findUnique({
        where: { id: parseInt(machineId) }
    });

    if (!machine) {
        throw { status: 404, message: 'Machine not found' };
    }

    if (!machine.ipAddress || !machine.username || !machine.password) {
        throw { status: 400, message: 'Machine does not have SSH credentials configured' };
    }

    return {
        machine,
        sshConfig: {
            host: machine.ipAddress,
            port: machine.port || 22,
            username: machine.username,
            password: machine.password
        }
    };
}

/**
 * Liệt kê SSH users trên machine
 */
exports.listSSHUsers = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { sshConfig, machine } = await getMachineSSHConfig(machineId);

        const users = await sshService.listUsers(sshConfig);

        res.json({
            machineId: machine.id,
            machineName: machine.name,
            users
        });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
};

/**
 * Tạo SSH user trên machine
 */
exports.createSSHUser = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { username, password, shell, createHome } = req.body;
        const { sshConfig, machine } = await getMachineSSHConfig(machineId);

        const result = await sshService.createUser(sshConfig, {
            username,
            password,
            shell: shell || '/bin/bash',
            createHome: createHome !== false
        });

        res.status(201).json({
            ...result,
            machineId: machine.id,
            machineName: machine.name
        });
    } catch (error) {
        const status = error.status || 400;
        res.status(status).json({ error: error.message });
    }
};

/**
 * Xóa SSH user trên machine
 */
exports.deleteSSHUser = async (req, res) => {
    try {
        const { machineId, username } = req.params;
        const { sshConfig, machine } = await getMachineSSHConfig(machineId);

        const result = await sshService.deleteUser(sshConfig, username);

        res.json({
            ...result,
            machineId: machine.id,
            machineName: machine.name
        });
    } catch (error) {
        const status = error.status || 400;
        res.status(status).json({ error: error.message });
    }
};

/**
 * Đổi password SSH user trên machine
 */
exports.changeSSHUserPassword = async (req, res) => {
    try {
        const { machineId, username } = req.params;
        const { newPassword } = req.body;
        const { sshConfig, machine } = await getMachineSSHConfig(machineId);

        const result = await sshService.changeUserPassword(sshConfig, username, newPassword);

        res.json({
            ...result,
            machineId: machine.id,
            machineName: machine.name
        });
    } catch (error) {
        const status = error.status || 400;
        res.status(status).json({ error: error.message });
    }
};

/**
 * Chạy lệnh SSH tùy ý (admin only)
 */
exports.execSSHCommand = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const { sshConfig, machine } = await getMachineSSHConfig(machineId);
        const result = await sshService.execCommand(sshConfig, command);

        res.json({
            machineId: machine.id,
            machineName: machine.name,
            command,
            ...result
        });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
};
