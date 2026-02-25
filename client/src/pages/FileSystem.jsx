import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Folder, FileText, ChevronRight, ArrowLeft, Download, Search,
    Filter, Grid, List, Eye, X, Image, FileCode, File, Music,
    Video, Archive, Database, Settings2, RefreshCw,
    XCircle, Terminal, UploadCloud, Loader2, CheckCircle, Plus,
    SlidersHorizontal, ChevronDown, Clock, HardDrive
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

// ==================== FILE ICON MAPPING ====================
const FILE_ICONS = {
    // Images
    jpg: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-50' },
    jpeg: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-50' },
    png: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-50' },
    gif: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-50' },
    webp: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-50' },
    svg: { icon: Image, color: 'text-orange-500', bg: 'bg-orange-50' },
    // Code
    js: { icon: FileCode, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    jsx: { icon: FileCode, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    ts: { icon: FileCode, color: 'text-blue-500', bg: 'bg-blue-50' },
    py: { icon: FileCode, color: 'text-green-500', bg: 'bg-green-50' },
    html: { icon: FileCode, color: 'text-orange-500', bg: 'bg-orange-50' },
    css: { icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-50' },
    json: { icon: FileCode, color: 'text-gray-600', bg: 'bg-gray-50' },
    // Media
    mp3: { icon: Music, color: 'text-purple-500', bg: 'bg-purple-50' },
    wav: { icon: Music, color: 'text-purple-500', bg: 'bg-purple-50' },
    mp4: { icon: Video, color: 'text-red-500', bg: 'bg-red-50' },
    mkv: { icon: Video, color: 'text-red-500', bg: 'bg-red-50' },
    avi: { icon: Video, color: 'text-red-500', bg: 'bg-red-50' },
    // Archive
    zip: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50' },
    rar: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50' },
    '7z': { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50' },
    tar: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50' },
    gz: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50' },
    // Data
    db: { icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    sql: { icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    csv: { icon: Database, color: 'text-green-600', bg: 'bg-green-50' },
    // Config
    ini: { icon: Settings2, color: 'text-gray-500', bg: 'bg-gray-50' },
    conf: { icon: Settings2, color: 'text-gray-500', bg: 'bg-gray-50' },
    cfg: { icon: Settings2, color: 'text-gray-500', bg: 'bg-gray-50' },
    yml: { icon: Settings2, color: 'text-violet-500', bg: 'bg-violet-50' },
    yaml: { icon: Settings2, color: 'text-violet-500', bg: 'bg-violet-50' },
};

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-50' };
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr, t) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t ? t('justNow') : 'Just now';
    if (diffMins < 60) return t ? `${diffMins} ${t('mAgo')}` : `${diffMins}m ago`;
    if (diffHours < 24) return t ? `${diffHours} ${t('hAgo')}` : `${diffHours}h ago`;
    if (diffDays < 7) return t ? `${diffDays} ${t('dAgo')}` : `${diffDays}d ago`;
    return d.toLocaleDateString();
}

// ==================== FILTER PRESETS ====================
const FILTER_PRESETS = [
    { labelKey: 'allFiles', extensions: null, icon: File },
    { labelKey: 'images', extensions: 'jpg,jpeg,png,gif,webp,svg,bmp', icon: Image },
    { labelKey: 'videos', extensions: 'mp4,mkv,avi,mov,wmv,flv', icon: Video },
    { labelKey: 'audio', extensions: 'mp3,wav,flac,aac,ogg,wma', icon: Music },
    { labelKey: 'documents', extensions: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md', icon: FileText },
    { labelKey: 'code', extensions: 'js,jsx,ts,tsx,py,java,c,cpp,go,rs,html,css', icon: FileCode },
    { labelKey: 'archives', extensions: 'zip,rar,7z,tar,gz,bz2', icon: Archive },
    { labelKey: 'data', extensions: 'csv,json,xml,sql,db,sqlite', icon: Database },
];

// ==================== MAIN COMPONENT ====================
const FileSystem = () => {
    const { t } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
    const machineId = searchParams.get('machineId');
    const pathParam = searchParams.get('path') || '';

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // list, grid
    const [sortBy, setSortBy] = useState('name'); // name, size, date
    const [sortDir, setSortDir] = useState('asc');

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilter, setActiveFilter] = useState('allFiles');
    const [sizeFilter, setSizeFilter] = useState({ min: '', max: '' });
    const [typeFilter, setTypeFilter] = useState('all'); // all, file, directory

    // Preview
    const [previewFile, setPreviewFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Selection & Context Menu
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [contextMenu, setContextMenu] = useState(null);
    const [activeModal, setActiveModal] = useState(null); // 'rename', 'delete', 'mkdir', 'info'
    const [modalData, setModalData] = useState(null);
    const [modalInput, setModalInput] = useState('');
    const [notification, setNotification] = useState(null);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    // Fetch files
    const fetchFiles = useCallback(async () => {
        if (!machineId) return;
        setLoading(true);
        setError(null);
        setSelectedItems(new Set()); // Clear selection on refresh
        try {
            const response = await api.get('/files/list', {
                params: { machineId, path: pathParam }
            });
            setFiles(response.data);
            setSearchResults(null);
            setSearchQuery('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load files');
        } finally {
            setLoading(false);
        }
    }, [machineId, pathParam]);

    useEffect(() => {
        fetchFiles();
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [fetchFiles]);

    // Handlers
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('machineId', machineId);
        // If pathParam is empty, use dot (.) to signify current directory
        formData.append('path', pathParam || '.');

        setUploading(true);
        try {
            await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showNotification('success', 'Uploaded successfully');
            fetchFiles();
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };


    const handleDownload = (file) => {
        if (!file || file.isDirectory) return;
        try {
            // Use axios baseURL if available, or relative
            // The api instance has baseURL set. We need to access it or construct manually.
            // Assuming api.defaults.baseURL is set properly. 
            // If not, use relative path '/api/files/download'
            const baseUrl = api.defaults.baseURL || '/api';
            const url = `${baseUrl}/files/download?machineId=${machineId}&path=${encodeURIComponent(file.path)}`;

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            showNotification('error', 'Download failed');
        }
    };

    const handleSelection = (e, file) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            const newSet = new Set(selectedItems);
            if (newSet.has(file.path)) newSet.delete(file.path);
            else newSet.add(file.path);
            setSelectedItems(newSet);
        } else {
            // Single click just selects, doesn't clear unless background clicked
            // To match standard OS behavior: single click selects one, deselects others
            setSelectedItems(new Set([file.path]));
        }
        setContextMenu(null);
    };

    const handleContextMenu = (e, file) => {
        e.preventDefault();
        e.stopPropagation();

        let newSelection = new Set(selectedItems);
        if (!newSelection.has(file.path)) {
            newSelection = new Set([file.path]);
            setSelectedItems(newSelection);
        }

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file,
            count: newSelection.size
        });
    };

    const handleBackgroundClick = () => {
        setSelectedItems(new Set());
        setContextMenu(null);
    };

    const handleAction = (action) => {
        if (action === 'mkdir') {
            setModalInput('');
            setActiveModal('mkdir');
            return;
        }

        if (!contextMenu && !selectedItems.size) return;
        const target = contextMenu?.file || files.find(f => f.path === Array.from(selectedItems)[0]);
        if (!target) return;

        setModalData({ file: target, count: selectedItems.size });
        setModalInput(action === 'rename' ? target.name : '');
        setActiveModal(action);
        setContextMenu(null);
    };

    const handleConfirmAction = async (e) => {
        e.preventDefault();
        try {
            if (activeModal === 'delete') {
                const target = modalData.file;
                await api.delete('/files/delete', { data: { machineId, path: target.path } });
                showNotification('success', 'Deleted successfully');
            } else if (activeModal === 'rename') {
                const target = modalData.file;
                await api.put('/files/rename', { machineId, path: target.path, newName: modalInput });
                showNotification('success', 'Renamed successfully');
            } else if (activeModal === 'mkdir') {
                // For mkdir, current path is pathParam
                let targetPath = pathParam ? `${pathParam}/${modalInput}` : modalInput;
                // On Windows/Agent, paths might need careful handling, but Agent handles join.
                // However, we send raw path.
                if (pathParam && !pathParam.endsWith('/') && !pathParam.endsWith('\\')) targetPath = `${pathParam}/${modalInput}`;

                await api.post('/files/mkdir', { machineId, path: targetPath });
                showNotification('success', 'Folder created');
            }

            fetchFiles();
            setActiveModal(null);
            setModalInput('');
            setModalData(null);
        } catch (err) {
            showNotification('error', err.response?.data?.error || 'Action failed');
        }
    };

    // Search
    const handleSearch = async () => {
        if (!searchQuery.trim() && activeFilter === 'All') return;
        setIsSearching(true);
        try {
            const preset = FILTER_PRESETS.find(p => p.label === activeFilter);
            const params = {
                machineId,
                query: searchQuery.trim(),
                path: pathParam || '.',
                type: typeFilter
            };
            if (preset?.extensions) params.extensions = preset.extensions;
            if (sizeFilter.min) params.minSize = parseInt(sizeFilter.min) * 1024;
            if (sizeFilter.max) params.maxSize = parseInt(sizeFilter.max) * 1024;

            const res = await api.get('/network/search', { params });
            setSearchResults(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchResults(null);
        setSearchQuery('');
        setActiveFilter('allFiles');
        setSizeFilter({ min: '', max: '' });
        setTypeFilter('all');
    };

    // Preview
    const openPreview = async (file) => {
        setPreviewFile(file);
        setPreviewLoading(true);
        setPreviewData(null);
        try {
            const res = await api.get('/network/preview', {
                params: { machineId, path: file.path }
            });
            setPreviewData(res.data);
        } catch {
            setPreviewData({ type: 'error', message: 'Failed to load preview' });
        } finally {
            setPreviewLoading(false);
        }
    };

    // Sort files
    const displayFiles = (searchResults || files).slice().sort((a, b) => {
        // Directories first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;

        let cmp = 0;
        switch (sortBy) {
            case 'size': cmp = (a.size || 0) - (b.size || 0); break;
            case 'date': cmp = new Date(a.modifiedAt || 0) - new Date(b.modifiedAt || 0); break;
            default: cmp = a.name.localeCompare(b.name);
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    if (!machineId) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360 }}>
                <div style={{ textAlign: 'center' }}>
                    <HardDrive size={40} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
                    <p style={{ color: 'var(--text-muted)', marginBottom: 10 }}>{t('selectMachineToView') || 'Select a machine from the Dashboard to browse files.'}</p>
                    <Link to="/" style={{ color: 'var(--accent-blue)', fontSize: 13, textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >{t('goToDashboard') || 'Go to Dashboard'}</Link>
                </div>
            </div>
        );
    }

    const pathParts = pathParam.split('/').filter(Boolean);
    const parentPath = pathParts.slice(0, -1).join('/');

    // Icon color map for dark theme
    const FILE_ICON_DARK = {
        jpg: '#F472B6', jpeg: '#F472B6', png: '#F472B6', gif: '#F472B6', webp: '#F472B6', svg: '#FB923C',
        js: '#FBBF24', jsx: '#06B6D4', ts: '#60A5FA', py: '#4ADE80', html: '#FB923C', css: '#60A5FA',
        json: '#94A3B8', mp3: '#C084FC', wav: '#C084FC', mp4: '#F87171', mkv: '#F87171', avi: '#F87171',
        zip: '#FBBF24', rar: '#FBBF24', '7z': '#FBBF24', db: '#818CF8', sql: '#818CF8', csv: '#4ADE80',
    };
    const getIconColor = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        return FILE_ICON_DARK[ext] || '#8B9DC0';
    };

    const iconBtnStyle = (hoverColor = 'var(--accent-blue)') => ({
        base: { padding: '5px', borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        enter: (e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = hoverColor; },
        leave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; },
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── Search Bar ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Search input */}
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={t('searchFiles') || "Search files and folders..."}
                            style={{ width: '100%', padding: '9px 12px 9px 36px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 9, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                        />
                        {searchResults && (
                            <button onClick={clearSearch} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filters toggle */}
                    <button onClick={() => setShowFilters(!showFilters)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', background: showFilters ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)', color: showFilters ? 'var(--accent-blue)' : 'var(--text-secondary)', borderColor: showFilters ? 'rgba(59,130,246,0.3)' : 'var(--border-default)' }}>
                        <SlidersHorizontal size={13} /> {t('advancedFilters') || 'Filters'}
                    </button>

                    {/* Search button */}
                    <button onClick={handleSearch} disabled={isSearching}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: isSearching ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#3B82F6,#06B6D4)', color: 'white', border: 'none', opacity: isSearching ? 0.7 : 1, boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
                        {isSearching ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={13} />}
                        {t('search') || 'Search'}
                    </button>
                </div>

                {/* Filter presets */}
                {showFilters && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }} className="animate-fadeIn">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {FILTER_PRESETS.map(preset => {
                                const Icon = preset.icon;
                                const isActive = activeFilter === preset.labelKey;
                                return (
                                    <button key={preset.labelKey} onClick={() => setActiveFilter(preset.labelKey)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)', color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)', border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}` }}>
                                        <Icon size={11} />{t(preset.labelKey) || preset.labelKey}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                <span>{t('size') || 'Size'}:</span>
                                {['min', 'max'].map(k => (
                                    <input key={k} type="number" placeholder={k === 'min' ? t('minSize') || 'Min (KB)' : t('maxSize') || 'Max (KB)'}
                                        value={sizeFilter[k]} onChange={e => setSizeFilter({ ...sizeFilter, [k]: e.target.value })}
                                        style={{ width: 90, padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }}
                                        onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    />
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                <span>{t('fileType') || 'Type'}:</span>
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                                    style={{ padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }}>
                                    <option value="all">{t('allTypes') || 'All'}</option>
                                    <option value="file">{t('onlyFiles') || 'Files only'}</option>
                                    <option value="directory">{t('onlyFolders') || 'Folders only'}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {searchResults && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        Found <strong style={{ color: 'var(--accent-blue)' }}>{searchResults.length}</strong> results
                        <button onClick={clearSearch} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('clearSelection') || 'Clear'}</button>
                    </div>
                )}
            </div>

            {/* ── File Browser ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, minHeight: 500, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>

                {/* Toolbar */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: 8 }}>
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flexShrink: 1 }}>
                        <Link to={parentPath ? `/files?machineId=${machineId}&path=${parentPath}` : '/'}
                            style={{ padding: '4px 7px', borderRadius: 6, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', border: '1px solid transparent' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                            <ArrowLeft size={14} />
                        </Link>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Link to="/" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, fontFamily: "'Fira Code', monospace" }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >{t('overview') || 'Home'}</Link>
                            <ChevronRight size={11} color="var(--text-muted)" />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontFamily: "'Fira Code', monospace" }}>Machine {machineId}</span>
                            {pathParts.map((part, idx) => {
                                const currentPath = pathParts.slice(0, idx + 1).join('/');
                                const isLast = idx === pathParts.length - 1;
                                return (
                                    <React.Fragment key={idx}>
                                        <ChevronRight size={11} color="var(--text-muted)" />
                                        {isLast ? (
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Fira Code', monospace" }}>{part}</span>
                                        ) : (
                                            <Link to={`/files?machineId=${machineId}&path=${currentPath}`}
                                                style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontFamily: "'Fira Code', monospace" }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            >{part}</Link>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Toolbar right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {/* Sort */}
                        <select value={`${sortBy}-${sortDir}`} onChange={e => { const [by, dir] = e.target.value.split('-'); setSortBy(by); setSortDir(dir); }}
                            style={{ fontSize: 11, padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-secondary)', outline: 'none' }}>
                            <option value="name-asc">{t('name') || 'Name'} A→Z</option>
                            <option value="name-desc">{t('name') || 'Name'} Z→A</option>
                            <option value="size-desc">{t('size') || 'Size'} ↓</option>
                            <option value="size-asc">{t('size') || 'Size'} ↑</option>
                            <option value="date-desc">{t('newest') || 'Newest'}</option>
                            <option value="date-asc">{t('oldest') || 'Oldest'}</option>
                        </select>

                        {/* View toggle */}
                        <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 7, overflow: 'hidden' }}>
                            {[['list', List], ['grid', Grid]].map(([mode, Icon]) => (
                                <button key={mode} onClick={() => setViewMode(mode)}
                                    style={{ padding: '5px 8px', background: viewMode === mode ? 'rgba(59,130,246,0.15)' : 'transparent', border: 'none', color: viewMode === mode ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                    <Icon size={14} />
                                </button>
                            ))}
                        </div>

                        {/* New folder */}
                        <button onClick={() => handleAction('mkdir')} title={t('newFolder') || 'New Folder'}
                            style={{ padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                        ><Plus size={14} /></button>

                        {/* Upload */}
                        <label title={t('upload') || 'Upload'}
                            style={{ padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7, color: uploading ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; } }}
                            onMouseLeave={e => { if (!uploading) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; } }}
                        >
                            {uploading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <UploadCloud size={14} />}
                            <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                        </label>

                        {/* Refresh */}
                        <button onClick={fetchFiles} title={t('refresh') || 'Refresh'}
                            style={{ padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: 12 }} onClick={handleBackgroundClick}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            {t('loadingFiles') || 'Loading files...'}
                        </div>
                    )}
                    {error && (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--danger)' }}>
                            <p style={{ marginBottom: 8 }}>{error}</p>
                            <button onClick={fetchFiles} style={{ fontSize: 12, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('retry') || 'Retry'}</button>
                        </div>
                    )}

                    {!loading && !error && displayFiles.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                            <Folder size={40} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
                            <p>{searchResults ? (t('noFilesMatch') || 'No results found') : (t('noFilesFoundDesc') || 'Folder is empty')}</p>
                        </div>
                    )}

                    {!loading && !error && displayFiles.length > 0 && (<>
                        {/* LIST VIEW */}
                        {viewMode === 'list' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {displayFiles.map((file, idx) => {
                                    const { icon: FileIcon } = file.isDirectory
                                        ? { icon: Folder } : getFileIcon(file.name);
                                    const iconColor = file.isDirectory ? 'var(--accent-blue)' : getIconColor(file.name);
                                    const previewable = !file.isDirectory && ['txt', 'log', 'md', 'json', 'xml', 'csv', 'yaml', 'yml', 'ini', 'conf', 'py', 'js', 'html', 'css', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(file.name.split('.').pop().toLowerCase());
                                    const isSelected = selectedItems.has(file.path);

                                    return (
                                        <div key={idx}
                                            onClick={(e) => handleSelection(e, file)}
                                            onContextMenu={(e) => handleContextMenu(e, file)}
                                            onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                                                background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                                                border: `1px solid ${isSelected ? 'rgba(59,130,246,0.25)' : 'transparent'}`,
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                                {/* Icon */}
                                                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${iconColor}18`, border: `1px solid ${iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                                                    <FileIcon size={15} color={iconColor} style={{ fill: file.isDirectory ? `${iconColor}20` : 'none' }} />
                                                    {isSelected && (
                                                        <div style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, background: 'var(--accent-blue)', borderRadius: '50%', border: '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <CheckCircle size={7} color="white" />
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Name */}
                                                {file.isDirectory ? (
                                                    <Link to={`/files?machineId=${machineId}&path=${file.path}`}
                                                        style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Fira Code', monospace" }}
                                                        onClick={(e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-cyan)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                                    >{file.name}</Link>
                                                ) : (
                                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Fira Code', monospace" }}>{file.name}</span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingLeft: 12 }}>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 72, textAlign: 'right', fontFamily: "'Fira Code', monospace" }}>
                                                    {!file.isDirectory ? formatFileSize(file.size) : '—'}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, textAlign: 'right' }}>
                                                    {formatDate(file.modifiedAt)}
                                                </span>
                                                {/* Action buttons (visible on hover via CSS in parent) */}
                                                <div className="file-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }}>
                                                    {previewable && (
                                                        <button onClick={(e) => { e.stopPropagation(); openPreview(file); }} title="Preview"
                                                            style={{ padding: 5, borderRadius: 5, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                        ><Eye size={13} /></button>
                                                    )}
                                                    {!file.isDirectory && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} title="Download"
                                                            style={{ padding: 5, borderRadius: 5, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.color = '#34D399'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                        ><Download size={13} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* GRID VIEW */}
                        {viewMode === 'grid' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                                {displayFiles.map((file, idx) => {
                                    const { icon: FileIcon } = file.isDirectory ? { icon: Folder } : getFileIcon(file.name);
                                    const iconColor = file.isDirectory ? 'var(--accent-blue)' : getIconColor(file.name);
                                    const isSelected = selectedItems.has(file.path);

                                    const cardContent = (
                                        <div style={{ position: 'relative', background: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)', border: `1px solid ${isSelected ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '16px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}
                                            onClick={(e) => { if (!file.isDirectory) e.preventDefault(); handleSelection(e, file); }}
                                            onContextMenu={(e) => handleContextMenu(e, file)}
                                            onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                            onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                                            onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; } }}
                                        >
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${iconColor}18`, border: `1px solid ${iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' }}>
                                                <FileIcon size={20} color={iconColor} style={{ fill: file.isDirectory ? `${iconColor}20` : 'none' }} />
                                                {isSelected && <div style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, background: 'var(--accent-blue)', borderRadius: '50%', border: '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={8} color="white" /></div>}
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontFamily: "'Fira Code', monospace" }}>{file.name}</span>
                                            {!file.isDirectory && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatFileSize(file.size)}</span>}
                                        </div>
                                    );

                                    return file.isDirectory ? (
                                        <div key={idx} onContextMenu={(e) => handleContextMenu(e, file)}>
                                            <Link to={`/files?machineId=${machineId}&path=${file.path}`} style={{ textDecoration: 'none' }} onClick={(e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }}>
                                                {cardContent}
                                            </Link>
                                        </div>
                                    ) : <div key={idx}>{cardContent}</div>;
                                })}
                            </div>
                        )}
                    </>)}
                </div>

                {/* Footer */}
                <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', fontFamily: "'Fira Code', monospace" }}>
                    <span>{displayFiles.length} {t('items') || 'items'}</span>
                    <span>{displayFiles.filter(f => !f.isDirectory).length} {t('files') || 'files'} · {displayFiles.filter(f => f.isDirectory).length} {t('folders') || 'folders'}</span>
                </div>
            </div>

            {/* ── Preview Modal ── */}
            {previewFile && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setPreviewFile(null)}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Eye size={15} color="var(--accent-blue)" />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{previewFile.name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatFileSize(previewFile.size)}</span>
                            </div>
                            <button onClick={() => setPreviewFile(null)} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {previewLoading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Loading preview...
                            </div>}
                            {!previewLoading && previewData?.type === 'text' && (
                                <pre style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#A8D8A8', background: 'var(--bg-base)', borderRadius: 10, padding: 16, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '60vh', lineHeight: 1.6 }}>
                                    {previewData.content}
                                </pre>
                            )}
                            {!previewLoading && previewData?.type === 'image' && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={`data:image/${previewData.ext};base64,${previewData.content}`} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }} />
                                </div>
                            )}
                            {!previewLoading && previewData && ['unsupported', 'error'].includes(previewData.type) && (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <FileText size={36} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
                                    <p>{previewData.message}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Context Menu ── */}
            {contextMenu && (
                <div className="animate-fadeIn"
                    style={{ position: 'fixed', zIndex: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '4px', width: 200, boxShadow: 'var(--shadow-elevated)', top: Math.min(contextMenu.y, window.innerHeight - 220), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
                    onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                        {contextMenu.file.isDirectory ? <Folder size={13} color="var(--accent-blue)" /> : <File size={13} color="var(--text-muted)" />}
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Fira Code', monospace" }}>{contextMenu.file.name}</span>
                    </div>

                    {[
                        { show: !contextMenu.file.isDirectory, label: t('openPreview') || 'Open Preview', icon: Eye, action: () => { openPreview(contextMenu.file); setContextMenu(null); }, color: 'var(--accent-blue)' },
                        { show: true, label: t('rename') || 'Rename', icon: Terminal, action: () => handleAction('rename'), color: 'var(--text-primary)' },
                        { show: !contextMenu.file.isDirectory, label: t('download') || 'Download', icon: Download, action: () => { handleDownload(contextMenu.file); setContextMenu(null); }, color: '#34D399' },
                    ].filter(i => i.show).map(({ label, icon: Icon, action, color }) => (
                        <button key={label} onClick={action}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', borderRadius: 7, textAlign: 'left' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = color; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        ><Icon size={13} />{label}</button>
                    ))}

                    <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                    <button onClick={() => handleAction('delete')}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--danger)', borderRadius: 7 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    ><XCircle size={13} />{t('delete') || 'Delete'}</button>
                </div>
            )}

            {/* ── Notification Toast ── */}
            {notification && (
                <div className="animate-fadeUp" style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 60,
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                    borderRadius: 10, boxShadow: 'var(--shadow-elevated)',
                    background: notification.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    border: `1px solid ${notification.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    color: notification.type === 'error' ? '#F87171' : '#34D399',
                    fontSize: 13, fontWeight: 500,
                }}>
                    {notification.type === 'error' ? <XCircle size={15} /> : <CheckCircle size={15} />}
                    {notification.message}
                </div>
            )}

            {/* ── Action Modal ── */}
            {activeModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setActiveModal(null)}>
                    <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 380, padding: 24, boxShadow: 'var(--shadow-elevated)' }}
                        onClick={e => e.stopPropagation()}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18, fontFamily: "'Fira Code', monospace" }}>
                            {activeModal === 'delete' && <><XCircle size={16} color="var(--danger)" /> Delete Item</>}
                            {activeModal === 'rename' && <><Terminal size={16} color="var(--accent-blue)" /> Rename Item</>}
                            {activeModal === 'mkdir' && <><Folder size={16} color="var(--accent-blue)" /> New Folder</>}
                        </h3>

                        <form onSubmit={handleConfirmAction}>
                            {activeModal === 'delete' ? (
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                                    {t('deleteWarning') || 'Delete'} <strong style={{ color: 'var(--text-primary)' }}>{modalData?.file.name}</strong>?
                                    <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>{t('cannotBeUndone') || 'This action cannot be undone.'}</span>
                                </p>
                            ) : (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                                        {activeModal === 'mkdir' ? (t('folderName') || 'Folder Name') : (t('newName') || 'New Name')}
                                    </label>
                                    <input type="text" autoFocus value={modalInput} onChange={e => setModalInput(e.target.value)}
                                        placeholder={activeModal === 'mkdir' ? (t('enterName') || 'My New Folder') : ''}
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "'Fira Code', monospace" }}
                                        onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button type="button" onClick={() => setActiveModal(null)}
                                    style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                >{t('cancel') || 'Cancel'}</button>
                                <button type="submit"
                                    style={{ padding: '8px 16px', background: activeModal === 'delete' ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#3B82F6,#06B6D4)', border: `1px solid ${activeModal === 'delete' ? 'rgba(239,68,68,0.3)' : 'transparent'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: activeModal === 'delete' ? '#F87171' : 'white', cursor: 'pointer', boxShadow: activeModal !== 'delete' ? '0 2px 8px rgba(59,130,246,0.25)' : 'none' }}>
                                    {activeModal === 'delete' ? (t('delete') || 'Delete') : activeModal === 'rename' ? (t('rename') || 'Rename') : (t('create') || 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                div:hover > div > .file-actions { opacity: 1 !important; }
            `}</style>
        </div>
    );
};

export default FileSystem;
