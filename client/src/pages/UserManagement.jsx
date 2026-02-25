import React, { useState, useEffect } from 'react';
import { Users, Shield, Plus, Edit2, Trash2, X, Save, Key, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

// Danh sách tất cả permissions có thể
const ALL_PERMISSIONS = [
    { key: 'ALL', label: 'Full Access', description: 'Toàn quyền hệ thống', color: 'red' },
    { key: 'READ_FLOOR', label: 'View Floors', description: 'Xem thông tin tầng', color: 'blue' },
    { key: 'READ_ROOM', label: 'View Rooms', description: 'Xem thông tin phòng', color: 'blue' },
    { key: 'MANAGE_HIERARCHY', label: 'Manage Hierarchy', description: 'Quản lý cơ sở hạ tầng', color: 'amber' },
    { key: 'WRITE_HIERARCHY', label: 'Write Hierarchy', description: 'Thêm/sửa tầng, phòng, máy', color: 'amber' },
    { key: 'READ_FILES', label: 'Read Files', description: 'Xem danh sách tệp', color: 'green' },
    { key: 'BROWSE_FILES', label: 'Browse Files', description: 'Duyệt hệ thống tệp', color: 'green' },
    { key: 'DOWNLOAD_FILES', label: 'Download Files', description: 'Tải tệp xuống', color: 'green' },
];

const PERMISSION_COLORS = {
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
};

const UserManagement = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    // User Modal State
    const [userModal, setUserModal] = useState({ open: false, mode: 'create', data: null });
    const [userForm, setUserForm] = useState({ username: '', password: '', roleId: '' });

    // Role Modal State
    const [roleModal, setRoleModal] = useState({ open: false, mode: 'create', data: null });
    const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });

    // Delete Confirm State
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.get('/users'),
                api.get('/users/roles')
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ==================== USER HANDLERS ====================
    const openCreateUser = () => {
        setUserForm({ username: '', password: '', roleId: roles[0]?.id || '' });
        setUserModal({ open: true, mode: 'create', data: null });
    };

    const openEditUser = (user) => {
        setUserForm({ username: user.username, password: '', roleId: user.roleId });
        setUserModal({ open: true, mode: 'edit', data: user });
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (userModal.mode === 'create') {
                await api.post('/users', userForm);
                showNotification('success', 'User created successfully');
            } else {
                const updateData = { ...userForm };
                if (!updateData.password) delete updateData.password; // Không gửi password nếu trống
                await api.put(`/users/${userModal.data.id}`, updateData);
                showNotification('success', 'User updated successfully');
            }
            setUserModal({ open: false, mode: 'create', data: null });
            fetchData();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to save user');
        }
    };

    const handleDeleteUser = async (userId) => {
        try {
            await api.delete(`/users/${userId}`);
            showNotification('success', 'User deleted successfully');
            setDeleteConfirm(null);
            fetchData();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to delete user');
        }
    };

    // ==================== ROLE HANDLERS ====================
    const openCreateRole = () => {
        setRoleForm({ name: '', permissions: [] });
        setRoleModal({ open: true, mode: 'create', data: null });
    };

    const openEditRole = (role) => {
        setRoleForm({ name: role.name, permissions: [...role.permissions] });
        setRoleModal({ open: true, mode: 'edit', data: role });
    };

    const togglePermission = (perm) => {
        setRoleForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        try {
            if (roleModal.mode === 'create') {
                await api.post('/users/roles', roleForm);
                showNotification('success', 'Role created successfully');
            } else {
                await api.put(`/users/roles/${roleModal.data.id}`, roleForm);
                showNotification('success', 'Role updated successfully');
            }
            setRoleModal({ open: false, mode: 'create', data: null });
            fetchData();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        try {
            await api.delete(`/users/roles/${roleId}`);
            showNotification('success', 'Role deleted successfully');
            setDeleteConfirm(null);
            fetchData();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to delete role');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideIn ${notification.type === 'success'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {notification.type === 'success'
                        ? <CheckCircle className="w-4 h-4" />
                        : <AlertCircle className="w-4 h-4" />
                    }
                    {notification.message}
                </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage accounts and permissions</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'users'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    Users ({users.length})
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'roles'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Shield className="w-4 h-4" />
                    Roles ({roles.length})
                </button>
            </div>

            {/* ==================== USERS TAB ==================== */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800">All Users</h2>
                        <button
                            onClick={openCreateUser}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <UserPlus className="w-4 h-4" />
                            Add User
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                                <span className="font-medium text-gray-800">{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${user.roleName === 'Admin'
                                                    ? 'bg-red-50 text-red-700'
                                                    : user.roleName === 'Operator'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-green-50 text-green-700'
                                                }`}>
                                                <Shield className="w-3 h-3" />
                                                {user.roleName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {user.permissions.slice(0, 3).map(p => (
                                                    <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                                                        {p}
                                                    </span>
                                                ))}
                                                {user.permissions.length > 3 && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                                                        +{user.permissions.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEditUser(user)}
                                                    className="p-2 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ type: 'user', id: user.id, name: user.username })}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==================== ROLES TAB ==================== */}
            {activeTab === 'roles' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={openCreateRole}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Role
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {roles.map(role => (
                            <div key={role.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${role.name === 'Admin' ? 'bg-red-50' :
                                                role.name === 'Operator' ? 'bg-amber-50' : 'bg-indigo-50'
                                            }`}>
                                            <Shield className={`w-5 h-5 ${role.name === 'Admin' ? 'text-red-500' :
                                                    role.name === 'Operator' ? 'text-amber-500' : 'text-indigo-500'
                                                }`} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800">{role.name}</h3>
                                            <p className="text-xs text-gray-400">{role.userCount} user(s)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEditRole(role)}
                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm({ type: 'role', id: role.id, name: role.name })}
                                            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {role.permissions.map(p => {
                                        const permInfo = ALL_PERMISSIONS.find(ap => ap.key === p);
                                        const colorClass = permInfo ? PERMISSION_COLORS[permInfo.color] : 'bg-gray-50 text-gray-600 border-gray-200';
                                        return (
                                            <span key={p} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${colorClass}`}>
                                                {permInfo?.label || p}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ==================== USER MODAL ==================== */}
            {userModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setUserModal({ open: false, mode: 'create', data: null })}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-800">
                                {userModal.mode === 'create' ? 'Create User' : 'Edit User'}
                            </h2>
                            <button onClick={() => setUserModal({ open: false, mode: 'create', data: null })} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={userForm.username}
                                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                    required
                                    placeholder="Enter username"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                    Password {userModal.mode === 'edit' && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={userForm.password}
                                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                    required={userModal.mode === 'create'}
                                    placeholder={userModal.mode === 'edit' ? '••••••••' : 'Enter password'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
                                <select
                                    value={userForm.roleId}
                                    onChange={e => setUserForm({ ...userForm, roleId: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                    required
                                >
                                    <option value="">Select Role</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setUserModal({ open: false, mode: 'create', data: null })}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {userModal.mode === 'create' ? 'Create' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== ROLE MODAL ==================== */}
            {roleModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRoleModal({ open: false, mode: 'create', data: null })}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-800">
                                {roleModal.mode === 'create' ? 'Create Role' : 'Edit Role'}
                            </h2>
                            <button onClick={() => setRoleModal({ open: false, mode: 'create', data: null })} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRole} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Role Name</label>
                                <input
                                    type="text"
                                    value={roleForm.name}
                                    onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                    required
                                    placeholder="e.g., Manager"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-3">Permissions</label>
                                <div className="space-y-2">
                                    {ALL_PERMISSIONS.map(perm => (
                                        <label
                                            key={perm.key}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${roleForm.permissions.includes(perm.key)
                                                    ? 'border-indigo-300 bg-indigo-50/50'
                                                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={roleForm.permissions.includes(perm.key)}
                                                onChange={() => togglePermission(perm.key)}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-700">{perm.label}</div>
                                                <div className="text-xs text-gray-400">{perm.description}</div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${PERMISSION_COLORS[perm.color]}`}>
                                                {perm.key}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRoleModal({ open: false, mode: 'create', data: null })}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {roleModal.mode === 'create' ? 'Create' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== DELETE CONFIRM MODAL ==================== */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete {deleteConfirm.type}?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteConfirm.type === 'user' ? handleDeleteUser(deleteConfirm.id) : handleDeleteRole(deleteConfirm.id)}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animation styles */}
            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes slideIn {
                    from { transform: translateX(100px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-scaleIn {
                    animation: scaleIn 0.2s ease-out;
                }
                .animate-slideIn {
                    animation: slideIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default UserManagement;
