import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import {
    Bell, X, CheckCircle, AlertTriangle, Info, AlertOctagon,
    HardDrive, Folder, Upload, Trash2, Edit3, Server, Activity
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const ICON_MAP = {
    'agent:online': { icon: HardDrive, color: 'var(--success)' },
    'agent:offline': { icon: HardDrive, color: 'var(--error, #ef4444)' },
    'file:created': { icon: Folder, color: 'var(--accent-blue)' },
    'file:deleted': { icon: Trash2, color: 'var(--error, #ef4444)' },
    'file:renamed': { icon: Edit3, color: 'var(--accent-blue)' },
    'file:uploaded': { icon: Upload, color: 'var(--success)' },
    'hierarchy:changed': { icon: Server, color: 'var(--accent-blue)' },
    'activity:new': { icon: Activity, color: 'var(--text-muted)' },
};

const LEVEL_ICON = {
    info: { icon: Info, color: 'var(--accent-blue)' },
    warn: { icon: AlertTriangle, color: '#f59e0b' },
    error: { icon: AlertOctagon, color: 'var(--error, #ef4444)' },
    success: { icon: CheckCircle, color: 'var(--success)' },
};

function formatEvent(event, data, t) {
    switch (event) {
        case 'agent:online': return `${t('agentConnectedNotif')}: "${data.machineName || data.machineId}"`;
        case 'agent:offline': return `${t('agentDisconnectedNotif')}: "${data.machineName || data.machineId}"`;
        case 'file:created': return `${t('directoryCreatedNotif')} ${data.path?.split('/').pop() || data.path}`;
        case 'file:deleted': return `${t('deletedNotif')} ${data.path?.split('/').pop() || data.path}`;
        case 'file:renamed': return `${t('renamedNotif')} ${data.oldPath?.split('/').pop()} → ${data.newPath}`;
        case 'file:uploaded': return `${t('uploadedNotif')} ${data.path?.split('/').pop() || data.path}`;
        case 'hierarchy:changed': return `${data.entityType} ${data.action}`;
        case 'activity:new': return data.message || `${data.category}: ${data.action}`;
        default: return event;
    }
}

function levelFromEvent(event) {
    if (event.includes('offline') || event.includes('error')) return 'warn';
    if (event.includes('deleted')) return 'info';
    return 'success';
}

let toastIdCounter = 0;

const NotificationToast = () => {
    const { subscribe, connected } = useNotifications();
    const { t } = useLanguage();
    const [toasts, setToasts] = useState([]);
    const [showPanel, setShowPanel] = useState(false);
    const [history, setHistory] = useState([]);
    const panelRef = useRef(null);

    const addToast = useCallback((event, data) => {
        const id = ++toastIdCounter;
        const level = data.level || levelFromEvent(event);
        const message = formatEvent(event, data, t);
        const entry = { id, event, level, message, timestamp: Date.now() };

        setToasts(prev => [...prev.slice(-4), entry]); // max 5 visible
        setHistory(prev => [entry, ...prev].slice(0, 100)); // keep 100 in history

        // Auto remove after 5s
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    useEffect(() => {
        // Toast only for important real-time events (agent status + errors)
        // Routine file ops go to history panel but don't pop a toast
        const toastEvents = ['agent:online', 'agent:offline'];
        const historyEvents = [
            'agent:online', 'agent:offline',
            'file:created', 'file:deleted', 'file:renamed', 'file:uploaded',
            'hierarchy:changed'
        ];

        // activity:new with level warn/error → toast
        const unsubActivity = subscribe('activity:new', (data) => {
            // Always add to history
            const id = ++toastIdCounter;
            const level = data.level || 'info';
            const message = data.message || `${data.category}: ${data.action}`;
            const entry = { id, event: 'activity:new', level, message, timestamp: Date.now() };
            setHistory(prev => [entry, ...prev].slice(0, 100));
            // Only toast if warn or error level
            if (level === 'warn' || level === 'error') {
                setToasts(prev => [...prev.slice(-4), entry]);
                setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
            }
        });

        const unsubs = [
            unsubActivity,
            ...toastEvents.map(evt =>
                subscribe(evt, (data) => addToast(evt, data))
            ),
            ...historyEvents.filter(e => !toastEvents.includes(e)).map(evt =>
                subscribe(evt, (data) => {
                    const id = ++toastIdCounter;
                    const level = levelFromEvent(evt);
                    const message = formatEvent(evt, data, t);
                    const entry = { id, event: evt, level, message, timestamp: Date.now() };
                    setHistory(prev => [entry, ...prev].slice(0, 100));
                })
            ),
        ];
        return () => unsubs.forEach(fn => fn && fn());
    }, [subscribe, addToast]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowPanel(false);
            }
        };
        if (showPanel) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPanel]);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const clearHistory = () => setHistory([]);

    return (
        <>
            {/* Bell Button */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36, height: 36,
                    borderRadius: 8,
                    border: 'none',
                    background: showPanel ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                }}
                title={t('notifications')}
            >
                <Bell size={18} />
                {connected && (
                    <span style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 7, height: 7, borderRadius: '50%',
                        background: history.length > 0 ? 'var(--success)' : 'var(--text-muted)',
                        border: '1.5px solid var(--bg-surface)',
                    }} />
                )}
            </button>

            {/* History Panel */}
            {showPanel && (
                <div ref={panelRef} style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 8,
                    width: 380, maxHeight: 480,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    zIndex: 100,
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>
                            {t('activityLog')}
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                                background: connected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: connected ? 'var(--success)' : 'var(--error, #ef4444)',
                            }}>
                                {connected ? 'LIVE' : 'OFFLINE'}
                            </span>
                            {history.length > 0 && (
                                <button onClick={clearHistory} style={{
                                    fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer',
                                    background: 'none', border: 'none', textDecoration: 'underline',
                                }}>
                                    {t('clear')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                        {history.length === 0 ? (
                            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                {t('noActivityYet')}
                            </div>
                        ) : (
                            history.map(item => {
                                const iconInfo = ICON_MAP[item.event] || LEVEL_ICON[item.level] || LEVEL_ICON.info;
                                const Icon = iconInfo.icon;
                                const ago = formatTimeAgo(item.timestamp);
                                return (
                                    <div key={item.id} style={{
                                        padding: '8px 16px',
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        borderBottom: '1px solid var(--border-subtle)',
                                    }}>
                                        <Icon size={15} style={{ color: iconInfo.color, marginTop: 2, flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.message}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ago}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Toast Stack */}
            <div style={{
                position: 'fixed', bottom: 24, right: 24,
                display: 'flex', flexDirection: 'column-reverse', gap: 8,
                zIndex: 9999, pointerEvents: 'none',
            }}>
                {toasts.map(toast => {
                    const iconInfo = ICON_MAP[toast.event] || LEVEL_ICON[toast.level] || LEVEL_ICON.info;
                    const Icon = iconInfo.icon;
                    return (
                        <div key={toast.id} style={{
                            pointerEvents: 'auto',
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 10,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            minWidth: 280, maxWidth: 400,
                            animation: 'slideInRight 0.25s ease-out',
                        }}>
                            <Icon size={16} style={{ color: iconInfo.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {toast.message}
                            </span>
                            <button onClick={() => removeToast(toast.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                            }}>
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

function formatTimeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleString();
}

export default NotificationToast;
