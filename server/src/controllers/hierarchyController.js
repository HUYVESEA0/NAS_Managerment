const prisma = require('../utils/prisma');

// Get full hierarchy tree
exports.getFullHierarchy = async (req, res) => {
    try {
        const hierarchy = await prisma.floor.findMany({
            include: {
                rooms: {
                    include: {
                        machines: {
                            include: {
                                mountPoints: true
                            }
                        }
                    }
                }
            },
            orderBy: { level: 'asc' }
        });
        res.json(hierarchy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Floor
exports.createFloor = async (req, res) => {
    try {
        const { name, level, description } = req.body;
        const floor = await prisma.floor.create({
            data: { name, level, description }
        });
        res.status(201).json(floor);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Create Room
exports.createRoom = async (req, res) => {
    try {
        const { name, floorId } = req.body;
        const room = await prisma.room.create({
            data: { name, floorId: parseInt(floorId) }
        });
        res.status(201).json(room);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Create Machine

exports.createMachine = async (req, res) => {
    try {
        const { name, ipAddress, roomId, username, password, port } = req.body;
        const machine = await prisma.machine.create({
            data: {
                name,
                ipAddress,
                roomId: parseInt(roomId),
                username,
                password, // Ideally encrypt this!
                port: port ? parseInt(port) : 22,
                status: 'online'
            }
        });
        res.status(201).json(machine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update Machine (e.g., set SSH credentials)
exports.updateMachine = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, ipAddress, username, password, port, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (ipAddress) updateData.ipAddress = ipAddress;
        if (username) updateData.username = username;
        if (password) updateData.password = password; // Should encrypt
        if (port) updateData.port = parseInt(port);
        if (status) updateData.status = status;

        const machine = await prisma.machine.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        res.json(machine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Create Mount Point
exports.createMountPoint = async (req, res) => {
    try {
        const { name, path, machineId } = req.body;
        const mount = await prisma.mountPoint.create({
            data: {
                name,
                path,
                machineId: parseInt(machineId)
            }
        });
        res.status(201).json(mount);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
// Update Mount Point
exports.updateMountPoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, path } = req.body;
        const mount = await prisma.mountPoint.update({
            where: { id: parseInt(id) },
            data: { name, path }
        });
        res.json(mount);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Mount Point
exports.deleteMountPoint = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.mountPoint.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
