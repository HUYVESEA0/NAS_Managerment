const prisma = require('../utils/prisma');
const notificationHub = require('../utils/notificationHub');
const { logActivity } = require('../utils/activityService');
const { encryptSecret } = require('../utils/credentialCrypto');

// Flat list of all machines (for filters, dropdowns)
exports.getMachines = async (req, res) => {
    try {
        const machines = await prisma.machine.findMany({
            include: { room: { include: { floor: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(machines.map(m => ({
            id: m.id,
            name: m.name,
            ipAddress: m.ipAddress || null,
            roomName: m.room?.name || null,
            floorName: m.room?.floor?.name || null
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const broadcastHierarchy = (action, entityType, entityId) => {
    notificationHub.broadcast('hierarchy:changed', { action, entityType, entityId });
    logActivity({ category: 'hierarchy', action, message: `${entityType} ${action} (ID: ${entityId})`, meta: { entityType, entityId } });
};

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
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Floor name is required.' });
        }
        const parsedLevel = parseInt(level);
        if (isNaN(parsedLevel)) {
            return res.status(400).json({ error: 'Floor level must be a valid number.' });
        }
        const floor = await prisma.floor.create({
            data: { name: name.trim(), level: parsedLevel, description: description || null }
        });
        broadcastHierarchy('created', 'floor', floor.id);
        res.status(201).json(floor);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'A floor with this level already exists.' });
        }
        res.status(400).json({ error: error.message });
    }
};

// Update Floor
exports.updateFloor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, level, description } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (level !== undefined) updateData.level = parseInt(level);
        if (description !== undefined) updateData.description = description;

        const floor = await prisma.floor.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        broadcastHierarchy('updated', 'floor', floor.id);
        res.json(floor);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Floor
exports.deleteFloor = async (req, res) => {
    try {
        const { id } = req.params;
        const floorId = parseInt(id);

        // Cascade manually:
        // 1. Get all rooms in this floor
        const rooms = await prisma.room.findMany({ where: { floorId } });
        const roomIds = rooms.map(r => r.id);

        // 2. Delete all MountPoints of machines in those rooms
        await prisma.mountPoint.deleteMany({
            where: {
                machine: {
                    roomId: { in: roomIds }
                }
            }
        });

        // 3. Delete all Machines in those rooms
        await prisma.machine.deleteMany({
            where: { roomId: { in: roomIds } }
        });

        // 4. Delete all Rooms in this floor
        await prisma.room.deleteMany({
            where: { floorId }
        });

        // 5. Delete the Floor
        await prisma.floor.delete({
            where: { id: floorId }
        });

        broadcastHierarchy('deleted', 'floor', floorId);
        res.status(204).send();
    } catch (error) {
        console.error('Delete Floor Error:', error);
        res.status(400).json({ error: error.message });
    }
};

// Create Room
exports.createRoom = async (req, res) => {
    try {
        const { name, floorId } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Room name is required.' });
        }
        const parsedFloorId = parseInt(floorId);
        if (isNaN(parsedFloorId)) {
            return res.status(400).json({ error: 'Floor ID must be a valid number.' });
        }
        const room = await prisma.room.create({
            data: { name: name.trim(), floorId: parsedFloorId }
        });
        broadcastHierarchy('created', 'room', room.id);
        res.status(201).json(room);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update Room
exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, floorId } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (floorId !== undefined) updateData.floorId = parseInt(floorId);

        const room = await prisma.room.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        broadcastHierarchy('updated', 'room', room.id);
        res.json(room);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Room
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const roomId = parseInt(id);

        // Cascade manually:
        // 1. Delete all MountPoints of machines in this room
        await prisma.mountPoint.deleteMany({
            where: {
                machine: {
                    roomId: roomId
                }
            }
        });

        // 2. Delete all Machines in this room
        await prisma.machine.deleteMany({
            where: { roomId }
        });

        // 3. Delete the Room
        await prisma.room.delete({
            where: { id: roomId }
        });

        broadcastHierarchy('deleted', 'room', roomId);
        res.status(204).send();
    } catch (error) {
        console.error('Delete Room Error:', error);
        res.status(400).json({ error: error.message });
    }
};

// Create Machine

exports.createMachine = async (req, res) => {
    try {
        const { name, ipAddress, roomId, username, password, port } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Machine name is required.' });
        }
        const parsedRoomId = parseInt(roomId);
        if (isNaN(parsedRoomId)) {
            return res.status(400).json({ error: 'Room ID must be a valid number.' });
        }
        const machine = await prisma.machine.create({
            data: {
                name: name.trim(),
                ipAddress,
                roomId: parsedRoomId,
                username,
                password: password ? encryptSecret(password) : null,
                port: port ? parseInt(port) : 22,
                status: 'online'
            }
        });
        broadcastHierarchy('created', 'machine', machine.id);
        res.status(201).json(machine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update Machine (e.g., set SSH credentials)
exports.updateMachine = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, ipAddress, username, password, port, status, roomId } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (ipAddress) updateData.ipAddress = ipAddress;
        if (username) updateData.username = username;
        if (password !== undefined) updateData.password = password ? encryptSecret(password) : null;
        if (port) updateData.port = parseInt(port);
        if (status) updateData.status = status;
        if (roomId) updateData.roomId = parseInt(roomId);

        const machine = await prisma.machine.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        broadcastHierarchy('updated', 'machine', machine.id);
        res.json(machine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Machine
exports.deleteMachine = async (req, res) => {
    try {
        const { id } = req.params;
        const machineId = parseInt(id);

        // Check if machine has dependencies that aren't marked as "Cascade" in Prisma
        // 1. Delete associated MountPoints first
        await prisma.mountPoint.deleteMany({
            where: { machineId: machineId }
        });

        // 2. Clear any other dependencies if exist (e.g. results, logs linked to machineId)
        // ... adding more here if needed in future

        // 3. Delete the machine
        await prisma.machine.delete({
            where: { id: machineId }
        });

        broadcastHierarchy('deleted', 'machine', machineId);
        res.status(204).send();
    } catch (error) {
        console.error('Delete Machine Error:', error);
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
