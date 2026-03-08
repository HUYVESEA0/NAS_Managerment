const fs = require('fs');

const fileContent = `import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Folder, Settings, Users, LogOut, Shield, ChevronDown, Globe, Wifi, Activity, Terminal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, LANGUAGES } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import CommandPalette from '../components/CommandPalette';
import ThemeToggle from '../components/ThemeToggle';

// ── Language Selector Dropdown ──────────────────────────────────────────
const LanguageSelector = ({ compact = false }) => {
    const { currentLang, setLang, languages, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                id="language-selector-btn"
                onClick={() => setOpen(!open)}
                title={t('language')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent-glow border border-accent hover:bg-accent/20 cursor-pointer text-secondary hover:text-primary transition-all rounded-none"
            >
                <span className="text-sm">{currentLang.flag}</span>
                {!compact && (
                    <span className="font-mono font-bold tracking-widest text-xs uppercase">
                        {currentLang.short}
                    </span>
                )}
                <ChevronDown size={12} className={\`text-muted transition-transform duration-200 \${open ? 'rotate-180' : ''}\`} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-elevated border-2 border-border-strong min-w-[160px] shadow-elevated overflow-hidden animate-fadeUp">
                    <div className="px-3 py-2 border-b border-border-default bg-surface">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                            {t('language')}
                        </span>
                    </div>
                    <div className="p-1">
                        {languages.map(lang => {
                            const isActive = lang.code === currentLang.code;
                            return (
                                <button
                                    key={lang.code}
                                    id={\`lang-option-\${lang.code}\`}
                                    onClick={() => { setLang(lang.code); setOpen(false); }}
                                    className={\`w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer text-left transition-colors font-mono text-sm
                                        \${isActive ? 'bg-accent/20 border-l-2 border-accent text-primary' : 'hover:bg-hover border-l-2 border-transparent text-secondary'}
                                    \`}
                                >
                                    <span className="text-base leading-none">{lang.flag}</span>
                                    <span className="flex-1 font-mono font-bold">{lang.label}</span>
                                    <span className={\`text-[10px] font-bold px-1.5 py-0.5 border
                                        \${isActive ? 'text-accent border-accent bg-accent/10' : 'text-muted border-border-subtle bg-elevated'}
                                    \`}>
                                        {lang.short}
                                    </span>
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
    const { isDark } = useTheme();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', labelKey: 'overview', icon: LayoutDashboard, show: true },
        { path: '/system', labelKey: 'systemStatus', icon: Activity, show: hasPermission('MANAGE_HIERARCHY') },
        { path: '/files', labelKey: 'fileExplorer', icon: Folder, show: hasPermission('READ_FILES', 'BROWSE_FILES') },
        { path: '/network', labelKey: 'network', icon: Globe, show: hasPermission('MANAGE_HIERARCHY') },
        { path: '/topology', labelKey: 'topology', icon: Wifi, show: hasPermission('MANAGE_HIERARCHY') },
        { path: '/admin', labelKey: 'infrastructure', icon: Settings, show: hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') },
        { path: '/users', labelKey: 'usersRoles', icon: Users, show: isAdmin() },
    ].filter(i => i.show);

    const getRoleStyle = (role) => {
        const rules = {
            Admin: 'text-danger bg-danger/10 border-danger/30',
            Operator: 'text-warning bg-warning/10 border-warning/30',
            User: 'text-success bg-success/10 border-success/30',
            Viewer: 'text-accent bg-accent/10 border-accent/30',
        };
        return rules[role] || 'text-muted bg-elevated border-border-default';
    };

    const roleStyleClasses = getRoleStyle(user?.roleName);
    const pageTitle = navItems.find(i => i.path === location.pathname);
    const pageTitleLabel = pageTitle ? t(pageTitle.labelKey) : 'Dashboard';

    return (
        <div className="flex h-screen bg-base bg-grid-pattern overflow-hidden text-primary font-mono tracking-tight">

            {/* ── Sidebar ── */}
            <aside className="w-64 shrink-0 bg-surface border-r-2 border-border-strong flex flex-col relative z-10 shadow-elevated">

                {/* Logo */}
                <div className="p-5 border-b-2 border-border-strong bg-base flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent text-base flex items-center justify-center border-2 border-text-primary shadow-card shrink-0">
                            <Terminal size={20} className="text-base font-bold invert mix-blend-difference" />
                        </div>
                        <div className="flex flex-col">
                            <div className="font-mono text-base font-bold text-primary uppercase tracking-widest leading-none mb-1">
                                SYS // \n MANAGER
                            </div>
                            <div className="text-[10px] text-accent font-bold tracking-[0.2em] bg-accent/10 px-1 inline-block w-max border border-accent/30">
                                v1.0.0-BETA
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
                    <div className="text-xs font-bold text-muted tracking-widest uppercase px-3 py-2 border-b border-border-subtle mb-2 inline-flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-muted"></div>
                        Index
                    </div>

                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={\`group flex items-center gap-3 px-3 py-2 font-mono text-sm font-bold uppercase tracking-wide border transition-all duration-200
                                    \${isActive 
                                    ? 'bg-nav-active-bg text-nav-active-text border-nav-active-border shadow-glow pl-5' 
                                    : 'text-secondary border-transparent hover:text-primary hover:bg-hover hover:border-border-default hover:pl-4'}
                                \`}
                            >
                                {isActive && <span className="absolute left-0 w-1.5 h-6 bg-accent border-[0.5px] border-base"></span>}
                                <Icon size={16} className={\`shrink-0 \${isActive ? 'text-accent' : 'text-muted group-hover:text-primary'}\`} />
                                {t(item.labelKey)}
                            </Link>
                        );
                    })}
                </nav>

                {/* Status Indicator */}
                <div className="mx-3 mb-2 p-2.5 bg-success/10 border border-success/30 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-success animate-pulse border border-base"></div>
                    <span className="text-xs text-success font-bold uppercase tracking-widest">{t('systemOnline')}</span>
                </div>

                {/* User section */}
                <div className="p-3 bg-base border-t-2 border-border-strong relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className={\`w-full flex items-center gap-3 p-2 border \${showUserMenu ? 'bg-hover border-border-strong' : 'bg-surface border-border-default hover:bg-hover hover:border-border-strong'} transition-colors\`}
                    >
                        <div className="w-8 h-8 shrink-0 bg-accent text-base flex flex-col items-center justify-center font-bold font-mono border border-text-primary shadow-sm uppercase">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 text-left min-w-0 flex flex-col">
                            <div className="text-xs font-bold text-primary truncate uppercase">{user?.username}</div>
                            <div className={\`mt-1 inline-flex items-center gap-1.5 px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-widest border \${roleStyleClasses}\`}>
                                <Shield size={10} />
                                {user?.roleName}
                            </div>
                        </div>
                        <ChevronDown size={14} className={\`text-muted transition-transform \${showUserMenu ? 'rotate-180' : ''}\`} />
                    </button>

                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                            <div className="absolute bottom-full left-3 right-3 mb-2 bg-elevated border-2 border-border-strong shadow-elevated z-50 animate-fadeUp">
                                <div className="p-3 border-b border-border-subtle bg-base/50">
                                    <div className="text-[10px] text-muted mb-1 uppercase tracking-widest">{t('signedInAs')}</div>
                                    <div className="text-sm font-bold text-primary truncate">{user?.username}</div>
                                </div>
                                <div className="p-1.5 bg-elevated">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-danger border border-transparent hover:bg-danger/10 hover:border-danger/30 uppercase tracking-widest transition-colors"
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
            <main className="flex-1 flex flex-col overflow-hidden relative">

                {/* Top Header */}
                <header className="h-16 bg-surface/90 backdrop-blur-md border-b-2 border-border-strong flex items-center px-6 justify-between shrink-0 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-1 h-6 bg-accent"></div>
                        <div className="font-mono text-lg font-bold text-primary uppercase tracking-widest">
                            {pageTitleLabel}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Global Search Hint */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-base border border-border-strong text-muted select-none group hover:border-accent/50 transition-colors">
                            <span className="text-xs uppercase font-bold tracking-widest group-hover:text-accent transition-colors">Search</span>
                            <div className="px-1.5 py-0.5 bg-elevated text-[10px] font-bold border border-border-subtle group-hover:border-accent/50 text-primary">
                                CTRL K
                            </div>
                        </div>

                        <LanguageSelector />
                        <ThemeToggle />

                        <div className={\`flex items-center gap-2 px-2 py-1 flex-col sm:flex-row justify-center border text-[10px] font-bold uppercase tracking-widest \${roleStyleClasses}\`}>
                            <Shield size={12} className="hidden sm:block"/>
                            <span>{user?.roleName}</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-6 sm:p-8 overflow-auto relative">
                    <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50"></div>
                    <div className="max-w-[1600px] mx-auto w-full relative z-10">
                        <Outlet />
                    </div>
                </div>
            </main>

            <CommandPalette />
        </div>
    );
};

export default DashboardLayout;
`
fs.writeFileSync('client/src/layouts/DashboardLayout.jsx', fileContent);
console.log('Updated DashboardLayout');
