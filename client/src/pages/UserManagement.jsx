import React, { useState, useEffect } from 'react';
import { Users, Shield, Plus, Edit2, Trash2, X, Save, UserPlus, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const ALL_PERMISSIONS = [
    { key: 'ALL', labelKey: 'permFullAccess', descKey: 'permFullAccessDesc', color: '#F87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    { key: 'READ_FLOOR', labelKey: 'permViewFloors', descKey: 'permViewFloorsDesc', color: '#60A5FA', bg: 'var(--accent-bg-subtle)', border: 'var(--accent-border-light)' },
    { key: 'READ_ROOM', labelKey: 'permViewRooms', descKey: 'permViewRoomsDesc', color: '#60A5FA', bg: 'var(--accent-bg-subtle)', border: 'var(--accent-border-light)' },
    { key: 'MANAGE_HIERARCHY', labelKey: 'permManageHierarchy', descKey: 'permManageHierarchyDesc', color: '#FBBF24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    { key: 'WRITE_HIERARCHY', labelKey: 'permWriteHierarchy', descKey: 'permWriteHierarchyDesc', color: '#FBBF24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    { key: 'READ_FILES', labelKey: 'permReadFiles', descKey: 'permReadFilesDesc', color: '#4ADE80', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { key: 'BROWSE_FILES', labelKey: 'permBrowseFiles', descKey: 'permBrowseFilesDesc', color: '#4ADE80', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { key: 'DOWNLOAD_FILES', labelKey: 'permDownloadFiles', descKey: 'permDownloadFilesDesc', color: '#4ADE80', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
];

const ROLE_COLORS = {
    Admin: { color: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', icon: '#F87171' },
    Operator: { color: '#FBBF24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '#FBBF24' },
    User: { color: '#4ADE80', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', icon: '#4ADE80' },
};
const getRoleStyle = (name) => ROLE_COLORS[name] || { color: 'var(--accent-blue)', bg: 'var(--accent-bg-light)', border: 'var(--accent-border-medium)', icon: 'var(--accent-blue)' };

// Shared input style
const inputSt = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg-hover)', border: '1px solid var(--border-default)',
    borderRadius: 9, fontSize: 13, color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box', fontFamily: "'Fira Code', monospace",
};
const iFocus = (e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; };
const iBlur = (e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; };

const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {children}
    </label>
);

const UserManagement = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);
    const [userModal, setUserModal] = useState({ open: false, mode: 'create', data: null });
    const [userForm, setUserForm] = useState({ username: '', password: '', roleId: '' });
    const [roleModal, setRoleModal] = useState({ open: false, mode: 'create', data: null });
    const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [resetModal, setResetModal] = useState(null); // { user }
    const [resetPassword, setResetPassword] = useState('');
    const [resetting, setResetting] = useState(false);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([api.get('/users'), api.get('/users/roles')]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err) {
            console.error(err);
            showNotification('error', t('failedToLoadData'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const openCreateUser = () => { setUserForm({ username: '', password: '', roleId: roles[0]?.id || '' }); setUserModal({ open: true, mode: 'create', data: null }); };
    const openEditUser = (user) => { setUserForm({ username: user.username, password: '', roleId: user.roleId }); setUserModal({ open: true, mode: 'edit', data: user }); };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (userModal.mode === 'create') { await api.post('/users', userForm); showNotification('success', t('userCreated')); }
            else { const d = { ...userForm }; if (!d.password) delete d.password; await api.put(`/users/${userModal.data.id}`, d); showNotification('success', t('userUpdated')); }
            setUserModal({ open: false, mode: 'create', data: null });
            fetchData();
        } catch (err) { showNotification('error', err.response?.data?.error || t('failedToSave')); }
    };

    const handleDeleteUser = async (id) => {
        try { await api.delete(`/users/${id}`); showNotification('success', t('userDeleted')); setDeleteConfirm(null); fetchData(); }
        catch (err) { showNotification('error', err.response?.data?.error || t('failedToDelete')); }
    };

    const openCreateRole = () => { setRoleForm({ name: '', permissions: [] }); setRoleModal({ open: true, mode: 'create', data: null }); };
    const openEditRole = (role) => { setRoleForm({ name: role.name, permissions: [...role.permissions] }); setRoleModal({ open: true, mode: 'edit', data: role }); };

    const togglePermission = (perm) => setRoleForm(prev => ({
        ...prev, permissions: prev.permissions.includes(perm) ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm]
    }));

    const handleSaveRole = async (e) => {
        e.preventDefault();
        try {
            if (roleModal.mode === 'create') { await api.post('/users/roles', roleForm); showNotification('success', t('roleCreated')); }
            else { await api.put(`/users/roles/${roleModal.data.id}`, roleForm); showNotification('success', t('roleUpdated')); }
            setRoleModal({ open: false, mode: 'create', data: null });
            fetchData();
        } catch (err) { showNotification('error', err.response?.data?.error || t('failedToSave')); }
    };

    const handleDeleteRole = async (id) => {
        try { await api.delete(`/users/roles/${id}`); showNotification('success', t('roleDeleted')); setDeleteConfirm(null); fetchData(); }
        catch (err) { showNotification('error', err.response?.data?.error || t('failedToDelete')); }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!resetModal || !resetPassword) return;
        if (resetPassword.length < 6) { showNotification('error', t('passwordTooShort')); return; }
        setResetting(true);
        try {
            await api.post(`/users/${resetModal.user.id}/reset-password`, { newPassword: resetPassword });
            showNotification('success', t('passwordResetSuccess') || 'Password reset successfully');
            setResetModal(null);
            setResetPassword('');
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            Loading...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: 'var(--accent-shadow)' };
    const btnDanger = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#F87171', cursor: 'pointer' };
    const iconBtn = (hover) => ({ padding: 6, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', transition: 'all 0.1s' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Page header */}
            <div>
                <h1 style={{ fontFamily: "'Fira Code', monospace", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={20} color="var(--accent-blue)" /> {t('userManagement')}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('userDesc')}</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border-subtle)' }}>
                {[['users', Users, `${t('users') || 'Users'} (${users.length})`], ['roles', Shield, `${t('roles')} (${roles.length})`]].map(([id, Icon, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: activeTab === id ? 'var(--bg-card)' : 'transparent', color: activeTab === id ? 'var(--accent-blue)' : 'var(--text-muted)', boxShadow: activeTab === id ? '0 1px 4px rgba(0,0,0,0.3)' : 'none', transition: 'all 0.15s' }}>
                        <Icon size={14} />{label}
                    </button>
                ))}
            </div>

            {/* ── USERS TAB ── */}
            {activeTab === 'users' && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('allUsers')}</h2>
                        <button onClick={openCreateUser} style={btnPrimary}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        ><UserPlus size={13} /> {t('addUser')}</button>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.01)' }}>
                                    {[t('userLabel'), t('role'), t('permissions'), t('created'), t('actions')].map((h, i) => (
                                        <th key={h} style={{ padding: '10px 20px', textAlign: i === 4 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => {
                                    const rs = getRoleStyle(user.roleName);
                                    return (
                                        <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {/* User */}
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                        {user.username[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{user.username}</span>
                                                </div>
                                            </td>
                                            {/* Role badge */}
                                            <td style={{ padding: '12px 20px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 20, padding: '3px 9px' }}>
                                                    <Shield size={9} />{user.roleName}
                                                </span>
                                            </td>
                                            {/* Permissions */}
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                                                    {user.permissions.slice(0, 3).map(p => (
                                                        <span key={p} style={{ padding: '2px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 10, fontFamily: "'Fira Code', monospace", color: 'var(--text-muted)' }}>{p}</span>
                                                    ))}
                                                    {user.permissions.length > 3 && (
                                                        <span style={{ padding: '2px 6px', background: 'var(--accent-bg-subtle)', border: '1px solid var(--accent-border-light)', borderRadius: 4, fontSize: 10, color: 'var(--accent-blue)' }}>+{user.permissions.length - 3} {t('more')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Created */}
                                            <td style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            {/* Actions */}
                                            <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                                    <button onClick={() => openEditUser(user)} style={iconBtn()}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg-light)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                    ><Edit2 size={13} /></button>
                                                    <button onClick={() => { setResetModal({ user }); setResetPassword(''); }}
                                                        title={t('resetPassword') || 'Reset Password'}
                                                        style={iconBtn()}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.color = '#FBBF24'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                    ><KeyRound size={13} /></button>
                                                    <button onClick={() => setDeleteConfirm({ type: 'user', id: user.id, name: user.username })} style={iconBtn()}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                    ><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── ROLES TAB ── */}
            {activeTab === 'roles' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={openCreateRole} style={btnPrimary}><Plus size={13} /> {t('addRole')}</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {roles.map(role => {
                            const rs = getRoleStyle(role.name);
                            return (
                                <div key={role.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, boxShadow: 'var(--shadow-card)', transition: 'border-color 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 38, height: 38, borderRadius: 10, background: rs.bg, border: `1px solid ${rs.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Shield size={16} color={rs.icon} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{role.name}</h3>
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{role.userCount} {t('user') || 'user'}(s)</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => openEditRole(role)} style={iconBtn()}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg-light)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                            ><Edit2 size={13} /></button>
                                            <button onClick={() => setDeleteConfirm({ type: 'role', id: role.id, name: role.name })} style={iconBtn()}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                            ><Trash2 size={13} /></button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {role.permissions.map(p => {
                                            const permInfo = ALL_PERMISSIONS.find(ap => ap.key === p);
                                            return (
                                                <span key={p} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, fontFamily: "'Fira Code', monospace", background: permInfo?.bg || 'var(--bg-elevated)', color: permInfo?.color || 'var(--text-muted)', border: `1px solid ${permInfo?.border || 'var(--border-subtle)'}` }}>
                                                    {permInfo ? t(permInfo.labelKey) : p}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── User Modal ── */}
            {userModal.open && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                    onClick={() => setUserModal({ open: false, mode: 'create', data: null })}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 420, padding: 24, boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserPlus size={15} color="var(--accent-blue)" />
                                {userModal.mode === 'create' ? t('createUser') : t('editUser')}
                            </h2>
                            <button onClick={() => setUserModal({ open: false, mode: 'create', data: null })} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </div>

                        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div><Label>{t('username') || 'Username'}</Label>
                                <input type="text" value={userForm.username} required placeholder={t('enterUsername')}
                                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                    style={inputSt} onFocus={iFocus} onBlur={iBlur} /></div>

                            <div><Label>{t('password') || 'Password'} {userModal.mode === 'edit' && <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('keepCurrent')}</span>}</Label>
                                <input type="password" value={userForm.password} placeholder={userModal.mode === 'edit' ? '••••••••' : t('enterPassword')}
                                    required={userModal.mode === 'create'}
                                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                    style={inputSt} onFocus={iFocus} onBlur={iBlur} /></div>

                            <div><Label>{t('role')}</Label>
                                <select value={userForm.roleId} required onChange={e => setUserForm({ ...userForm, roleId: parseInt(e.target.value) })}
                                    style={{ ...inputSt, background: 'var(--bg-hover)' }} onFocus={iFocus} onBlur={iBlur}>
                                    <option value="">{t('selectRole')}</option>
                                    {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                                </select></div>

                            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                                <button type="button" onClick={() => setUserModal({ open: false, mode: 'create', data: null })}
                                    style={{ flex: 1, padding: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 9, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                <button type="submit"
                                    style={{ flex: 1, padding: '9px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Save size={13} />{userModal.mode === 'create' ? t('create') : t('update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Role Modal ── */}
            {roleModal.open && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                    onClick={() => setRoleModal({ open: false, mode: 'create', data: null })}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 480, padding: 24, boxShadow: 'var(--shadow-elevated)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Shield size={15} color="var(--accent-blue)" />
                                {roleModal.mode === 'create' ? t('createRole') : t('editRole')}
                            </h2>
                            <button onClick={() => setRoleModal({ open: false, mode: 'create', data: null })} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </div>

                        <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div><Label>{t('roleName')}</Label>
                                <input type="text" value={roleForm.name} required placeholder={t('roleNamePlaceholder')}
                                    onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                                    style={inputSt} onFocus={iFocus} onBlur={iBlur} /></div>

                            <div>
                                <Label>{t('permissions')}</Label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {ALL_PERMISSIONS.map(perm => {
                                        const checked = roleForm.permissions.includes(perm.key);
                                        return (
                                            <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${checked ? perm.border : 'var(--border-subtle)'}`, background: checked ? perm.bg : 'transparent', transition: 'all 0.1s' }}
                                                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <input type="checkbox" checked={checked} onChange={() => togglePermission(perm.key)}
                                                    style={{ width: 14, height: 14, accentColor: 'var(--accent-blue)' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t(perm.labelKey)}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t(perm.descKey)}</div>
                                                </div>
                                                <span style={{ fontSize: 9, fontFamily: "'Fira Code', monospace", fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: perm.color, background: perm.bg, border: `1px solid ${perm.border}` }}>{perm.key}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={() => setRoleModal({ open: false, mode: 'create', data: null })}
                                    style={{ flex: 1, padding: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 9, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                <button type="submit"
                                    style={{ flex: 1, padding: '9px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Save size={13} />{roleModal.mode === 'create' ? t('create') : t('update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ── */}
            {deleteConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                    onClick={() => setDeleteConfirm(null)}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, width: '100%', maxWidth: 360, padding: 28, textAlign: 'center', boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ width: 52, height: 52, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Trash2 size={22} color="#F87171" />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: "'Fira Code', monospace" }}>
                            {t('delete')} {deleteConfirm.type}?
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.6 }}>
                            {t('delete')} <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>?<br />
                            <span style={{ fontSize: 11, color: 'var(--danger)' }}>{t('cannotBeUndone')}</span>
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setDeleteConfirm(null)}
                                style={{ flex: 1, padding: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 9, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                            <button onClick={() => deleteConfirm.type === 'user' ? handleDeleteUser(deleteConfirm.id) : handleDeleteRole(deleteConfirm.id)}
                                style={{ flex: 1, ...btnDanger, borderRadius: 9, padding: '9px' }}>{t('delete')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {resetModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                    onClick={() => !resetting && setResetModal(null)}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, width: '100%', maxWidth: 380, padding: 24, boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FBBF24', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                                <KeyRound size={15} color="#FBBF24" />
                                {t('resetPassword') || 'Reset Password'}
                            </h2>
                            <button onClick={() => setResetModal(null)} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                            {t('resetPasswordFor') || 'Set new password for'} <strong style={{ color: 'white', fontFamily: "'Fira Code', monospace" }}>{resetModal.user.username}</strong>
                        </p>
                        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <Label>{t('newPassword') || 'New Password'}</Label>
                                <input type="password" value={resetPassword} required autoFocus
                                    placeholder="Min. 6 characters"
                                    onChange={e => setResetPassword(e.target.value)}
                                    style={inputSt} onFocus={iFocus} onBlur={iBlur} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={() => setResetModal(null)} disabled={resetting}
                                    style={{ flex: 1, padding: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 9, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                <button type="submit" disabled={resetting || !resetPassword}
                                    style={{ flex: 1, padding: '9px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#FBBF24', cursor: resetting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !resetPassword ? 0.5 : 1 }}>
                                    {resetting ? <div style={{ width: 13, height: 13, border: '2px solid #FBBF24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <KeyRound size={13} />}
                                    {resetting ? '...' : (t('resetPassword') || 'Reset')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className="animate-slideIn" style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 70,
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px',
                    borderRadius: 10, boxShadow: 'var(--shadow-elevated)', fontSize: 13, fontWeight: 500,
                    background: notification.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: notification.type === 'success' ? '#34D399' : '#F87171',
                }}>
                    {notification.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {notification.message}
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(80px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .animate-slideIn { animation: slideIn 0.25s ease-out; }
            `}</style>
        </div>
    );
};

export default UserManagement;
