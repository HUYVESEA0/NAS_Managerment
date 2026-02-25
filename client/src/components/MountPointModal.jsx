import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, HardDrive } from 'lucide-react';
import api from '../services/api';

const MountPointModal = ({ machine, onClose, onUpdate }) => {
    const [mountPoints, setMountPoints] = useState([]);
    const [newMount, setNewMount] = useState({ name: '', path: '' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', path: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (machine && machine.mountPoints) {
            setMountPoints(machine.mountPoints);
        }
    }, [machine]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newMount.name || !newMount.path) return;
        setLoading(true);
        try {
            await api.post('/hierarchy/mounts', {
                ...newMount,
                machineId: machine.id
            });
            setNewMount({ name: '', path: '' });
            onUpdate(); // Trigger refresh
            // Optimistically add would be better, but simple refresh for now
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add mount point');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this mount point?')) return;
        setLoading(true);
        try {
            await api.delete(`/hierarchy/mounts/${id}`);
            onUpdate();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete mount point');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (mount) => {
        setEditingId(mount.id);
        setEditForm({ name: mount.name, path: mount.path });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: '', path: '' });
    };

    const saveEdit = async (id) => {
        setLoading(true);
        try {
            await api.put(`/hierarchy/mounts/${id}`, editForm);
            setEditingId(null);
            onUpdate();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update mount point');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-indigo-500" />
                        Manage Drives - {machine.name}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* List Existing Mounts */}
                    <div className="space-y-3 mb-6">
                        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Current Drives</h4>
                        {mountPoints.length === 0 && <p className="text-sm text-gray-400 italic">No drives configured.</p>}

                        {mountPoints.map(mount => (
                            <div key={mount.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                {editingId === mount.id ? (
                                    <div className="flex-1 flex gap-2 items-center">
                                        <input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-1/3 px-2 py-1 text-sm border rounded"
                                            placeholder="Name"
                                        />
                                        <input
                                            value={editForm.path}
                                            onChange={e => setEditForm({ ...editForm, path: e.target.value })}
                                            className="flex-1 px-2 py-1 text-sm border rounded"
                                            placeholder="Path"
                                        />
                                        <button onClick={() => saveEdit(mount.id)} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                            <Save className="w-4 h-4" />
                                        </button>
                                        <button onClick={cancelEdit} className="p-1 text-gray-500 hover:bg-gray-200 rounded">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <div className="font-medium text-gray-800">{mount.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{mount.path}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(mount)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                <Save className="w-4 h-4" /> {/* Reusing Save icon as Edit for simplicity, or import Edit2 */}
                                            </button>
                                            <button onClick={() => handleDelete(mount.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add New Mount */}
                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2">Add New Drive</h4>
                        <form onSubmit={handleAdd} className="flex gap-2 items-end">
                            <div className="w-1/3">
                                <label className="block text-xs text-gray-500 mb-1">Name (Display)</label>
                                <input
                                    type="text"
                                    value={newMount.name}
                                    onChange={e => setNewMount({ ...newMount, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. Media"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Path (Absolute)</label>
                                <input
                                    type="text"
                                    value={newMount.path}
                                    onChange={e => setNewMount({ ...newMount, path: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. D:/Media or /mnt/data"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MountPointModal;
