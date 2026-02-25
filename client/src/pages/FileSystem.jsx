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

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('vi-VN');
}

// ==================== FILTER PRESETS ====================
const FILTER_PRESETS = [
    { label: 'All', extensions: null, icon: File },
    { label: 'Images', extensions: 'jpg,jpeg,png,gif,webp,svg,bmp', icon: Image },
    { label: 'Videos', extensions: 'mp4,mkv,avi,mov,wmv,flv', icon: Video },
    { label: 'Audio', extensions: 'mp3,wav,flac,aac,ogg,wma', icon: Music },
    { label: 'Docs', extensions: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md', icon: FileText },
    { label: 'Code', extensions: 'js,jsx,ts,tsx,py,java,c,cpp,go,rs,html,css', icon: FileCode },
    { label: 'Archives', extensions: 'zip,rar,7z,tar,gz,bz2', icon: Archive },
    { label: 'Data', extensions: 'csv,json,xml,sql,db,sqlite', icon: Database },
];

// ==================== MAIN COMPONENT ====================
const FileSystem = () => {
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
    const [activeFilter, setActiveFilter] = useState('All');
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
        setActiveFilter('All');
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
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <HardDrive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Select a machine from the Dashboard to browse files.</p>
                    <Link to="/" className="text-indigo-600 text-sm hover:underline mt-2 inline-block">Go to Dashboard</Link>
                </div>
            </div>
        );
    }

    const pathParts = pathParam.split('/').filter(Boolean);
    const parentPath = pathParts.slice(0, -1).join('/');

    return (
        <div className="space-y-4">
            {/* ==================== SEARCH BAR ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Search files and folders..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm transition-all"
                        />
                        {searchResults && (
                            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded">
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${showFilters ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Search
                    </button>
                </div>

                {/* Filter Bar */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-slideDown">
                        {/* Filter presets */}
                        <div className="flex flex-wrap gap-2">
                            {FILTER_PRESETS.map(preset => {
                                const Icon = preset.icon;
                                return (
                                    <button
                                        key={preset.label}
                                        onClick={() => setActiveFilter(preset.label)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${activeFilter === preset.label
                                            ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className="w-3 h-3" />
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Size + Type filters */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Size:</span>
                                <input
                                    type="number"
                                    placeholder="Min (KB)"
                                    value={sizeFilter.min}
                                    onChange={e => setSizeFilter({ ...sizeFilter, min: e.target.value })}
                                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                                />
                                <span>—</span>
                                <input
                                    type="number"
                                    placeholder="Max (KB)"
                                    value={sizeFilter.max}
                                    onChange={e => setSizeFilter({ ...sizeFilter, max: e.target.value })}
                                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Type:</span>
                                <select
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value)}
                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                                >
                                    <option value="all">All</option>
                                    <option value="file">Files only</option>
                                    <option value="directory">Folders only</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search result count */}
                {searchResults && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Found <strong className="text-indigo-600">{searchResults.length}</strong> results</span>
                        <button onClick={clearSearch} className="text-xs text-gray-400 hover:text-gray-600 underline ml-2">Clear</button>
                    </div>
                )}
            </div>

            {/* ==================== FILE BROWSER ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px] flex flex-col">
                {/* Toolbar */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <Link
                            to={parentPath ? `/files?machineId=${machineId}&path=${parentPath}` : '/'}
                            className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-indigo-600 border border-transparent hover:border-gray-200"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>

                        <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Link to="/" className="hover:text-indigo-600 font-medium px-1">Home</Link>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <span className="font-medium text-gray-700 px-1">Machine {machineId}</span>

                            {pathParts.map((part, idx) => {
                                const currentPath = pathParts.slice(0, idx + 1).join('/');
                                const isLast = idx === pathParts.length - 1;
                                return (
                                    <React.Fragment key={idx}>
                                        <ChevronRight className="w-3 h-3 text-gray-300" />
                                        {isLast ? (
                                            <span className="font-medium text-gray-800 px-1">{part}</span>
                                        ) : (
                                            <Link
                                                to={`/files?machineId=${machineId}&path=${currentPath}`}
                                                className="hover:text-indigo-600 px-1"
                                            >
                                                {part}
                                            </Link>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Sort */}
                        <select
                            value={`${sortBy}-${sortDir}`}
                            onChange={e => {
                                const [by, dir] = e.target.value.split('-');
                                setSortBy(by);
                                setSortDir(dir);
                            }}
                            className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none bg-white"
                        >
                            <option value="name-asc">Name A→Z</option>
                            <option value="name-desc">Name Z→A</option>
                            <option value="size-desc">Size ↓</option>
                            <option value="size-asc">Size ↑</option>
                            <option value="date-desc">Newest</option>
                            <option value="date-asc">Oldest</option>
                        </select>

                        {/* View toggle */}
                        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={() => handleAction('mkdir')}
                            className="p-1.5 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
                            title="New Folder"
                        >
                            <Plus className="w-4 h-4" />
                        </button>

                        <label className="p-1.5 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer" title="Upload File">
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <UploadCloud className="w-4 h-4" />}
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                        </label>

                        <button onClick={fetchFiles} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3">
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    {error && (
                        <div className="text-center py-16">
                            <p className="text-red-500 mb-2">{error}</p>
                            <button onClick={fetchFiles} className="text-sm text-indigo-600 hover:underline">Retry</button>
                        </div>
                    )}

                    {!loading && !error && displayFiles.length === 0 && (
                        <div className="text-center py-20 text-gray-400">
                            <Folder className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                            <p>{searchResults ? 'No results found' : 'Folder is empty'}</p>
                        </div>
                    )}

                    {!loading && !error && displayFiles.length > 0 && (
                        <>
                            {/* ==================== LIST VIEW ==================== */}
                            {viewMode === 'list' && (
                                <div className="space-y-0.5" onClick={handleBackgroundClick}>
                                    {displayFiles.map((file, idx) => {
                                        const { icon: FileIcon, color, bg } = file.isDirectory
                                            ? { icon: Folder, color: 'text-indigo-400', bg: 'bg-indigo-50' }
                                            : getFileIcon(file.name);
                                        const previewable = !file.isDirectory && ['txt', 'log', 'md', 'json', 'xml', 'csv', 'yaml', 'yml', 'ini', 'conf', 'py', 'js', 'html', 'css', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(file.name.split('.').pop().toLowerCase());

                                        const isSelected = selectedItems.has(file.path);

                                        return (
                                            <div
                                                key={idx}
                                                className={`group flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors cursor-pointer select-none ${isSelected
                                                    ? 'bg-indigo-50 ring-1 ring-indigo-500/20'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                                onClick={(e) => {
                                                    // Prevent navigation if clicking row but not link
                                                    handleSelection(e, file);
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, file)}
                                                onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 relative`}>
                                                        <FileIcon className={`w-4 h-4 ${color} ${file.isDirectory ? 'fill-indigo-100' : ''}`} />
                                                        {isSelected && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white flex items-center justify-center">
                                                            <CheckCircle className="w-2 h-2 text-white" />
                                                        </div>}
                                                    </div>
                                                    <div className="min-w-0">
                                                        {file.isDirectory ? (
                                                            <Link
                                                                to={`/files?machineId=${machineId}&path=${file.path}`}
                                                                className="text-sm text-gray-800 font-medium hover:text-indigo-600 truncate block"
                                                                onClick={(e) => {
                                                                    if (e.ctrlKey || e.metaKey || contextMenu) e.preventDefault();
                                                                }}
                                                            >
                                                                {file.name}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-sm text-gray-700 truncate block">{file.name}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                                                    <span className="text-xs text-gray-400 w-20 text-right">
                                                        {!file.isDirectory ? formatFileSize(file.size) : '—'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 w-16 text-right hidden md:block">
                                                        {formatDate(file.modifiedAt)}
                                                    </span>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {previewable && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openPreview(file); }}
                                                                className="p-1.5 hover:bg-indigo-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
                                                                title="Preview"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {!file.isDirectory && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                                className="p-1.5 hover:bg-green-100 rounded-lg text-gray-400 hover:text-green-600 transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ==================== GRID VIEW ==================== */}
                            {viewMode === 'grid' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                    {displayFiles.map((file, idx) => {
                                        const { icon: FileIcon, color, bg } = file.isDirectory
                                            ? { icon: Folder, color: 'text-indigo-400', bg: 'bg-indigo-50' }
                                            : getFileIcon(file.name);

                                        const isSelected = selectedItems.has(file.path);
                                        const content = (
                                            <div
                                                className={`group relative border rounded-xl p-4 flex flex-col items-center text-center transition-all cursor-pointer select-none ${isSelected
                                                    ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
                                                    : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'
                                                    }`}
                                                onClick={(e) => {
                                                    if (!file.isDirectory) e.preventDefault(); // Prevent link nav if clicking file
                                                    handleSelection(e, file);
                                                }}
                                                onContextMenu={(e) => {
                                                    handleContextMenu(e, file);
                                                    // Prevent default handled in function
                                                }}
                                                onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                            >
                                                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-3 relative`}>
                                                    <FileIcon className={`w-6 h-6 ${color} ${file.isDirectory ? 'fill-indigo-100' : ''}`} />
                                                    {isSelected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center">
                                                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                                                    </div>}
                                                </div>
                                                <span className="text-xs text-gray-700 font-medium truncate w-full">{file.name}</span>
                                                {!file.isDirectory && (
                                                    <span className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(file.size)}</span>
                                                )}
                                            </div>
                                        );

                                        return file.isDirectory ? (
                                            <div key={idx} onContextMenu={(e) => handleContextMenu(e, file)}>
                                                {/* Wrap in div to capture context menu before Link */}
                                                <Link
                                                    to={`/files?machineId=${machineId}&path=${file.path}`}
                                                    onClick={(e) => {
                                                        if (e.ctrlKey || e.metaKey || contextMenu) e.preventDefault();
                                                    }}
                                                >
                                                    {content}
                                                </Link>
                                            </div>
                                        ) : (
                                            <div key={idx}>
                                                {content}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
                    <span>{displayFiles.length} items</span>
                    <span>
                        {displayFiles.filter(f => !f.isDirectory).length} files,{' '}
                        {displayFiles.filter(f => f.isDirectory).length} folders
                    </span>
                </div>
            </div>

            {/* ==================== PREVIEW MODAL ==================== */}
            {previewFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <Eye className="w-4 h-4 text-indigo-500" />
                                <span className="font-medium text-gray-800 text-sm truncate">{previewFile.name}</span>
                                <span className="text-xs text-gray-400">{formatFileSize(previewFile.size)}</span>
                            </div>
                            <button onClick={() => setPreviewFile(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-5">
                            {previewLoading && (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}

                            {!previewLoading && previewData && previewData.type === 'text' && (
                                <pre className="text-sm text-gray-700 font-mono bg-gray-50 rounded-xl p-4 overflow-auto whitespace-pre-wrap break-words max-h-[60vh]">
                                    {previewData.content}
                                </pre>
                            )}

                            {!previewLoading && previewData && previewData.type === 'image' && (
                                <div className="flex items-center justify-center">
                                    <img
                                        src={`data:image/${previewData.ext};base64,${previewData.content}`}
                                        alt={previewFile.name}
                                        className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                                    />
                                </div>
                            )}

                            {!previewLoading && previewData && (previewData.type === 'unsupported' || previewData.type === 'error') && (
                                <div className="text-center py-12 text-gray-400">
                                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                    <p>{previewData.message}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-56 text-sm animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                    style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 250) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 border-b border-gray-50 mb-1 flex items-center gap-2">
                        {contextMenu.file.isDirectory ? <Folder className="w-4 h-4 text-indigo-500" /> : <File className="w-4 h-4 text-gray-400" />}
                        <span className="font-medium text-gray-700 truncate">{contextMenu.file.name}</span>
                    </div>

                    {!contextMenu.file.isDirectory && (
                        <button onClick={() => { openPreview(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors">
                            <Eye className="w-4 h-4" /> Open Preview
                        </button>
                    )}

                    <button onClick={() => handleAction('rename')} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 transition-colors">
                        <Terminal className="w-4 h-4 text-gray-400" /> Rename
                    </button>

                    {!contextMenu.file.isDirectory && (
                        <button onClick={() => { handleDownload(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 transition-colors">
                            <Download className="w-4 h-4 text-gray-400" /> Download
                        </button>
                    )}

                    <div className="h-px bg-gray-100 my-1"></div>

                    <button onClick={() => handleAction('delete')} className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 flex items-center gap-2.5 text-red-600 transition-colors">
                        <XCircle className="w-4 h-4" /> Delete
                    </button>
                </div>
            )}

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideDown z-50 ${notification.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                    {notification.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{notification.message}</span>
                </div>
            )}

            {/* Action Modals */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {activeModal === 'delete' && <><XCircle className="w-5 h-5 text-red-500" /> Delete Item</>}
                            {activeModal === 'rename' && <><Terminal className="w-5 h-5 text-indigo-500" /> Rename Item</>}
                            {activeModal === 'mkdir' && <><Folder className="w-5 h-5 text-indigo-500" /> New Folder</>}
                        </h3>

                        <form onSubmit={handleConfirmAction}>
                            {activeModal === 'delete' ? (
                                <p className="text-gray-600 mb-6">
                                    Are you sure you want to delete <span className="font-medium text-gray-900">{modalData?.file.name}</span>?
                                    <br /><span className="text-xs text-red-500 mt-2 block">This action cannot be undone.</span>
                                </p>
                            ) : (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {activeModal === 'mkdir' ? 'Folder Name' : 'New Name'}
                                    </label>
                                    <input
                                        type="text"
                                        autoFocus
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        value={modalInput}
                                        onChange={e => setModalInput(e.target.value)}
                                        placeholder={activeModal === 'mkdir' ? "My New Folder" : ""}
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-colors ${activeModal === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                >
                                    {activeModal === 'delete' ? 'Delete' : activeModal === 'rename' ? 'Rename' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
                @keyframes slideDown {
                    from { transform: translateY(-8px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slideDown { animation: slideDown 0.2s ease-out; }
            `}</style>
        </div>
    );
};

export default FileSystem;
