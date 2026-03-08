import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Activity, Server, Users, Wifi, ShieldCheck, Cpu, HardDrive, AlertCircle } from 'lucide-react';
import api from '../services/api';

const formatBps = (bytes) => {
    if (!bytes || bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Home = () => {
    const { t } = useLanguage();
    
    // --- Real Data States ---
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState([]);
    const [sysStats, setSysStats] = useState(null);
    const [totalMachines, setTotalMachines] = useState(0);
    const [userCount, setUserCount] = useState(1);
    const [dynAlerts, setDynAlerts] = useState([]);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                // 1. Fetch Agents
                const agentsRes = await api.get('/agents').catch(() => ({ data: [] }));
                if (!isMounted) return;
                const connectedAgents = agentsRes.data || [];
                setAgents(connectedAgents);

                // 2. Fetch Master System Stats
                const sysRes = await api.get('/system/stats').catch(() => ({ data: null }));
                if (isMounted && sysRes.data) {
                    setSysStats(sysRes.data);
                }

                // 3. Fetch Hierarchy to know total configured machines
                const hierarchyRes = await api.get('/hierarchy').catch(() => ({ data: [] }));
                if (isMounted && hierarchyRes.data) {
                    let mCount = 0;
                    hierarchyRes.data.forEach(floor => {
                        floor.rooms?.forEach(room => {
                            mCount += (room.machines?.length || 0);
                        });
                    });
                    setTotalMachines(mCount);
                }

                // 4. Try fetch Users
                const usersRes = await api.get('/users').catch(() => ({ data: [] }));
                if (isMounted && usersRes.data && usersRes.data.length > 0) {
                    setUserCount(usersRes.data.length);
                }

                // 5. Generate Dynamic Alerts
                const newAlerts = [];
                if (sysRes.data && sysRes.data.cpu && sysRes.data.cpu.load > 85) {
                    newAlerts.push({ type: 'warning', msg: `${t('highMasterCpu')} (${sysRes.data.cpu.load}%)`, time: t('justNow') });
                }
                connectedAgents.forEach(agent => {
                    const load = parseFloat(agent.systemInfo?.cpu?.load || 0);
                    if (load > 85) {
                        newAlerts.push({ type: 'error', msg: `${t('highCpuOn')} ${agent.machineName || agent.id} (${load}%)`, time: t('justNow') });
                    }
                });
                if (newAlerts.length === 0) {
                    newAlerts.push({ type: 'info', msg: t('systemNormal'), time: t('live') });
                }
                if (isMounted) setDynAlerts(newAlerts);
                if (isMounted) setLoading(false);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // --- Derived Data for UI ---
    
    // Fallback if no hierarchy, assume total is at least Master + agents
    const displayTotalMachines = totalMachines > 0 ? totalMachines + 1 : agents.length + 1; 
    const activeNodesDisplay = `${agents.length + 1}/${displayTotalMachines}`;

    let networkLoad = '0 B/s';
    if (sysStats && sysStats.network) {
        // Sum rx/tx of main network interfaces
        const totalRxTx = sysStats.network.reduce((acc, n) => acc + (n.rx_sec || 0) + (n.tx_sec || 0), 0);
        networkLoad = formatBps(totalRxTx);
    }

    const stats = [
        { label: t('activeNodes'), value: activeNodesDisplay, icon: Server, color: 'text-success' },
        { label: t('networkLoad'), value: networkLoad, icon: Wifi, color: 'text-accent' },
        { label: t('users'), value: userCount.toString(), icon: Users, color: 'text-blue-500' },
        { label: t('security'), value: t('secure'), icon: ShieldCheck, color: 'text-success' }
    ];

    const nodesToDisplay = [];
    if (sysStats) {
        nodesToDisplay.push({
            id: 'master',
            name: t('masterNode'),
            cpu: sysStats.cpu?.load || 0,
            ram: sysStats.memory?.percent || 0,
            status: 'online'
        });
    }
    agents.forEach(agent => {
        nodesToDisplay.push({
            id: agent.id,
            name: agent.machineName || agent.hostname || `Node-${agent.id}`,
            cpu: parseFloat(agent.systemInfo?.cpu?.load || 0).toFixed(1),
            ram: parseFloat(agent.systemInfo?.memory?.percent || 0).toFixed(1),
            status: 'online'
        });
    });

    if (nodesToDisplay.length === 0 && !loading) {
        nodesToDisplay.push({
            id: 'master-fallback',
            name: t('masterNodeConnecting'),
            cpu: 0,
            ram: 0,
            status: 'offline'
        });
    }

    return (
        <div className="space-y-6">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-default pb-6">
                <div>
                    <h1 className="text-3xl font-bold font-mono text-primary flex items-center gap-3">
                        <Activity className="text-accent" size={32} />
                        {t('systemOverviewTitle')}
                    </h1>
                    <p className="text-secondary mt-1 max-w-2xl text-sm">
                        {t('systemOverviewSubtitle')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-accent text-white font-bold rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2">
                        {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {t('generateReport')}
                    </button>
                    <button className="px-4 py-2 border border-border-strong bg-surface text-primary font-bold rounded shadow-sm hover:bg-hover transition-colors">
                        {t('settings')}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="bg-surface rounded-xl border border-border-default shadow-sm p-5 relative overflow-hidden group hover:border-accent transition-colors">
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                                    <h3 className="text-2xl font-bold text-primary tracking-tight">
                                        {loading && i < 2 ? <span className="text-muted/50 text-lg animate-pulse">{t('loading')}</span> : stat.value}
                                    </h3>
                                </div>
                                <div className={`p-3 bg-base rounded-lg ${stat.color}`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                            
                            {/* Decorative background accent */}
                            <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Icon size={100} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Graph Area */}
                <div className="lg:col-span-2">
                    <div className="bg-surface rounded-xl border border-border-default shadow-sm h-[400px] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-base/50">
                            <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                                <Activity size={18} className="text-accent" />
                                {t('clusterPerformance')}
                            </h2>
                            <div className="flex gap-2 text-xs font-mono">
                                <button className="px-2 py-1 bg-accent/10 text-accent rounded font-bold">{t('live')}</button>
                                <button className="px-2 py-1 text-muted hover:text-primary transition-colors">1H</button>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center bg-stripes relative">
                            {/* Mockup for Live Graph Area but showing real numeric bounds */}
                            {sysStats ? (
                                <div className="text-center">
                                    <div className="text-4xl font-mono font-bold text-accent mb-2">
                                        {sysStats.cpu?.load || '0.00'}%
                                    </div>
                                    <div className="text-muted font-mono text-sm uppercase tracking-widest">{t('masterCpuLoad')}</div>
                                    
                                    <div className="mt-8 flex gap-8">
                                        <div>
                                            <div className="text-lg font-mono font-bold text-primary">{sysStats.memory?.percent || '0.0'}%</div>
                                            <div className="text-xs text-muted font-mono">{t('ramUsed')}</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-mono font-bold text-primary">{agents.length}</div>
                                            <div className="text-xs text-muted font-mono">{t('peers')}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-muted font-mono text-sm">
                                    {loading ? t('initializingTelemetry') : t('awaitingDataStream')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Alerts */}
                <div>
                    <div className="bg-surface rounded-xl border border-border-default shadow-sm h-[400px] flex flex-col">
                        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-base/50">
                            <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                                <AlertCircle size={18} className={`${dynAlerts.some(a => a.type === 'error' || a.type === 'warning') ? 'text-warning' : 'text-success'}`} />
                                {t('recentEvents')}
                            </h2>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dynAlerts.some(a => a.type === 'error' || a.type === 'warning') ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                {dynAlerts.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {dynAlerts.map((alert, i) => (
                                <div key={i} className="p-3 mb-2 rounded border border-border-subtle bg-base flex gap-3 items-start animate-fadeUp" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className={`mt-0.5 ${
                                        alert.type === 'error' ? 'text-danger' : 
                                        alert.type === 'warning' ? 'text-warning' : 'text-blue-500'
                                    }`}>
                                        <AlertCircle size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-primary">{alert.msg}</p>
                                        <p className="text-xs text-muted font-mono mt-1">{alert.time}</p>
                                    </div>
                                </div>
                            ))}
                            {loading && dynAlerts.length === 0 && (
                                <div className="p-4 text-center text-muted font-mono text-xs">{t('scanningLogs')}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Node Status */}
            <div>
                 <div className="bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden min-h-[150px]">
                    <div className="px-5 py-4 border-b border-border-subtle bg-base/50 flex justify-between items-center">
                        <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                            <Server size={18} className="text-accent" />
                            {t('nodeMatrix')}
                        </h2>
                        {loading && <div className="text-xs text-muted font-mono animate-pulse">{t('syncing')}</div>}
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {nodesToDisplay.map((node, i) => (
                            <Link key={node.id} to={`/files?machineId=${node.id}`} className="border border-border-subtle rounded-lg p-4 bg-base relative overflow-hidden group hover:border-accent hover:shadow-card transition-all" style={{ textDecoration: 'none' }}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-mono font-bold text-primary flex items-center gap-2 truncate pr-2 group-hover:text-accent transition-colors">
                                        <HardDrive size={16} className={node.id === 'master' ? 'text-accent' : 'text-muted'} />
                                        {node.name}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${node.status === 'online' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-muted'}`}></span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-secondary">{t('cpu')}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${node.cpu > 80 ? 'bg-danger' : node.cpu > 50 ? 'bg-warning' : 'bg-success'}`}
                                                    style={{ width: `${Math.min(100, Math.max(0, node.cpu))}%` }}
                                                ></div>
                                            </div>
                                            <span className="font-mono text-primary font-bold min-w-[3ch] text-right">{node.cpu}%</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-secondary">{t('ram')}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${node.ram > 80 ? 'bg-danger' : node.ram > 50 ? 'bg-warning' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, Math.max(0, node.ram))}%` }}
                                                ></div>
                                            </div>
                                            <span className="font-mono text-primary font-bold min-w-[3ch] text-right">{node.ram}%</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                 </div>
            </div>

        </div>
    );
};

export default Home;