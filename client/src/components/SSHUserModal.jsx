import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Key, X, Save, Monitor, AlertCircle, CheckCircle, Terminal, RefreshCw, User, Shield } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const SSHUserModal = ({ machine, onClose }) => {
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);

    // Tabs
    const [activeTab, setActiveTab] = useState('list');

    // Create form
    const [createForm, setCreateForm] = useState({ username: '', password: '', shell: '/bin/bash', createHome: true });
    const [creating, setCreating] = useState(false);

    // Change password
    const [changingPassword, setChangingPassword] = useState(null); // username
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/ssh/${machine.id}/users`);
            setUsers(res.data.users);
        } catch (err) {
            setError(err.response?.data?.error || t('failedToConnectSSH'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post(`/ssh/${machine.id}/users`, createForm);
            showNotification('success', `${t('userLabel')} '${createForm.username}' ${t('sshUserCreated')}`);
            setCreateForm({ username: '', password: '', shell: '/bin/bash', createHome: true });
            setActiveTab('list');
            fetchUsers();
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('failedToCreateUser'));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (username) => {
        try {
            await api.delete(`/ssh/${machine.id}/users/${username}`);
            showNotification('success', `${t('userLabel')} '${username}' ${t('sshUserDeleted')}`);
            setDeleteConfirm(null);
            fetchUsers();
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('failedToDeleteUser'));
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword) return;
        setPasswordLoading(true);
        try {
            await api.put(`/ssh/${machine.id}/users/${changingPassword}/password`, { newPassword });
            showNotification('success', `${t('passwordChanged')} '${changingPassword}'`);
            setChangingPassword(null);
            setNewPassword('');
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('failedToChangePassword'));
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-scaleIn max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Terminal className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">{t('sshUsers')} — {machine.name}</h2>
                            <p className="text-xs text-gray-500">{machine.ipAddress}:{machine.port || 22}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Notification */}
                {notification && (
                    <div className={`mx-6 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {notification.message}
                    </div>
                )}

                {/* Tabs */}
                <div className="px-6 pt-4 flex gap-1 bg-white flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'list'
                                ? 'bg-gray-50 text-indigo-600 border border-gray-200 border-b-white -mb-px z-10'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        {t('users')}
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${activeTab === 'create'
                                ? 'bg-gray-50 text-indigo-600 border border-gray-200 border-b-white -mb-px z-10'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        {t('addUser')}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 border-t border-gray-200">
                    {/* LIST TAB */}
                    {activeTab === 'list' && (
                        <div className="p-6">
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                    <p className="text-sm text-gray-500">{t('connectingViaSSH')}</p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="w-6 h-6 text-red-500" />
                                    </div>
                                    <p className="text-sm text-red-600 mb-3">{error}</p>
                                    <button onClick={fetchUsers} className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mx-auto">
                                        <RefreshCw className="w-3 h-3" /> {t('retry')}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-500">{users.length} {t('usersFound')}</span>
                                        <button
                                            onClick={fetchUsers}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" /> {t('refresh')}
                                        </button>
                                    </div>

                                    {users.map(user => (
                                        <div key={user.username} className="bg-white rounded-xl border border-gray-150 p-4 hover:shadow-sm transition-shadow">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${user.uid === 0
                                                            ? 'bg-gradient-to-br from-red-400 to-red-600'
                                                            : user.isSystem
                                                                ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                                                                : 'bg-gradient-to-br from-indigo-400 to-purple-500'
                                                        }`}>
                                                        {user.uid === 0 ? <Shield className="w-4 h-4" /> : user.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-800">{user.username}</span>
                                                            {user.uid === 0 && (
                                                                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">{t('rootBadge')}</span>
                                                            )}
                                                            {user.isSystem && (
                                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium">{t('systemBadge')}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            UID: {user.uid} • {user.home} • {user.shell}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions - không hiện cho root */}
                                                {user.uid !== 0 && !user.isSystem && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => { setChangingPassword(user.username); setNewPassword(''); }}
                                                            className="p-2 hover:bg-amber-50 rounded-lg text-gray-400 hover:text-amber-600 transition-colors"
                                                            title={t('changePassword')}
                                                        >
                                                            <Key className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(user.username)}
                                                            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                            title={t('deleteUser')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CREATE TAB */}
                    {activeTab === 'create' && (
                        <div className="p-6">
                            <form onSubmit={handleCreate} className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">{t('username')}</label>
                                    <input
                                        type="text"
                                        value={createForm.username}
                                        onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                                        placeholder="e.g. john"
                                        required
                                        pattern="[a-z_][a-z0-9_-]*"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all bg-white"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{t('lowercaseHint')}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">{t('password')}</label>
                                    <input
                                        type="password"
                                        value={createForm.password}
                                        onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                        placeholder="Enter password"
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">{t('shell')}</label>
                                    <select
                                        value={createForm.shell}
                                        onChange={e => setCreateForm({ ...createForm, shell: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all bg-white"
                                    >
                                        <option value="/bin/bash">Bash (/bin/bash)</option>
                                        <option value="/bin/sh">SH (/bin/sh)</option>
                                        <option value="/bin/zsh">ZSH (/bin/zsh)</option>
                                        <option value="/usr/sbin/nologin">No Login</option>
                                    </select>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={createForm.createHome}
                                        onChange={e => setCreateForm({ ...createForm, createHome: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-600">{t('createHomeDir')}</span>
                                </label>

                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {creating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            {t('creating')}
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            {t('createUser')}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Change Password Mini-Modal */}
                {changingPassword && (
                    <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/30 rounded-2xl">
                        <div className="bg-white rounded-xl shadow-xl p-5 w-80" onClick={e => e.stopPropagation()}>
                            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Key className="w-4 h-4 text-amber-500" />
                                {t('changePassword')}
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">{t('userLabel')}: <strong>{changingPassword}</strong></p>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder={t('newPasswordPlaceholder')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 outline-none focus:border-indigo-400"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setChangingPassword(null)}
                                    className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={!newPassword || passwordLoading}
                                    className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    {passwordLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Key className="w-3 h-3" />}
                                    {t('change')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirm Mini-Modal */}
                {deleteConfirm && (
                    <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/30 rounded-2xl">
                        <div className="bg-white rounded-xl shadow-xl p-5 w-80 text-center" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="font-semibold text-gray-800 mb-1">{t('deleteSSHUser')}</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                {t('userLabel')} <strong>{deleteConfirm}</strong> {t('deleteSSHUserWarning')}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scaleIn {
                    animation: scaleIn 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SSHUserModal;
