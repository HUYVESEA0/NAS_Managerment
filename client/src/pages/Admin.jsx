import React, { useState, useEffect } from 'react';
import { Building, Server, Cpu, Plus, Layers, Terminal as TerminalIcon, Edit2, Trash2, XCircle, Lock, Shield, Eye, EyeOff, FolderOpen, FolderPlus, X } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import WebTerminal from '../components/WebTerminal';

// ── System Nodes (built-in, always present, protected) ─────────────
const SYSTEM_NODES = [
    {
        id: 'system-main-server',
        nameKey: 'mainServer',
        type: 'master',
        descKey: 'mainServerDesc',
        status: 'online',
        isSystem: true,
    },
    {
        id: 'system-web-server',
        nameKey: 'webServer',
        type: 'web',
        descKey: 'webServerDesc',
        status: 'online',
        isSystem: true,
    },
];

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
const inputFocus = (e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; };
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
    const { t } = useLanguage();
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFloor, setNewFloor] = useState({ name: '', level: '', description: '' });
    const [newRoom, setNewRoom] = useState({ name: '', floorId: '' });
    const [newMachine, setNewMachine] = useState({ name: '', ipAddress: '', roomId: '' });
    const [notification, setNotification] = useState(null);
    const [dragOverRoomId, setDragOverRoomId] = useState(null);
    const [terminalMachine, setTerminalMachine] = useState(null);
    const [editModal, setEditModal] = useState({ open: false, type: '', data: null });
    const [protectedModal, setProtectedModal] = useState({ open: false, node: null, action: null, password: '', error: '', showPw: false });
    const [pathsModal, setPathsModal] = useState({ open: false, machine: null, paths: [], newPath: '', saving: false, result: null });

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

    const openPathsModal = (machine) => {
        let paths = [];
        try { paths = machine.sharedPaths ? JSON.parse(machine.sharedPaths) : []; } catch { paths = []; }
        setPathsModal({ open: true, machine, paths, newPath: '', saving: false, result: null });
    };

    const handleSavePaths = async () => {
        setPathsModal(prev => ({ ...prev, saving: true, result: null }));
        try {
            const res = await api.put(`/agents/paths/${pathsModal.machine.id}`, { paths: pathsModal.paths });
            setPathsModal(prev => ({ ...prev, saving: false, result: { ok: true, pushed: res.data.agentUpdated } }));
            fetchHierarchy();
        } catch (err) {
            setPathsModal(prev => ({ ...prev, saving: false, result: { ok: false, msg: err.response?.data?.error || 'Failed' } }));
        }
    };

    const handleAddFloor = async (e) => {
        e.preventDefault();
        const level = parseInt(newFloor.level);
        if (!newFloor.name.trim()) return showNotification('error', t('floorNameRequired'));
        if (isNaN(level)) return showNotification('error', t('floorLevelRequired'));
        try {
            await api.post('/hierarchy/floors', { ...newFloor, level });
            setNewFloor({ name: '', level: '', description: '' });
            fetchHierarchy();
            showNotification('success', t('floorAdded'));
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add floor');
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        if (!newRoom.name.trim()) return showNotification('error', t('roomNameRequired'));
        const floorId = parseInt(newRoom.floorId);
        if (isNaN(floorId)) return showNotification('error', t('selectFloorRequired'));
        try {
            await api.post('/hierarchy/rooms', { name: newRoom.name.trim(), floorId });
            setNewRoom({ name: '', floorId: '' });
            fetchHierarchy();
            showNotification('success', t('roomAdded'));
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add room');
        }
    };

    const handleAddMachine = async (e) => {
        e.preventDefault();
        if (!newMachine.name.trim()) return showNotification('error', t('machineNameRequired'));
        const roomId = parseInt(newMachine.roomId);
        if (isNaN(roomId)) return showNotification('error', t('selectRoomRequired'));
        try {
            await api.post('/hierarchy/machines', { name: newMachine.name.trim(), ipAddress: newMachine.ipAddress, roomId, status: 'offline' });
            setNewMachine({ name: '', ipAddress: '', roomId: '' });
            fetchHierarchy();
            showNotification('success', t('machineAdded'));
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
            showNotification('success', t('machineMoved'));
            fetchHierarchy();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to move machine');
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm(`${t('confirmDeleteItem')} ${type}?`)) return;
        try {
            await api.delete(`/hierarchy/${type}s/${id}`);
            fetchHierarchy();
            showNotification('success', `${type} ${t('deletedItem')}`);
        } catch (err) {
            showNotification('error', err.response?.data?.error || `Failed to delete ${type}`);
        }
    };

    const handleProtectedAction = (node, action) => {
        setProtectedModal({ open: true, node, action, password: '', error: '', showPw: false });
    };

    const handleProtectedSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/login', {
                username: 'admin',
                password: protectedModal.password
            });
            // Password correct — allow action
            const { node, action } = protectedModal;
            setProtectedModal({ open: false, node: null, action: null, password: '', error: '', showPw: false });
            if (action === 'edit') {
                setEditModal({ open: true, type: 'system', data: { ...node } });
            }
        } catch {
            setProtectedModal(prev => ({ ...prev, error: t('incorrectPassword') }));
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = { ...editModal.data };
            // Ensure numeric fields are properly parsed before sending
            if (editModal.type === 'floor' && data.level !== undefined) {
                data.level = parseInt(data.level);
                if (isNaN(data.level)) return showNotification('error', 'Level must be a valid number');
            }
            if (data.floorId !== undefined) data.floorId = parseInt(data.floorId);
            if (data.roomId !== undefined) data.roomId = parseInt(data.roomId);
            await api.put(`/hierarchy/${editModal.type}s/${editModal.data.id}`, data);
            setEditModal({ open: false, type: '', data: null });
            fetchHierarchy();
            showNotification('success', `${editModal.type} ${t('updatedSuccessfully')}`);
        } catch (err) {
            showNotification('error', err.response?.data?.error || `Failed to update ${editModal.type}`);
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
        padding: '9px 16px', background: 'var(--accent-gradient)',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white',
        cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'var(--accent-shadow)',
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Page header */}
                <div style={{ marginBottom: 4 }}>
                    <h1 style={{ fontFamily: "'Fira Code', monospace", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={20} color="var(--accent-blue)" /> {t('adminPanel')}
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('adminDesc')}</p>
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
                <SectionCard icon={Building} title={t('addFloor')}>
                    <form onSubmit={handleAddFloor} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        {[
                            { placeholder: t('floorName'), value: newFloor.name, key: 'name', type: 'text', required: true },
                            { placeholder: t('level'), value: newFloor.level, key: 'level', type: 'number', required: true },
                            { placeholder: t('description'), value: newFloor.description, key: 'description', type: 'text', required: false },
                        ].map(({ placeholder, value, key, type, required }) => (
                            <input key={key} type={type} placeholder={placeholder} value={value} required={required}
                                onChange={e => setNewFloor({ ...newFloor, [key]: e.target.value })}
                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                        ))}
                        <button type="submit" style={btnStyle}><Plus size={14} /> {t('add')}</button>
                    </form>
                </SectionCard>

                {/* Add Room */}
                <SectionCard icon={Server} title={t('addRoom')}>
                    <form onSubmit={handleAddRoom} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        <input type="text" placeholder={t('roomName')} value={newRoom.name} required
                            onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                            style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                        <select value={newRoom.floorId} required onChange={e => setNewRoom({ ...newRoom, floorId: e.target.value })}
                            style={{ ...inputStyle, background: 'var(--bg-elevated)' }}
                            onFocus={inputFocus} onBlur={inputBlur}>
                            <option value="">{t('selectFloor')}</option>
                            {hierarchy.map(floor => <option key={floor.id} value={floor.id}>{floor.name} (L{floor.level})</option>)}
                        </select>
                        <button type="submit" style={btnStyle}><Plus size={14} /> {t('add')}</button>
                    </form>
                </SectionCard>

                {/* Add Machine */}
                <SectionCard icon={Cpu} title={t('addMachine')}>
                    <form onSubmit={handleAddMachine} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        <input type="text" placeholder={t('machineName')} value={newMachine.name} required
                            onChange={e => setNewMachine({ ...newMachine, name: e.target.value })}
                            style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                        <input type="text" placeholder={t('ipAddressOptional')} value={newMachine.ipAddress}
                            onChange={e => setNewMachine({ ...newMachine, ipAddress: e.target.value })}
                            style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                        <select value={newMachine.roomId} required onChange={e => setNewMachine({ ...newMachine, roomId: e.target.value })}
                            style={{ ...inputStyle, background: 'var(--bg-elevated)' }}
                            onFocus={inputFocus} onBlur={inputBlur}>
                            <option value="">{t('selectRoom')}</option>
                            {hierarchy.flatMap(floor =>
                                floor.rooms.map(room => (
                                    <option key={room.id} value={room.id}>{floor.name} (L{floor.level}) → {room.name}</option>
                                ))
                            )}
                        </select>
                        <button type="submit" style={btnStyle}><Plus size={14} /> {t('add')}</button>
                    </form>
                </SectionCard>

                {/* Web Terminal Overlay */}
                {terminalMachine && (
                    <div style={{ position: 'relative' }}>
                        <WebTerminal machine={terminalMachine} onClose={() => setTerminalMachine(null)} />
                    </div>
                )}

                {/* Current Hierarchy */}
                <SectionCard icon={Layers} title={t('currentHierarchy')}>
                    {/* ── Built-in System Nodes ── */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Shield size={12} color="var(--accent-blue)" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Fira Code', monospace" }}>{t('builtInSystem')}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {SYSTEM_NODES.map(node => (
                                <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, borderLeft: '3px solid var(--accent-blue)' }}>
                                    <div style={{ padding: '6px', background: 'var(--accent-bg-subtle)', borderRadius: 8 }}>
                                        <Server size={14} color="var(--accent-blue)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{t(node.nameKey)}</span>
                                            <span style={{ fontSize: 10, color: 'var(--accent-blue)', background: 'var(--accent-bg-light)', border: '1px solid var(--accent-border-medium)', borderRadius: 4, padding: '1px 6px', fontFamily: "'Fira Code', monospace" }}>{t('systemBadge')}</span>
                                            <span style={{ fontSize: 10, color: 'var(--success)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px' }}>● {t('online')}</span>
                                        </div>
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t(node.descKey)}</p>
                                    </div>
                                    <button
                                        onClick={() => handleProtectedAction(node, 'edit')}
                                        title={t('editRequiresPassword')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
                                    >
                                        <Lock size={11} /> {t('edit')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0 16px' }} />

                    {hierarchy.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>{t('noHierarchyData')}</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {hierarchy.map(floor => (
                                <div key={floor.id} style={{ borderLeft: '3px solid var(--accent-blue)', paddingLeft: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <Building size={13} color="var(--accent-blue)" />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{floor.name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px', fontFamily: "'Fira Code', monospace" }}>L{floor.level}</span>

                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                            <button onClick={() => setEditModal({ open: true, type: 'floor', data: floor })} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }} title={t('editFloor')}><Edit2 size={12} /></button>
                                            <button onClick={() => handleDelete('floor', floor.id)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: 2 }} title={t('deleteFloor')}><Trash2 size={12} /></button>
                                        </div>
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
                                                    background: dragOverRoomId === room.id ? 'var(--accent-bg-subtle)' : 'transparent',
                                                    transition: 'background 0.2s',
                                                    border: dragOverRoomId === room.id ? '1px dashed var(--accent-blue)' : '1px solid transparent',
                                                    borderLeft: '2px solid var(--border-subtle)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                    <Server size={11} color="var(--accent-cyan)" />
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{room.name}</span>
                                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                                        <button onClick={() => setEditModal({ open: true, type: 'room', data: room })} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }} title={t('editRoom')}><Edit2 size={11} /></button>
                                                        <button onClick={() => handleDelete('room', room.id)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: 2 }} title={t('deleteRoom')}><Trash2 size={11} /></button>
                                                    </div>
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

                                                            {/* Shared Paths Button */}
                                                            <button
                                                                onClick={() => openPathsModal(machine)}
                                                                style={{ marginLeft: 2, background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                                                title={t('manageSharedPaths')}
                                                            >
                                                                <FolderOpen size={12} />
                                                            </button>

                                                            {/* SSH Terminal Button */}
                                                            {machine.ipAddress && machine.username && (
                                                                <button
                                                                    onClick={() => setTerminalMachine(machine)}
                                                                    style={{
                                                                        marginLeft: 4,
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        color: 'var(--accent-blue)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: 0
                                                                    }}
                                                                    title={t('openWebTerminal')}
                                                                >
                                                                    <TerminalIcon size={12} />
                                                                </button>
                                                            )}
                                                            {/* Actions */}
                                                            <div style={{ marginLeft: 6, display: 'flex', gap: 4 }}>
                                                                <button onClick={() => setEditModal({ open: true, type: 'machine', data: machine })} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} title={t('editMachine')}><Edit2 size={11} /></button>
                                                                <button onClick={() => handleDelete('machine', machine.id)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: 0 }} title={t('deleteMachine')}><Trash2 size={11} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {room.machines.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('noMachines')}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Protected Password Modal */}
                {protectedModal.open && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                        <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(239,68,68,0.04)' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Lock size={14} color="var(--danger)" /> {t('protectedNode')}
                                </h3>
                                <button onClick={() => setProtectedModal({ open: false, node: null, action: null, password: '', error: '', showPw: false })}
                                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <XCircle size={14} />
                                </button>
                            </div>
                            <form onSubmit={handleProtectedSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{protectedModal.node?.name || t(protectedModal.node?.nameKey)}</strong> {t('protectedNodeDesc')}
                                </p>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('adminPassword')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={protectedModal.showPw ? 'text' : 'password'}
                                            placeholder={t('enterAdminPassword')}
                                            value={protectedModal.password}
                                            autoFocus
                                            required
                                            onChange={e => setProtectedModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
                                            style={{ ...inputStyle, paddingRight: 40 }}
                                            onFocus={inputFocus} onBlur={inputBlur}
                                        />
                                        <button type="button"
                                            onClick={() => setProtectedModal(prev => ({ ...prev, showPw: !prev.showPw }))}
                                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                            {protectedModal.showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    {protectedModal.error && (
                                        <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{protectedModal.error}</p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button type="button" onClick={() => setProtectedModal({ open: false, node: null, action: null, password: '', error: '', showPw: false })}
                                        style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                    <button type="submit"
                                        style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Lock size={13} /> {t('authenticate')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editModal.open && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}>
                        <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Edit2 size={14} color="var(--accent-blue)" /> {t('edit')} {editModal.type}
                                </h3>
                                <button onClick={() => setEditModal({ open: false, type: '', data: null })}
                                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <XCircle size={14} />
                                </button>
                            </div>

                            <form onSubmit={handleEditSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('name')}</label>
                                    <input type="text" required value={editModal.data.name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })}
                                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                </div>

                                {editModal.type === 'floor' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('level')}</label>
                                            <input type="number" required value={editModal.data.level ?? ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, level: e.target.value } })}
                                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('description')}</label>
                                            <input type="text" value={editModal.data.description || ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, description: e.target.value } })}
                                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                        </div>
                                    </>
                                )}

                                {editModal.type === 'room' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('floor')}</label>
                                        <select value={editModal.data.floorId} required onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, floorId: parseInt(e.target.value) } })}
                                            style={{ ...inputStyle, background: 'var(--bg-elevated)' }} onFocus={inputFocus} onBlur={inputBlur}>
                                            {hierarchy.map(floor => <option key={floor.id} value={floor.id}>{floor.name} (L{floor.level})</option>)}
                                        </select>
                                    </div>
                                )}

                                {editModal.type === 'machine' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('ipAddress')}</label>
                                            <input type="text" value={editModal.data.ipAddress || ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, ipAddress: e.target.value } })}
                                                style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('selectRoom')}</label>
                                            <select value={editModal.data.roomId} required onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, roomId: parseInt(e.target.value) } })}
                                                style={{ ...inputStyle, background: 'var(--bg-elevated)' }} onFocus={inputFocus} onBlur={inputBlur}>
                                                {hierarchy.flatMap(floor => floor.rooms.map(room => (
                                                    <option key={room.id} value={room.id}>{floor.name} (L{floor.level}) → {room.name}</option>
                                                )))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                                    <button type="button" onClick={() => setEditModal({ open: false, type: '', data: null })}
                                        style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    >Cancel</button>
                                    <button type="submit"
                                        style={{ padding: '8px 20px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: 'var(--accent-shadow)' }}>
                                        {t('saveChanges')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Shared Paths Modal ── */}
                {pathsModal.open && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
                        <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(6,182,212,0.04)' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FolderOpen size={14} color="var(--accent-cyan)" />
                                    {t('sharedPaths')} — {pathsModal.machine?.name}
                                </h3>
                                <button onClick={() => setPathsModal(p => ({ ...p, open: false }))}
                                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <XCircle size={14} />
                                </button>
                            </div>
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    {t('sharedPathsDesc')}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pathsModal.paths.length === 0 && (
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>{t('noPathsConfigured')}</p>
                                    )}
                                    {pathsModal.paths.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                                            <FolderOpen size={12} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                                            <span style={{ flex: 1, fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{p}</span>
                                            <button onClick={() => setPathsModal(prev => ({ ...prev, paths: prev.paths.filter((_, j) => j !== i), result: null }))}
                                                style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="text" placeholder="e.g. C:/Data  or  /home/user/nas"
                                        value={pathsModal.newPath}
                                        onChange={e => setPathsModal(p => ({ ...p, newPath: e.target.value, result: null }))}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const v = pathsModal.newPath.trim();
                                                if (v && !pathsModal.paths.includes(v))
                                                    setPathsModal(prev => ({ ...prev, paths: [...prev.paths, v], newPath: '', result: null }));
                                            }
                                        }}
                                        style={{ ...inputStyle, flex: 1, margin: 0 }} onFocus={inputFocus} onBlur={inputBlur}
                                    />
                                    <button type="button"
                                        onClick={() => {
                                            const v = pathsModal.newPath.trim();
                                            if (v && !pathsModal.paths.includes(v))
                                                setPathsModal(prev => ({ ...prev, paths: [...prev.paths, v], newPath: '', result: null }));
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8, color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        <FolderPlus size={13} /> Add
                                    </button>
                                </div>
                                {pathsModal.result && (
                                    <div style={{
                                        padding: '8px 12px', borderRadius: 8, fontSize: 12,
                                        background: pathsModal.result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                        border: `1px solid ${pathsModal.result.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                        color: pathsModal.result.ok ? '#34D399' : '#F87171'
                                    }}>
                                        {pathsModal.result.ok
                                            ? (pathsModal.result.pushed ? t('savedAgentUpdated') : t('agentOfflineWillApply'))
                                            : `✗ ${pathsModal.result.msg}`}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button onClick={() => setPathsModal(p => ({ ...p, open: false }))}
                                        style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                    <button onClick={handleSavePaths} disabled={pathsModal.saving}
                                        style={{ padding: '8px 20px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: pathsModal.saving ? 'wait' : 'pointer', opacity: pathsModal.saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {pathsModal.saving ? t('saving') : t('savePush')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Admin;

