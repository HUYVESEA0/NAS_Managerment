const fs = require('fs');
const content = `import React, { useEffect, useState } from 'react';
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
                api.get(\`/agents/status/\${m.id}\`)
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
            const res = await api.get(\`/agents/setup/\${machine.id}\`);
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
        <div className="flex flex-col items-center justify-center h-48 text-accent font-mono uppercase tracking-widest gap-4">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            <span>Loading infrastructure...</span>
        </div>
    );

    if (error) return (
        <div className="p-6 text-center text-danger bg-danger/10 border-2 border-danger font-mono font-bold uppercase tracking-widest">
            {error}
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6 w-full">

            {hierarchy.map((floor) => (
                <section key={floor.id} className="bg-card border-2 border-border-strong shadow-card relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:bg-accent">
                    {/* Floor Header */}
                    <div className="p-4 border-b-2 border-border-strong bg-base flex items-center gap-4 pl-6">
                        <div className="w-10 h-10 bg-accent/20 border border-accent/50 flex items-center justify-center shadow-glow">
                            <Building size={20} className="text-accent" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-mono text-base font-bold text-primary uppercase tracking-widest leading-none mb-1">
                                {floor.name}
                            </span>
                            {floor.description && (
                                <span className="text-xs text-muted uppercase tracking-wider">{floor.description}</span>
                            )}
                        </div>
                        <div className="ml-auto px-3 py-1 cursor-default border border-border-subtle bg-elevated text-xs font-bold text-accent font-mono">
                            DATA_NODES: {floor.rooms.reduce((a, r) => a + r.machines.length, 0)}
                        </div>
                    </div>

                    {/* Rooms Grid */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 bg-card">
                        {floor.rooms.map((room) => (
                            <div key={room.id} className="bg-base border-2 border-border-default hover:border-accent/50 transition-colors flex flex-col">
                                {/* Room Header */}
                                <div className="p-3 border-b-2 border-border-default flex items-center gap-3 bg-elevated/50">
                                    <Server size={16} className="text-accent" />
                                    <span className="text-sm font-bold text-primary uppercase tracking-widest">{room.name}</span>
                                </div>

                                {/* Machines */}
                                <div className="p-4 flex flex-col gap-4">
                                    {room.machines.map((machine) => {
                                        const agentConnected = agentStatuses[machine.id];
                                        const isOnline = machine.status === 'online';
                                        return (
                                            <div key={machine.id}
                                                className={\`group bg-base border-2 p-4 transition-all duration-200 shadow-sm
                                                    \${agentConnected ? 'border-accent/60 hover:border-accent shadow-glow' : 'border-border-subtle hover:border-border-default'}
                                                \`}
                                            >
                                                {/* Machine top row */}
                                                <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-3">
                                                    <div className="flex items-center gap-3">
                                                        <Cpu size={16} className={\`\${agentConnected ? 'text-accent' : 'text-muted'}\`} />
                                                        <span className="font-mono text-sm font-bold text-primary tracking-wider">{machine.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {/* Actions */}
                                                        {hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') && (<div className="flex gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {[
                                                                { icon: Users, onClick: () => setSSHUserMachine(machine), title: 'SSH Users', color: 'text-success' },
                                                                { icon: Edit2, onClick: () => setEditingMachine(machine), title: 'Edit', color: 'text-accent' },
                                                                { icon: Settings, onClick: () => setManagingMounts(machine), title: 'Drives', color: 'text-accent' },
                                                            ].map(({ icon: Icon, onClick, title, color }) => (
                                                                <button key={title} onClick={onClick} title={title}
                                                                    className={\`w-6 h-6 border border-transparent hover:border-text-muted hover:bg-hover flex items-center justify-center transition-colors text-muted hover:\${color}\`}
                                                                ><Icon size={12} /></button>
                                                            ))}
                                                        </div>)}

                                                        {/* Agent status */}
                                                        {agentConnected ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-accent bg-accent/10 border border-accent/40 uppercase tracking-widest">
                                                                <Wifi size={10} /> AGENT_ON
                                                            </span>
                                                        ) : (
                                                            <button onClick={() => openSetupModal(machine)} title="Setup Agent"
                                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-muted bg-hover border border-border-default hover:text-accent hover:border-accent/50 cursor-pointer uppercase tracking-widest transition-colors"
                                                            ><WifiOff size={10} /> NO_AGENT</button>
                                                        )}

                                                        {/* Online/Offline */}
                                                        <span className={\`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border
                                                            \${isOnline ? 'text-success bg-success/10 border-success/40' : 'text-danger bg-danger/10 border-danger/40'}
                                                        \`}>
                                                            {machine.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* IP + SSH tag */}
                                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                                    <span className="flex items-center gap-1.5 text-[11px] text-secondary font-mono bg-elevated px-2 py-1 border border-border-subtle">
                                                        <Activity size={12} className="text-muted" />{machine.ipAddress || 'UNKNOWN'}
                                                    </span>
                                                    {machine.username && (
                                                        <span className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 border border-success/30 px-2 py-1 uppercase tracking-widest font-bold">
                                                            <Terminal size={10} /> SSH_RDY
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Mount Points */}
                                                <div className="flex flex-col gap-1.5">
                                                    {machine.mountPoints.length === 0 ? (
                                                        <div className="text-[11px] text-muted text-center py-2 uppercase tracking-widest border border-dashed border-border-subtle bg-elevated/30">
                                                            {t('noDrivesConfigured') || 'NO_DRIVES_ATTACHED'}
                                                        </div>
                                                    ) : machine.mountPoints.map(mount => (
                                                        <Link key={mount.id}
                                                            to={\`/files?machineId=\${machine.id}&path=\${encodeURIComponent(mount.path)}\`}
                                                            className="flex items-center gap-3 px-3 py-2 bg-elevated border border-border-subtle hover:bg-accent/10 hover:border-accent hover:text-accent text-secondary text-xs transition-all no-underline group/link"
                                                        >
                                                            <HardDrive size={14} className="shrink-0 group-hover/link:text-accent text-muted" />
                                                            <span className="font-mono font-bold tracking-tight truncate">{mount.name}</span>
                                                            {agentConnected && <Wifi size={12} className="ml-auto text-accent opacity-50 group-hover/link:opacity-100" />}
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
                <div className="text-center p-16 bg-base border-2 border-dashed border-border-strong text-muted uppercase tracking-widest">
                    <Server size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-lg text-primary mb-2">INFRASTRUCTURE_EMPTY</p>
                    <p className="text-xs">ACCESS INFRASTRUCTURE DIRECTORY TO INITIALIZE NODES</p>
                </div>
            )}

            {/* Modals */}
            {editingMachine && <MachineEditModal machine={editingMachine} onClose={() => setEditingMachine(null)} onUpdate={handleMachineUpdate} />}
            {managingMounts && <MountPointModal machine={managingMounts} onClose={() => setManagingMounts(null)} onUpdate={handleMachineUpdate} />}
            {sshUserMachine && <SSHUserModal machine={sshUserMachine} onClose={() => setSSHUserMachine(null)} />}

            {/* Setup Agent Modal */}
            {setupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm p-4" onClick={() => { setSetupModal(null); setSetupInfo(null); }}>
                    <div className="animate-fadeUp bg-base border-2 border-accent shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                        
                        <div className="absolute top-0 left-0 right-0 h-1 bg-accent"></div>

                        {/* Modal Header */}
                        <div className="flex items-start justify-between p-6 border-b-2 border-border-strong bg-elevated/50">
                            <div>
                                <h2 className="flex items-center gap-3 text-lg font-bold text-primary font-mono uppercase tracking-widest">
                                    <Terminal size={20} className="text-accent" />
                                    INIT_AGENT // {setupModal.machineName}
                                </h2>
                                <p className="text-xs text-secondary mt-2 tracking-wider">DEPLOY PROTOCOL TO REMOTE TARGET FOR INTERFACE SYNC</p>
                            </div>
                            <button onClick={() => { setSetupModal(null); setSetupInfo(null); }}
                                className="w-8 h-8 border-2 border-transparent hover:border-text-primary flex items-center justify-center text-muted hover:text-primary transition-colors">
                                ✕
                            </button>
                        </div>

                        {setupInfo ? (
                            <div className="p-6 flex flex-col gap-4">
                                {[
                                    { step: 1, title: <>TRANSFER DIR <code className="bg-hover px-1.5 py-0.5 border border-border-strong font-mono text-accent">client_connect</code> TO TARGET</>, desc: \`LOC: NAS_Managerment/client_connect/\` },
                                    { step: 2, title: 'EXECUTE DEPENDENCY SYNC', cmd: 'npm install', field: 'npm' },
                                    { step: 3, title: 'INITIALIZE RUNTIME', cmd: setupInfo.command, field: 'cmd' },
                                ].map(({ step, title, desc, cmd, field }) => (
                                    <div key={step} className="bg-elevated border-2 border-border-strong p-4 group hover:border-accent/50 transition-colors">
                                        <div className={\`flex items-center gap-3 \${(desc || cmd) ? 'mb-3' : ''}\`}>
                                            <span className="w-6 h-6 border-2 border-accent bg-accent/10 flex flex-col items-center justify-center text-xs font-bold text-accent shrink-0">
                                                {step}
                                            </span>
                                            <span className="text-sm font-bold text-primary uppercase tracking-widest">{title}</span>
                                        </div>
                                        {desc && <p className="text-xs text-muted ml-9 font-mono">{desc}</p>}
                                        {cmd && (
                                            <div className="flex items-center justify-between ml-9 mt-2 bg-base border border-border-subtle p-2 group-hover:border-accent/30">
                                                <code className="font-mono text-xs text-success break-all">{cmd}</code>
                                                <button onClick={() => copyToClipboard(cmd, field)}
                                                    className="shrink-0 ml-3 w-8 h-8 border border-border-subtle bg-elevated hover:bg-hover flex items-center justify-center text-muted hover:text-primary transition-colors cursor-pointer">
                                                    {copiedField === field ? <CheckCircle size={14} className="text-success" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="mt-4 p-4 border-2 border-dashed border-border-subtle bg-base flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-center">
                                    <div className="text-muted">WS_ENDPOINT :: <span className="text-accent font-bold">{setupInfo.wsUrl}</span></div>
                                    <div className="text-muted">TARGET_ID :: <span className="text-accent font-bold">{setupInfo.machineId}</span></div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 flex justify-center">
                                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
`
fs.writeFileSync('client/src/pages/Home.jsx', content);
console.log('Updated Home.jsx')
