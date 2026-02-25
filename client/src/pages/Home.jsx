import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Server, HardDrive, Cpu, Activity, Edit2, Settings, Wifi, WifiOff, Copy, CheckCircle, Terminal, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MachineEditModal from '../components/MachineEditModal';
import MountPointModal from '../components/MountPointModal';
import SSHUserModal from '../components/SSHUserModal';

const Home = () => {
    const [hierarchy, setHierarchy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingMachine, setEditingMachine] = useState(null);
    const [managingMounts, setManagingMounts] = useState(null);
    const [agentStatuses, setAgentStatuses] = useState({});
    const [setupModal, setSetupModal] = useState(null); // { machineId, machineName }
    const [setupInfo, setSetupInfo] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [sshUserMachine, setSSHUserMachine] = useState(null);
    const { hasPermission } = useAuth();

    const fetchHierarchy = async () => {
        try {
            const response = await api.get('/hierarchy');
            setHierarchy(response.data);

            // Fetch agent status cho tất cả machines
            const machines = response.data.flatMap(f => f.rooms.flatMap(r => r.machines));
            const statusPromises = machines.map(m =>
                api.get(`/agents/status/${m.id}`)
                    .then(res => ({ machineId: m.id, connected: res.data.agentConnected }))
                    .catch(() => ({ machineId: m.id, connected: false }))
            );
            const statuses = await Promise.all(statusPromises);
            const statusMap = {};
            statuses.forEach(s => { statusMap[s.machineId] = s.connected; });
            setAgentStatuses(statusMap);
        } catch (err) {
            setError('Failed to load hierarchy');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHierarchy();
        // Refresh agent status mỗi 10s
        const interval = setInterval(() => {
            api.get('/agents').then(res => {
                const statusMap = {};
                res.data.forEach(a => {
                    if (a.machineId) statusMap[a.machineId] = true;
                });
                setAgentStatuses(prev => {
                    const next = {};
                    Object.keys(prev).forEach(k => { next[k] = false; });
                    return { ...next, ...statusMap };
                });
            }).catch(() => { });
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const handleMachineUpdate = () => {
        fetchHierarchy();
    };

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

    if (loading) return <div className="p-8 text-center text-gray-500">Loading hierarchy...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="space-y-8">
            {hierarchy.map((floor) => (
                <section key={floor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Building className="w-5 h-5 text-indigo-500" />
                            {floor.name}
                            <span className="text-sm font-normal text-gray-500 ml-2">({floor.description})</span>
                        </h3>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {floor.rooms.map((room) => (
                            <div key={room.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <h4 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                                    <Server className="w-4 h-4 text-gray-400" />
                                    {room.name}
                                </h4>

                                <div className="space-y-3">
                                    {room.machines.map((machine) => (
                                        <div key={machine.id} className="group relative bg-gray-50 rounded-md p-3 border border-gray-100 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className="w-4 h-4 text-indigo-600" />
                                                    <span className="font-medium text-gray-900">{machine.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {/* Agent Status Indicator */}
                                                    {agentStatuses[machine.id] ? (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <Wifi className="w-3 h-3" />
                                                            Agent
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => openSetupModal(machine)}
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer"
                                                            title="Setup Agent"
                                                        >
                                                            <WifiOff className="w-3 h-3" />
                                                            No Agent
                                                        </button>
                                                    )}

                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${machine.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {machine.status}
                                                    </span>

                                                    {hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') && (
                                                        <>
                                                            <button
                                                                onClick={() => setSSHUserMachine(machine)}
                                                                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-emerald-600 transition-colors"
                                                                title="SSH Users"
                                                            >
                                                                <Users className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingMachine(machine)}
                                                                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                                                                title="Edit Machine Settings"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => setManagingMounts(machine)}
                                                                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                                                                title="Manage Drives"
                                                            >
                                                                <Settings className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="text-xs text-gray-500 flex items-center gap-1" title="IP Address">
                                                    <Activity className="w-3 h-3" />
                                                    {machine.ipAddress || 'No IP'}
                                                </div>
                                                {machine.username && (
                                                    <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title={`SSH User: ${machine.username}`}>
                                                        <Terminal className="w-3 h-3" />
                                                        SSH Ready
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                {machine.mountPoints.length === 0 ? (
                                                    <div className="text-xs text-center text-gray-400 italic py-2">No drives configured</div>
                                                ) : (
                                                    machine.mountPoints.map(mount => (
                                                        <Link
                                                            key={mount.id}
                                                            to={`/files?machineId=${machine.id}&path=${encodeURIComponent(mount.path)}`}
                                                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-white p-1.5 rounded transition-colors"
                                                        >
                                                            <HardDrive className="w-3 h-3" />
                                                            {mount.name}
                                                            {agentStatuses[machine.id] && (
                                                                <Wifi className="w-2.5 h-2.5 text-emerald-500 ml-auto" />
                                                            )}
                                                        </Link>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {hierarchy.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No infrastructure set up yet.</p>
                </div>
            )}

            {editingMachine && (
                <MachineEditModal
                    machine={editingMachine}
                    onClose={() => setEditingMachine(null)}
                    onUpdate={handleMachineUpdate}
                />
            )}

            {managingMounts && (
                <MountPointModal
                    machine={managingMounts}
                    onClose={() => setManagingMounts(null)}
                    onUpdate={handleMachineUpdate}
                />
            )}

            {sshUserMachine && (
                <SSHUserModal
                    machine={sshUserMachine}
                    onClose={() => setSSHUserMachine(null)}
                />
            )}

            {/* ==================== SETUP AGENT MODAL ==================== */}
            {setupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setSetupModal(null); setSetupInfo(null); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 animate-scaleIn max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <Terminal className="w-5 h-5 text-indigo-500" />
                                    Setup Agent — {setupModal.machineName}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Install the agent on the remote machine to share its directories</p>
                            </div>
                            <button onClick={() => { setSetupModal(null); setSetupInfo(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {setupInfo && (
                            <div className="space-y-5">
                                {/* Step 1 */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                        <span className="font-medium text-gray-700 text-sm">Copy the <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">agent</code> folder to the remote machine</span>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-8">The folder is at <code className="bg-gray-200 px-1 rounded">NAS_Managerment/agent/</code></p>
                                </div>

                                {/* Step 2 */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                        <span className="font-medium text-gray-700 text-sm">Install dependencies on the remote machine</span>
                                    </div>
                                    <div className="ml-8 mt-2 bg-gray-900 rounded-lg p-3 flex items-center justify-between group">
                                        <code className="text-green-400 text-sm font-mono">npm install</code>
                                        <button
                                            onClick={() => copyToClipboard('npm install', 'npm')}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors"
                                        >
                                            {copiedField === 'npm' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                        <span className="font-medium text-gray-700 text-sm">Run the agent</span>
                                    </div>
                                    <div className="ml-8 mt-2 bg-gray-900 rounded-lg p-3 flex items-center justify-between group">
                                        <code className="text-green-400 text-sm font-mono break-all">{setupInfo.command}</code>
                                        <button
                                            onClick={() => copyToClipboard(setupInfo.command, 'cmd')}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors flex-shrink-0 ml-2"
                                        >
                                            {copiedField === 'cmd' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Step 4 (Optional) */}
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">💡</span>
                                        <span className="font-medium text-blue-700 text-sm">Share specific directories</span>
                                    </div>
                                    <div className="ml-8 mt-2 bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                                        <code className="text-green-400 text-xs font-mono break-all">{setupInfo.command} --paths "C:\\Users,D:\\Data"</code>
                                        <button
                                            onClick={() => copyToClipboard(`${setupInfo.command} --paths "C:\\Users,D:\\Data"`, 'paths')}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors flex-shrink-0 ml-2"
                                        >
                                            {copiedField === 'paths' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Connection info */}
                                <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
                                    WebSocket URL: <code className="bg-gray-100 px-1.5 rounded">{setupInfo.wsUrl}</code>
                                    <span className="mx-2">•</span>
                                    Machine ID: <code className="bg-gray-100 px-1.5 rounded">{setupInfo.machineId}</code>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scaleIn {
                    animation: scaleIn 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default Home;
