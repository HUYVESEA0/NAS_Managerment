import React, { useState, useEffect } from 'react';
import { X, Save, Lock, Cpu, Globe } from 'lucide-react';
import api from '../services/api';

const MachineEditModal = ({ machine, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        ipAddress: '',
        username: '',
        password: '',
        port: 22
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (machine) {
            setFormData({
                name: machine.name || '',
                ipAddress: machine.ipAddress || '',
                username: machine.username || '',
                password: machine.password || '', // In real app, might leave blank for security
                port: machine.port || 22
            });
        }
    }, [machine]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await api.put(`/hierarchy/machines/${machine.id}`, {
                ...formData,
                port: parseInt(formData.port)
            });
            onUpdate(response.data);
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to update machine');
        } finally {
            setLoading(false);
        }
    };

    if (!machine) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Edit Machine</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name</label>
                        <div className="relative">
                            <Cpu className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. NAS-01"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="ipAddress"
                                value={formData.ipAddress}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. 192.168.1.100"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-indigo-500" />
                            SSH Credentials
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="root"
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="••••••"
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                                <input
                                    type="number"
                                    name="port"
                                    value={formData.port}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="22"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Credentials are saved to the database to enable remote file browsing.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MachineEditModal;
