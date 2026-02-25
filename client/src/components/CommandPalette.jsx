import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Server, Cpu, Building, ArrowRight, CornerDownLeft, LayoutDashboard, FolderOpen, Settings, Users, Wifi, LogOut, FileSearch, Loader2, File, Image, FileCode, Music, Video, Archive, Database, Settings2 } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const STATIC_PAGES = [
    { id: 'p1', type: 'page', name: 'Dashboard Overview', path: '/', icon: LayoutDashboard },
    { id: 'p2', type: 'page', name: 'File Explorer', path: '/files', icon: FolderOpen },
    { id: 'p3', type: 'page', name: 'Network Scanner', path: '/network', icon: Wifi },
    { id: 'p4', type: 'page', name: 'Infrastructure Admin', path: '/admin', icon: Settings },
    { id: 'p5', type: 'page', name: 'User Management', path: '/users', icon: Users },
];

const FILE_ICONS = {
    jpg: Image, jpeg: Image, png: Image, gif: Image, webp: Image, svg: Image,
    js: FileCode, jsx: FileCode, ts: FileCode, py: FileCode, html: FileCode, css: FileCode, json: FileCode,
    mp3: Music, wav: Music, mp4: Video, mkv: Video, avi: Video,
    zip: Archive, rar: Archive, '7z': Archive, tar: Archive, gz: Archive,
    db: Database, sql: Database, csv: Database,
    ini: Settings2, conf: Settings2, cfg: Settings2, yml: Settings2, yaml: Settings2,
};

function getFileIcon(filename) {
    if (!filename) return File;
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || File;
}

const CommandPalette = () => {
    const { t } = useLanguage();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [machines, setMachines] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    // Deep search states
    const [isDeepSearching, setIsDeepSearching] = useState(false);
    const [isDeepSearchLoading, setIsDeepSearchLoading] = useState(false);
    const [deepSearchResults, setDeepSearchResults] = useState([]);

    // Fetch hierarchy flat list of machines
    useEffect(() => {
        if (!isOpen) return;
        const fetchMachines = async () => {
            try {
                const res = await api.get('/hierarchy');
                const flatMachines = res.data.flatMap(floor =>
                    floor.rooms.flatMap(room =>
                        room.machines.map(m => ({
                            ...m,
                            id: `m-${m.id}`,
                            machineId: m.id,
                            type: 'machine',
                            floorName: floor.name,
                            roomName: room.name,
                            path: `/files?machineId=${m.id}`
                        }))
                    )
                );
                setMachines(flatMachines);
            } catch (err) {
                console.error('Failed to fetch machines for command palette', err);
            }
        };
        fetchMachines();
        setQuery('');
        setSelectedIndex(0);
        setIsDeepSearching(false);
        setDeepSearchResults([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [isOpen]);

    // Keyboard listener for Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                if (isDeepSearching && !isDeepSearchLoading) {
                    setIsDeepSearching(false);
                    setDeepSearchResults([]);
                    setQuery('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                } else {
                    setIsOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isDeepSearching, isDeepSearchLoading]);

    const filteredItems = useMemo(() => {
        if (isDeepSearching) {
            return deepSearchResults.map((r, i) => ({
                ...r,
                type: 'file_result',
                id: `fr-${i}`
            }));
        }

        const q = query.toLowerCase();

        let pages = STATIC_PAGES.filter(p => p.name.toLowerCase().includes(q));
        let machs = machines.filter(m =>
            m.name.toLowerCase().includes(q) ||
            (m.ipAddress && m.ipAddress.toLowerCase().includes(q))
        );

        let actions = [];
        if ('log out'.includes(q) || 'sign out'.includes(q)) {
            actions.push({ id: 'a1', type: 'action', name: 'Log Out', action: 'logout', icon: LogOut });
        }

        // Add deep search trigger if query is long enough
        if (q.length >= 2) {
            actions.push({ id: 'a2', type: 'action', name: `Deep Search Files for "${query}"`, action: 'deep_search', icon: FileSearch });
        }

        return [...pages, ...machs, ...actions];
    }, [query, machines, isDeepSearching, deepSearchResults]);

    // Handle arrow keys
    useEffect(() => {
        const handleNavigation = (e) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    handleSelect(filteredItems[selectedIndex]);
                }
            }
            if (e.key === 'Backspace' && query === '' && isDeepSearching) {
                setIsDeepSearching(false);
                setDeepSearchResults([]);
            }
        };
        window.addEventListener('keydown', handleNavigation);
        return () => window.removeEventListener('keydown', handleNavigation);
    }, [isOpen, filteredItems, selectedIndex, query, isDeepSearching]);

    const performDeepSearch = async (searchQuery) => {
        setIsDeepSearching(true);
        setIsDeepSearchLoading(true);
        setSelectedIndex(0);
        try {
            const res = await api.get(`/network/search-global?query=${encodeURIComponent(searchQuery)}`);
            setDeepSearchResults(res.data);
        } catch (error) {
            console.error('Deep search error', error);
            setDeepSearchResults([]);
        } finally {
            setIsDeepSearchLoading(false);
        }
    };

    const handleSelect = (item) => {
        if (item.type === 'page' || item.type === 'machine') {
            setIsOpen(false);
            navigate(item.path);
        } else if (item.type === 'action' && item.action === 'logout') {
            setIsOpen(false);
            logout();
        } else if (item.type === 'action' && item.action === 'deep_search') {
            performDeepSearch(query);
        } else if (item.type === 'file_result') {
            setIsOpen(false);
            const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
            navigate(`/files?machineId=${item.machineId}&path=${encodeURIComponent(parentPath)}`);
        }
    };

    if (!isOpen) return null;

    const renderItem = (item, idx) => {
        const isSelected = selectedIndex === idx;
        let Icon = item.icon || Cpu;

        if (item.type === 'file_result') {
            Icon = item.isDirectory ? FolderOpen : getFileIcon(item.name);
            return (
                <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                        display: 'flex', alignItems: 'center', padding: '12px 20px',
                        cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        borderLeft: `3px solid ${isSelected ? 'var(--accent-blue)' : 'transparent'}`,
                        transition: 'all 0.1s'
                    }}
                >
                    <div style={{
                        width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16
                    }}>
                        <Icon size={16} color={isSelected ? 'var(--accent-blue)' : (item.isDirectory ? 'var(--accent-blue)' : 'var(--text-secondary)')} />
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {item.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                            <Server size={10} /> {item.machineName} <ArrowRight size={8} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.path}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                    display: 'flex', alignItems: 'center', padding: '12px 20px',
                    cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                    borderLeft: `3px solid ${isSelected ? 'var(--accent-blue)' : 'transparent'}`,
                    transition: 'all 0.1s'
                }}
            >
                <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16
                }}>
                    <Icon size={16} color={isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)'} />
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)', fontFamily: item.type === 'machine' ? "'Fira Code', monospace" : 'inherit', marginBottom: 2 }}>
                        {item.name}
                    </div>
                    {item.type === 'machine' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            <Building size={12} /> {item.floorName} <ArrowRight size={10} /> <Server size={12} /> {item.roomName}
                            {item.ipAddress && <span style={{ marginLeft: 6, paddingLeft: 6, borderLeft: '1px solid var(--border-strong)' }}>{item.ipAddress}</span>}
                        </div>
                    )}
                    {item.type === 'page' && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Navigation Shortcut</div>
                    )}
                    {item.type === 'action' && item.action === 'logout' && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>System Command</div>
                    )}
                    {item.type === 'action' && item.action === 'deep_search' && (
                        <div style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>Search across all interconnected servers</div>
                    )}
                </div>

                {isSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-blue)', fontSize: 12 }}>
                        Enter <CornerDownLeft size={14} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '10vh', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)'
        }} onClick={() => setIsOpen(false)}>

            <div
                className="animate-fadeUp"
                style={{
                    width: '100%', maxWidth: 720,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                    borderRadius: 16, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: isDeepSearching ? 'rgba(6, 182, 212, 0.05)' : 'transparent' }}>
                    {isDeepSearching ? (
                        <FileSearch size={20} color="var(--accent-cyan)" style={{ marginRight: 12 }} />
                    ) : (
                        <Search size={20} color="var(--text-muted)" style={{ marginRight: 12 }} />
                    )}

                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={isDeepSearching ? "Search globally..." : "Search machines, pages, or commands..."}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                            // If user modifies search while deep searching, let them type but don't auto search.
                            // To make new search, they have to hit enter or go back. Let's quit deep search on query edit.
                            if (isDeepSearching) {
                                setIsDeepSearching(false);
                            }
                        }}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 16, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif"
                        }}
                    />

                    {isDeepSearching && (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', background: 'var(--bg-elevated)', borderRadius: 20, fontSize: 11, color: 'var(--text-secondary)', marginRight: 12 }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)', marginRight: 6 }} className="pulse-dot"></span>
                            Global File Scope
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>ESC</div>
                </div>

                {/* Results List */}
                <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0', position: 'relative' }}>

                    {isDeepSearchLoading ? (
                        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-cyan)', marginBottom: 12 }} />
                            <div style={{ fontSize: 13, fontWeight: 500 }}>Scanning entire infrastructure...</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>This might take a few moments depending on network latency.</div>
                        </div>
                    ) : (
                        filteredItems.length === 0 ? (
                            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                No results found matching "{query}"
                            </div>
                        ) : (
                            filteredItems.map((item, idx) => renderItem(item, idx))
                        )
                    )}
                </div>

                {/* Footer hints */}
                <div style={{ padding: '8px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>↑↓</span> to navigate
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Enter</span> to select
                    </div>
                    {isDeepSearching && (
                        <>
                            <div style={{ width: 1, height: 12, background: 'var(--border-strong)' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>ESC / Backspace</span> to cancel Deep Search
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
