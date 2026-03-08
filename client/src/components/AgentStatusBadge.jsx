import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HardDrive, RefreshCw, Wifi, WifiOff, Monitor } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

/**
 * AgentStatusBadge — Hiển thị trạng thái kết nối agents trên header.
 * - Badge nhỏ gọn: icon + số agent online
 * - Dropdown panel: chi tiết từng machine + agent status
 * - Real-time update qua WebSocket events
 */
const AgentStatusBadge = () => {
    const { subscribe, connected: wsConnected } = useNotifications();
    const { t } = useLanguage();
    const [agents, setAgents] = useState([]);
    const [machines, setMachines] = useState([]);
    const [localSpawner, setLocalSpawner] = useState(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);

    // Fetch agent summary
    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/agents/summary');
            setAgents(data.agents || []);
            setMachines(data.machines || []);
            setLocalSpawner(data.localSpawner || null);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Real-time updates via WebSocket
    useEffect(() => {
        const unsub1 = subscribe('agent:online', () => fetchSummary());
        const unsub2 = subscribe('agent:offline', () => fetchSummary());
        return () => { unsub1(); unsub2(); };
    }, [subscribe, fetchSummary]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const onlineCount = machines.filter(m => m.agentConnected).length;
    const totalCount = machines.length;
    const allOnline = totalCount > 0 && onlineCount === totalCount;
    const someOnline = onlineCount > 0;

    const statusColor = allOnline
        ? 'bg-success'
        : someOnline
            ? 'bg-warning'
            : 'bg-danger';

    const statusTextColor = allOnline
        ? 'text-success'
        : someOnline
            ? 'text-warning'
            : 'text-danger';

    return (
        <div ref={ref} className="relative">
            {/* Badge Button */}
            <button
                onClick={() => { setOpen(!open); if (!open) fetchSummary(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-hover cursor-pointer text-secondary transition-all"
                title={t('agentStatus')}
            >
                <div className="relative">
                    <HardDrive size={16} className="text-muted" />
                    <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusColor} ring-2 ring-base`} />
                </div>
                <span className={`text-xs font-mono font-bold ${statusTextColor}`}>
                    {onlineCount}/{totalCount}
                </span>
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-elevated border border-border-default rounded-lg min-w-[280px] shadow-elevated animate-fadeUp">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                            <HardDrive size={14} className="text-accent" />
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                                {t('agentStatus')}
                            </span>
                        </div>
                        <button
                            onClick={fetchSummary}
                            disabled={loading}
                            className="p-1 rounded hover:bg-hover text-muted hover:text-primary transition-colors cursor-pointer"
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Machine List */}
                    <div className="max-h-[300px] overflow-y-auto p-2">
                        {machines.length === 0 ? (
                            <div className="text-xs text-muted text-center py-4 font-mono">
                                {t('noMachinesFound')}
                            </div>
                        ) : (
                            machines.map((m) => {
                                const agent = agents.find(a => a.id === m.id);
                                return (
                                    <div
                                        key={m.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-hover transition-colors"
                                    >
                                        <div className="relative shrink-0">
                                            <Monitor size={16} className={m.agentConnected ? 'text-success' : 'text-muted'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-mono font-bold text-primary truncate">
                                                {m.name}
                                            </div>
                                            {agent && (
                                                <div className="text-[10px] text-muted font-mono truncate">
                                                    {agent.hostname} · {agent.platform}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            {m.agentConnected ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-success font-mono uppercase">
                                                    <Wifi size={10} /> {t('online')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-danger font-mono uppercase">
                                                    <WifiOff size={10} /> {t('offline')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Local Spawner Status */}
                    {localSpawner && localSpawner.available && (
                        <div className="px-4 py-2.5 border-t border-border-subtle">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                                    {t('localAgent')}
                                </span>
                                <span className={`text-[10px] font-bold font-mono uppercase ${localSpawner.running ? 'text-success' : 'text-muted'}`}>
                                    {localSpawner.running ? `PID ${localSpawner.pid}` : t('stopped')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* WebSocket connection status */}
                    <div className="px-4 py-2 border-t border-border-subtle flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">WebSocket</span>
                        <span className={`text-[10px] font-bold font-mono uppercase ${wsConnected ? 'text-success' : 'text-danger'}`}>
                            {wsConnected ? t('connected') : t('disconnected')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentStatusBadge;
