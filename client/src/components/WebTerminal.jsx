import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Maximize2, Minimize2, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const WebTerminal = ({ machine, onClose }) => {
    const { token } = useAuth();
    const { t } = useLanguage();
    const terminalRef = useRef(null);
    const terminalElRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);

    const [isConnected, setIsConnected] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!machine || !token || !terminalElRef.current) return;

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0D0D11', // hacker-terminal deep black
                foreground: '#34D399', // bright green
                cursor: '#34D399',
                cursorAccent: '#0D0D11',
                selectionBackground: 'rgba(52, 211, 153, 0.3)',
                black: '#000000',
                red: '#EF4444',
                green: '#10B981',
                yellow: '#F59E0B',
                blue: '#3B82F6',
                magenta: '#8B5CF6',
                cyan: '#06B6D4',
                white: '#FFFFFF',
            },
            fontFamily: "'Fira Code', 'Courier New', monospace",
            fontSize: 14,
            lineHeight: 1.2
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalElRef.current);
        fitAddon.fit();

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        connectWebSocket();

        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'resize',
                        cols: term.cols,
                        rows: term.rows,
                        width: terminalElRef.current.clientWidth,
                        height: terminalElRef.current.clientHeight
                    }));
                }
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (wsRef.current) wsRef.current.close();
            if (terminalRef.current) terminalRef.current.dispose();
        };
    }, [machine, token]);

    const connectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        const term = terminalRef.current;
        term.clear();
        term.writeln(`\x1b[36m${t('initializingWebTerminal')}\x1b[0m`);
        setIsConnected(false);

        // Get WS URL from getApiUrl (replace http/https with ws/wss)
        const baseUrl = getApiUrl().replace(/^http/, 'ws');
        const wsUrl = `${baseUrl}/ws/ssh?token=${token}&machineId=${machine.id}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setTimeout(() => {
                if (fitAddonRef.current) {
                    fitAddonRef.current.fit();
                    ws.send(JSON.stringify({
                        type: 'resize',
                        cols: term.cols,
                        rows: term.rows
                    }));
                }
            }, 500);
        };

        ws.onmessage = (event) => {
            term.write(event.data);
        };

        ws.onclose = () => {
            setIsConnected(false);
            term.writeln(`\r\n\x1b[31m${t('webTerminalDisconnected')}\x1b[0m\r\n`);
        };

        ws.onerror = (err) => {
            console.error('Terminal WS Error:', err);
        };

        // Capture keystrokes and send to SSH server
        term.onData(data => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data }));
            }
        });
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setTimeout(() => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && terminalRef.current) {
                    wsRef.current.send(JSON.stringify({
                        type: 'resize',
                        cols: terminalRef.current.cols,
                        rows: terminalRef.current.rows
                    }));
                }
            }
        }, 100);
    };

    return (
        <div style={{
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? 0 : 'auto',
            left: isFullscreen ? 0 : 'auto',
            right: isFullscreen ? 0 : 'auto',
            bottom: isFullscreen ? 0 : 'auto',
            width: isFullscreen ? '100vw' : '100%',
            height: isFullscreen ? '100vh' : '450px',
            zIndex: isFullscreen ? 9999 : 10,
            background: 'var(--bg-card)',
            border: isFullscreen ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: isFullscreen ? 0 : 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: isFullscreen ? 'none' : 'var(--shadow-elevated)',
            margin: isFullscreen ? 0 : '16px 0'
        }}>
            {/* Terminal Header Bar */}
            <div style={{
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="terminal-dots" style={{ display: 'flex', gap: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }}></div>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }}></div>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }}></div>
                    </div>
                    <span style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        {machine.username}@{machine.ipAddress}
                        <span style={{
                            display: 'inline-block',
                            width: 8, height: 8,
                            borderRadius: '50%',
                            background: isConnected ? '#10B981' : '#EF4444',
                            boxShadow: isConnected ? '0 0 8px #10B981' : 'none'
                        }} />
                    </span>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        onClick={connectWebSocket}
                        title={t('reconnect')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        title={isFullscreen ? t('restoreWindow') : t('fullscreen')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            title={t('closeTerminal')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal Container */}
            <div
                ref={terminalElRef}
                style={{
                    flex: 1,
                    padding: 8,
                    background: '#0D0D11', // xterm bg
                    overflow: 'hidden'
                }}
            />
        </div>
    );
};

export default WebTerminal;
