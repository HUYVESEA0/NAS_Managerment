import React, { useState } from 'react';
import { User, KeyRound, ShieldCheck, Calendar, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

// ── Permission Badge ─────────────────────────────────────────────────────
const PermBadge = ({ perm }) => {
    const isAll = perm === 'ALL';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 99,
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: isAll ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.10)',
            color: isAll ? 'var(--accent)' : '#818CF8',
            border: `1px solid ${isAll ? 'rgba(220,38,38,0.25)' : 'rgba(99,102,241,0.20)'}`,
        }}>
            {perm}
        </span>
    );
};

// ── Section Card ─────────────────────────────────────────────────────────
const Card = ({ icon: Icon, title, children }) => (
    <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        overflow: 'hidden',
    }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
        }}>
            <Icon size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {title}
            </span>
        </div>
        <div style={{ padding: '20px' }}>
            {children}
        </div>
    </div>
);

// ── Input Field ──────────────────────────────────────────────────────────
const Field = ({ label, value, readOnly, type = 'text', placeholder, onChange, children }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            {label}
        </label>
        {readOnly ? (
            <div style={{
                padding: '9px 14px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 7,
                fontSize: 13,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: 'var(--text-primary)',
            }}>
                {value}
            </div>
        ) : children ? children : (
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '9px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 7,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
        )}
    </div>
);

// ── Password Input with show/hide ────────────────────────────────────────
const PasswordField = ({ label, value, placeholder, onChange }) => {
    const [show, setShow] = useState(false);
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    placeholder={placeholder}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '9px 40px 9px 14px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 7,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                />
                <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
                >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
        </div>
    );
};

// ── Main Profile Page ────────────────────────────────────────────────────
const Profile = () => {
    const { user, logout } = useAuth();
    const { t } = useLanguage();

    // Change password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSuccessMsg('');
        setErrorMsg('');

        if (newPassword.length < 6) {
            setErrorMsg(t('passwordTooShort'));
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setErrorMsg(t('passwordMismatch'));
            return;
        }

        setSaving(true);
        try {
            await api.put('/users/change-password', { currentPassword, newPassword });
            setSuccessMsg(t('passwordChangedSuccess'));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            setErrorMsg(err.response?.data?.error || t('failedToChangePassword'));
        } finally {
            setSaving(false);
        }
    };

    const perms = user?.permissions || [];

    return (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'monospace',
                        flexShrink: 0,
                    }}>
                        {(user?.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0 }}>
                            {user?.username}
                        </h1>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                            {user?.roleName}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Account Info */}
                <Card icon={User} title={t('accountInfo')}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                        <Field label={t('username')} value={user?.username} readOnly />
                        <Field label={t('role')} value={user?.roleName} readOnly />
                        <Field label={t('memberSince')} value={formatDate(user?.createdAt)} readOnly />
                    </div>
                </Card>

                {/* Permissions */}
                <Card icon={ShieldCheck} title={t('myPermissions')}>
                    {perms.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {t('noPermissions')}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {perms.map(p => <PermBadge key={p} perm={p} />)}
                        </div>
                    )}
                </Card>

                {/* Change Password */}
                <Card icon={KeyRound} title={t('changePassword')}>
                    <form onSubmit={handleChangePassword}>
                        <PasswordField
                            label={t('currentPassword')}
                            value={currentPassword}
                            placeholder="••••••••"
                            onChange={setCurrentPassword}
                        />
                        <PasswordField
                            label={t('newPassword')}
                            value={newPassword}
                            placeholder="••••••••"
                            onChange={setNewPassword}
                        />
                        <PasswordField
                            label={t('confirmNewPassword')}
                            value={confirmNewPassword}
                            placeholder="••••••••"
                            onChange={setConfirmNewPassword}
                        />

                        {/* Feedback */}
                        {errorMsg && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', marginBottom: 14, fontSize: 13, color: '#EF4444', fontFamily: 'monospace' }}>
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                {errorMsg}
                            </div>
                        )}
                        {successMsg && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 7, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)', marginBottom: 14, fontSize: 13, color: '#10B981', fontFamily: 'monospace' }}>
                                <CheckCircle size={15} style={{ flexShrink: 0 }} />
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving || !currentPassword || !newPassword || !confirmNewPassword}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 20px',
                                borderRadius: 7,
                                background: (saving || !currentPassword || !newPassword || !confirmNewPassword) ? 'var(--bg-elevated)' : 'var(--accent)',
                                color: (saving || !currentPassword || !newPassword || !confirmNewPassword) ? 'var(--text-muted)' : '#fff',
                                border: 'none',
                                cursor: (saving || !currentPassword || !newPassword || !confirmNewPassword) ? 'not-allowed' : 'pointer',
                                fontFamily: 'monospace',
                                fontSize: 13,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                transition: 'all 0.15s',
                            }}
                        >
                            {saving ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <KeyRound size={15} />}
                            {saving ? t('saving') : t('changePassword')}
                        </button>
                    </form>
                </Card>

            </div>
        </div>
    );
};

export default Profile;
