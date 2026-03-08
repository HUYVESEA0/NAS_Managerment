import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    FolderHeart, Plus, Pencil, Trash2, GripVertical, X,
    ChevronRight, Check, Loader2, Palette
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

/**
 * PathManager — CRUD saved paths (bookmarked directories)
 * Hiển thị dưới dạng sidebar panel gọn hoặc inline section.
 * 
 * Props:
 *   machineId?: string  — filter theo machine (null = tất cả)
 *   currentPath?: string — path hiện tại (để highlight)
 *   onNavigate?: (machineId, path) => void — sử dụng thay cho Link nếu cần
 */
const PathManager = ({ machineId = null, currentPath = '', onNavigate }) => {
    const { t } = useLanguage();
    const [paths, setPaths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ label: '', path: '', color: '#3B82F6' });
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    const fetchPaths = async () => {
        try {
            const params = machineId ? { machineId } : {};
            const res = await api.get('/saved-paths', { params });
            setPaths(res.data);
        } catch (err) {
            console.error('Failed to fetch saved paths', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPaths(); }, [machineId]);

    const openCreateForm = (prefillPath = '') => {
        setEditingId(null);
        setFormData({
            label: prefillPath ? prefillPath.split('/').filter(Boolean).pop() || 'Root' : '',
            path: prefillPath,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
        setShowForm(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const openEditForm = (item) => {
        setEditingId(item.id);
        setFormData({ label: item.label, path: item.path, color: item.color || '#3B82F6' });
        setShowForm(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.label.trim() || !formData.path.trim()) return;
        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/saved-paths/${editingId}`, { ...formData, machineId: machineId || null });
            } else {
                await api.post('/saved-paths', { ...formData, machineId: machineId || null });
            }
            setShowForm(false);
            setEditingId(null);
            fetchPaths();
        } catch (err) {
            console.error('Save path error', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/saved-paths/${id}`);
            setPaths(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error('Delete path error', err);
        }
    };

    const handleNavigate = (item) => {
        if (onNavigate) {
            onNavigate(item.machineId || machineId, item.path);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderHeart size={16} style={{ color: 'var(--accent-blue)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fira Code', monospace", color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                        {t('savedPaths')}
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                        padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border-subtle)'
                    }}>
                        {paths.length}
                    </span>
                </div>

                <button
                    onClick={() => openCreateForm(currentPath)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                        background: 'var(--accent-bg-light)', border: '1px solid var(--accent-border-light)',
                        borderRadius: 6, color: 'var(--accent-blue)', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, fontFamily: "'Fira Code', monospace"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-border-light)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-bg-light)'; }}
                    title={t('addCurrentPath')}
                >
                    <Plus size={12} /> {t('add')}
                </button>
            </div>

            {/* Inline Form */}
            {showForm && (
                <form onSubmit={handleSave} style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--accent-bg-subtle)', display: 'flex', flexDirection: 'column', gap: 8
                }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            ref={inputRef}
                            placeholder={t('labelExample')}
                            value={formData.label}
                            onChange={e => setFormData(p => ({ ...p, label: e.target.value }))}
                            style={{
                                flex: 1, padding: '6px 10px', background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)', borderRadius: 6,
                                fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                                fontFamily: "'Inter', sans-serif"
                            }}
                        />
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, color: c }))}
                                    style={{
                                        width: 16, height: 16, borderRadius: '50%', background: c,
                                        border: formData.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                                        cursor: 'pointer', padding: 0
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <input
                        placeholder={t('pathExample')}
                        value={formData.path}
                        onChange={e => setFormData(p => ({ ...p, path: e.target.value }))}
                        style={{
                            padding: '6px 10px', background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)', borderRadius: 6,
                            fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                            fontFamily: "'Fira Code', monospace"
                        }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); setEditingId(null); }}
                            style={{
                                padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11
                            }}
                        >{t('cancel')}</button>
                        <button
                            type="submit"
                            disabled={saving || !formData.label.trim() || !formData.path.trim()}
                            style={{
                                padding: '4px 12px', borderRadius: 6, border: 'none',
                                background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontSize: 11,
                                fontWeight: 600, opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {editingId ? t('update') : t('save')}
                        </button>
                    </div>
                </form>
            )}

            {/* Path List */}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block' }} />
                    </div>
                ) : paths.length === 0 && !showForm ? (
                    <div style={{ padding: '24px 14px', textAlign: 'center' }}>
                        <FolderHeart size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('noSavedPaths')}</p>
                        <button
                            onClick={() => openCreateForm(currentPath)}
                            style={{
                                marginTop: 8, padding: '5px 14px', borderRadius: 6,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 11, fontWeight: 600
                            }}
                        >
                            <Plus size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                            {t('saveFirstPath')}
                        </button>
                    </div>
                ) : (
                    paths.map(item => {
                        const isActive = currentPath === item.path;
                        return (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 14px',
                                    background: isActive ? 'var(--accent-bg-subtle)' : 'transparent',
                                    borderLeft: `3px solid ${isActive ? (item.color || 'var(--accent-blue)') : 'transparent'}`,
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Color dot */}
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: item.color || 'var(--accent-blue)', flexShrink: 0
                                }} />

                                {/* Link */}
                                {onNavigate ? (
                                    <div
                                        onClick={() => handleNavigate(item)}
                                        style={{
                                            flex: 1, cursor: 'pointer', overflow: 'hidden',
                                            minWidth: 0
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {item.label}
                                        </div>
                                        <div style={{
                                            fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace",
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {item.path}
                                        </div>
                                    </div>
                                ) : (
                                    <Link
                                        to={`/files?machineId=${item.machineId || machineId}&path=${encodeURIComponent(item.path)}`}
                                        style={{
                                            flex: 1, textDecoration: 'none', overflow: 'hidden',
                                            minWidth: 0
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {item.label}
                                        </div>
                                        <div style={{
                                            fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace",
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {item.path}
                                        </div>
                                    </Link>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0.5 }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                                >
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openEditForm(item); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, borderRadius: 4, display: 'flex' }}
                                        title={t('edit')}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, borderRadius: 4, display: 'flex' }}
                                        title={t('delete')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PathManager;
