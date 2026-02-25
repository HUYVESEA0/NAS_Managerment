import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Folder, Settings, Users, LogOut, Shield, ChevronDown, Globe, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, LANGUAGES } from '../contexts/LanguageContext';

// ── Language Selector Dropdown ──────────────────────────────────────────
const LanguageSelector = ({ compact = false }) => {
    const { currentLang, setLang, languages, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                id="language-selector-btn"
                onClick={() => setOpen(!open)}
                title={t('language')}
                style={{
                    display: 'flex', alignItems: 'center', gap: compact ? 4 : 6,
                    padding: compact ? '5px 8px' : '5px 10px',
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.18)',
                    borderRadius: 7, cursor: 'pointer',
                    fontSize: compact ? 12 : 13,
                    color: 'var(--text-secondary)',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.18)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
                <span style={{ fontSize: 14 }}>{currentLang.flag}</span>
                {!compact && (
                    <span style={{ fontFamily: "'Fira Code', monospace", fontWeight: 600, letterSpacing: '0.05em', fontSize: 11 }}>
                        {currentLang.short}
                    </span>
                )}
                <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
            </button>

            {open && (
                <div
                    className="animate-fadeUp"
                    style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 10,
                        boxShadow: 'var(--shadow-elevated)',
                        minWidth: 168,
                        overflow: 'hidden',
                    }}
                >
                    {/* Header label */}
                    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('language')}
                        </span>
                    </div>

                    {/* Options */}
                    <div style={{ padding: 4 }}>
                        {languages.map(lang => {
                            const isActive = lang.code === currentLang.code;
                            return (
                                <button
                                    key={lang.code}
                                    id={`lang-option-${lang.code}`}
                                    onClick={() => { setLang(lang.code); setOpen(false); }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: 7,
                                        background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                                        border: `1px solid ${isActive ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.1s',
                                    }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
                                >
                                    {/* Flag */}
                                    <span style={{ fontSize: 18, lineHeight: 1 }}>{lang.flag}</span>

                                    {/* Label */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                                            {lang.label}
                                        </div>
                                    </div>

                                    {/* Short code */}
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, fontFamily: "'Fira Code', monospace",
                                        color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                                        background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)',
                                        border: `1px solid ${isActive ? 'rgba(59,130,246,0.25)' : 'var(--border-subtle)'}`,
                                        padding: '1px 6px', borderRadius: 4,
                                    }}>
                                        {lang.short}
                                    </span>

                                    {/* Active check */}
                                    {isActive && (
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)', boxShadow: '0 0 5px rgba(59,130,246,0.5)', flexShrink: 0 }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Layout ──────────────────────────────────────────────────────────
const DashboardLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAdmin, hasPermission } = useAuth();
    const { t } = useLanguage();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', labelKey: 'overview', icon: LayoutDashboard, show: true },
        { path: '/files', labelKey: 'fileExplorer', icon: Folder, show: hasPermission('READ_FILES', 'BROWSE_FILES') },
        { path: '/network', labelKey: 'network', icon: Globe, show: hasPermission('MANAGE_HIERARCHY') },
        { path: '/admin', labelKey: 'infrastructure', icon: Settings, show: hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') },
        { path: '/users', labelKey: 'usersRoles', icon: Users, show: isAdmin() },
    ].filter(i => i.show);

    const getRoleStyle = (role) => ({
        Admin: { color: '#F87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
        Operator: { color: '#FBBF24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
        User: { color: '#34D399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
        Viewer: { color: '#60A5FA', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
    }[role] || { color: '#8B9DC0', bg: 'rgba(139,157,192,0.12)', border: 'rgba(139,157,192,0.25)' });

    const roleStyle = getRoleStyle(user?.roleName);
    const pageTitle = navItems.find(i => i.path === location.pathname);
    const pageTitleLabel = pageTitle ? t(pageTitle.labelKey) : 'Dashboard';

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <aside style={{
                width: 220, flexShrink: 0,
                background: 'var(--bg-surface)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column',
                position: 'relative', zIndex: 10,
            }}>

                {/* Logo */}
                <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', flexShrink: 0 }}>
                            <Server size={17} color="white" />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>NAS Manager</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>v1.0-beta</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>
                        Navigation
                    </div>

                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 10px', borderRadius: 8, textDecoration: 'none',
                                    fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                                    color: isActive ? '#fff' : 'var(--text-secondary)',
                                    background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(6,182,212,0.15) 100%)' : 'transparent',
                                    border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                                    boxShadow: isActive ? '0 2px 8px rgba(59,130,246,0.1)' : 'none',
                                    transition: 'all 0.15s', position: 'relative',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                {isActive && (
                                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'linear-gradient(180deg,#3B82F6,#06B6D4)', borderRadius: '0 4px 4px 0' }} />
                                )}
                                <Icon size={16} style={{ flexShrink: 0, color: isActive ? 'var(--accent-cyan)' : 'inherit' }} />
                                {t(item.labelKey)}
                            </Link>
                        );
                    })}
                </nav>

                {/* Status Indicator */}
                <div style={{ margin: '0 10px 10px', padding: '10px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} className="pulse-dot" />
                    <span style={{ fontSize: 11, color: '#34D399', fontWeight: 500 }}>{t('systemOnline')}</span>
                </div>

                {/* User section */}
                <div style={{ padding: '0 10px 12px', position: 'relative' }}>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }} />
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: showUserMenu ? 'var(--bg-hover)' : 'transparent', border: '1px solid transparent', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: roleStyle.color, background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <Shield size={9} />{user?.roleName}
                            </div>
                        </div>
                        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    {showUserMenu && (
                        <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowUserMenu(false)} />
                            <div className="animate-fadeUp" style={{ position: 'absolute', bottom: '100%', left: 10, right: 10, marginBottom: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden', zIndex: 50 }}>
                                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{t('signedInAs')}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</div>
                                </div>
                                <div style={{ padding: 4 }}>
                                    <button
                                        onClick={handleLogout}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 7, fontSize: 13, color: '#F87171', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <LogOut size={14} />
                                        {t('signOut')}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

                {/* Top Header */}
                <header style={{ height: 56, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {pageTitleLabel}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Language Selector */}
                        <LanguageSelector />

                        {/* Connection status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 7, fontSize: 11, color: 'var(--accent-cyan)' }}>
                            <Wifi size={12} />
                            <span>{t('connected')}</span>
                        </div>

                        {/* Role badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: roleStyle.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Shield size={11} />
                            {user?.roleName}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
