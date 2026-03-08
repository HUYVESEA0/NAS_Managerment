import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Terminal, Lock, User, Eye, EyeOff, Shield, Server, ArrowRight, Loader2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

// ── Background Effects ──
const BackgroundMatrix = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
             {/* Tech grid/network background hints */}
             <div className="absolute inset-0 bg-stripes opacity-10"></div>
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]"></div>
        </div>
    );
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sysInfo, setSysInfo] = useState([]);
    
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { t } = useLanguage();

    // Easter egg/Terminal effect text
    useEffect(() => {
        const messages = [
            t('initSystemBoot'),
            t('loadingSecureKernel'),
            t('mountingFileSystems'),
            t('establishingEncryption'),
            t('systemReady')
        ];
        
        let index = 0;
        const interval = setInterval(() => {
            if (index < messages.length) {
                setSysInfo(prev => [...prev, messages[index]]);
                index++;
            } else {
                clearInterval(interval);
            }
        }, 150);
        return () => clearInterval(interval);
    }, [t]);

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
            <BackgroundMatrix />
            
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md p-6 relative z-10">
                {/* Branding */}
                <div className="mb-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-surface border border-border-default rounded-2xl flex items-center justify-center shadow-sm mb-4">
                        <Server size={32} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
                        <span className="text-accent">&gt;_</span>
                        <span className="text-primary truncate">NAS.MANAGER</span>
                    </div>
                    <p className="text-secondary text-sm mt-2 font-mono">{t('secureAccessPortal')}</p>
                </div>

                <div className="bg-surface border border-border-default rounded-xl shadow-lg overflow-hidden backdrop-blur-sm">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-border-subtle bg-base/50 flex items-center gap-3">
                        <Lock size={18} className="text-muted" />
                        <h2 className="font-mono font-bold text-primary tracking-wide text-sm">{t('authRequired')}</h2>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        
                        {/* Terminal sequence block */}
                        <div className="bg-base border border-border-subtle rounded-lg p-3 h-28 overflow-y-auto mb-6 text-[10px] font-mono text-muted space-y-1">
                            {sysInfo.map((msg, i) => (
                                <div key={i} className="flex gap-2">
                                    <span className="text-accent/70">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                                    <span>{msg}</span>
                                </div>
                            ))}
                            {error && (
                                <div className="text-danger flex gap-2">
                                    <span className="text-danger/70">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                                    <span>ERROR: {error}</span>
                                </div>
                            )}
                            <div className="text-primary animate-pulse">_</div>
                        </div>

                        <div className="space-y-4">
                            {/* Username Input */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold font-mono text-secondary ml-1 block">{t('username').toUpperCase()}</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted group-focus-within:text-accent transition-colors">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-base border border-border-default rounded-lg text-primary text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
                                        placeholder="admin"
                                        autoComplete="username"
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold font-mono text-secondary ml-1 block">{t('password').toUpperCase()}</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted group-focus-within:text-accent transition-colors">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-12 py-2.5 bg-base border border-border-default rounded-lg text-primary text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary transition-colors focus:outline-none"
                                        tabIndex="-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-mono flex items-start gap-2 animate-fadeUp">
                                <Shield size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="w-full py-3 bg-accent text-white font-bold font-mono rounded-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden group shadow-sm mt-4"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <span>{t('initializeSession')}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                            {/* Button highlight effect */}
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        </button>
                    </form>
                </div>
                
                <div className="mt-8 text-center text-xs font-mono text-muted flex items-center justify-center gap-2">
                    <Shield size={12} />
                    <span>{t('encryptedConnection')}</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
