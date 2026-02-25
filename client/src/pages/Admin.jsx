import React, { useState, useEffect } from 'react';
import { Building, Server, Cpu, Plus, Trash2, Save } from 'lucide-react';
import api from '../services/api';

const Admin = () => {
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFloor, setNewFloor] = useState({ name: '', level: '', description: '' });
    const [newRoom, setNewRoom] = useState({ name: '', floorId: '' });
    const [newMachine, setNewMachine] = useState({ name: '', ipAddress: '', roomId: '' });

    const fetchHierarchy = async () => {
        try {
            const response = await api.get('/hierarchy');
            setHierarchy(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHierarchy();
    }, []);

    const handleAddFloor = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/floors', {
                ...newFloor,
                level: parseInt(newFloor.level)
            });
            setNewFloor({ name: '', level: '', description: '' });
            fetchHierarchy();
        } catch (err) {
            alert('Failed to add floor: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/rooms', {
                ...newRoom,
                floorId: parseInt(newRoom.floorId)
            });
            setNewRoom({ name: '', floorId: '' });
            fetchHierarchy();
        } catch (err) {
            alert('Failed to add room: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleAddMachine = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/machines', {
                ...newMachine,
                roomId: parseInt(newMachine.roomId),
                status: 'offline'
            });
            setNewMachine({ name: '', ipAddress: '', roomId: '' });
            fetchHierarchy();
        } catch (err) {
            alert('Failed to add machine: ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>

            {/* Add Floor */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-indigo-500" />
                    Add Floor
                </h2>
                <form onSubmit={handleAddFloor} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Name (e.g., Floor 2)"
                        value={newFloor.name}
                        onChange={e => setNewFloor({ ...newFloor, name: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    />
                    <input
                        type="number"
                        placeholder="Level (e.g., 2)"
                        value={newFloor.level}
                        onChange={e => setNewFloor({ ...newFloor, level: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Description"
                        value={newFloor.description}
                        onChange={e => setNewFloor({ ...newFloor, description: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                    />
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Floor
                    </button>
                </form>
            </section>

            {/* Add Room */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-500" />
                    Add Room
                </h2>
                <form onSubmit={handleAddRoom} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        type="text"
                        placeholder="Room Name (e.g., Server Room B)"
                        value={newRoom.name}
                        onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    />
                    <select
                        value={newRoom.floorId}
                        onChange={e => setNewRoom({ ...newRoom, floorId: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    >
                        <option value="">Select Floor</option>
                        {hierarchy.map(floor => (
                            <option key={floor.id} value={floor.id}>{floor.name}</option>
                        ))}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Room
                    </button>
                </form>
            </section>

            {/* Add Machine */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-500" />
                    Add Machine
                </h2>
                <form onSubmit={handleAddMachine} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Machine Name (e.g., NAS-02)"
                        value={newMachine.name}
                        onChange={e => setNewMachine({ ...newMachine, name: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    />
                    <input
                        type="text"
                        placeholder="IP Address (optional)"
                        value={newMachine.ipAddress}
                        onChange={e => setNewMachine({ ...newMachine, ipAddress: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                    />
                    <select
                        value={newMachine.roomId}
                        onChange={e => setNewMachine({ ...newMachine, roomId: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                        required
                    >
                        <option value="">Select Room</option>
                        {hierarchy.flatMap(floor =>
                            floor.rooms.map(room => (
                                <option key={room.id} value={room.id}>
                                    {floor.name} - {room.name}
                                </option>
                            ))
                        )}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Machine
                    </button>
                </form>
            </section>

            {/* Current Hierarchy */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Current Hierarchy</h2>
                <div className="space-y-4">
                    {hierarchy.map(floor => (
                        <div key={floor.id} className="border-l-4 border-indigo-500 pl-4">
                            <h3 className="font-semibold text-gray-800">{floor.name} (Level {floor.level})</h3>
                            <p className="text-sm text-gray-500">{floor.description}</p>
                            <div className="ml-4 mt-2 space-y-2">
                                {floor.rooms.map(room => (
                                    <div key={room.id} className="border-l-2 border-gray-300 pl-4">
                                        <h4 className="font-medium text-gray-700">{room.name}</h4>
                                        <div className="ml-4 mt-1 space-y-1">
                                            {room.machines.map(machine => (
                                                <p key={machine.id} className="text-sm text-gray-600">
                                                    • {machine.name} ({machine.ipAddress || 'No IP'})
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Admin;
