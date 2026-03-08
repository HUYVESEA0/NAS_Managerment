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
                onClick={() => setOpen(!open)}
                title={t('language')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-hover cursor-pointer text-secondary transition-all"
            >
                <span className="text-sm">{currentLang.flag}</span>
                {!compact && (
                    <span className="font-mono font-bold tracking-widest text-xs uppercase">
                        {currentLang.short}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-elevated border border-border-default rounded-md min-w-[160px] shadow-elevated overflow-hidden animate-fadeUp">
                    <div className="p-1">
                        {languages.map(lang => {
                            const isActive = lang.code === currentLang.code;
                            return (
                                <button
                                    key={lang.code}
                                    onClick={() => { setLang(lang.code); setOpen(false); }}
                                    className={\`w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-left transition-colors font-mono text-sm rounded-sm
                                        \${isActive ? 'bg-accent/10 text-accent font-bold' : 'hover:bg-hover text-secondary hover:text-primary'}
                                    \`}
                                >
                                    <span className="text-base leading-none">{lang.flag}</span>
                                    <span className="flex-1">{lang.label}</span>
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

    const pageTitle = navItems.find(i => i.path === location.pathname);
    const pageTitleLabel = pageTitle ? t(pageTitle.labelKey) : 'Dashboard';

    return (
        <div className="flex h-screen bg-base overflow-hidden text-primary font-sans">

            {/* ── Sidebar ── */}
            <aside className="w-64 bg-surface border-r border-border-default flex flex-col relative z-20 shadow-sm shrink-0">

                {/* Logo */}
                <div className="pt-8 pb-6 px-6">
                    <div className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                        <span className="text-accent">&gt;_</span>
                        <span className="text-primary truncate">NAS.MANAGER</span>
                    </div>
                </div>

                {/* Session */}
                <div className="px-6 pb-6 mb-2">
                    <div className="text-[10px] text-muted font-bold uppercase tracking-widest mb-3">Session</div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success"></div>
                        <div className="font-mono text-xs font-bold leading-tight">
                            <div className="text-primary">{user?.roleName || 'System'}</div>
                            <div className="text-muted font-normal mt-0.5">{user?.username || 'Administrator'}</div>
                        </div>
                        <div className="ml-auto text-[9px] font-bold bg-base border border-border-subtle px-1.5 py-0.5 rounded text-muted shadow-sm uppercase">MASTER</div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 flex flex-col gap-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={\`group flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-sm font-bold transition-all duration-200
                                    \${isActive 
                                    ? 'bg-nav-active-bg text-nav-active-text' 
                                    : 'text-secondary hover:bg-hover hover:text-primary'}
                                \`}
                            >
                                <Icon size={18} className={\`shrink-0 \${isActive ? 'text-accent' : 'text-muted group-hover:text-primary'}\`} />
                                {t(item.labelKey)}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-border-subtle">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-secondary hover:bg-hover hover:text-primary transition-colors font-mono text-sm font-bold"
                    >
                        <LogOut size={18} className="text-muted" />
                        {t('signOut')}
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col overflow-hidden relative bg-base">

                {/* Top Header */}
                <header className="h-20 flex items-center px-8 justify-between shrink-0 relative z-10 w-full pt-2">
                    <div className="font-mono text-secondary text-sm flex items-center gap-2">
                        <span className="text-muted">~/</span> <span className="lowercase">{pageTitleLabel}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Global Search Hint */}
                        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono font-bold text-muted uppercase tracking-widest px-1">
                            PRESS <span className="text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><span className="font-sans">⌘</span>K / CTRL+K</span> TO EXECUTE
                        </div>

                        <div className="flex items-center gap-1 ml-4 border-l border-border-subtle pl-4">
                            <LanguageSelector />
                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 overflow-auto relative z-0">
                    <div className="max-w-[1400px] mx-auto w-full">
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
fs.writeFileSync('src/layouts/DashboardLayout.jsx', fileContent);
console.log('Updated DashboardLayout');
