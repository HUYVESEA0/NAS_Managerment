import { useEffect, useRef, useCallback, useState } from 'react';
import { getApiUrl } from '../services/api';

/**
 * useNotifications — Real-time WebSocket hook kết nối /ws/notify
 * 
 * Tự động reconnect khi mất kết nối.
 * Trả về hàm subscribe để lắng nghe events.
 * 
 * Usage:
 *   const { subscribe, connected } = useNotifications();
 *   useEffect(() => subscribe('file:created', (data) => { ... }), [subscribe]);
 */
export function useNotifications() {
    const wsRef = useRef(null);
    const listenersRef = useRef(new Map());
    const reconnectTimer = useRef(null);
    const [connected, setConnected] = useState(false);

    const connect = useCallback(() => {
        const token = localStorage.getItem('nas_token');
        if (!token) return;

        // Build WS URL from current page location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.DEV
            ? `${window.location.hostname}:3001`
            : window.location.host;
        const url = `${protocol}//${host}/ws/notify?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'event' && msg.event) {
                    const handlers = listenersRef.current.get(msg.event);
                    if (handlers) {
                        handlers.forEach(fn => fn(msg.data));
                    }
                    // Also fire wildcard listeners
                    const wildcardHandlers = listenersRef.current.get('*');
                    if (wildcardHandlers) {
                        wildcardHandlers.forEach(fn => fn(msg.event, msg.data));
                    }
                }
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
            // Auto reconnect after 3s
            reconnectTimer.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connect]);

    /**
     * Subscribe to a specific event. Returns unsubscribe function.
     * @param {string} event - Event name or '*' for all events
     * @param {function} handler - Callback (data) or (event, data) for wildcard
     */
    const subscribe = useCallback((event, handler) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(handler);

        return () => {
            const set = listenersRef.current.get(event);
            if (set) {
                set.delete(handler);
                if (set.size === 0) listenersRef.current.delete(event);
            }
        };
    }, []);

    return { subscribe, connected };
}
