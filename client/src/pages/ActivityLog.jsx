import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity, Filter, RefreshCw, Trash2, ChevronLeft, ChevronRight,
    LogIn, LogOut, Upload, Download, FolderPlus, FileMinus, Edit3,
    Server, UserPlus, UserMinus, UserCog, HardDrive, AlertTriangle,
    Info, AlertOctagon, CheckCircle, Search, X, Clock, User, Monitor
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const CATEGORY_COLORS = {
    auth: { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA', border: 'rgba(59,130,246,0.25)' },
    file: { bg: 'rgba(16,185,129,0.12)', text: '#34D399', border: 'rgba(16,185,129,0.25)' },
    agent: { bg: 'rgba(245,158,11,0.12)', text: '#FCD34D', border: 'rgba(245,158,11,0.25)' },
    user: { bg: 'rgba(168,85,247,0.12)', text: '#C084FC', border: 'rgba(168,85,247,0.25)' },
    hierarchy: { bg: 'rgba(236,72,153,0.12)', text: '#F472B6', border: 'rgba(236,72,153,0.25)' },
    system: { bg: 'rgba(99,102,241,0.12)', text: '#818CF8', border: 'rgba(99,102,241,0.25)' },
};

const LEVEL_CONFIG = {
    info: { icon: Info, color: 'var(--accent-blue)', bg: 'rgba(220,38,38,0.08)' },
    warn: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    error: { icon: AlertOctagon, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
    success: { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
};

const ACTION_ICONS = {
    login: LogIn, logout: LogOut,
    login_failed: AlertTriangle,
    upload: Upload, download: Download,
    create_directory: FolderPlus, delete: FileMinus,
    rename: Edit3,
    connect: HardDrive, disconnect: HardDrive,
    create_user: UserPlus, delete_user: UserMinus, update_user: UserCog,
};

const PAGE_SIZE = 50;

const ActivityLog = () => {
    const { t } = useLanguage();
    const { isAdmin } = useAuth();
    const { subscribe } = useNotifications();

    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [liveCount, setLiveCount] = useState(0);
    const [showNewBanner, setShowNewBanner] = useState(false);

    // Filters
    const [filterCategory, setFilterCategory] = useState('');
    const [filterLevel, setFilterLevel] = useState('');
    const [filterMachineId, setFilterMachineId] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');

    const [machines, setMachines] = useState([]);
    const [clearConfirm, setClearConfirm] = useState(false);

    const fetchLogs = useCallback(async (pageNum = 0) => {
        setLoading(true);
        try {
            const params = {
                limit: PAGE_SIZE,
                offset: pageNum * PAGE_SIZE,
            };
            if (filterCategory) params.category = filterCategory;
            if (filterLevel) params.level = filterLevel;
            if (filterMachineId) params.machineId = filterMachineId;
            if (filterFrom) params.from = new Date(filterFrom).toISOString();
            if (filterTo) {
                const to = new Date(filterTo);
                to.setHours(23, 59, 59, 999);
                params.to = to.toISOString();
            }
            const res = await api.get('/activity-logs', { params });
            setLogs(res.data.logs);
            setTotal(res.data.total);
            setLiveCount(0);
            setShowNewBanner(false);
        } catch {
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterLevel, filterMachineId, filterFrom, filterTo]);

    useEffect(() => {
        fetchLogs(page);
    }, [fetchLogs, page]);

    // Reset to page 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [filterCategory, filterLevel, filterMachineId, filterFrom, filterTo]);

    // Load machines for filter dropdown
    useEffect(() => {
        api.get('/hierarchy/machines').then(r => setMachines(r.data || [])).catch(() => {});
    }, []);

    // Live update banner
    useEffect(() => {
        return subscribe('activity:new', () => {
            setLiveCount(c => c + 1);
            if (page === 0) setShowNewBanner(true);
        });
    }, [subscribe, page]);

    // Search filter applied locally (on fetched page)
    const filtered = filterSearch
        ? logs.filter(l =>
            l.message.toLowerCase().includes(filterSearch.toLowerCase()) ||
            (l.user?.username || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
            l.action.toLowerCase().includes(filterSearch.toLowerCase())
        )
        : logs;

    const handleClear = async () => {
        try {
            await api.delete('/activity-logs/clear');
            setClearConfirm(false);
            fetchLogs(0);
        } catch {}
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Activity size={20} style={{ color: 'var(--accent-blue)' }} />
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)' }}>
                        {t('activityLog')}
                    </h1>
                    <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)'
                    }}>{total.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setPage(0); fetchLogs(0); }}
                        style={btnStyle}
                        title={t('refresh')}
                    >
                        <RefreshCw size={14} />
                    </button>
                    {isAdmin() && (
                        <button
                            onClick={() => setClearConfirm(true)}
                            style={{ ...btnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                            title={t('clearLogs')}
                        >
                            <Trash2 size={14} /> {t('clearLogs')}
                        </button>
                    )}
                </div>
            </div>

            {/* New events banner */}
            {showNewBanner && liveCount > 0 && (
                <div
                    onClick={() => { setPage(0); fetchLogs(0); }}
                    style={{
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                        color: '#34D399', fontSize: 12, fontWeight: 600, textAlign: 'center',
                        fontFamily: "'Fira Code', monospace",
                    }}
                >
                    ↑ {liveCount} {t('newEventsClick')}
                </div>
            )}

            {/* Filters */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end'
            }}>
                <Filter size={14} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />

                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        placeholder={t('searchLogs')}
                        style={{ ...inputStyle, paddingLeft: 26 }}
                    />
                </div>

                {/* Category */}
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
                    <option value="">{t('allCategories')}</option>
                    <option value="auth">auth</option>
                    <option value="file">file</option>
                    <option value="agent">agent</option>
                    <option value="user">user</option>
                    <option value="hierarchy">hierarchy</option>
                    <option value="system">system</option>
                </select>

                {/* Level */}
                <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={inputStyle}>
                    <option value="">{t('allLevels')}</option>
                    <option value="info">info</option>
                    <option value="warn">warn</option>
                    <option value="error">error</option>
                </select>

                {/* Machine */}
                <select value={filterMachineId} onChange={e => setFilterMachineId(e.target.value)} style={inputStyle}>
                    <option value="">{t('allMachines')}</option>
                    {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>

                {/* Date range */}
                <input
                    type="date" value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    style={inputStyle}
                    title={t('from')}
                />
                <input
                    type="date" value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    style={inputStyle}
                    title={t('to')}
                />

                {(filterCategory || filterLevel || filterMachineId || filterSearch || filterFrom || filterTo) && (
                    <button
                        onClick={() => { setFilterCategory(''); setFilterLevel(''); setFilterMachineId(''); setFilterSearch(''); setFilterFrom(''); setFilterTo(''); }}
                        style={{ ...btnStyle, fontSize: 11, gap: 4 }}
                    >
                        <X size={12} /> {t('resetFilters')}
                    </button>
                )}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', flex: 1 }}>
                {/* Table header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '80px 90px 100px 1fr 120px 130px 140px',
                    padding: '8px 16px', background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    fontFamily: "'Fira Code', monospace", textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                    <span>{t('level')}</span>
                    <span>{t('category')}</span>
                    <span>{t('action')}</span>
                    <span>{t('message')}</span>
                    <span><Monitor size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />{t('machine')}</span>
                    <span><User size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />{t('user')}</span>
                    <span><Clock size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />{t('time')}</span>
                </div>

                {/* Rows */}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw size={20} className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }} />
                            <div style={{ fontSize: 13 }}>{t('loading')}</div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Activity size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                            <div style={{ fontSize: 13 }}>{t('noActivityYet')}</div>
                        </div>
                    ) : filtered.map((log, i) => {
                        const lvl = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                        const LvlIcon = lvl.icon;
                        const ActIcon = ACTION_ICONS[log.action] || Activity;
                        const cat = CATEGORY_COLORS[log.category] || CATEGORY_COLORS.system;
                        const meta = log.meta ? (() => { try { return JSON.parse(log.meta); } catch { return {}; } })() : {};
                        return (
                            <div
                                key={log.id}
                                style={{
                                    display: 'grid', gridTemplateColumns: '80px 90px 100px 1fr 120px 130px 140px',
                                    padding: '9px 16px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    fontSize: 12,
                                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'; }}
                            >
                                {/* Level */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <LvlIcon size={13} style={{ color: lvl.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: lvl.color, fontFamily: "'Fira Code', monospace", fontWeight: 700 }}>
                                        {log.level.toUpperCase()}
                                    </span>
                                </div>

                                {/* Category */}
                                <div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                        background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
                                        fontFamily: "'Fira Code', monospace"
                                    }}>
                                        {log.category}
                                    </span>
                                </div>

                                {/* Action */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ActIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Fira Code', monospace" }}>
                                        {log.action}
                                    </span>
                                </div>

                                {/* Message */}
                                <div style={{ color: 'var(--text-primary)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {log.message}
                                    </div>
                                    {log.ipAddress && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace", marginTop: 1 }}>
                                            IP: {log.ipAddress}
                                            {meta.path && <span style={{ marginLeft: 8, opacity: 0.7 }}>{meta.path}</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Machine */}
                                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                                    {log.machineId
                                        ? machines.find(m => m.id === log.machineId)?.name || `#${log.machineId}`
                                        : meta.machineId === 'master' ? 'Master' : (meta.machineId ? `#${meta.machineId}` : '—')
                                    }
                                </div>

                                {/* User */}
                                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                                    {log.user?.username || '—'}
                                </div>

                                {/* Time */}
                                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: "'Fira Code', monospace" }}>
                                    {formatDateTime(log.createdAt)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{ ...btnStyle, opacity: page === 0 ? 0.4 : 1 }}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                        {page + 1} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        style={{ ...btnStyle, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* Clear confirm dialog */}
            {clearConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {t('clearLogs')}
                        </h3>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
                            {t('clearLogsConfirm')}
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setClearConfirm(false)} style={btnStyle}>
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleClear}
                                style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                            >
                                <Trash2 size={13} /> {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 6,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    fontFamily: "'Fira Code', monospace", transition: 'all 0.15s'
};

const inputStyle = {
    padding: '6px 10px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)', borderRadius: 6,
    fontSize: 12, color: 'var(--text-primary)', outline: 'none',
    fontFamily: "'Fira Code', monospace", cursor: 'pointer',
    minWidth: 120,
};

function formatDateTime(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default ActivityLog;
