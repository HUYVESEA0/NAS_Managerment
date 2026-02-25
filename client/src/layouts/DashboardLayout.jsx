import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Folder, Settings, Users, LogOut, Shield, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DashboardLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAdmin, hasPermission } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Nav items dựa trên quyền
    const navItems = [
        { path: '/', label: 'Overview', icon: LayoutDashboard, show: true },
        { path: '/files', label: 'File Explorer', icon: Folder, show: hasPermission('READ_FILES', 'BROWSE_FILES') },
        { path: '/network', label: 'Network', icon: Globe, show: hasPermission('MANAGE_HIERARCHY') },
        { path: '/admin', label: 'Infrastructure', icon: Settings, show: hasPermission('MANAGE_HIERARCHY', 'WRITE_HIERARCHY') },
        { path: '/users', label: 'Users & Roles', icon: Users, show: isAdmin() },
    ].filter(item => item.show);

    const getRoleBadgeColor = (roleName) => {
        switch (roleName) {
            case 'Admin': return 'bg-red-50 text-red-600 border-red-200';
            case 'Operator': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'User': return 'bg-green-50 text-green-600 border-green-200';
            case 'Viewer': return 'bg-blue-50 text-blue-600 border-blue-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                        <Server className="w-6 h-6" />
                        NAS Manager
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-indigo-50 text-indigo-600 font-medium shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info at bottom */}
                <div className="p-4 border-t border-gray-100 relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-medium text-gray-700 truncate">{user?.username}</div>
                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeColor(user?.roleName)}`}>
                                <Shield className="w-2.5 h-2.5" />
                                {user?.roleName}
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* User Dropdown Menu */}
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-fadeUp">
                                <div className="p-3 bg-gray-50 border-b border-gray-100">
                                    <p className="text-xs text-gray-500">Signed in as</p>
                                    <p className="text-sm font-semibold text-gray-800">{user?.username}</p>
                                </div>
                                <div className="p-1">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 justify-between sticky top-0 z-30">
                    <h2 className="text-lg font-semibold text-gray-700">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user?.roleName)}`}>
                            <Shield className="w-3 h-3" />
                            {user?.roleName}
                        </span>
                    </div>
                </header>
                <div className="p-8">
                    <Outlet />
                </div>
            </main>

            {/* Animation styles */}
            <style>{`
                @keyframes fadeUp {
                    from { transform: translateY(8px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fadeUp {
                    animation: fadeUp 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default DashboardLayout;
