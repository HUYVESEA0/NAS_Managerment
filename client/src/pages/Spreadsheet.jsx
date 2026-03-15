import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
    Table, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
    Upload, Download, Play, Code2, Plus, Trash2, X, Loader2,
    ChevronDown, ArrowUpDown, Filter, Server, Link, FolderOpen,
    CheckCircle, AlertCircle, Terminal
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 26;
const ROWS = 50;
const COL_W = 96;
const ROW_H = 24;
const HDR_W = 44;

// 0-indexed → 'A', 25 → 'Z', 26 → 'AA'
function colLetter(idx) {
    let s = '';
    let n = idx;
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

// 'B3' → { col:1, row:2 }
function parseAddr(addr) {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
    return { col: c - 1, row: parseInt(m[2]) - 1 };
}

// 'A1:C3' → ['A1','B1','C1','A2','B2','C2','A3','B3','C3']
function expandRange(range) {
    const [a, b] = range.split(':');
    const s = parseAddr(a), e = parseAddr(b);
    if (!s || !e) return [range];
    const out = [];
    for (let r = s.row; r <= e.row; r++)
        for (let c = s.col; c <= e.col; c++)
            out.push(`${colLetter(c)}${r + 1}`);
    return out;
}

// ─── Formula Engine ───────────────────────────────────────────────────────────
const FUNS = {
    SUM: vs => vs.reduce((a, v) => a + (+v || 0), 0),
    AVERAGE: vs => vs.length ? vs.reduce((a, v) => a + (+v || 0), 0) / vs.length : 0,
    MIN: vs => Math.min(...vs.map(v => +v || 0)),
    MAX: vs => Math.max(...vs.map(v => +v || 0)),
    COUNT: vs => vs.filter(v => !isNaN(+v)).length,
    COUNTA: vs => vs.filter(v => v !== null && v !== undefined && v !== '').length,
    ABS: vs => Math.abs(+vs[0] || 0),
    ROUND: vs => Math.round((+vs[0] || 0) * Math.pow(10, +vs[1] || 0)) / Math.pow(10, +vs[1] || 0),
    LEN: vs => String(vs[0] ?? '').length,
    TRIM: vs => String(vs[0] ?? '').trim(),
    UPPER: vs => String(vs[0] ?? '').toUpperCase(),
    LOWER: vs => String(vs[0] ?? '').toLowerCase(),
    CONCATENATE: vs => vs.join(''),
    NOW: () => new Date().toLocaleString(),
    TODAY: () => new Date().toLocaleDateString(),
};

function evalFormula(formula, cells, depth = 0) {
    if (!formula || !formula.startsWith('=')) return formula ?? '';
    if (depth > 50) return '#CYCLE!';

    let expr = formula.slice(1).trim();

    // Replace cell ranges  A1:C3 → values
    expr = expr.replace(/([A-Z]+\d+):([A-Z]+\d+)/gi, (_, a, b) => {
        return expandRange(`${a.toUpperCase()}:${b.toUpperCase()}`)
            .map(addr => {
                const c = cells[addr.toUpperCase()];
                if (!c) return 0;
                if (c.formula) return evalFormula(c.formula, cells, depth + 1) ?? 0;
                return c.value ?? 0;
            }).join(',');
    });

    // Replace IF( cond, t, f ) specially
    expr = expr.replace(/IF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, t, f) => {
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict"; return !!(' + cond + ')')();
            return result ? t.trim() : f.trim();
        } catch { return f.trim(); }
    });

    // Replace function calls FUNCNAME(arg,arg,...)
    expr = expr.replace(/([A-Z]+)\s*\(([^)]*)\)/gi, (_, fn, args) => {
        const name = fn.toUpperCase();
        if (FUNS[name]) {
            const vals = args ? args.split(',').map(a => a.trim()) : [];
            try { return FUNS[name](vals); }
            catch { return '#ERR!'; }
        }
        return '#NAME!';
    });

    // Resolve single cell refs
    expr = expr.replace(/\b([A-Z]+\d+)\b/gi, (_, addr) => {
        const c = cells[addr.toUpperCase()];
        if (!c || c.value === null || c.value === undefined) return 0;
        if (c.formula) {
            const v = evalFormula(c.formula, cells, depth + 1);
            return (v !== null && v !== undefined) ? v : 0;
        }
        return isNaN(+c.value) ? `"${c.value}"` : c.value;
    });

    try {
        // eslint-disable-next-line no-new-func
        const r = Function('"use strict"; return (' + expr + ')')();
        if (typeof r === 'number' && !isFinite(r)) return '#DIV/0!';
        if (r === null || r === undefined) return '';
        return r;
    } catch { return '#ERROR!'; }
}

function cellDisplay(cell, cells) {
    if (!cell) return '';
    if (cell.formula) {
        const v = evalFormula(cell.formula, cells);
        return v === null || v === undefined ? '' : String(v);
    }
    return cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
}

// ─── XLSX sheet data → our format ─────────────────────────────────────────────
function xlsxToSheets(workbook) {
    return workbook.SheetNames.map(name => {
        const ws = workbook.Sheets[name];
        const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
        const cells = {};
        for (let r = ref.s.r; r <= ref.e.r; r++) {
            for (let c = ref.s.c; c <= ref.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = ws[addr];
                if (!cell) continue;
                cells[addr] = {
                    value: cell.v !== undefined ? cell.v : null,
                    formula: cell.f ? `=${cell.f}` : null,
                    format: { bold: false, italic: false, underline: false, align: 'left' }
                };
            }
        }
        return { id: name, name, cells };
    });
}

// ─── Shared style helpers ─────────────────────────────────────────────────────
const btnStyle = (active) => ({
    padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-default)',
    background: active ? 'var(--accent-bg-medium)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontFamily: "'Fira Code', monospace", fontWeight: 600,
    transition: 'all 0.15s',
});

const inputStyle = {
    padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    fontSize: 13, fontFamily: "'Fira Code', monospace", outline: 'none',
    width: '100%', boxSizing: 'border-box',
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Spreadsheet = () => {
    const { t } = useLanguage();
    const { isAdmin, hasPermission } = useAuth();

    // Core data
    const [sheets, setSheets] = useState([{ id: 'Sheet1', name: 'Sheet1', cells: {} }]);
    const [activeSheetId, setActiveSheetId] = useState('Sheet1');
    const [selectedCell, setSelectedCell] = useState('A1');
    const [editMode, setEditMode] = useState(false);
    const [editValue, setEditValue] = useState('');

    // UI state
    const [notification, setNotification] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showVbaPanel, setShowVbaPanel] = useState(false);
    const [importTab, setImportTab] = useState('upload'); // upload | machine | url
    const [importMachineId, setImportMachineId] = useState('');
    const [importFilePath, setImportFilePath] = useState('');
    const [importUrl, setImportUrl] = useState('');
    const [machines, setMachines] = useState([]);
    const [vbaCode, setVbaCode] = useState('Sub Main()\n    WScript.Echo "Hello from VBA!"\nEnd Sub\n');
    const [vbaOutput, setVbaOutput] = useState('');
    const [vbaRunning, setVbaRunning] = useState(false);
    const [vbaMethod, setVbaMethod] = useState('');
    const [vbaEntryPoint, setVbaEntryPoint] = useState('Main');
    const [showFileBrowser, setShowFileBrowser] = useState(false);
    const [browserPath, setBrowserPath] = useState('');
    const [browserFiles, setBrowserFiles] = useState([]);
    const [browserLoading, setBrowserLoading] = useState(false);
    const [browserError, setBrowserError] = useState('');
    // Send to machine
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendMachineId, setSendMachineId] = useState('');
    const [sendFilePath, setSendFilePath] = useState('');
    const [sendLoading, setSendLoading] = useState(false);
    const [showSendBrowser, setShowSendBrowser] = useState(false);
    const [sendBrowserPath, setSendBrowserPath] = useState('');
    const [sendBrowserFiles, setSendBrowserFiles] = useState([]);
    const [sendBrowserLoading, setSendBrowserLoading] = useState(false);
    const [sendBrowserError, setSendBrowserError] = useState('');
    // VBA CRUD
    const [savedScripts, setSavedScripts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nas_vba_scripts') || '[]'); } catch { return []; }
    });
    const [showScriptList, setShowScriptList] = useState(false);
    const [filterTexts, setFilterTexts] = useState({});
    const [showFilter, setShowFilter] = useState(false);
    const [filenameInput, setFilenameInput] = useState('spreadsheet');
    const [renamingSheet, setRenamingSheet] = useState(null);

    const fileInputRef = useRef(null);
    const cellInputRef = useRef(null);
    const gridRef = useRef(null);

    const activeSheet = useMemo(
        () => sheets.find(s => s.id === activeSheetId) || sheets[0],
        [sheets, activeSheetId]
    );
    const cells = activeSheet?.cells || {};

    const formulaBarValue = useMemo(() => {
        const c = cells[selectedCell];
        if (!c) return '';
        return c.formula || (c.value !== null && c.value !== undefined ? String(c.value) : '');
    }, [cells, selectedCell]);

    const showNotif = useCallback((msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3500);
    }, []);

    // Fetch machines when import modal opens on machine tab
    useEffect(() => {
        if (showImportModal && importTab === 'machine' && machines.length === 0) {
            api.get('/hierarchy').then(res => {
                const flat = (res.data || []).flatMap(f =>
                    (f.rooms || []).flatMap(r =>
                        (r.machines || []).map(m => ({ id: String(m.id), name: m.name, ip: m.ipAddress }))
                    )
                );
                setMachines(flat);
            }).catch(() => {});
        }
    }, [showImportModal, importTab, machines.length]);

    // ── Cell helpers ────────────────────────────────────────────────────────
    const updateCell = useCallback((addr, updates) => {
        setSheets(prev => prev.map(s => {
            if (s.id !== activeSheetId) return s;
            const oldCell = s.cells[addr] || { value: null, formula: null, format: { bold: false, italic: false, underline: false, align: 'left' } };
            const newCell = { ...oldCell, ...updates };
            if (newCell.value === null && !newCell.formula) {
                const newCells = { ...s.cells };
                delete newCells[addr];
                return { ...s, cells: newCells };
            }
            return { ...s, cells: { ...s.cells, [addr]: newCell } };
        }));
    }, [activeSheetId]);

    const commitEdit = useCallback(() => {
        if (!editMode) return;
        const val = editValue;
        if (val === '') {
            updateCell(selectedCell, { value: null, formula: null });
        } else if (val.startsWith('=')) {
            updateCell(selectedCell, { formula: val, value: null });
        } else {
            const num = parseFloat(val);
            updateCell(selectedCell, { value: isNaN(num) ? val : num, formula: null });
        }
        setEditMode(false);
        setEditValue('');
    }, [editMode, editValue, selectedCell, updateCell]);

    const startEdit = useCallback((cellId, initialValue) => {
        setSelectedCell(cellId);
        setEditMode(true);
        const c = cells[cellId];
        setEditValue(initialValue !== undefined ? initialValue : (c?.formula || (c?.value !== null && c?.value !== undefined ? String(c.value) : '')));
        setTimeout(() => cellInputRef.current?.focus(), 0);
    }, [cells]);

    // ── Keyboard navigation ──────────────────────────────────────────────────
    const handleGridKeyDown = useCallback((e) => {
        if (editMode) {
            if (e.key === 'Escape') { setEditMode(false); setEditValue(''); e.preventDefault(); return; }
            if (e.key === 'Enter') { commitEdit(); e.preventDefault(); moveSelection('down'); return; }
            if (e.key === 'Tab') { commitEdit(); e.preventDefault(); moveSelection('right'); return; }
            return;
        }
        const parsed = parseAddr(selectedCell);
        if (!parsed) return;
        const { col, row } = parsed;

        if (e.key === 'ArrowUp' && row > 0) { setSelectedCell(`${colLetter(col)}${row}`); e.preventDefault(); }
        else if (e.key === 'ArrowDown' && row < ROWS - 1) { setSelectedCell(`${colLetter(col)}${row + 2}`); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && col > 0) { setSelectedCell(`${colLetter(col - 1)}${row + 1}`); e.preventDefault(); }
        else if (e.key === 'ArrowRight' && col < COLS - 1) { setSelectedCell(`${colLetter(col + 1)}${row + 1}`); e.preventDefault(); }
        else if (e.key === 'Enter' || e.key === 'F2') { startEdit(selectedCell); e.preventDefault(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            updateCell(selectedCell, { value: null, formula: null });
            e.preventDefault();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            startEdit(selectedCell, e.key);
        }
    }, [editMode, selectedCell, commitEdit, startEdit, updateCell]);

    function moveSelection(dir) {
        const p = parseAddr(selectedCell);
        if (!p) return;
        const { col, row } = p;
        if (dir === 'down' && row < ROWS - 1) setSelectedCell(`${colLetter(col)}${row + 2}`);
        if (dir === 'right' && col < COLS - 1) setSelectedCell(`${colLetter(col + 1)}${row + 1}`);
    }

    // ── Format toggles ───────────────────────────────────────────────────────
    const toggleFormat = (key) => {
        const c = cells[selectedCell];
        const fmt = c?.format || { bold: false, italic: false, underline: false, align: 'left' };
        updateCell(selectedCell, { format: { ...fmt, [key]: !fmt[key] } });
        gridRef.current?.focus();
    };

    const setAlign = (align) => {
        const c = cells[selectedCell];
        const fmt = c?.format || { bold: false, italic: false, underline: false, align: 'left' };
        updateCell(selectedCell, { format: { ...fmt, align } });
        gridRef.current?.focus();
    };

    // ── Sort column ──────────────────────────────────────────────────────────
    const sortColumn = (dir) => {
        const p = parseAddr(selectedCell);
        if (!p) return;
        const col = p.col;
        const rows = Array.from({ length: ROWS }, (_, i) => i);

        // Collect rows that have any data in any column
        const rowData = rows.map(r => {
            const rowCells = {};
            for (let c = 0; c < COLS; c++) {
                const addr = `${colLetter(c)}${r + 1}`;
                rowCells[colLetter(c)] = cells[addr];
            }
            return rowCells;
        });

        const sortKey = colLetter(col);
        const filled = rowData.filter(r => r[sortKey]?.value !== null && r[sortKey]?.value !== undefined && r[sortKey]?.value !== '');
        const empty = rowData.filter(r => !r[sortKey]?.value && r[sortKey]?.value !== 0);

        filled.sort((a, b) => {
            const va = a[sortKey]?.value ?? '';
            const vb = b[sortKey]?.value ?? '';
            const na = typeof va === 'number', nb = typeof vb === 'number';
            if (na && nb) return dir === 'asc' ? va - vb : vb - va;
            return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });

        const sorted = [...filled, ...empty];
        const newCells = { ...cells };

        // Clear all rows first, then repopulate
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                delete newCells[`${colLetter(c)}${r + 1}`];

        sorted.forEach((rowData, r) => {
            for (let c = 0; c < COLS; c++) {
                const cellData = rowData[colLetter(c)];
                if (cellData) newCells[`${colLetter(c)}${r + 1}`] = cellData;
            }
        });

        setSheets(prev => prev.map(s =>
            s.id === activeSheetId ? { ...s, cells: newCells } : s
        ));
    };

    // ── Import handlers ──────────────────────────────────────────────────────
    const handleBrowserUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellStyles: true });
            const parsed = xlsxToSheets(wb);
            if (parsed.length > 0) {
                setSheets(parsed);
                setActiveSheetId(parsed[0].id);
                setSelectedCell('A1');
                showNotif(t('parseSuccess'));
                setShowImportModal(false);
            }
        } catch (err) {
            showNotif(t('parseFailed') + ': ' + err.message, 'error');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleImportFromMachine = async () => {
        if (!importMachineId || !importFilePath) return;
        setLoading(true);
        try {
            const res = await api.post('/spreadsheet/import-from-machine', {
                machineId: importMachineId,
                filePath: importFilePath
            });
            const { sheets: serverSheets, sheetNames } = res.data;
            const parsed = sheetNames.map(name => ({
                id: name, name, cells: serverSheets[name] || {}
            }));
            setSheets(parsed);
            setActiveSheetId(parsed[0].id);
            setSelectedCell('A1');
            showNotif(t('importSuccess'));
            setShowImportModal(false);
        } catch (err) {
            showNotif(t('parseFailed') + ': ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImportFromUrl = async () => {
        if (!importUrl) return;
        setLoading(true);
        try {
            const res = await api.post('/spreadsheet/import-from-url', { url: importUrl });
            const { sheets: serverSheets, sheetNames } = res.data;
            const parsed = sheetNames.map(name => ({
                id: name, name, cells: serverSheets[name] || {}
            }));
            setSheets(parsed);
            setActiveSheetId(parsed[0].id);
            setSelectedCell('A1');
            showNotif(t('importSuccess'));
            setShowImportModal(false);
        } catch (err) {
            showNotif(t('parseFailed') + ': ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── File Browser ─────────────────────────────────────────────────────────
    const fetchBrowserFiles = useCallback(async (path) => {
        if (!importMachineId) return;
        setBrowserLoading(true);
        setBrowserError('');
        try {
            const res = await api.get('/files/list', { params: { machineId: importMachineId, path: path || '.' } });
            setBrowserFiles(res.data || []);
            setBrowserPath(path || '');
        } catch (err) {
            setBrowserError(err.response?.data?.error || 'Failed to list files');
            setBrowserFiles([]);
        } finally {
            setBrowserLoading(false);
        }
    }, [importMachineId]);

    const openFileBrowser = useCallback(() => {
        const parentDir = importFilePath
            ? importFilePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
            : '';
        setShowFileBrowser(true);
        fetchBrowserFiles(parentDir);
    }, [fetchBrowserFiles, importFilePath]);

    const browserGoUp = useCallback(() => {
        const norm = browserPath.replace(/\\/g, '/');
        const parts = norm.split('/').filter(Boolean);
        if (parts.length === 0) return;
        if (parts.length === 1 && /^[A-Z]:$/i.test(parts[0])) {
            fetchBrowserFiles('');
            return;
        }
        parts.pop();
        fetchBrowserFiles(parts.length > 0 ? parts.join('/') : '');
    }, [browserPath, fetchBrowserFiles]);

    // Reset browser when machine changes
    useEffect(() => {
        setShowFileBrowser(false);
        setBrowserFiles([]);
        setBrowserPath('');
        setBrowserError('');
    }, [importMachineId]);

    // ── Send-to-machine browser ───────────────────────────────────────────────
    const fetchSendBrowserFiles = useCallback(async (path) => {
        if (!sendMachineId) return;
        setSendBrowserLoading(true);
        setSendBrowserError('');
        try {
            const res = await api.get('/files/list', { params: { machineId: sendMachineId, path: path || '.' } });
            setSendBrowserFiles(res.data || []);
            setSendBrowserPath(path || '');
        } catch (err) {
            setSendBrowserError(err.response?.data?.error || 'Failed to list files');
            setSendBrowserFiles([]);
        } finally {
            setSendBrowserLoading(false);
        }
    }, [sendMachineId]);

    const openSendBrowser = useCallback(() => {
        const parentDir = sendFilePath
            ? sendFilePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
            : '';
        setShowSendBrowser(true);
        fetchSendBrowserFiles(parentDir);
    }, [fetchSendBrowserFiles, sendFilePath]);

    const sendBrowserGoUp = useCallback(() => {
        const norm = sendBrowserPath.replace(/\\/g, '/');
        const parts = norm.split('/').filter(Boolean);
        if (parts.length === 0) return;
        if (parts.length === 1 && /^[A-Z]:$/i.test(parts[0])) { fetchSendBrowserFiles(''); return; }
        parts.pop();
        fetchSendBrowserFiles(parts.length > 0 ? parts.join('/') : '');
    }, [sendBrowserPath, fetchSendBrowserFiles]);

    useEffect(() => {
        setShowSendBrowser(false);
        setSendBrowserFiles([]);
        setSendBrowserPath('');
        setSendBrowserError('');
    }, [sendMachineId]);

    // ── Send to machine ───────────────────────────────────────────────────────
    const handleSendToMachine = async () => {
        if (!sendMachineId || !sendFilePath) return;
        setSendLoading(true);
        try {
            const sheetData = sheets.map(s => ({ name: s.name, cells: s.cells }));
            const res = await api.post('/spreadsheet/export-to-machine', {
                sheets: sheetData,
                machineId: sendMachineId,
                filePath: sendFilePath,
            });
            showNotif(`${t('exportSuccess')} → ${res.data.method}`);
            setShowSendModal(false);
        } catch (err) {
            showNotif(err.response?.data?.error || err.message, 'error');
        } finally {
            setSendLoading(false);
        }
    };

    // ── VBA CRUD ──────────────────────────────────────────────────────────────
    const saveVbaScript = () => {
        const name = prompt('Script name:');
        if (!name?.trim()) return;
        const entry = { id: Date.now(), name: name.trim(), code: vbaCode };
        const updated = [...savedScripts.filter(s => s.name !== entry.name), entry];
        setSavedScripts(updated);
        localStorage.setItem('nas_vba_scripts', JSON.stringify(updated));
        showNotif(`Saved "${entry.name}"`);
    };

    const deleteVbaScript = (id, e) => {
        e.stopPropagation();
        const updated = savedScripts.filter(s => s.id !== id);
        setSavedScripts(updated);
        localStorage.setItem('nas_vba_scripts', JSON.stringify(updated));
    };

    // ── Export ───────────────────────────────────────────────────────────────
    const handleExport = () => {
        if (sheets.every(s => Object.keys(s.cells).length === 0)) {
            showNotif(t('noDataToExport'), 'error');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            for (const sheet of sheets) {
                const ws = {};
                let maxR = 0, maxC = 0;
                for (const [addr, cell] of Object.entries(sheet.cells)) {
                    const d = XLSX.utils.decode_cell(addr);
                    if (d.r > maxR) maxR = d.r;
                    if (d.c > maxC) maxC = d.c;
                    const xc = {};
                    if (cell.formula) { xc.f = cell.formula.replace(/^=/, ''); xc.t = 'n'; }
                    else if (typeof cell.value === 'number') { xc.v = cell.value; xc.t = 'n'; }
                    else if (typeof cell.value === 'boolean') { xc.v = cell.value; xc.t = 'b'; }
                    else { xc.v = String(cell.value ?? ''); xc.t = 's'; }
                    ws[addr] = xc;
                }
                if (Object.keys(ws).length > 0)
                    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
                XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
            }
            XLSX.writeFile(wb, `${filenameInput || 'spreadsheet'}.xlsx`);
            showNotif(t('exportSuccess'));
        } catch (err) {
            showNotif(t('exportFailed') + ': ' + err.message, 'error');
        }
    };

    // ── VBA ──────────────────────────────────────────────────────────────────
    const handleRunVba = async () => {
        if (!vbaCode) return;
        setVbaRunning(true);
        setVbaOutput(t('vbaRunning'));
        try {
            const sheetData = sheets.map(s => ({ name: s.name, cells: s.cells }));
            const res = await api.post('/spreadsheet/run-vba', {
                code: vbaCode, sheetData, entryPoint: vbaEntryPoint || 'Main'
            });
            const { success, output, method, updatedSheets } = res.data;
            setVbaOutput(output || (success ? 'OK' : 'Error'));
            setVbaMethod(method);
            if (updatedSheets && Object.keys(updatedSheets).length > 0) {
                setSheets(prev => prev.map(s => {
                    const synced = updatedSheets[s.name];
                    return synced ? { ...s, cells: synced } : s;
                }));
                showNotif('Sheets synced from VBA output');
            } else {
                showNotif(success ? t('vbaSuccess') : t('vbaError'), success ? 'success' : 'error');
            }
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setVbaOutput('ERROR: ' + msg);
            showNotif(t('vbaError'), 'error');
        } finally {
            setVbaRunning(false);
        }
    };

    // ── Sheet management ─────────────────────────────────────────────────────
    const addSheet = () => {
        const id = `Sheet${sheets.length + 1}`;
        setSheets(prev => [...prev, { id, name: id, cells: {} }]);
        setActiveSheetId(id);
    };

    const deleteSheet = (id) => {
        if (sheets.length <= 1) return;
        const newSheets = sheets.filter(s => s.id !== id);
        setSheets(newSheets);
        if (activeSheetId === id) setActiveSheetId(newSheets[0].id);
    };

    const renameSheet = (id, newName) => {
        if (!newName.trim()) return;
        setSheets(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
        setRenamingSheet(null);
    };

    // ── Filtered rows ─────────────────────────────────────────────────────────
    const visibleRows = useMemo(() => {
        const allRows = Array.from({ length: ROWS }, (_, i) => i);
        if (!showFilter || Object.keys(filterTexts).every(k => !filterTexts[k])) return allRows;
        return allRows.filter(r => {
            return Object.entries(filterTexts).every(([col, text]) => {
                if (!text) return true;
                const addr = `${col}${r + 1}`;
                const display = cellDisplay(cells[addr], cells);
                return display.toLowerCase().includes(text.toLowerCase());
            });
        });
    }, [cells, filterTexts, showFilter]);

    // ── Render ────────────────────────────────────────────────────────────────
    const selFmt = cells[selectedCell]?.format || {};
    const cellCount = Object.keys(cells).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 160px)', minHeight: 500 }}>

            {/* Notification */}
            {notification && (
                <div className="animate-fadeIn" style={{
                    marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 8, fontSize: 13,
                    background: notification.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: notification.type === 'success' ? '#10B981' : '#EF4444',
                }}>
                    {notification.type === 'success'
                        ? <CheckCircle size={14} />
                        : <AlertCircle size={14} />}
                    {notification.msg}
                </div>
            )}

            {/* ── Toolbar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: '10px 10px 0 0', flexWrap: 'wrap',
            }}>
                {/* Import */}
                <button style={btnStyle(false)} onClick={() => setShowImportModal(true)}>
                    <Upload size={13} /> {t('importFile')}
                </button>

                {/* Export */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                        value={filenameInput}
                        onChange={e => setFilenameInput(e.target.value)}
                        style={{ ...inputStyle, width: 120, padding: '4px 8px', fontSize: 12 }}
                        placeholder="filename"
                    />
                    <button style={btnStyle(false)} onClick={handleExport}>
                        <Download size={13} /> {t('exportFile')}
                    </button>
                </div>

                {/* Send to machine */}
                <button style={btnStyle(false)} onClick={() => setShowSendModal(true)}>
                    <Server size={13} /> Gửi sang máy
                </button>

                <div style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 2px' }} />

                {/* Format */}
                <button style={btnStyle(selFmt.bold)} title={t('formatBold')} onClick={() => toggleFormat('bold')}>
                    <Bold size={13} />
                </button>
                <button style={btnStyle(selFmt.italic)} title={t('formatItalic')} onClick={() => toggleFormat('italic')}>
                    <Italic size={13} />
                </button>
                <button style={btnStyle(selFmt.underline)} title={t('formatUnderline')} onClick={() => toggleFormat('underline')}>
                    <Underline size={13} />
                </button>

                <div style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 2px' }} />

                {/* Alignment */}
                <button style={btnStyle(selFmt.align === 'left')} title={t('alignLeft')} onClick={() => setAlign('left')}>
                    <AlignLeft size={13} />
                </button>
                <button style={btnStyle(selFmt.align === 'center')} title={t('alignCenter')} onClick={() => setAlign('center')}>
                    <AlignCenter size={13} />
                </button>
                <button style={btnStyle(selFmt.align === 'right')} title={t('alignRight')} onClick={() => setAlign('right')}>
                    <AlignRight size={13} />
                </button>

                <div style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 2px' }} />

                {/* Sort */}
                <button style={btnStyle(false)} title={t('sortAscLabel')} onClick={() => sortColumn('asc')}>
                    <ArrowUpDown size={13} /> A→Z
                </button>
                <button style={btnStyle(false)} title={t('sortDescLabel')} onClick={() => sortColumn('desc')}>
                    <ArrowUpDown size={13} /> Z→A
                </button>

                {/* Filter */}
                <button style={btnStyle(showFilter)} title={t('filterData')} onClick={() => setShowFilter(v => !v)}>
                    <Filter size={13} /> {t('filterData')}
                </button>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Cell count */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code',monospace" }}>
                        {selectedCell} · {cellCount} {t('sheetCells')}
                    </span>

                    {/* VBA (admin only) */}
                    {isAdmin() && (
                        <button style={{ ...btnStyle(showVbaPanel), background: showVbaPanel ? 'var(--accent-bg-medium)' : 'var(--bg-elevated)' }}
                            onClick={() => setShowVbaPanel(v => !v)}>
                            <Code2 size={13} /> {t('vbaEditor')}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Formula Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderTop: 'none',
            }}>
                <div style={{
                    width: HDR_W + COL_W * 0.8, minWidth: 100,
                    padding: '4px 10px', borderRight: '1px solid var(--border-subtle)',
                    fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                    <span style={{ color: 'var(--accent-blue)', fontSize: 14, fontWeight: 700 }}>𝑓𝑥</span>
                    <span style={{ fontWeight: 700 }}>{selectedCell}</span>
                </div>
                <input
                    value={editMode ? editValue : formulaBarValue}
                    onChange={e => {
                        if (editMode) setEditValue(e.target.value);
                        else { startEdit(selectedCell, e.target.value); }
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { commitEdit(); gridRef.current?.focus(); }
                        if (e.key === 'Escape') { setEditMode(false); setEditValue(''); gridRef.current?.focus(); }
                    }}
                    style={{
                        flex: 1, padding: '5px 12px', border: 'none', outline: 'none',
                        background: 'transparent', color: 'var(--text-primary)',
                        fontFamily: "'Fira Code', monospace", fontSize: 13,
                    }}
                    placeholder={t('formulaBar')}
                />
            </div>

            {/* ── Grid + optional VBA panel ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', border: '1px solid var(--border-subtle)', borderTop: 'none' }}>

                {/* Grid */}
                <div
                    ref={gridRef}
                    tabIndex={0}
                    onKeyDown={handleGridKeyDown}
                    style={{ flex: 1, overflow: 'auto', outline: 'none', background: 'var(--bg-base)' }}
                >
                    <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', userSelect: 'none' }}>
                        <thead>
                            <tr>
                                {/* Corner */}
                                <th style={{
                                    width: HDR_W, minWidth: HDR_W, height: ROW_H,
                                    position: 'sticky', top: 0, left: 0, zIndex: 4,
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                }} />
                                {/* Col headers */}
                                {Array.from({ length: COLS }, (_, c) => (
                                    <th key={c} style={{
                                        width: COL_W, minWidth: COL_W, height: ROW_H,
                                        position: 'sticky', top: 0, zIndex: 3,
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                                        fontFamily: "'Fira Code', monospace", textAlign: 'center'
                                    }}>
                                        {colLetter(c)}
                                    </th>
                                ))}
                            </tr>
                            {/* Filter row */}
                            {showFilter && (
                                <tr>
                                    <td style={{
                                        position: 'sticky', left: 0, zIndex: 3,
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                    }} />
                                    {Array.from({ length: COLS }, (_, c) => (
                                        <td key={c} style={{ border: '1px solid var(--border-subtle)', padding: '1px 2px', background: 'var(--bg-surface)' }}>
                                            <input
                                                value={filterTexts[colLetter(c)] || ''}
                                                onChange={e => setFilterTexts(prev => ({ ...prev, [colLetter(c)]: e.target.value }))}
                                                style={{
                                                    width: '100%', padding: '2px 4px', border: 'none', outline: 'none',
                                                    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                                                    fontSize: 11, fontFamily: "'Fira Code', monospace",
                                                }}
                                                placeholder="🔍"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {visibleRows.map(r => (
                                <tr key={r}>
                                    {/* Row header */}
                                    <td style={{
                                        width: HDR_W, height: ROW_H,
                                        position: 'sticky', left: 0, zIndex: 2,
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                                        fontFamily: "'Fira Code', monospace", textAlign: 'center',
                                    }}>
                                        {r + 1}
                                    </td>
                                    {/* Data cells */}
                                    {Array.from({ length: COLS }, (_, c) => {
                                        const addr = `${colLetter(c)}${r + 1}`;
                                        const cell = cells[addr];
                                        const isSelected = addr === selectedCell;
                                        const isEditing = isSelected && editMode;
                                        const fmt = cell?.format || {};
                                        const display = cellDisplay(cell, cells);
                                        const isError = display.startsWith('#') && display.endsWith('!');

                                        return (
                                            <td
                                                key={c}
                                                onClick={() => {
                                                    if (editMode) commitEdit();
                                                    setSelectedCell(addr);
                                                }}
                                                onDoubleClick={() => startEdit(addr)}
                                                style={{
                                                    width: COL_W, height: ROW_H,
                                                    border: isSelected
                                                        ? '2px solid var(--accent-blue)'
                                                        : '1px solid var(--border-subtle)',
                                                    padding: 0, cursor: 'default',
                                                    background: isSelected ? 'var(--accent-bg-subtle)' : 'var(--bg-base)',
                                                    fontFamily: "'Fira Code', monospace",
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        ref={cellInputRef}
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={handleGridKeyDown}
                                                        onBlur={commitEdit}
                                                        style={{
                                                            width: '100%', height: '100%',
                                                            border: 'none', outline: 'none',
                                                            background: 'var(--bg-elevated)', padding: '0 4px',
                                                            fontFamily: "'Fira Code', monospace", fontSize: 12,
                                                            color: 'var(--text-primary)',
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        padding: '0 4px', height: '100%',
                                                        display: 'flex', alignItems: 'center',
                                                        justifyContent: fmt.align === 'right' ? 'flex-end' : fmt.align === 'center' ? 'center' : 'flex-start',
                                                        fontWeight: fmt.bold ? 700 : 400,
                                                        fontStyle: fmt.italic ? 'italic' : 'normal',
                                                        textDecoration: fmt.underline ? 'underline' : 'none',
                                                        fontSize: 12, color: isError ? '#EF4444' : 'var(--text-primary)',
                                                        whiteSpace: 'nowrap', overflow: 'hidden',
                                                    }}>
                                                        {display}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* VBA Panel */}
                {showVbaPanel && (
                    <div style={{
                        width: 380, borderLeft: '1px solid var(--border-default)',
                        background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column',
                        flexShrink: 0,
                    }}>
                        {/* VBA Header */}
                        <div style={{
                            padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Terminal size={14} color="var(--accent-blue)" />
                                {t('vbaEditor')}
                            </span>
                            <button onClick={() => setShowVbaPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                <X size={14} />
                            </button>
                        </div>

                        {/* VBA Scripts Toolbar */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderBottom: '1px solid var(--border-subtle)',
                            background: 'var(--bg-base)', flexShrink: 0,
                        }}>
                            <button onClick={saveVbaScript} style={{ ...btnStyle(false), padding: '3px 8px', fontSize: 11, gap: 4 }} title="Lưu script">
                                <Plus size={11} /> Lưu
                            </button>
                            <button
                                onClick={() => setShowScriptList(v => !v)}
                                style={{ ...btnStyle(showScriptList), padding: '3px 8px', fontSize: 11, gap: 4 }}
                                title="Danh sách scripts"
                            >
                                <Code2 size={11} /> Scripts {savedScripts.length > 0 && `(${savedScripts.length})`}
                            </button>
                            {showScriptList && savedScripts.length > 0 && (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace", marginLeft: 4 }}>
                                    click để load
                                </span>
                            )}
                        </div>

                        {/* Scripts List */}
                        {showScriptList && (
                            <div style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                maxHeight: 130, overflowY: 'auto', flexShrink: 0,
                                background: 'var(--bg-base)',
                            }}>
                                {savedScripts.length === 0 ? (
                                    <div style={{ padding: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontFamily: "'Fira Code', monospace" }}>
                                        Chưa có script nào
                                    </div>
                                ) : (
                                    savedScripts.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => { setVbaCode(s.code); setShowScriptList(false); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                                                fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg-subtle)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                📄 {s.name}
                                            </span>
                                            <button
                                                onClick={(e) => deleteVbaScript(s.id, e)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0 4px', flexShrink: 0 }}
                                                title="Xóa"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Code Editor */}
                        <textarea
                            value={vbaCode}
                            onChange={e => setVbaCode(e.target.value)}
                            spellCheck={false}
                            style={{
                                flex: 1, resize: 'none', border: 'none', outline: 'none',
                                background: '#1E1E1E', color: '#D4D4D4',
                                fontFamily: "'Fira Code', Consolas, monospace", fontSize: 12,
                                padding: '10px 14px', lineHeight: '1.6',
                                minHeight: '40%',
                            }}
                        />

                        {/* Run controls */}
                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleRunVba}
                                disabled={vbaRunning}
                                style={{
                                    ...btnStyle(false),
                                    background: 'var(--accent-blue)', color: '#fff', border: 'none',
                                    padding: '6px 14px', opacity: vbaRunning ? 0.6 : 1,
                                }}
                            >
                                {vbaRunning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
                                {t('vbaRunBtn')}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace", flexShrink: 0 }}>Sub</span>
                                <input
                                    value={vbaEntryPoint}
                                    onChange={e => setVbaEntryPoint(e.target.value)}
                                    style={{
                                        ...inputStyle, width: 72, padding: '3px 6px', fontSize: 11,
                                        background: '#1E1E1E', color: '#D4D4D4', border: '1px solid #444',
                                    }}
                                    title="Entry point Sub name"
                                    spellCheck={false}
                                />
                            </div>
                            {vbaMethod && (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                                    {vbaMethod === 'excel_com' ? t('vbaMethodExcel') : t('vbaMethodWscript')}
                                </span>
                            )}
                            <button
                                onClick={() => setVbaOutput('')}
                                style={{ ...btnStyle(false), marginLeft: 'auto', padding: '4px 8px' }}
                            >
                                {t('clearOutput')}
                            </button>
                        </div>

                        {/* Output */}
                        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                <span>{t('vbaOutput')}</span>
                                <span style={{ color: '#555', fontWeight: 400, textTransform: 'none' }}>
                                    NASLog("text") to print
                                </span>
                            </div>
                            <div style={{
                                background: '#111', fontFamily: "'Fira Code', Consolas, monospace",
                                fontSize: 11, padding: '8px', borderRadius: 6, minHeight: 80, maxHeight: 160,
                                overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                                color: vbaOutput.includes('[VBA-ERROR]') || vbaOutput.includes('[SETUP-ERROR]') || vbaOutput.startsWith('ERROR:')
                                    ? '#FF6B6B' : '#9CE37D',
                            }}>
                                {vbaOutput || '> '}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Sheet Tabs ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 2,
                padding: '4px 8px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: 'none',
                borderRadius: '0 0 10px 10px', overflowX: 'auto',
            }}>
                {sheets.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {renamingSheet === s.id ? (
                            <input
                                autoFocus
                                defaultValue={s.name}
                                onBlur={e => renameSheet(s.id, e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') renameSheet(s.id, e.target.value);
                                    if (e.key === 'Escape') setRenamingSheet(null);
                                }}
                                style={{ ...inputStyle, width: 80, padding: '3px 6px', fontSize: 11 }}
                            />
                        ) : (
                            <button
                                onClick={() => { setActiveSheetId(s.id); setSelectedCell('A1'); }}
                                onDoubleClick={() => setRenamingSheet(s.id)}
                                style={{
                                    padding: '4px 12px', borderRadius: 6, border: '1px solid',
                                    borderColor: activeSheetId === s.id ? 'var(--accent-blue)' : 'var(--border-subtle)',
                                    background: activeSheetId === s.id ? 'var(--accent-bg-light)' : 'var(--bg-base)',
                                    color: activeSheetId === s.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                    cursor: 'pointer', fontSize: 11, fontFamily: "'Fira Code', monospace", fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                }}
                            >
                                {s.name}
                                {sheets.length > 1 && (
                                    <X size={10} onClick={e => { e.stopPropagation(); deleteSheet(s.id); }}
                                        style={{ opacity: 0.5, cursor: 'pointer' }} />
                                )}
                            </button>
                        )}
                    </div>
                ))}
                <button onClick={addSheet} style={{ ...btnStyle(false), padding: '3px 8px', fontSize: 11 }}>
                    <Plus size={12} />
                </button>
            </div>

            {/* ── Import Modal ── */}
            {showImportModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                }}>
                    <div className="animate-fadeUp" style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        borderRadius: 14, width: 480, maxWidth: '90vw', boxShadow: 'var(--shadow-elevated)',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Upload size={15} color="var(--accent-blue)" />
                                {t('importSpreadsheet')}
                            </h3>
                            <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)' }}>
                            {[
                                { key: 'upload', icon: FolderOpen, label: t('browserUpload') },
                                { key: 'machine', icon: Server, label: t('fromMachine') },
                                { key: 'url', icon: Link, label: t('fromUrl') },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setImportTab(tab.key)}
                                    style={{
                                        flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer',
                                        background: importTab === tab.key ? 'var(--accent-bg-light)' : 'transparent',
                                        color: importTab === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                        borderBottom: importTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                        fontSize: 12, fontFamily: "'Fira Code', monospace", fontWeight: 600,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <tab.icon size={13} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: 20 }}>
                            {importTab === 'upload' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: '2px dashed var(--border-default)', borderRadius: 10,
                                            padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                                            background: 'var(--bg-base)', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                    >
                                        {loading
                                            ? <Loader2 size={28} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                                            : <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />}
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Fira Code', monospace" }}>
                                            .xlsx · .xls · .csv · .ods
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv,.ods"
                                        style={{ display: 'none' }}
                                        onChange={handleBrowserUpload}
                                    />
                                </div>
                            )}

                            {importTab === 'machine' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {t('selectMachine')}
                                    </label>
                                    <select
                                        value={importMachineId}
                                        onChange={e => setImportMachineId(e.target.value)}
                                        style={{ ...inputStyle }}
                                    >
                                        <option value="">{t('selectMachine')}...</option>
                                        {machines.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} {m.ip ? `(${m.ip})` : ''}</option>
                                        ))}
                                    </select>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {t('filePath')}
                                    </label>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input
                                            value={importFilePath}
                                            onChange={e => setImportFilePath(e.target.value)}
                                            placeholder="C:\Users\data.xlsx or /home/user/data.xlsx"
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                        <button
                                            onClick={openFileBrowser}
                                            disabled={!importMachineId}
                                            title="Browse files"
                                            style={{
                                                ...btnStyle(showFileBrowser),
                                                padding: '6px 10px', flexShrink: 0,
                                                opacity: !importMachineId ? 0.4 : 1,
                                            }}
                                        >
                                            <FolderOpen size={14} />
                                        </button>
                                    </div>
                                    {showFileBrowser && importMachineId && (
                                        <div style={{
                                            border: '1px solid var(--border-default)',
                                            borderRadius: 8, background: 'var(--bg-base)',
                                            maxHeight: 220, display: 'flex', flexDirection: 'column',
                                            overflow: 'hidden',
                                        }}>
                                            {/* Header */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '5px 8px', borderBottom: '1px solid var(--border-subtle)',
                                                background: 'var(--bg-surface)', flexShrink: 0,
                                            }}>
                                                <button
                                                    onClick={browserGoUp}
                                                    disabled={browserLoading || !browserPath}
                                                    title="Go up"
                                                    style={{
                                                        ...btnStyle(false), padding: '2px 7px', fontSize: 13,
                                                        opacity: !browserPath ? 0.35 : 1,
                                                    }}
                                                >↑</button>
                                                <span style={{
                                                    flex: 1, fontSize: 11, fontFamily: "'Fira Code', monospace",
                                                    color: 'var(--text-secondary)', overflow: 'hidden',
                                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {browserPath || '/'}
                                                </span>
                                                <button
                                                    onClick={() => setShowFileBrowser(false)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                            {/* File list */}
                                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                                {browserLoading ? (
                                                    <div style={{ padding: 16, textAlign: 'center' }}>
                                                        <Loader2 size={18} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite' }} />
                                                    </div>
                                                ) : browserError ? (
                                                    <div style={{ padding: 12, fontSize: 12, color: '#EF4444', fontFamily: "'Fira Code', monospace" }}>
                                                        {browserError}
                                                    </div>
                                                ) : browserFiles.length === 0 ? (
                                                    <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                                                        Empty
                                                    </div>
                                                ) : (
                                                    [...browserFiles]
                                                        .filter(f => f.isDirectory || /\.(xlsx|xls|csv|ods)$/i.test(f.name))
                                                        .sort((a, b) => {
                                                            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                                                            return a.name.localeCompare(b.name);
                                                        })
                                                        .map(f => (
                                                            <div
                                                                key={f.path || f.name}
                                                                onClick={() => {
                                                                    if (f.isDirectory) {
                                                                        fetchBrowserFiles(f.path || (browserPath ? `${browserPath}/${f.name}` : f.name));
                                                                    } else {
                                                                        setImportFilePath(f.path || (browserPath ? `${browserPath}/${f.name}` : f.name));
                                                                        setShowFileBrowser(false);
                                                                    }
                                                                }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                                                                    fontFamily: "'Fira Code', monospace",
                                                                    color: 'var(--text-primary)',
                                                                    borderBottom: '1px solid var(--border-subtle)',
                                                                    transition: 'background 0.1s',
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg-subtle)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <span style={{ flexShrink: 0, fontSize: 13 }}>
                                                                    {f.isDirectory ? '📁' : '📊'}
                                                                </span>
                                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {f.name}
                                                                </span>
                                                                {!f.isDirectory && (
                                                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                                        {f.name.split('.').pop()?.toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleImportFromMachine}
                                        disabled={loading || !importMachineId || !importFilePath}
                                        style={{
                                            ...btnStyle(false), background: 'var(--accent-blue)', color: '#fff',
                                            border: 'none', padding: '8px 14px', justifyContent: 'center',
                                            opacity: (!importMachineId || !importFilePath) ? 0.5 : 1,
                                        }}
                                    >
                                        {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                                        {t('importFromMachine')}
                                    </button>
                                </div>
                            )}

                            {importTab === 'url' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {t('urlOrNetPath')}
                                    </label>
                                    <input
                                        value={importUrl}
                                        onChange={e => setImportUrl(e.target.value)}
                                        placeholder="https://example.com/data.xlsx  or  \\\\server\\share\\file.xlsx"
                                        style={inputStyle}
                                    />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
                                        http:// · https:// · \\server\share\file.xlsx
                                    </div>
                                    <button
                                        onClick={handleImportFromUrl}
                                        disabled={loading || !importUrl}
                                        style={{
                                            ...btnStyle(false), background: 'var(--accent-blue)', color: '#fff',
                                            border: 'none', padding: '8px 14px', justifyContent: 'center',
                                            opacity: !importUrl ? 0.5 : 1,
                                        }}
                                    >
                                        {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Link size={13} />}
                                        {t('importFromUrl')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── Send to Machine Modal ── */}
            {showSendModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                }}>
                    <div className="animate-fadeUp" style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        borderRadius: 14, width: 480, maxWidth: '90vw', boxShadow: 'var(--shadow-elevated)',
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Server size={15} color="var(--accent-blue)" />
                                Gửi sang máy khác
                            </h3>
                            <button onClick={() => setShowSendModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {t('selectMachine')}
                            </label>
                            <select
                                value={sendMachineId}
                                onChange={e => setSendMachineId(e.target.value)}
                                style={{ ...inputStyle }}
                            >
                                <option value="">{t('selectMachine')}...</option>
                                {machines.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} {m.ip ? `(${m.ip})` : ''}</option>
                                ))}
                            </select>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Đường dẫn đích
                            </label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                    value={sendFilePath}
                                    onChange={e => setSendFilePath(e.target.value)}
                                    placeholder="C:\Users\output.xlsx or /home/user/output.xlsx"
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button
                                    onClick={openSendBrowser}
                                    disabled={!sendMachineId}
                                    title="Browse"
                                    style={{ ...btnStyle(showSendBrowser), padding: '6px 10px', flexShrink: 0, opacity: !sendMachineId ? 0.4 : 1 }}
                                >
                                    <FolderOpen size={14} />
                                </button>
                            </div>
                            {showSendBrowser && sendMachineId && (
                                <div style={{
                                    border: '1px solid var(--border-default)', borderRadius: 8,
                                    background: 'var(--bg-base)', maxHeight: 200,
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '5px 8px', borderBottom: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-surface)', flexShrink: 0,
                                    }}>
                                        <button onClick={sendBrowserGoUp} disabled={sendBrowserLoading || !sendBrowserPath}
                                            style={{ ...btnStyle(false), padding: '2px 7px', fontSize: 13, opacity: !sendBrowserPath ? 0.35 : 1 }}>↑</button>
                                        <span style={{ flex: 1, fontSize: 11, fontFamily: "'Fira Code', monospace", color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {sendBrowserPath || '/'}
                                        </span>
                                        <button onClick={() => setShowSendBrowser(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                    <div style={{ overflowY: 'auto', flex: 1 }}>
                                        {sendBrowserLoading ? (
                                            <div style={{ padding: 16, textAlign: 'center' }}>
                                                <Loader2 size={18} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite' }} />
                                            </div>
                                        ) : sendBrowserError ? (
                                            <div style={{ padding: 12, fontSize: 12, color: '#EF4444', fontFamily: "'Fira Code', monospace" }}>{sendBrowserError}</div>
                                        ) : sendBrowserFiles.length === 0 ? (
                                            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Empty</div>
                                        ) : (
                                            [...sendBrowserFiles]
                                                .sort((a, b) => {
                                                    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                                                    return a.name.localeCompare(b.name);
                                                })
                                                .map(f => (
                                                    <div key={f.path || f.name}
                                                        onClick={() => {
                                                            if (f.isDirectory) {
                                                                fetchSendBrowserFiles(f.path || (sendBrowserPath ? `${sendBrowserPath}/${f.name}` : f.name));
                                                            } else {
                                                                setSendFilePath(f.path || (sendBrowserPath ? `${sendBrowserPath}/${f.name}` : f.name));
                                                                setShowSendBrowser(false);
                                                            }
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                                                            fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)',
                                                            borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg-subtle)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ flexShrink: 0, fontSize: 13 }}>{f.isDirectory ? '📁' : '📄'}</span>
                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={handleSendToMachine}
                                disabled={sendLoading || !sendMachineId || !sendFilePath}
                                style={{
                                    ...btnStyle(false), background: 'var(--accent-blue)', color: '#fff',
                                    border: 'none', padding: '8px 14px', justifyContent: 'center', marginTop: 4,
                                    opacity: (!sendMachineId || !sendFilePath) ? 0.5 : 1,
                                }}
                            >
                                {sendLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Server size={13} />}
                                Gửi file
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Spreadsheet;
