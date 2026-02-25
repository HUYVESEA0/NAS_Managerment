import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Server, HardDrive, Cpu, Activity, Edit2, Settings, Wifi, WifiOff, Copy, CheckCircle, Terminal, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MachineEditModal from '../components/MachineEditModal';
import MountPointModal from '../components/MountPointModal';
import SSHUserModal from '../components/SSHUserModal';
import { useLanguage } from '../contexts/LanguageContext';

const Home = () => {
    const { t } = useLanguage();
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingMachine, setEditingMachine] = useState(null);
    const [managingMounts, setManagingMounts] = useState(null);
    const [agentStatuses, setAgentStatuses] = useState({});
    const [setupModal, setSetupModal] = useState(null);
    const [setupInfo, setSetupInfo] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [sshUserMachine, setSSHUserMachine] = useState(null);
    const { hasPermission } = useAuth();

    const fetchHierarchy = async () => {
        try {
            const response = await api.get('/hierarchy');
            setHierarchy(response.data);
            const machines = response.data.flatMap(f => f.rooms.flatMap(r => r.machines));
            const statuses = await Promise.all(machines.map(m =>
                api.get(`/agents/status/${m.id}`)
                    .then(res => ({ machineId: m.id, connected: res.data.agentConnected }))
                    .catch(() => ({ machineId: m.id, connected: false }))
            ));
            const statusMap = {};
            statuses.forEach(s => { statusMap[s.machineId] = s.connected; });
            setAgentStatuses(statusMap);
        } catch (err) {
            setError('Failed to load hierarchy');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHierarchy();
        const interval = setInterval(() => {
            api.get('/agents').then(res => {
                const statusMap = {};
                res.data.forEach(a => { if (a.machineId) statusMap[a.machineId] = true; });
                setAgentStatuses(prev => {
                    const next = {};
                    Object.keys(prev).forEach(k => { next[k] = false; });
                    return { ...next, ...statusMap };
                });
            }).catch(() => { });
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleMachineUpdate = () => fetchHierarchy();

    const openSetupModal = async (machine) => {
        setSetupModal({ machineId: machine.id, machineName: machine.name });
        try {
            const res = await api.get(`/agents/setup/${machine.id}`);
            setSetupInfo(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // ─── Loading State ───────────────────────────────────────────────
    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', gap: 10 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            Loading infrastructure...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error) return (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
            {error}
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {hierarchy.map((floor) => (
                <section key={floor.id} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-card)',
                }}>
                    {/* Floor Header */}
                    <div style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'linear-gradient(90deg, rgba(59,130,246,0.06) 0%, transparent 60%)',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 7,
                            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Building size={14} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {floor.name}
                            </span>
                            {floor.description && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{floor.description}</span>
                            )}
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                            {floor.rooms.reduce((a, r) => a + r.machines.length, 0)} {t('activeMachines')?.toLowerCase()}
                        </div>
                    </div>

                    {/* Rooms Grid */}
                    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {floor.rooms.map((room) => (
                            <div key={room.id} style={{
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                borderRadius: 10, overflow: 'hidden',
                            }}>
                                {/* Room Header */}
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Server size={13} color="var(--text-muted)" />
                                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{room.name}</span>
                                </div>

                                {/* Machines */}
                                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {room.machines.map((machine) => {
                                        const agentConnected = agentStatuses[machine.id];
                                        const isOnline = machine.status === 'online';
                                        return (
                                            <div key={machine.id}
                                                style={{
                                                    background: 'var(--bg-card)',
                                                    border: `1px solid ${agentConnected ? 'rgba(6,182,212,0.2)' : 'var(--border-subtle)'}`,
                                                    borderRadius: 8, padding: '10px 12px',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.08)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = agentConnected ? 'rgba(6,182,212,0.2)' : 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                                            >
                                                {/* Machine top row */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                        <Cpu size={13} color="var(--accent-cyan)" />
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{machine.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        {/* Agent status */}
                                                        {agentConnected ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, color: '#06B6D4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}>
                                                                <Wifi size={9} /> Agent
                                                            </span>
                                                        ) : (
                                                            <button onClick={() => openSetupModal(machine)} title="Setup Agent"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                                            ><WifiOff size={9} /> No Agent</button>
                                                        )}

                                                        {/* Online/Offline */}
                                                        <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, color: isOnline ? '#34D399' : '#F87171', background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                                                            {machine.status}
                                                        </span>

                                                        {/* Actions */}
                                                        {hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') && (<>
                                                            {[
                                                                { icon: Users, onClick: () => setSSHUserMachine(machine), title: 'SSH Users', hoverColor: '#34D399', hoverBg: 'rgba(16,185,129,0.1)' },
                                                                { icon: Edit2, onClick: () => setEditingMachine(machine), title: 'Edit', hoverColor: 'var(--accent-blue)', hoverBg: 'rgba(59,130,246,0.1)' },
                                                                { icon: Settings, onClick: () => setManagingMounts(machine), title: 'Drives', hoverColor: 'var(--accent-blue)', hoverBg: 'rgba(59,130,246,0.1)' },
                                                            ].map(({ icon: Icon, onClick, title, hoverColor, hoverBg }) => (
                                                                <button key={title} onClick={onClick} title={title}
                                                                    style={{ width: 24, height: 24, borderRadius: 5, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                                ><Icon size={12} /></button>
                                                            ))}
                                                        </>)}
                                                    </div>
                                                </div>

                                                {/* IP + SSH tag */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                                                        <Activity size={10} />{machine.ipAddress || '—'}
                                                    </span>
                                                    {machine.username && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#34D399', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '1px 7px', borderRadius: 20 }}>
                                                            <Terminal size={9} /> SSH Ready
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Mount Points */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    {machine.mountPoints.length === 0 ? (
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0', fontStyle: 'italic' }}>
                                                            {t('noDrivesConfigured') || 'No drives configured'}
                                                        </div>
                                                    ) : machine.mountPoints.map(mount => (
                                                        <Link key={mount.id}
                                                            to={`/files?machineId=${machine.id}&path=${encodeURIComponent(mount.path)}`}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', background: 'var(--bg-elevated)', border: '1px solid transparent', transition: 'all 0.15s' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.background = 'rgba(6,182,212,0.06)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.2)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'transparent'; }}
                                                        >
                                                            <HardDrive size={11} style={{ flexShrink: 0 }} />
                                                            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11 }}>{mount.name}</span>
                                                            {agentConnected && <Wifi size={9} style={{ marginLeft: 'auto', color: 'var(--accent-cyan)', opacity: 0.7 }} />}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* Empty State */}
            {hierarchy.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)', border: '1px dashed var(--border-default)', borderRadius: 14, color: 'var(--text-muted)' }}>
                    <Server size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p>{t('noInfrastructure') || 'No infrastructure set up yet.'}</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>{t('noInfrastructureHint') || 'Go to Infrastructure tab to add floors and machines.'}</p>
                </div>
            )}

            {/* Modals */}
            {editingMachine && <MachineEditModal machine={editingMachine} onClose={() => setEditingMachine(null)} onUpdate={handleMachineUpdate} />}
            {managingMounts && <MountPointModal machine={managingMounts} onClose={() => setManagingMounts(null)} onUpdate={handleMachineUpdate} />}
            {sshUserMachine && <SSHUserModal machine={sshUserMachine} onClose={() => setSSHUserMachine(null)} />}

            {/* Setup Agent Modal */}
            {setupModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setSetupModal(null); setSetupInfo(null); }}>
                    <div className="animate-fadeUp"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-elevated)', width: '100%', maxWidth: 520, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        {/* Modal Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>
                                    <Terminal size={16} color="var(--accent-blue)" />
                                    {t('setupAgent') || 'Setup Agent'} — {setupModal.machineName}
                                </h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('setupAgentDesc') || 'Install on remote machine to share directories'}</p>
                            </div>
                            <button onClick={() => { setSetupModal(null); setSetupInfo(null); }}
                                style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
                                ✕
                            </button>
                        </div>

                        {setupInfo && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[
                                    { step: 1, title: <>{t('copyFolder') || 'Copy'} <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>client_connect</code> {t('toRemoteMachine') || 'to remote machine'}</>, desc: `${t('locatedAt') || 'Located at:'} NAS_Managerment/client_connect/` },
                                    { step: 2, title: t('installDependencies') || 'Install dependencies', cmd: 'npm install', field: 'npm' },
                                    { step: 3, title: t('runTheAgent') || 'Run the agent', cmd: setupInfo.command, field: 'cmd' },
                                ].map(({ step, title, desc, cmd, field }) => (
                                    <div key={step} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: desc || cmd ? 8 : 0 }}>
                                            <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)' }}>{step}</span>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
                                        </div>
                                        {desc && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 30 }}>{desc}</p>}
                                        {cmd && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginLeft: 30, marginTop: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '8px 10px' }}>
                                                <code style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#34D399', wordBreak: 'break-all' }}>{cmd}</code>
                                                <button onClick={() => copyToClipboard(cmd, field)}
                                                    style={{ flexShrink: 0, marginLeft: 10, width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    {copiedField === field ? <CheckCircle size={13} color="#34D399" /> : <Copy size={13} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontFamily: "'Fira Code', monospace" }}>
                                    WS: <span style={{ color: 'var(--text-secondary)' }}>{setupInfo.wsUrl}</span>
                                    {' · '}ID: <span style={{ color: 'var(--text-secondary)' }}>{setupInfo.machineId}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
