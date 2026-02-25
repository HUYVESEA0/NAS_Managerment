import React, { useState, useEffect } from 'react';
import { Building, Server, Cpu, Plus, Layers } from 'lucide-react';
import api from '../services/api';

// Shared dark input style
const inputStyle = {
    padding: '9px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Fira Code', monospace",
};
const inputFocus = (e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; };
const inputBlur = (e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; };

const SectionCard = ({ icon: Icon, title, children }) => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--shadow-card)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, fontFamily: "'Fira Code', monospace" }}>
            <Icon size={16} color="var(--accent-blue)" />
            {title}
        </h2>
        {children}
    </div>
);

const Admin = () => {
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFloor, setNewFloor] = useState({ name: '', level: '', description: '' });
    const [newRoom, setNewRoom] = useState({ name: '', floorId: '' });
    const [newMachine, setNewMachine] = useState({ name: '', ipAddress: '', roomId: '' });
    const [notification, setNotification] = useState(null);
    const [dragOverRoomId, setDragOverRoomId] = useState(null);

    const showNotification = (type, msg) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 3000);
    };

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

    useEffect(() => { fetchHierarchy(); }, []);

    const handleAddFloor = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/floors', { ...newFloor, level: parseInt(newFloor.level) });
            setNewFloor({ name: '', level: '', description: '' });
            fetchHierarchy();
            showNotification('success', 'Floor added');
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add floor');
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/rooms', { ...newRoom, floorId: parseInt(newRoom.floorId) });
            setNewRoom({ name: '', floorId: '' });
            fetchHierarchy();
            showNotification('success', 'Room added');
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add room');
        }
    };

    const handleAddMachine = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/machines', { ...newMachine, roomId: parseInt(newMachine.roomId), status: 'offline' });
            setNewMachine({ name: '', ipAddress: '', roomId: '' });
            fetchHierarchy();
            showNotification('success', 'Machine added');
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add machine');
        }
    };

    const handleDragStart = (e, machine, roomId) => {
        e.dataTransfer.setData('machineId', machine.id);
        e.dataTransfer.setData('sourceRoomId', roomId);
    };

    const handleDragOver = (e, roomId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverRoomId !== roomId) {
            setDragOverRoomId(roomId);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverRoomId(null);
    };

    const handleDrop = async (e, targetRoomId) => {
        e.preventDefault();
        setDragOverRoomId(null);
        const machineId = e.dataTransfer.getData('machineId');
        const sourceRoomId = e.dataTransfer.getData('sourceRoomId');

        if (!machineId || parseInt(sourceRoomId) === targetRoomId) return;

        try {
            await api.put(`/hierarchy/machines/${machineId}`, { roomId: targetRoomId });
            showNotification('success', 'Machine moved successfully');
            fetchHierarchy();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to move machine');
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            Loading...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const btnStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 16px', background: 'linear-gradient(135deg,#3B82F6,#06B6D4)',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white',
        cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(59,130,246,0.25)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Page header */}
            <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontFamily: "'Fira Code', monospace", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={20} color="var(--accent-blue)" /> Admin Panel
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage infrastructure hierarchy: Floors → Rooms → Machines</p>
            </div>

            {/* Notification toast */}
            {notification && (
                <div className="animate-fadeUp" style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 60,
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 10,
                    background: notification.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    border: `1px solid ${notification.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    color: notification.type === 'error' ? '#F87171' : '#34D399', fontSize: 13, fontWeight: 500,
                    boxShadow: 'var(--shadow-elevated)',
                }}>
                    {notification.msg}
                </div>
            )}

            {/* Add Floor */}
            <SectionCard icon={Building} title="Add Floor">
                <form onSubmit={handleAddFloor} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    {[
                        { placeholder: 'Name (e.g., Floor 2)', value: newFloor.name, key: 'name', type: 'text', required: true },
                        { placeholder: 'Level (e.g., 2)', value: newFloor.level, key: 'level', type: 'number', required: true },
                        { placeholder: 'Description', value: newFloor.description, key: 'description', type: 'text', required: false },
                    ].map(({ placeholder, value, key, type, required }) => (
                        <input key={key} type={type} placeholder={placeholder} value={value} required={required}
                            onChange={e => setNewFloor({ ...newFloor, [key]: e.target.value })}
                            style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    ))}
                    <button type="submit" style={btnStyle}><Plus size={14} /> Add</button>
                </form>
            </SectionCard>

            {/* Add Room */}
            <SectionCard icon={Server} title="Add Room">
                <form onSubmit={handleAddRoom} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <input type="text" placeholder="Room Name (e.g., Server Room B)" value={newRoom.name} required
                        onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    <select value={newRoom.floorId} required onChange={e => setNewRoom({ ...newRoom, floorId: e.target.value })}
                        style={{ ...inputStyle, background: 'var(--bg-elevated)' }}
                        onFocus={inputFocus} onBlur={inputBlur}>
                        <option value="">Select Floor</option>
                        {hierarchy.map(floor => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                    </select>
                    <button type="submit" style={btnStyle}><Plus size={14} /> Add</button>
                </form>
            </SectionCard>

            {/* Add Machine */}
            <SectionCard icon={Cpu} title="Add Machine">
                <form onSubmit={handleAddMachine} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <input type="text" placeholder="Machine Name (e.g., NAS-02)" value={newMachine.name} required
                        onChange={e => setNewMachine({ ...newMachine, name: e.target.value })}
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    <input type="text" placeholder="IP Address (optional)" value={newMachine.ipAddress}
                        onChange={e => setNewMachine({ ...newMachine, ipAddress: e.target.value })}
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    <select value={newMachine.roomId} required onChange={e => setNewMachine({ ...newMachine, roomId: e.target.value })}
                        style={{ ...inputStyle, background: 'var(--bg-elevated)' }}
                        onFocus={inputFocus} onBlur={inputBlur}>
                        <option value="">Select Room</option>
                        {hierarchy.flatMap(floor =>
                            floor.rooms.map(room => (
                                <option key={room.id} value={room.id}>{floor.name} → {room.name}</option>
                            ))
                        )}
                    </select>
                    <button type="submit" style={btnStyle}><Plus size={14} /> Add</button>
                </form>
            </SectionCard>

            {/* Current Hierarchy */}
            <SectionCard icon={Layers} title="Current Hierarchy">
                {hierarchy.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No hierarchy data yet. Add floors, rooms, and machines above.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {hierarchy.map(floor => (
                            <div key={floor.id} style={{ borderLeft: '3px solid var(--accent-blue)', paddingLeft: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <Building size={13} color="var(--accent-blue)" />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{floor.name}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px', fontFamily: "'Fira Code', monospace" }}>L{floor.level}</span>
                                </div>
                                {floor.description && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 21 }}>{floor.description}</p>}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20, marginTop: 8 }}>
                                    {floor.rooms.map(room => (
                                        <div
                                            key={room.id}
                                            onDragOver={(e) => handleDragOver(e, room.id)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, room.id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '0 8px 8px 0',
                                                background: dragOverRoomId === room.id ? 'rgba(59,130,246,0.05)' : 'transparent',
                                                transition: 'background 0.2s',
                                                border: dragOverRoomId === room.id ? '1px dashed var(--accent-blue)' : '1px solid transparent',
                                                borderLeft: '2px solid var(--border-subtle)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                <Server size={11} color="var(--accent-cyan)" />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{room.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 16 }}>
                                                {room.machines.map(machine => (
                                                    <div
                                                        key={machine.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, machine, room.id)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, cursor: 'grab' }}
                                                        onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                                                        onDrag={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                                                    >
                                                        <Cpu size={10} color="var(--text-muted)" />
                                                        <span style={{ color: 'var(--text-secondary)', fontFamily: "'Fira Code', monospace" }}>{machine.name}</span>
                                                        {machine.ipAddress && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>· {machine.ipAddress}</span>}
                                                    </div>
                                                ))}
                                                {room.machines.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No machines</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
};

export default Admin;
