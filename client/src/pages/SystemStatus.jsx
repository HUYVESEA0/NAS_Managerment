import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Wifi, Server, Play, Square, RefreshCw, Terminal, Clock, MemoryStick, XCircle, AlertTriangle, X } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const SystemStatus = () => {
    const { t } = useLanguage();
    const { isAdmin } = useAuth();
    const [info, setInfo] = useState(null);
    const [stats, setStats] = useState(null);
    const [processes, setProcesses] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [killConfirm, setKillConfirm] = useState(null); // { pid, name }
    const [killing, setKilling] = useState(false);
    const [killMsg, setKillMsg] = useState(null);

    const fetchAllData = async () => {
        try {
            const [infoRes, statsRes, procRes] = await Promise.all([
                api.get('/system/info'),
                api.get('/system/stats'),
                api.get('/system/processes')
            ]);
            setInfo(infoRes.data);
            setStats(statsRes.data);
            setProcesses(procRes.data);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to fetch system data', err);
        } finally {
            setLoading(false);
        }
    };

    // Auto refresh every 5 seconds
    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleKillProcess = async () => {
        if (!killConfirm) return;
        setKilling(true);
        try {
            await api.delete(`/system/processes/${killConfirm.pid}`);
            setKillMsg({ type: 'success', text: `${t('processKilled') || 'Process killed'}: ${killConfirm.name} (PID ${killConfirm.pid})` });
            setKillConfirm(null);
            setTimeout(() => { setKillMsg(null); fetchAllData(); }, 2000);
        } catch (err) {
            setKillMsg({ type: 'error', text: err.response?.data?.error || 'Failed to kill process' });
            setTimeout(() => setKillMsg(null), 3000);
            setKillConfirm(null);
        } finally {
            setKilling(false);
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const formatUptime = (seconds) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        return `${d}d ${h}h ${m}m`;
    };

    if (loading && !info) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <Activity className="pulse-dot" size={24} style={{ marginRight: 10, color: 'var(--accent-cyan)' }} />
                {t('initTelemetry') || 'Initializing Telemetry...'}
            </div>
        );
    }

    return (
        <div className="animate-fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '16px 24px', boxShadow: 'var(--shadow-card)' }}>
                <div>
                    <h1 style={{ fontFamily: "'Fira Code', monospace", fontSize: 20, color: '#34D399', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Terminal size={20} />
                        {t('serverTelemetry')}
                    </h1>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Fira Code', monospace" }}>
                        ROOT // {info?.os.hostname} // {info?.os.distro} {info?.os.release}
                    </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border-subtle)' }}>
                        <Clock size={12} /> {t('uptime') || 'Uptime'}: <span style={{ color: 'white' }}>{formatUptime(info?.os.uptime)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={10} className="pulse-dot" /> {t('lastSync')} {lastUpdate.toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

                {/* CPU */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                            <Cpu size={16} color="#34D399" />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('processor')}</span>
                        </div>
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 18, color: '#34D399', fontWeight: 700 }}>
                            {stats?.cpu.load}%
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: "'Fira Code', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {info?.cpu.manufacturer} {info?.cpu.brand} @ {info?.cpu.speed}GHz
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${stats?.cpu.load}%`, background: 'linear-gradient(90deg, #34D399, #10B981)', transition: 'width 0.5s ease-out' }} />
                    </div>
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                        {stats?.cpu.cores.slice(0, 8).map((load, i) => (
                            <div key={i} style={{ height: 2, background: 'var(--bg-hover)', borderRadius: 1 }}>
                                <div style={{ height: '100%', width: `${load}%`, background: '#059669', transition: 'width 0.5s' }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* MEMORY */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                            <MemoryStick size={16} color="var(--accent-blue)" />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('memory')}</span>
                        </div>
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 18, color: 'var(--accent-blue)', fontWeight: 700 }}>
                            {stats?.memory.percent}%
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: "'Fira Code', monospace" }}>
                        <span>{t('used')} {formatBytes(stats?.memory.used)}</span>
                        <span>{t('total')} {formatBytes(stats?.memory.total)}</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${stats?.memory.percent}%`, background: 'var(--accent-gradient-90)', transition: 'width 0.5s ease-out' }} />
                    </div>
                </div>

                {/* DISKS */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        <HardDrive size={16} color="#F59E0B" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('storageIO')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {stats?.disks.map((d, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-primary)', marginBottom: 4, fontFamily: "'Fira Code', monospace" }}>
                                    <span>{d.fs} ({d.mount})</span>
                                    <span style={{ color: '#F59E0B' }}>{d.percent}%</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${d.percent}%`, background: '#F59E0B', transition: 'width 0.5s ease-out' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* NETWORK */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        <Wifi size={16} color="#A78BFA" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('networkLabel')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stats?.network.map((net, i) => (
                            <div key={i} style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: 11, color: 'white', marginBottom: 6, fontFamily: "'Fira Code', monospace" }}>{t('iface')} {net.iface}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                    <span style={{ color: '#34D399' }}>↓ {formatBytes(net.rx_sec)}/s</span>
                                    <span style={{ color: '#F87171' }}>↑ {formatBytes(net.tx_sec)}/s</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* PROCESSES TABLE */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Server size={16} color="var(--text-muted)" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('activeProcesses')}</span>
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10 }}>
                            Total: {processes?.all} | {t('running')}: {processes?.running}
                        </span>
                    </div>
                    {/* Kill message toast */}
                    {killMsg && (
                        <div style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, background: killMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: killMsg.type === 'success' ? '#34D399' : '#F87171', border: `1px solid ${killMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                            {killMsg.text}
                        </div>
                    )}
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', zIndex: 1 }}>
                            <tr>
                                <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 500, width: 80 }}>{t('pid')}</th>
                                <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 500 }}>{t('processName')}</th>
                                <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 500 }}>{t('user')}</th>
                                <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>{t('cpuPercent')}</th>
                                <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>{t('memPercent')}</th>
                                {isAdmin && <th style={{ padding: '12px 20px', width: 60 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {processes?.list.map((proc) => {
                                const highCpu = proc.cpu > 20;
                                const highMem = proc.mem > 20;
                                return (
                                    <tr key={proc.pid} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '10px 20px', color: 'var(--text-secondary)' }}>{proc.pid}</td>
                                        <td style={{ padding: '10px 20px', color: 'white' }}>{proc.name}</td>
                                        <td style={{ padding: '10px 20px', color: 'var(--text-muted)' }}>{proc.user || '--'}</td>
                                        <td style={{ padding: '10px 20px', textAlign: 'right', color: highCpu ? '#F87171' : '#34D399' }}>{proc.cpu}</td>
                                        <td style={{ padding: '10px 20px', textAlign: 'right', color: highMem ? '#F87171' : 'var(--accent-blue)' }}>{proc.mem}</td>
                                        {isAdmin && (
                                            <td style={{ padding: '10px 14px' }}>
                                                <button onClick={() => setKillConfirm({ pid: proc.pid, name: proc.name })}
                                                    title={t('killProcess') || 'Kill Process'}
                                                    style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#F87171'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                ><XCircle size={13} /></button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Kill Confirm Modal */}
            {killConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                    onClick={() => !killing && setKillConfirm(null)}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14, width: '100%', maxWidth: 380, padding: 24, boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <AlertTriangle size={18} color="#F87171" />
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F87171', margin: 0, fontFamily: "'Fira Code', monospace" }}>{t('killProcess') || 'Kill Process'}</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                            {t('confirmKillProcess') || 'Terminate process'} <strong style={{ color: 'white', fontFamily: "'Fira Code', monospace" }}>{killConfirm.name}</strong> (PID <code style={{ color: '#F87171' }}>{killConfirm.pid}</code>)?
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setKillConfirm(null)} disabled={killing}
                                style={{ flex: 1, padding: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                {t('cancel')}
                            </button>
                            <button onClick={handleKillProcess} disabled={killing}
                                style={{ flex: 1, padding: '9px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#F87171', cursor: killing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                {killing ? <div style={{ width: 13, height: 13, border: '2px solid #F87171', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <XCircle size={13} />}
                                {t('killProcess') || 'Kill'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SystemStatus;
