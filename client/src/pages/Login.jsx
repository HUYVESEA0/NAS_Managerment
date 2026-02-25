import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Server, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }}></div>

                {/* Grid pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.08) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-6 transform hover:scale-105 transition-transform duration-300">
                        <Server className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        NAS Manager
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Sign in to access the management dashboard
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm animate-shake">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Username
                            </label>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                required
                                autoFocus
                                className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                    className="w-full px-4 py-3 pr-12 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Demo Credentials */}
                <div className="mt-6 bg-white/[0.04] backdrop-blur border border-white/[0.06] rounded-xl p-4">
                    <p className="text-xs text-slate-500 text-center mb-3 uppercase tracking-wider font-medium">Demo Accounts</p>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-400 bg-white/[0.03] rounded-lg px-3 py-2">
                            <span className="font-mono">admin / admin123</span>
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full text-[10px] font-medium">ADMIN</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 bg-white/[0.03] rounded-lg px-3 py-2">
                            <span className="font-mono">operator / operator123</span>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-medium">OPERATOR</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 bg-white/[0.03] rounded-lg px-3 py-2">
                            <span className="font-mono">user / user123</span>
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-[10px] font-medium">USER</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom animation */}
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default Login;
