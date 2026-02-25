import React, { useState, useEffect } from 'react';
import { Wifi, Search, Monitor, Plus, CheckCircle, XCircle, Server, RefreshCw, Globe, Terminal, Shield, Clock, Trash2 } from 'lucide-react';
import api from '../services/api';

const NetworkScanner = () => {
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null);
    const [subnet, setSubnet] = useState('');
    const [error, setError] = useState(null);
    const [addingMachine, setAddingMachine] = useState(null);
    const [notification, setNotification] = useState(null);
    const [lastScanTime, setLastScanTime] = useState(null);

    useEffect(() => {
        const savedData = localStorage.getItem('networkScanResults');
        if (savedData) {
            try {
                const { results, subnet, timestamp } = JSON.parse(savedData);
                setResults(results);
                if (subnet) setSubnet(subnet);
                if (timestamp) setLastScanTime(new Date(timestamp));
            } catch (e) {
                console.error("Failed to parse saved scan results", e);
            }
        }
    }, []);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleScan = async () => {
        setScanning(true);
        setError(null);
        try {
            const params = subnet ? { subnet } : {};
            const res = await api.get('/network/scan', { params });
            setResults(res.data);

            // Save to localStorage
            const now = new Date();
            setLastScanTime(now);
            localStorage.setItem('networkScanResults', JSON.stringify({
                results: res.data,
                subnet: subnet || res.data.subnet,
                timestamp: now.toISOString()
            }));
        } catch (err) {
            setError(err.response?.data?.error || 'Network scan failed');
        } finally {
            setScanning(false);
        }
    };

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({ roomId: '', name: '', username: '', password: '' });

    const handleAddClick = async (device) => {
        try {
            const res = await api.get('/hierarchy');
            // Flatten rooms
            const allRooms = [];
            res.data.forEach(floor => {
                if (floor.rooms) {
                    floor.rooms.forEach(room => {
                        allRooms.push({ id: room.id, name: room.name, floorName: floor.name });
                    });
                }
            });

            if (allRooms.length === 0) {
                showNotification('error', 'Please create at least one Room in Infrastructure page first.');
                return;
            }

            setRooms(allRooms);
            setSelectedDevice(device);
            setFormData({
                roomId: allRooms[0].id,
                name: device.hostname || device.ip,
                username: '',
                password: ''
            });
            setAddModalOpen(true);
        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to load rooms');
        }
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/machines', {
                roomId: parseInt(formData.roomId),
                name: formData.name,
                ipAddress: selectedDevice.ip,
                username: formData.username || undefined,
                password: formData.password || undefined
            });
            showNotification('success', 'Machine added successfully');
            setAddModalOpen(false);

            // Refetch or update local state
            const updatedResults = { ...results };
            const devIndex = updatedResults.devices.findIndex(d => d.ip === selectedDevice.ip);
            if (devIndex !== -1) {
                updatedResults.devices[devIndex].isRegistered = true;
                setResults(updatedResults);
                // Update storage
                if (lastScanTime) {
                    localStorage.setItem('networkScanResults', JSON.stringify({
                        results: updatedResults,
                        subnet,
                        timestamp: lastScanTime.toISOString()
                    }));
                }
            }
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Failed to add machine');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-500" />
                            Network Scanner
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Scan your local network to discover machines and SSH services</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                        <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={subnet}
                            onChange={e => setSubnet(e.target.value)}
                            placeholder="Auto-detect subnet (or enter e.g. 192.168.1)"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {scanning ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4" />
                                Scan Network
                            </>
                        )}
                    </button>
                </div>

                {scanning && (
                    <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full animate-scanning"></div>
                        </div>
                        <span>Scanning {subnet || 'local'} network...</span>
                    </div>
                )}
            </div>

            {/* Notification */}
            {notification && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                    : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                    <CheckCircle className="w-4 h-4" />
                    {notification.message}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-sm font-medium text-gray-700">
                                Found <span className="text-indigo-600 font-bold">{results.totalOnline}</span> devices on <code className="bg-gray-100 px-1.5 rounded text-xs text-gray-600 font-mono">{results.subnet}.0/24</code>
                            </h3>
                            {lastScanTime && (
                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last scan: {lastScanTime.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('networkScanResults');
                                setResults(null);
                                setLastScanTime(null);
                            }}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Clear saved results"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {results.devices.map((device, idx) => (
                            <div
                                key={idx}
                                className={`bg-white rounded-xl border p-4 transition-all hover:shadow-md ${device.isRegistered
                                    ? 'border-green-200 bg-green-50/30'
                                    : device.sshAvailable
                                        ? 'border-indigo-200'
                                        : 'border-gray-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${device.isRegistered ? 'bg-green-100' : device.sshAvailable ? 'bg-indigo-100' : 'bg-gray-100'
                                            }`}>
                                            <Monitor className={`w-5 h-5 ${device.isRegistered ? 'text-green-600' : device.sshAvailable ? 'text-indigo-600' : 'text-gray-400'
                                                }`} />
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-800 text-sm">{device.hostname || device.ip}</div>
                                            <div className="text-xs text-gray-400">{device.ip}</div>
                                        </div>
                                    </div>

                                    {device.isRegistered ? (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                                            <CheckCircle className="w-3 h-3" />
                                            Registered
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                            New
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <Terminal className={`w-3 h-3 ${device.sshAvailable ? 'text-green-500' : 'text-gray-300'}`} />
                                        <span className={device.sshAvailable ? 'text-green-600' : 'text-gray-400'}>
                                            SSH (22) {device.sshAvailable ? 'Available' : 'Not available'}
                                        </span>
                                    </div>

                                    {device.machine && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <Server className="w-3 h-3 text-indigo-500" />
                                            <span className="text-indigo-600">Machine: {device.machine.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {!device.isRegistered && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <button
                                            onClick={() => handleAddClick(device)}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add to NAS
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!results && !scanning && (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                    <Globe className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 mb-1">Click "Scan Network" to discover devices</p>
                    <p className="text-xs text-gray-400">This will ping all IPs in your local subnet and check for SSH availability</p>
                </div>
            )}

            <style>{`
                @keyframes scanning {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
                .animate-scanning {
                    animation: scanning 2s ease-in-out infinite;
                }
            `}</style>

            {/* Add Machine Modal */}
            {addModalOpen && selectedDevice && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-semibold text-gray-800">Add Machine to NAS</h3>
                            <button onClick={() => setAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Machine Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Select Room</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    value={formData.roomId}
                                    onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                                >
                                    {rooms.map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.floorName} &gt; {room.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">IP Address</label>
                                <input
                                    type="text"
                                    disabled
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500"
                                    value={selectedDevice.ip}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">SSH User (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="root"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">SSH Password</label>
                                    <input
                                        type="password"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="••••••"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors"
                                >
                                    Add Machine
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkScanner;
