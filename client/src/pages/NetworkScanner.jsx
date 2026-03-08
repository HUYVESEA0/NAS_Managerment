import React, { useState, useEffect } from 'react';
import { Wifi, Search, Monitor, Plus, CheckCircle, XCircle, Server, RefreshCw, Globe, Terminal, Clock, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const inputStyle = {
    padding: '9px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 9, fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: "'Fira Code', monospace",
};
const inputFocus = (e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; };
const inputBlur = (e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; };

const NetworkScanner = () => {
    const { t } = useLanguage();
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null);
    const [subnet, setSubnet] = useState('');
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);
    const [lastScanTime, setLastScanTime] = useState(null);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({ roomId: '', name: '', username: '', password: '' });

    useEffect(() => {
        const savedData = localStorage.getItem('networkScanResults');
        if (savedData) {
            try {
                const { results, subnet, timestamp } = JSON.parse(savedData);
                setResults(results);
                if (subnet) setSubnet(subnet);
                if (timestamp) setLastScanTime(new Date(timestamp));
            } catch (e) {
                console.error('Failed to parse saved scan results', e);
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
            const now = new Date();
            setLastScanTime(now);
            localStorage.setItem('networkScanResults', JSON.stringify({
                results: res.data, subnet: subnet || res.data.subnet, timestamp: now.toISOString()
            }));
        } catch (err) {
            setError(err.response?.data?.error || t('networkScanFailed'));
        } finally {
            setScanning(false);
        }
    };

    const handleAddClick = async (device) => {
        try {
            const res = await api.get('/hierarchy');
            const allRooms = [];
            res.data.forEach(floor => {
                if (floor.rooms) floor.rooms.forEach(room => allRooms.push({ id: room.id, name: room.name, floorName: floor.name }));
            });
            if (allRooms.length === 0) { showNotification('error', t('noRoomsWarning')); return; }
            setRooms(allRooms);
            setSelectedDevice(device);
            setFormData({ roomId: allRooms[0].id, name: device.hostname || device.ip, username: '', password: '' });
            setAddModalOpen(true);
        } catch (err) {
            console.error(err);
            showNotification('error', t('failedToLoadRooms'));
        }
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hierarchy/machines', {
                roomId: parseInt(formData.roomId), name: formData.name,
                ipAddress: selectedDevice.ip,
                username: formData.username || undefined,
                password: formData.password || undefined
            });
            showNotification('success', t('machineAddedSuccess'));
            setAddModalOpen(false);
            const updatedResults = { ...results };
            const devIndex = updatedResults.devices.findIndex(d => d.ip === selectedDevice.ip);
            if (devIndex !== -1) {
                updatedResults.devices[devIndex].isRegistered = true;
                setResults(updatedResults);
                if (lastScanTime) {
                    localStorage.setItem('networkScanResults', JSON.stringify({ results: updatedResults, subnet, timestamp: lastScanTime.toISOString() }));
                }
            }
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('failedToAddMachine'));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Scan Card ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", marginBottom: 4 }}>
                            <Globe size={16} color="var(--accent-cyan)" /> {t('networkScanner')}
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scanDesc')}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                        <Wifi size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" value={subnet} onChange={e => setSubnet(e.target.value)}
                            placeholder={t('autoDetectSubnet')}
                            style={{ ...inputStyle, paddingLeft: 36 }}
                            onFocus={inputFocus} onBlur={inputBlur} />
                    </div>
                    <button onClick={handleScan} disabled={scanning}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: scanning ? 'var(--bg-elevated)' : 'var(--accent-gradient)', border: scanning ? '1px solid var(--border-default)' : 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: scanning ? 'var(--text-muted)' : 'white', cursor: scanning ? 'wait' : 'pointer', boxShadow: scanning ? 'none' : 'var(--accent-shadow)', whiteSpace: 'nowrap' }}>
                        {scanning ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> {t('scanningDots')}</> : <><Search size={13} /> {t('scanNetwork')}</>}
                    </button>
                </div>

                {/* Scanning progress bar */}
                {scanning && (
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 3, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--accent-gradient-90)', borderRadius: 4, animation: 'scanning 2s ease-in-out infinite' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('scanning')} {subnet || 'local'} network...</span>
                    </div>
                )}
            </div>

            {/* ── Notification ── */}
            {notification && (
                <div className="animate-fadeIn" style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    borderRadius: 10, fontSize: 13, fontWeight: 500,
                    background: notification.type === 'success' ? 'rgba(16,185,129,0.1)' : notification.type === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--accent-bg-light)',
                    border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.25)' : notification.type === 'error' ? 'rgba(239,68,68,0.25)' : 'var(--accent-border-medium)'}`,
                    color: notification.type === 'success' ? '#34D399' : notification.type === 'error' ? '#F87171' : 'var(--accent-blue)',
                }}>
                    {notification.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {notification.message}
                </div>
            )}

            {/* ── Error state ── */}
            {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#F87171' }}>
                    {error}
                </div>
            )}

            {/* ── Results ── */}
            {results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Results header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {t('found')} <strong style={{ color: 'var(--accent-blue)' }}>{results.totalOnline}</strong> {t('devicesOn')}{' '}
                                <code style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px', color: 'var(--accent-cyan)' }}>{results.subnet}.0/24</code>
                            </p>
                            {lastScanTime && (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} /> {t('lastScan')} {lastScanTime.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <button onClick={() => { localStorage.removeItem('networkScanResults'); setResults(null); setLastScanTime(null); }}
                            title={t('clearResults')}
                            style={{ padding: '6px 8px', borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        ><Trash2 size={14} /></button>
                    </div>

                    {/* Device grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                        {results.devices.map((device, idx) => (
                            <div key={idx} style={{
                                background: 'var(--bg-card)',
                                border: `1px solid ${device.isRegistered ? 'rgba(16,185,129,0.25)' : device.sshAvailable ? 'var(--accent-border-medium)' : 'var(--border-subtle)'}`,
                                borderRadius: 10, padding: 16,
                                boxShadow: 'var(--shadow-card)',
                                transition: 'border-color 0.15s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = device.isRegistered ? 'rgba(16,185,129,0.4)' : device.sshAvailable ? 'var(--accent-border-strong)' : 'var(--border-default)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = device.isRegistered ? 'rgba(16,185,129,0.25)' : device.sshAvailable ? 'var(--accent-border-medium)' : 'var(--border-subtle)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {/* Icon */}
                                        <div style={{ width: 36, height: 36, borderRadius: 9, background: device.isRegistered ? 'rgba(16,185,129,0.1)' : device.sshAvailable ? 'var(--accent-bg-light)' : 'var(--bg-elevated)', border: `1px solid ${device.isRegistered ? 'rgba(16,185,129,0.2)' : device.sshAvailable ? 'var(--accent-border-light)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Monitor size={16} color={device.isRegistered ? '#34D399' : device.sshAvailable ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{device.hostname || device.ip}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>{device.ip}</div>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    {device.isRegistered ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#34D399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '2px 7px' }}>
                                            <CheckCircle size={9} /> {t('registered')}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '2px 7px' }}>{t('newDevice')}</span>
                                    )}
                                </div>

                                {/* Service info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                        <Terminal size={11} color={device.sshAvailable ? '#34D399' : 'var(--text-muted)'} />
                                        <span style={{ color: device.sshAvailable ? '#34D399' : 'var(--text-muted)' }}>
                                            {t('sshPort')} (22) {device.sshAvailable ? `— ${t('sshAvailable')}` : `— ${t('sshNotAvailable')}`}
                                        </span>
                                    </div>
                                    {device.machine && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                            <Server size={11} color="var(--accent-blue)" />
                                            <span style={{ color: 'var(--accent-blue)' }}>{t('machine')}: {device.machine.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Add button */}
                                {!device.isRegistered && (
                                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                                        <button onClick={() => handleAddClick(device)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', background: 'var(--accent-bg-subtle)', border: '1px solid var(--accent-border-light)', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg-strong)'; e.currentTarget.style.borderColor = 'var(--accent-border-strong)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-bg-subtle)'; e.currentTarget.style.borderColor = 'var(--accent-border-light)'; }}
                                        ><Plus size={11} /> {t('addToNas')}</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {!results && !scanning && (
                <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-default)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                    <Globe size={36} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{t('clickScanToDiscover')}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scanSubnetHint')}</p>
                </div>
            )}

            {/* ── Add Machine Modal ── */}
            {addModalOpen && selectedDevice && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Server size={14} color="var(--accent-blue)" /> {t('addMachineToNas')}
                            </h3>
                            <button onClick={() => setAddModalOpen(false)}
                                style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <XCircle size={14} />
                            </button>
                        </div>

                        {/* Modal form */}
                        <form onSubmit={handleSubmitAdd} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Machine Name */}
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t('machineName')}</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                            </div>

                            {/* Room */}
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t('selectRoom')}</label>
                                <select value={formData.roomId} onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                                    style={{ ...inputStyle, background: 'var(--bg-elevated)' }} onFocus={inputFocus} onBlur={inputBlur}>
                                    {rooms.map(room => <option key={room.id} value={room.id}>{room.floorName} → {room.name}</option>)}
                                </select>
                            </div>

                            {/* IP (read-only) */}
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t('ipAddress')}</label>
                                <input type="text" disabled value={selectedDevice.ip}
                                    style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
                            </div>

                            {/* SSH creds */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t('sshUserOptional')}</label>
                                    <input type="text" placeholder="root" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t('sshPassword')}</label>
                                    <input type="password" placeholder="••••••" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                                <button type="button" onClick={() => setAddModalOpen(false)}
                                    style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                >{t('cancel')}</button>
                                <button type="submit"
                                    style={{ padding: '8px 20px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: 'var(--accent-shadow)' }}>
                                    {t('addMachine') || 'Add Machine'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes scanning {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    );
};

export default NetworkScanner;
