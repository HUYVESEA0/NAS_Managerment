const fs = require('fs');

const fileContent = `import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Terminal, Lock, User, Eye, EyeOff, Shield, Server, ArrowRight, Loader2, Database } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { t } = useLanguage();

    const from = location.state?.from?.pathname || "/";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await login(username, password);
            if (success) {
                navigate(from, { replace: true });
            } else {
                setError(t('invalidCredentials'));
            }
        } catch (err) {
            setError(t('systemError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-base flex flex-col justify-center items-center relative overflow-hidden font-sans">
            
            {/* Minimal pattern background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--bg-muted) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            {/* Top Right Controls */}
            <div className="absolute top-4 right-6 flex items-center gap-4 z-50">
                <div className="flex gap-2 text-xs font-mono text-muted">
                    <button className="hover:text-primary transition-colors hover:bg-hover px-2 py-1 rounded">VN VI</button>
                    <button className="text-accent font-bold bg-accent/10 px-2 py-1 rounded border border-border-subtle shadow-sm">GB EN</button>
                    <button className="hover:text-primary transition-colors hover:bg-hover px-2 py-1 rounded">CN 中</button>
                </div>
                <div className="w-px h-4 bg-border-subtle"></div>
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[420px] p-6 relative z-10 flex flex-col items-center">
                
                {/* Logo & Header (Now matches the screenshot) */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md mb-5 bg-gradient-to-tr from-blue-600 to-blue-400">
                        <Database size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-primary mb-2 font-mono tracking-tight">NAS Manager</h1>
                    <p className="text-muted text-sm font-mono opacity-80">Sign in to access the management dashboard</p>
                </div>

                {/* Login Form Card */}
                <div className="w-full bg-surface border border-border-default rounded-2xl shadow-elevated overflow-hidden backdrop-blur-sm p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        <div className="space-y-5">
                            {/* Username Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold font-mono text-secondary tracking-widest uppercase">USERNAME</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-3 bg-base border border-border-default rounded-xl text-primary text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-all"
                                        placeholder="Username"
                                        autoComplete="username"
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold font-mono text-secondary tracking-widest uppercase">PASSWORD</label>
                                <div className="relative group">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-4 pr-12 py-3 bg-base/50 border border-border-default rounded-xl text-primary text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted hover:text-primary transition-colors focus:outline-none"
                                        tabIndex="-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-start gap-2 animate-fadeUp">
                                <Shield size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading || !username || !password}
                                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        <ArrowRight size={18} />
                                        <span>Sign In</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUsername(''); setPassword(''); setError(''); }}
                                className="px-6 py-3 bg-base border border-border-default hover:bg-hover hover:border-border-strong text-secondary font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>

                {/* Demo Accounts Panel */}
                <div className="w-full mt-6 bg-surface border border-border-default rounded-2xl p-6 shadow-sm overflow-hidden relative">
                    <div className="text-[10px] font-bold tracking-widest text-muted text-center uppercase mb-5 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full border border-muted"></span>
                        DEMO ACCOUNTS
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-mono">
                            <span className="text-secondary">admin / admin123</span>
                            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">ADMIN</span>
                        </div>
                        <div className="w-full h-px bg-border-subtle"></div>
                        <div className="flex justify-between items-center text-sm font-mono">
                            <span className="text-secondary">operator / operator123</span>
                            <span className="text-[10px] font-bold text-yellow-600 bg-yellow-600/10 px-2 py-0.5 rounded-full uppercase tracking-wider">OPERATOR</span>
                        </div>
                        <div className="w-full h-px bg-border-subtle"></div>
                        <div className="flex justify-between items-center text-sm font-mono">
                            <span className="text-secondary">user / user123</span>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">USER</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Login;
`
fs.writeFileSync('client/src/pages/Login.jsx', fileContent);
console.log('Updated Login page perfectly matching the screenshot design.');
