import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Folder, FileText, ChevronRight, ArrowLeft, Download, Search,
    Filter, Grid, List, Eye, X, Image, FileCode, File, Music,
    Video, Archive, Database, Settings2, RefreshCw,
    XCircle, Terminal, UploadCloud, Loader2, CheckCircle, Plus,
    SlidersHorizontal, ChevronDown, Clock, HardDrive, Server, MapPin, Network, Home, Star,
    Send, ArrowRightLeft, Pencil
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../hooks/useNotifications';
import PathManager from '../components/PathManager';

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

    // File editor
    const [editModal, setEditModal] = useState(null); // { file } | null
    const [editContent, setEditContent] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Downloads: Map<filePath, { name, progress, status, loaded, cancel, errorMsg }>
    const [downloads, setDownloads] = useState(new Map());
    const [showDownloadPanel, setShowDownloadPanel] = useState(true);

    // Transfer modal state
    const [transferModal, setTransferModal] = useState(null); // { file } | null
    const [transferTargetMachineId, setTransferTargetMachineId] = useState('');
    const [transferDestPath, setTransferDestPath] = useState('');
    const [transferring, setTransferring] = useState(false);
    const [availableMachines, setAvailableMachines] = useState([]);
    const [transferResult, setTransferResult] = useState(null); // { method, size, name }

    // Selection & Context Menu
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [contextMenu, setContextMenu] = useState(null);
    const [activeModal, setActiveModal] = useState(null); // 'rename', 'delete', 'mkdir', 'info'
    const [modalData, setModalData] = useState(null);
    const [modalInput, setModalInput] = useState('');
    const [notification, setNotification] = useState(null);
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [editPathInput, setEditPathInput] = useState('');

    // Pinned Paths (CRUD Paths for quick access)
    const [pinnedPaths, setPinnedPaths] = useState(() => {
        try {
            const stored = localStorage.getItem('nas_pinned_paths');
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    });

    const togglePinPath = (path) => {
        const key = machineId || 'global';
        const currentPins = pinnedPaths[key] || [];
        let newPins;
        if (currentPins.includes(path)) {
            newPins = currentPins.filter(p => p !== path);
        } else {
            newPins = [...currentPins, path];
        }
        const updated = { ...pinnedPaths, [key]: newPins };
        setPinnedPaths(updated);
        localStorage.setItem('nas_pinned_paths', JSON.stringify(updated));
    };

    const isPathPinned = (path) => {
        const currentPins = pinnedPaths[machineId || 'global'] || [];
        return currentPins.includes(path);
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const [machines, setMachines] = useState([]);
    const [loadingMachines, setLoadingMachines] = useState(false);

    // Initial load machines if no machineId is selected
    useEffect(() => {
        if (!machineId) {
            setLoadingMachines(true);
            Promise.all([
                api.get('/agents').catch(() => ({ data: [] })),
                api.get('/system/stats').catch(() => ({ data: null })),
                api.get('/hierarchy').catch(() => ({ data: [] }))
            ]).then(([agentsRes, sysRes, hierarchyRes]) => {
                const nodes = [];
                // 1. Add Master Node
                if (sysRes.data) {
                    nodes.push({
                        id: 'master',
                        name: t('masterNode'),
                        status: 'online',
                        group: t('systemGroup')
                    });
                }

                const connectedAgents = agentsRes.data || [];
                const connectedAgentIds = connectedAgents.map(a => Number(a.id));

                // 2. Add DB Configured Machines
                if (hierarchyRes.data) {
                    hierarchyRes.data.forEach(floor => {
                        floor.rooms?.forEach(room => {
                            room.machines?.forEach(machine => {
                                const isOnline = connectedAgentIds.includes(Number(machine.id));
                                nodes.push({
                                    id: machine.id,
                                    name: machine.name,
                                    ip: machine.ipAddress,
                                    status: isOnline ? 'online' : 'offline',
                                    group: `${floor.name} - ${room.name}`,
                                    clientConnect: isOnline
                                });
                            });
                        });
                    });
                }

                // 3. Add unassigned Client Connect nodes (connected but not in hierarchy)
                connectedAgents.forEach(a => {
                    const exists = nodes.some(n => Number(n.id) === Number(a.id));
                    if (!exists) {
                        nodes.push({
                            id: a.id,
                            name: a.machineName || a.hostname || `Node-${a.id}`,
                            status: 'online',
                            group: t('clientConnectGroup'),
                            clientConnect: true
                        });
                    }
                });

                setMachines(nodes);
            }).finally(() => {
                setLoadingMachines(false);
            });
        }
    }, [machineId, t]);

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
            setError(err.response?.data?.error || t('failedToLoadFiles'));
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

    // Real-time: auto-refresh when files change on current machine
    const { subscribe, connected: wsConnected } = useNotifications();
    useEffect(() => {
        if (!machineId) return;
        const events = ['file:created', 'file:deleted', 'file:renamed', 'file:uploaded'];
        const unsubs = events.map(evt =>
            subscribe(evt, (data) => {
                if (String(data.machineId) === String(machineId)) {
                    fetchFiles();
                }
            })
        );
        // Also refresh on agent status change for this machine
        const unsubOnline = subscribe('agent:online', (data) => {
            if (String(data.machineId) === String(machineId)) fetchFiles();
        });
        const unsubOffline = subscribe('agent:offline', (data) => {
            if (String(data.machineId) === String(machineId)) fetchFiles();
        });
        return () => { unsubs.forEach(fn => fn()); unsubOnline(); unsubOffline(); };
    }, [machineId, subscribe, fetchFiles]);

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
            showNotification('success', t('uploadedSuccessfully'));
            fetchFiles();
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('uploadFailed'));
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };


    const handleDownload = async (file) => {
        if (!file || file.isDirectory) return;
        if (downloads.has(file.path)) return; // Already downloading

        const controller = new AbortController();
        setShowDownloadPanel(true);
        setDownloads(prev => new Map(prev).set(file.path, {
            name: file.name,
            progress: 0,
            loaded: 0,
            status: 'downloading',
            size: file.size || null,
            cancel: () => controller.abort()
        }));

        try {
            const response = await api.get('/files/download', {
                params: { machineId, path: file.path },
                responseType: 'blob',
                signal: controller.signal,
                onDownloadProgress: (evt) => {
                    setDownloads(prev => {
                        const m = new Map(prev);
                        const entry = m.get(file.path);
                        if (!entry) return prev;
                        const progress = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
                        m.set(file.path, { ...entry, progress, loaded: evt.loaded });
                        return m;
                    });
                }
            });

            const objectUrl = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);

            setDownloads(prev => {
                const m = new Map(prev);
                const entry = m.get(file.path);
                if (entry) m.set(file.path, { ...entry, status: 'done', progress: 100 });
                return m;
            });
            setTimeout(() => {
                setDownloads(prev => { const m = new Map(prev); m.delete(file.path); return m; });
            }, 3000);

        } catch (err) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.name === 'AbortError') {
                setDownloads(prev => { const m = new Map(prev); m.delete(file.path); return m; });
                return;
            }
            let msg = t('downloadFailed');
            try {
                const blob = err.response?.data;
                if (blob instanceof Blob && blob.type?.includes('json')) {
                    const text = await blob.text();
                    const json = JSON.parse(text);
                    if (json.error) msg = json.error;
                }
            } catch { /* ignore parse errors */ }
            setDownloads(prev => {
                const m = new Map(prev);
                const entry = m.get(file.path);
                if (entry) m.set(file.path, { ...entry, status: 'error', errorMsg: msg });
                return m;
            });
            setTimeout(() => {
                setDownloads(prev => { const m = new Map(prev); m.delete(file.path); return m; });
            }, 5000);
            showNotification('error', msg);
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

    const openTransferModal = async (file) => {
        setContextMenu(null);
        setTransferModal({ file });
        setTransferTargetMachineId('');
        setTransferDestPath(file.name); // default dest filename
        // Load all connected machines (except current)
        try {
            const [agentsRes, hierarchyRes] = await Promise.all([
                api.get('/agents').catch(() => ({ data: [] })),
                api.get('/hierarchy').catch(() => ({ data: [] }))
            ]);
            const agentIds = (agentsRes.data || []).map(a => Number(a.id));
            const nodes = [];
            (hierarchyRes.data || []).forEach(floor => {
                floor.rooms?.forEach(room => {
                    room.machines?.forEach(m => {
                        if (agentIds.includes(Number(m.id)) && String(m.id) !== String(machineId)) {
                            nodes.push({ id: m.id, name: m.name, group: `${floor.name} — ${room.name}` });
                        }
                    });
                });
            });
            // Include unassigned agents
            (agentsRes.data || []).forEach(a => {
                const exists = nodes.some(n => Number(n.id) === Number(a.id));
                if (!exists && String(a.id) !== String(machineId)) {
                    nodes.push({ id: a.id, name: a.machineName || `Agent-${a.id}`, group: 'Client Connect' });
                }
            });
            setAvailableMachines(nodes);
        } catch { setAvailableMachines([]); }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        if (!transferTargetMachineId || !transferDestPath || !transferModal?.file) return;
        setTransferring(true);
        setTransferResult(null);
        try {
            const res = await api.post('/files/transfer', {
                fromMachineId: machineId,
                toMachineId: transferTargetMachineId,
                sourcePath: transferModal.file.path,
                destPath: transferDestPath
            });
            setTransferResult(res.data);
            const methodLabel = { 'sftp→sftp': 'SSH→SSH', 'agent→sftp': 'Agent→SSH', 'sftp→agent': 'SSH→Agent', 'agent→agent': 'Agent→Agent' }[res.data.method] || res.data.method;
            showNotification('success', `${t('transferComplete') || 'Transferred'} — ${methodLabel}`);
            setTransferModal(null);
        } catch (err) {
            showNotification('error', err.response?.data?.error || (t('transferFailed') || 'Transfer failed'));
        } finally {
            setTransferring(false);
        }
    };

    const handlePathSubmit = (e) => {
        if (e.key === 'Enter') {
            setSearchParams({ machineId, path: editPathInput });
            setIsEditingPath(false);
        } else if (e.key === 'Escape') {
            setIsEditingPath(false);
        }
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
                showNotification('success', t('deletedSuccessfully'));
            } else if (activeModal === 'rename') {
                const target = modalData.file;
                await api.put('/files/rename', { machineId, path: target.path, newName: modalInput });
                showNotification('success', t('renamedSuccessfully'));
            } else if (activeModal === 'mkdir') {
                // For mkdir, current path is pathParam
                let targetPath = pathParam ? `${pathParam}/${modalInput}` : modalInput;
                // On Windows/Agent, paths might need careful handling, but Agent handles join.
                // However, we send raw path.
                if (pathParam && !pathParam.endsWith('/') && !pathParam.endsWith('\\')) targetPath = `${pathParam}/${modalInput}`;

                await api.post('/files/mkdir', { machineId, path: targetPath });
                showNotification('success', t('folderCreated'));
            }

            fetchFiles();
            setActiveModal(null);
            setModalInput('');
            setModalData(null);
        } catch (err) {
            showNotification('error', err.response?.data?.error || t('actionFailed'));
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
            setError(err.response?.data?.error || t('searchFailed'));
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

    // Text file extensions that can be edited
    const TEXT_EXTS = new Set(['txt','md','json','js','ts','jsx','tsx','css','html','htm','xml','yaml','yml','ini','conf','cfg','log','sh','bat','py','rb','php','java','c','cpp','h','sql','env','gitignore','toml','csv']);
    const isEditableFile = (file) => !file.isDirectory && TEXT_EXTS.has(file.name.split('.').pop()?.toLowerCase());

    const openEdit = async (file) => {
        setContextMenu(null);
        setEditModal({ file });
        setEditLoading(true);
        setEditContent('');
        try {
            const res = await api.get('/network/preview', { params: { machineId, path: file.path } });
            if (res.data?.type === 'text') {
                setEditContent(res.data.content);
            } else {
                showNotification('error', t('fileNotEditable') || 'File content could not be loaded');
                setEditModal(null);
            }
        } catch {
            showNotification('error', t('failedToLoadPreview') || 'Failed to load file');
            setEditModal(null);
        } finally {
            setEditLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editModal || editSaving) return;
        setEditSaving(true);
        try {
            await api.put('/files/edit', { machineId, path: editModal.file.path, content: editContent });
            showNotification('success', t('savedSuccessfully') || 'Saved');
            setEditModal(null);
        } catch (err) {
            showNotification('error', err.response?.data?.error || (t('actionFailed') || 'Save failed'));
        } finally {
            setEditSaving(false);
        }
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
            setPreviewData({ type: 'error', message: t('failedToLoadPreview') });
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
            <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-default)', paddingBottom: '16px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <HardDrive style={{ color: 'var(--accent-blue)' }} size={28} />
                        {t('selectMachineToView') || 'Select NAS Node'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
                        {t('chooseNodeToBrowse')}
                    </p>
                </div>

                {loadingMachines ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
                        <Loader2 className="animate-spin" size={24} style={{ marginRight: 8 }} />
                        {t('loadingNodes')}
                    </div>
                ) : machines.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
                        {t('noNodesAvailable')}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                        {machines.map(node => (
                            <Link
                                key={node.id}
                                to={`/files?machineId=${node.id}`}
                                style={{
                                    textDecoration: 'none',
                                    display: 'block',
                                    padding: '20px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '12px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '10px', color: node.id === 'master' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                                        <Server size={32} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                        {node.id === 'master' && (
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-blue)', background: 'var(--accent-bg-light)', border: '1px solid var(--accent-border-medium)', borderRadius: '4px', padding: '2px 7px', fontFamily: 'monospace' }}>{t('systemBadge')}</span>
                                        )}
                                        {node.clientConnect && (
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '4px', padding: '2px 7px', fontFamily: 'monospace' }}>{t('clientConnectBadge')}</span>
                                        )}
                                        <span style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: node.status === 'online' ? 'var(--success)' : 'var(--muted)',
                                            boxShadow: node.status === 'online' ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
                                        }} />
                                    </div>
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'monospace' }}>
                                    {node.name}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    ID: <span style={{ fontFamily: 'monospace' }}>{node.id}</span>
                                </p>

                                {node.group && (
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                                            {node.group}
                                        </div>
                                        {node.ip && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
                                                <Network size={14} style={{ color: 'var(--text-muted)' }} />
                                                {node.ip}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
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
        enter: (e) => { e.currentTarget.style.background = 'var(--accent-bg-light)'; e.currentTarget.style.color = hoverColor; },
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
                            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; }}
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
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', background: showFilters ? 'var(--accent-bg-medium)' : 'var(--bg-elevated)', color: showFilters ? 'var(--accent-blue)' : 'var(--text-secondary)', borderColor: showFilters ? 'var(--accent-border-strong)' : 'var(--border-default)' }}>
                        <SlidersHorizontal size={13} /> {t('advancedFilters') || 'Filters'}
                    </button>

                    {/* Search button */}
                    <button onClick={handleSearch} disabled={isSearching}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: isSearching ? 'wait' : 'pointer', background: 'var(--accent-gradient)', color: 'white', border: 'none', opacity: isSearching ? 0.7 : 1, boxShadow: 'var(--accent-shadow)' }}>
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
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'var(--accent-bg-medium)' : 'var(--bg-elevated)', color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)', border: `1px solid ${isActive ? 'var(--accent-border-strong)' : 'var(--border-subtle)'}` }}>
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
                        Found <strong style={{ color: 'var(--accent-blue)' }}>{searchResults.length}</strong> {t('results') || 'results'}
                        <button onClick={clearSearch} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('clearSelection') || 'Clear'}</button>
                    </div>
                )}
            </div>

            {/* ── Main Layout ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

                {/* ── Saved Paths Sidebar (CRUD) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Root link */}
                    <Link to={`/files?machineId=${machineId}`} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                        borderRadius: 10, color: (!pathParam || pathParam === '.') ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        background: (!pathParam || pathParam === '.') ? 'var(--accent-bg-light)' : 'var(--bg-card)',
                        textDecoration: 'none', fontSize: 13, fontWeight: 600,
                        border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)'
                    }}>
                        <Home size={14} /> {t('rootDirectory')}
                    </Link>
                    <PathManager machineId={machineId} currentPath={pathParam} onNavigate={(mid, p) => {
                        setSearchParams({ machineId: mid || machineId, path: p });
                    }} />
                </div>

                {/* ── File Browser ── */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, minHeight: 500, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>

                    {/* Toolbar */}
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: 8 }}>
                        {/* Breadcrumb */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flexShrink: 1 }}>
                            <Link to={parentPath ? `/files?machineId=${machineId}&path=${parentPath}` : `/files?machineId=${machineId}`}
                                style={{ padding: '4px 7px', borderRadius: 6, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', border: '1px solid transparent' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                            >
                                <ArrowLeft size={14} />
                            </Link>

                            {isEditingPath ? (
                                <input
                                    type="text"
                                    autoFocus
                                    value={editPathInput}
                                    onChange={e => setEditPathInput(e.target.value)}
                                    onKeyDown={handlePathSubmit}
                                    onBlur={() => setIsEditingPath(false)}
                                    placeholder={t('enterAbsolutePath')}
                                    style={{
                                        flex: 1, minWidth: '300px', padding: '5px 10px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--accent-blue)',
                                        borderRadius: 6, fontSize: 12, color: 'var(--text-primary)',
                                        outline: 'none', fontFamily: "'Fira Code', monospace"
                                    }}
                                />
                            ) : (
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'text', flex: 1, padding: '4px 0' }}
                                    onClick={() => { setEditPathInput(pathParam || '.'); setIsEditingPath(true); }}
                                    title={t('clickToEnterPath')}
                                >
                                    <Link to="/files" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, fontFamily: "'Fira Code', monospace" }}
                                        onClick={e => e.stopPropagation()}
                                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                    >{t('fileExplorer') || 'Files'}</Link>
                                    <ChevronRight size={11} color="var(--text-muted)" />
                                    <Link to={`/files?machineId=${machineId}`}
                                        onClick={e => e.stopPropagation()}
                                        style={{ color: 'var(--text-secondary)', fontWeight: 500, fontFamily: "'Fira Code', monospace", textDecoration: 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                    >{t('machine')} {machineId}</Link>
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
                                                        onClick={e => e.stopPropagation()}
                                                        style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontFamily: "'Fira Code', monospace" }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    >{part}</Link>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {pathParam && pathParam !== '.' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); togglePinPath(pathParam); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', marginLeft: 6, color: isPathPinned(pathParam) ? '#FBBF24' : 'var(--text-muted)', padding: 2 }}
                                            title={isPathPinned(pathParam) ? t('unpinPath') : t('pinToQuickAccess')}
                                        >
                                            <Star size={14} fill={isPathPinned(pathParam) ? '#FBBF24' : 'none'} />
                                        </button>
                                    )}
                                </div>
                            )}
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
                                        style={{ padding: '5px 8px', background: viewMode === mode ? 'var(--accent-bg-strong)' : 'transparent', border: 'none', color: viewMode === mode ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                        <Icon size={14} />
                                    </button>
                                ))}
                            </div>

                            {/* Delete selected */}
                            {selectedItems.size > 0 && (
                                <button onClick={() => handleAction('delete')} title={t('deleteNItems').replace('{count}', selectedItems.size)}
                                    style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                ><XCircle size={13} />{selectedItems.size}</button>
                            )}

                            {/* New folder */}
                            <button onClick={() => handleAction('mkdir')} title={t('newFolder') || 'New Folder'}
                                style={{ padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-border-strong)'; }}
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
                                                className="file-row"
                                                onClick={(e) => handleSelection(e, file)}
                                                onContextMenu={(e) => handleContextMenu(e, file)}
                                                onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                                                    background: isSelected ? 'var(--accent-bg-light)' : 'transparent',
                                                    border: `1px solid ${isSelected ? 'var(--accent-border-medium)' : 'transparent'}`,
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
                                                        {formatDate(file.modifiedAt, t)}
                                                    </span>
                                                    {/* Action buttons (visible on hover via CSS in parent) */}
                                                    <div className="file-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }}>
                                                        {previewable && (
                                                            <button onClick={(e) => { e.stopPropagation(); openPreview(file); }} title={t('openPreview')}
                                                                style={{ padding: 5, borderRadius: 5, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg-light)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                            ><Eye size={13} /></button>
                                                        )}
                                                        {!file.isDirectory && (() => {
                                                            const dlState = downloads.get(file.path);
                                                            const isDownloading = dlState?.status === 'downloading';
                                                            const isDone = dlState?.status === 'done';
                                                            return (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                                    title={isDownloading ? `${dlState.progress > 0 ? dlState.progress + '%' : (t('downloading') || 'Downloading...')}` : t('download')}
                                                                    disabled={isDownloading}
                                                                    style={{ padding: 5, borderRadius: 5, background: isDownloading ? 'rgba(59,130,246,0.1)' : isDone ? 'rgba(16,185,129,0.1)' : 'transparent', border: 'none', color: isDownloading ? 'var(--accent-blue)' : isDone ? '#34D399' : 'var(--text-muted)', cursor: isDownloading ? 'default' : 'pointer', position: 'relative' }}
                                                                    onMouseEnter={e => { if (!isDownloading && !isDone) { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.color = '#34D399'; } }}
                                                                    onMouseLeave={e => { if (!isDownloading && !isDone) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                                                                >
                                                                    {isDownloading ? (
                                                                        <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--accent-blue)', animation: 'spin 0.8s linear infinite' }} />
                                                                    ) : isDone ? (
                                                                        <CheckCircle size={13} />
                                                                    ) : (
                                                                        <Download size={13} />
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
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
                                            <div style={{ position: 'relative', background: isSelected ? 'var(--accent-bg-medium)' : 'var(--bg-elevated)', border: `1px solid ${isSelected ? 'var(--accent-border-strong)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '16px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}
                                                onClick={(e) => { if (!file.isDirectory) e.preventDefault(); handleSelection(e, file); }}
                                                onContextMenu={(e) => handleContextMenu(e, file)}
                                                onDoubleClick={() => !file.isDirectory && openPreview(file)}
                                                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--accent-border-medium)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
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

                {/* ── File Editor Modal ── */}
                {editModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
                        onClick={() => !editSaving && setEditModal(null)}>
                        <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-elevated)' }}
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Pencil size={14} color="#FBBF24" />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace" }}>{editModal.file.name}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '2px 6px' }}>{t('editFile') || 'EDIT'}</span>
                                </div>
                                <button onClick={() => setEditModal(null)} disabled={editSaving}
                                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={14} />
                                </button>
                            </div>
                            {/* Textarea */}
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 16px' }}>
                                {editLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
                                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #FBBF24', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                        {t('loadingPreview') || 'Loading...'}
                                    </div>
                                ) : (
                                    <textarea
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        spellCheck={false}
                                        style={{ flex: 1, minHeight: 360, maxHeight: '62vh', width: '100%', fontFamily: "'Fira Code', monospace", fontSize: 12, lineHeight: 1.65, color: '#A8D8A8', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = 'rgba(251,191,36,0.4)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                                    />
                                )}
                            </div>
                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                                    {editContent.split('\n').length} {t('lines') || 'lines'} · {editContent.length} {t('chars') || 'chars'}
                                </span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => setEditModal(null)} disabled={editSaving}
                                        style={{ padding: '7px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {t('cancel') || 'Cancel'}
                                    </button>
                                    <button onClick={handleSaveEdit} disabled={editSaving || editLoading}
                                        style={{ padding: '7px 16px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#FBBF24', cursor: editSaving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {editSaving ? <div style={{ width: 12, height: 12, border: '2px solid #FBBF24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle size={12} />}
                                        {editSaving ? '...' : (t('save') || 'Save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> {t('loadingPreview')}
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
                            { show: isEditableFile(contextMenu.file), label: t('editFile') || 'Edit File', icon: Pencil, action: () => openEdit(contextMenu.file), color: '#FBBF24' },
                            { show: true, label: t('rename') || 'Rename', icon: Terminal, action: () => handleAction('rename'), color: 'var(--text-primary)' },
                            { show: !contextMenu.file.isDirectory, label: t('download') || 'Download', icon: Download, action: () => { handleDownload(contextMenu.file); setContextMenu(null); }, color: '#34D399' },
                            { show: !contextMenu.file.isDirectory, label: t('sendToMachine') || 'Send to Machine', icon: Send, action: () => openTransferModal(contextMenu.file), color: '#A78BFA' },
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

                {/* ── Transfer Modal ── */}
                {transferModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
                        onClick={() => !transferring && setTransferModal(null)}>
                        <div className="animate-fadeUp" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 14, width: '100%', maxWidth: 420, padding: 24, boxShadow: 'var(--shadow-elevated)' }}
                            onClick={e => e.stopPropagation()}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontFamily: "'Fira Code', monospace" }}>
                                <ArrowRightLeft size={16} color="#A78BFA" />
                                {t('sendToMachine') || 'Send to Machine'}
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                                {t('transferViaServer') || 'Server auto-selects the best relay path for your LAN.'}
                            </p>
                            {/* Relay method priority badges */}
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
                                {[
                                    { label: 'SSH→SSH', color: '#10B981', title: 'Direct SFTP (fastest)' },
                                    { label: 'Agent→SSH', color: '#3B82F6', title: 'Agent source, SFTP dest' },
                                    { label: 'SSH→Agent', color: '#8B5CF6', title: 'SFTP source, Agent dest' },
                                    { label: 'Agent→Agent', color: '#9CA3AF', title: 'WebSocket relay (fallback)' }
                                ].map((m, i) => (
                                    <div key={i} title={m.title} style={{
                                        display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
                                        padding: '2px 8px', borderRadius: 20,
                                        background: `${m.color}18`, border: `1px solid ${m.color}50`, color: m.color,
                                        fontFamily: "'Fira Code', monospace", fontWeight: 600, cursor: 'default',
                                        opacity: i === 0 ? 1 : 0.65
                                    }}>
                                        {i === 0 && <span style={{ fontSize: 8, marginRight: 2 }}>★</span>}
                                        {m.label}
                                    </div>
                                ))}
                            </div>

                            {/* Source */}
                            <div style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em' }}>{t('sourceFile') || 'Source'}</div>
                                <div style={{ color: 'var(--text-primary)', fontFamily: "'Fira Code', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transferModal.file.name}</div>
                                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{formatFileSize(transferModal.file.size)} &mdash; {t('machine') || 'Machine'} {machineId}</div>
                            </div>

                            <form onSubmit={handleTransfer}>
                                {/* Destination machine */}
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                        {t('destinationMachine') || 'Destination Machine'}
                                    </label>
                                    {availableMachines.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)' }}>
                                            {t('noOtherMachinesOnline') || 'No other machines are online.'}
                                        </div>
                                    ) : (
                                        <select value={transferTargetMachineId} onChange={e => setTransferTargetMachineId(e.target.value)} required
                                            style={{ width: '100%', padding: '9px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                                            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; }}
                                            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}>
                                            <option value="">{t('selectMachine') || '-- Select machine --'}</option>
                                            {availableMachines.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.group})</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Destination path */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                        {t('destinationPath') || 'Destination Path (absolute on target)'}
                                    </label>
                                    <input type="text" value={transferDestPath} onChange={e => setTransferDestPath(e.target.value)} required
                                        placeholder="/home/user/data/file.zip"
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "'Fira Code', monospace" }}
                                        onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button type="button" onClick={() => setTransferModal(null)} disabled={transferring}
                                        style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                    >{t('cancel') || 'Cancel'}</button>
                                    <button type="submit" disabled={transferring || !transferTargetMachineId || !transferDestPath}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#7C3AED', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: transferring ? 'wait' : 'pointer', opacity: (!transferTargetMachineId || !transferDestPath) ? 0.5 : 1 }}>
                                        {transferring ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
                                        {transferring ? (t('transferring') || 'Transferring...') : (t('sendToMachine') || 'Send')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Download Manager Panel ── */}
                {downloads.size > 0 && showDownloadPanel && (
                    <div className="animate-fadeUp" style={{
                        position: 'fixed', bottom: 24, right: 24, zIndex: 55,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        borderRadius: 12, boxShadow: 'var(--shadow-elevated)', minWidth: 300, maxWidth: 360,
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                <Download size={13} color="var(--accent-blue)" />
                                {t('activeDownloads') || 'Downloads'}
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: 10, padding: '1px 6px', fontFamily: "'Fira Code', monospace" }}>{downloads.size}</span>
                            </div>
                            <button onClick={() => setShowDownloadPanel(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                                title={t('close') || 'Close'}
                            ><X size={13} /></button>
                        </div>
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {[...downloads.entries()].map(([filePath, dl]) => (
                                <div key={filePath} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210, fontFamily: "'Fira Code', monospace" }} title={dl.name}>{dl.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                            {dl.status === 'downloading' && (
                                                <span style={{ fontSize: 10, color: 'var(--accent-blue)', fontFamily: "'Fira Code', monospace" }}>
                                                    {dl.progress > 0 ? `${dl.progress}%` : formatFileSize(dl.loaded)}
                                                </span>
                                            )}
                                            {dl.status === 'done' && <CheckCircle size={14} color="#34D399" />}
                                            {dl.status === 'error' && <XCircle size={14} color="#F87171" />}
                                            {dl.status === 'downloading' && (
                                                <button onClick={dl.cancel}
                                                    title={t('cancelDownload') || 'Cancel download'}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                                                ><X size={12} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 2,
                                            background: dl.status === 'done' ? '#34D399' : dl.status === 'error' ? '#F87171' : 'var(--accent-blue)',
                                            width: dl.status === 'downloading' && dl.progress === 0 ? '100%' : `${dl.progress}%`,
                                            transition: 'width 0.25s ease',
                                            animation: dl.status === 'downloading' && dl.progress === 0 ? 'shimmer 1.4s ease-in-out infinite' : 'none'
                                        }} />
                                    </div>
                                    {dl.status === 'downloading' && dl.size && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Fira Code', monospace" }}>
                                            {formatFileSize(dl.loaded)} / {formatFileSize(dl.size)}
                                        </div>
                                    )}
                                    {dl.status === 'error' && (
                                        <div style={{ fontSize: 10, color: '#F87171', marginTop: 4 }}>{dl.errorMsg || t('downloadFailed')}</div>
                                    )}
                                    {dl.status === 'done' && (
                                        <div style={{ fontSize: 10, color: '#34D399', marginTop: 4 }}>{t('downloadComplete') || 'Complete'}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Notification Toast ── */}
                {notification && (
                    <div className="animate-fadeUp" style={{
                        position: 'fixed', bottom: 24, left: 24, zIndex: 60,
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
                                {activeModal === 'delete' && <><XCircle size={16} color="var(--danger)" /> {t('deleteItem')}</>}
                                {activeModal === 'rename' && <><Terminal size={16} color="var(--accent-blue)" /> {t('renameItem')}</>}
                                {activeModal === 'mkdir' && <><Folder size={16} color="var(--accent-blue)" /> {t('newFolder')}</>}
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
                                            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = 'var(--accent-focus-ring)'; }}
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
                                        style={{ padding: '8px 16px', background: activeModal === 'delete' ? 'rgba(239,68,68,0.15)' : 'var(--accent-gradient)', border: `1px solid ${activeModal === 'delete' ? 'rgba(239,68,68,0.3)' : 'transparent'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: activeModal === 'delete' ? '#F87171' : 'white', cursor: 'pointer', boxShadow: activeModal !== 'delete' ? 'var(--accent-shadow)' : 'none' }}>
                                        {activeModal === 'delete' ? (t('delete') || 'Delete') : activeModal === 'rename' ? (t('rename') || 'Rename') : (t('create') || 'Create')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes shimmer { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } }
                .file-row:hover .file-actions { opacity: 1 !important; }
                `}</style>
            </div>
        </div>
    );
};

export default FileSystem;
