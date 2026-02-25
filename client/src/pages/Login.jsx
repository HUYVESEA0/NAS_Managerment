import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, LANGUAGES } from '../contexts/LanguageContext';
import { Server, Eye, EyeOff, LogIn, AlertCircle, Shield } from 'lucide-react';

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

    const handleOperatorLogin = async () => {
        setError('');
        setLoading(true);
        try {
            await login('operator', 'operator123');
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || t('loginFailed') || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const loginUser = username.trim() || 'operator';
        const loginPass = password || 'operator123';

        try {
            await login(loginUser, loginPass);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || t('loginFailed') || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const S = {
        page: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base)',
            position: 'relative',
            overflow: 'hidden',
            padding: '24px',
        },
        // Subtle grid pattern background
        bgGrid: {
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(rgba(59,130,246,0.06) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
        },
        // Soft glow blobs
        glow1: {
            position: 'absolute', top: '-10%', right: '-5%',
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
        },
        glow2: {
            position: 'absolute', bottom: '-10%', left: '-5%',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
        },
        // Card container
        wrap: {
            position: 'relative', zIndex: 10,
            width: '100%', maxWidth: 400,
        },
        // Top logo section
        logoWrap: { textAlign: 'center', marginBottom: 28 },
        logoBox: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
            boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
            marginBottom: 16, cursor: 'default',
            transition: 'transform 0.2s',
        },
        title: {
            fontFamily: "'Fira Code', monospace",
            fontSize: 24, fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            marginBottom: 6,
        },
        subtitle: { fontSize: 13, color: 'var(--text-muted)' },
        // Main form card
        card: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            marginBottom: 14,
        },
        label: {
            display: 'block', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', marginBottom: 7,
            textTransform: 'uppercase', letterSpacing: '0.06em',
        },
        inputWrap: { position: 'relative', marginBottom: 18 },
        input: {
            width: '100%', padding: '10px 14px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-default)',
            borderRadius: 10, fontSize: 14,
            color: 'var(--text-primary)',
            outline: 'none', boxSizing: 'border-box',
            fontFamily: "'Fira Code', monospace",
        },
        inputPwPadding: { paddingRight: 44 },
        eyeBtn: {
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
        },
        submitBtn: {
            flex: 1, padding: '12px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, color: 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
            transition: 'opacity 0.15s, transform 0.1s',
        },
        cancelBtn: {
            padding: '12px 20px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-default)', borderRadius: 10,
            fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
        },
        btnGroup: {
            display: 'flex', gap: 10, marginTop: 22,
        },
        submitBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
        errorBox: {
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 9, padding: '10px 12px',
            marginBottom: 18, fontSize: 13, color: '#F87171',
        },
        // Demo accounts
        demo: {
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '14px 16px',
        },
        demoTitle: {
            fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            textAlign: 'center', marginBottom: 10,
        },
        demoRow: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 10px', borderRadius: 7,
            background: 'rgba(255,255,255,0.03)', marginBottom: 5,
        },
        demoCode: { fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--text-secondary)' },
    };

    const ROLES = [
        { cred: 'admin / admin123', role: 'ADMIN', color: '#F87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
        { cred: 'operator / operator123', role: 'OPERATOR', color: '#FBBF24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
        { cred: 'user / user123', role: 'USER', color: '#34D399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    ];

    const { t, lang, setLang, currentLang } = useLanguage();

    return (
        <div style={S.page}>
            <div style={S.bgGrid} />
            <div style={S.glow1} />
            <div style={S.glow2} />

            {/* Language switcher — top right corner */}
            <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', alignItems: 'center', gap: 4, zIndex: 20 }}>
                {LANGUAGES.map(l => {
                    const isActive = l.code === lang;
                    return (
                        <button
                            key={l.code}
                            id={`login-lang-${l.code}`}
                            onClick={() => setLang(l.code)}
                            title={l.label}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 7,
                                background: isActive ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isActive ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                cursor: 'pointer', fontSize: 13,
                                color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                                fontFamily: isActive ? "'Fira Code', monospace" : 'inherit',
                                fontWeight: isActive ? 700 : 400,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                        >
                            <span style={{ fontSize: 15 }}>{l.flag}</span>
                            <span style={{ fontSize: 11, fontFamily: "'Fira Code', monospace" }}>{l.short}</span>
                        </button>
                    );
                })}
            </div>

            <div style={S.wrap} className="animate-fadeUp">
                {/* Logo */}
                <div style={S.logoWrap}>
                    <div style={S.logoBox}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Server size={28} color="white" />
                    </div>
                    <div style={S.title}>{t('loginTitle')}</div>
                    <div style={S.subtitle}>{t('loginSubtitle')}</div>
                </div>

                {/* Form Card */}
                <div style={S.card}>
                    <form onSubmit={handleSubmit} noValidate>
                        {/* Error */}
                        {error && (
                            <div style={S.errorBox} className="animate-fadeIn">
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Username */}
                        <label style={S.label} htmlFor="login-username">{t('username')}</label>
                        <div style={S.inputWrap}>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={t('username')}
                                autoFocus
                                style={S.input}
                                onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>

                        {/* Password */}
                        <label style={S.label} htmlFor="login-password">{t('password')}</label>
                        <div style={{ position: 'relative', marginBottom: 4 }}>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ ...S.input, ...S.inputPwPadding }}
                                onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={S.eyeBtn}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <div style={S.btnGroup}>
                            {/* Sign In button */}
                            <button
                                id="login-submit"
                                type="submit"
                                disabled={loading}
                                style={{ ...S.submitBtn, ...(loading ? S.submitBtnDisabled : {}) }}
                                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {loading ? (
                                    <>
                                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        {t('signIn') || 'Đăng nhập'}...
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={16} />
                                        {t('signIn')}
                                    </>
                                )}
                            </button>

                            {/* Cancel button */}
                            <button
                                type="button"
                                onClick={handleOperatorLogin}
                                disabled={loading}
                                style={{ ...S.cancelBtn, ...(loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                {t('cancel') || 'Hủy bỏ'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Demo accounts */}
                <div style={S.demo}>
                    <div style={S.demoTitle}>
                        <Shield size={9} style={{ display: 'inline', marginRight: 5 }} />
                        {t('demoAccounts')}
                    </div>
                    {ROLES.map(({ cred, role, color, bg, border }) => (
                        <div key={role} style={S.demoRow}>
                            <span style={S.demoCode}>{cred}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
                                {role}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Login;
