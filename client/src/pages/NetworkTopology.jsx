import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { Server, Home, Laptop, Cpu, Globe, Database, Wifi } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

// --- Custom Node Components ---

const ServerNode = ({ data }) => {
    const { t } = useLanguage();
    return (
        <div className="topology-node server-node">
            <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6', width: 8, height: 8 }} />
            <div className="node-icon bg-blue-500 shadow-blue-500/50">
                <Server size={20} color="white" />
            </div>
            <div className="node-info">
                <div className="node-label">{t('nasCenter')}</div>
                <div className="node-sub">{t('mainServer')}</div>
            </div>
            <div className="node-glow bg-blue-500/20" />
        </div>
    );
};

const FloorNode = ({ data }) => {
    const { t } = useLanguage();
    return (
        <div className="topology-node floor-node">
            <Handle type="target" position={Position.Top} style={{ background: '#6366f1', width: 8, height: 8 }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', width: 8, height: 8 }} />
            <div className="node-icon bg-indigo-500 shadow-indigo-500/50">
                <Database size={18} color="white" />
            </div>
            <div className="node-info">
                <div className="node-label">{data.label}</div>
                <div className="node-sub">{t('floor')} {data.level}</div>
            </div>
        </div>
    );
};

const RoomNode = ({ data }) => (
    <div className="topology-node room-node">
        <Handle type="target" position={Position.Top} style={{ background: '#06b6d4', width: 8, height: 8 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#06b6d4', width: 8, height: 8 }} />
        <div className="node-icon bg-cyan-500 shadow-cyan-500/50">
            <Home size={16} color="white" />
        </div>
        <div className="node-info">
            <div className="node-label">{data.label}</div>
        </div>
    </div>
);

const MachineNode = ({ data }) => {
    const { t } = useLanguage();
    const isOnline = data.status === 'online';
    const hasAgent = data.agentConnected;

    return (
        <div className={`topology-node machine-node ${isOnline ? 'online' : 'offline'}`}>
            <Handle type="target" position={Position.Top} style={{ background: isOnline ? '#10b981' : '#94a3b8', width: 8, height: 8 }} />
            <Handle type="source" position={Position.Bottom} style={{ background: isOnline ? '#10b981' : '#94a3b8', width: 8, height: 8 }} />
            <div className={`node-icon ${isOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-slate-500 shadow-slate-500/50'}`}>
                <Laptop size={14} color="white" />
            </div>
            <div className="node-info">
                <div className="node-label">{data.label}</div>
                <div className="node-sub">{data.ipAddress || t('noIP')}</div>
            </div>
            {hasAgent && (
                <div className="agent-badge" title={t('agentConnected')}>
                    <Wifi size={10} />
                </div>
            )}
            <div className={`status-glow ${isOnline ? 'bg-emerald-500/20' : 'bg-slate-500/20'}`} />
        </div>
    );
};

const nodeTypes = {
    mainServer: ServerNode,
    floor: FloorNode,
    room: RoomNode,
    machine: MachineNode,
};

// --- Main Page Component ---

const NetworkTopology = () => {
    const { t } = useLanguage();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    const fetchTopologyData = useCallback(async () => {
        try {
            setLoading(true);
            const [hierRes, agentRes] = await Promise.all([
                api.get('/hierarchy'),
                api.get('/agents').catch(() => ({ data: [] }))
            ]);
            const hierarchy = hierRes.data;
            const connectedAgents = agentRes.data;

            // Build a set of connected machine IDs
            const connectedMachineIds = new Set(
                connectedAgents.filter(a => a.status === 'connected').map(a => a.machineId)
            );

            const newNodes = [];
            const newEdges = [];

            // Node size hints for dagre
            const nodeSize = { mainServer: { w: 200, h: 60 }, floor: { w: 190, h: 56 }, room: { w: 170, h: 48 }, machine: { w: 200, h: 56 } };

            // 1. Central Server Node
            const serverId = 'server-root';
            newNodes.push({
                id: serverId,
                type: 'mainServer',
                position: { x: 0, y: 0 },
                data: { label: t('nasServer') },
            });

            hierarchy.forEach((floor) => {
                const floorId = `floor-${floor.id}`;
                newNodes.push({
                    id: floorId,
                    type: 'floor',
                    position: { x: 0, y: 0 },
                    data: { label: floor.name, level: floor.level },
                });
                newEdges.push({
                    id: `e-s-${floorId}`,
                    source: serverId,
                    target: floorId,
                    animated: true,
                    style: { stroke: '#6366f1', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
                });

                floor.rooms.forEach((room) => {
                    const roomId = `room-${room.id}`;
                    newNodes.push({
                        id: roomId,
                        type: 'room',
                        position: { x: 0, y: 0 },
                        data: { label: room.name },
                    });
                    newEdges.push({
                        id: `e-f-${roomId}`,
                        source: floorId,
                        target: roomId,
                        style: { stroke: '#06b6d4', strokeWidth: 1.5 },
                    });

                    room.machines.forEach((machine) => {
                        const machineId = `mac-${machine.id}`;
                        const isAgentConnected = connectedMachineIds.has(machine.id);
                        const isOnline = machine.status === 'online';

                        newNodes.push({
                            id: machineId,
                            type: 'machine',
                            position: { x: 0, y: 0 },
                            data: {
                                label: machine.name,
                                ipAddress: machine.ipAddress,
                                status: machine.status,
                                agentConnected: isAgentConnected
                            },
                        });

                        // Edge from room to machine — shows send/receive for connected agents
                        if (isAgentConnected && isOnline) {
                            // Bidirectional: Server → Machine (send) and Machine → Server (receive)
                            newEdges.push({
                                id: `e-r-${machineId}-send`,
                                source: roomId,
                                target: machineId,
                                animated: true,
                                label: '↓ TX',
                                labelStyle: { fill: '#10b981', fontSize: 10, fontWeight: 600, fontFamily: 'Fira Code, monospace' },
                                labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.85 },
                                labelBgPadding: [4, 2],
                                labelBgBorderRadius: 4,
                                style: { stroke: '#10b981', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 16, height: 16 },
                            });
                            newEdges.push({
                                id: `e-r-${machineId}-recv`,
                                source: machineId,
                                target: roomId,
                                animated: true,
                                label: '↑ RX',
                                labelStyle: { fill: '#06b6d4', fontSize: 10, fontWeight: 600, fontFamily: 'Fira Code, monospace' },
                                labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.85 },
                                labelBgPadding: [4, 2],
                                labelBgBorderRadius: 4,
                                style: { stroke: '#06b6d4', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4', width: 16, height: 16 },
                            });
                        } else {
                            newEdges.push({
                                id: `e-r-${machineId}`,
                                source: roomId,
                                target: machineId,
                                animated: false,
                                label: isOnline ? '' : t('offline'),
                                labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'Fira Code, monospace' },
                                labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.85 },
                                labelBgPadding: [4, 2],
                                labelBgBorderRadius: 4,
                                style: {
                                    stroke: isOnline ? '#94a3b8' : '#475569',
                                    strokeWidth: 1,
                                    strokeDasharray: isOnline ? 'none' : '5,5',
                                    opacity: isOnline ? 0.6 : 0.3
                                },
                            });
                        }
                    });
                });
            });

            // Auto-layout with dagre
            const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
            g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60, edgesep: 30 });

            newNodes.forEach((node) => {
                const size = nodeSize[node.type] || { w: 180, h: 56 };
                g.setNode(node.id, { width: size.w, height: size.h });
            });
            newEdges.forEach((edge) => {
                g.setEdge(edge.source, edge.target);
            });

            Dagre.layout(g);

            const layoutNodes = newNodes.map((node) => {
                const pos = g.node(node.id);
                const size = nodeSize[node.type] || { w: 180, h: 56 };
                return { ...node, position: { x: pos.x - size.w / 2, y: pos.y - size.h / 2 } };
            });

            setNodes(layoutNodes);
            setEdges(newEdges);
        } catch (error) {
            console.error('Error fetching topology:', error);
        } finally {
            setLoading(false);
        }
    }, [setNodes, setEdges, t]);

    useEffect(() => {
        fetchTopologyData();
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchTopologyData, 30000);
        return () => clearInterval(interval);
    }, [fetchTopologyData]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div className="topology-container">
            <div className="topology-header">
                <div className="topology-title">
                    <Wifi className="text-blue-500" size={24} />
                    <h1>{t('topology')}</h1>
                </div>
                <div className="topology-stats">
                    <div className="stat-item">
                        <span className="stat-dot bg-blue-500" />
                        <span>{t('legendServer')}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-dot bg-emerald-500" />
                        <span>{t('legendOnline')}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-dot bg-slate-500" />
                        <span>{t('legendOffline')}</span>
                    </div>
                    <div className="stat-item" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
                        <span style={{ color: '#10b981', fontFamily: 'Fira Code, monospace', fontSize: 11, fontWeight: 600 }}>↓ TX</span>
                        <span>{t('send')}</span>
                    </div>
                    <div className="stat-item">
                        <span style={{ color: '#06b6d4', fontFamily: 'Fira Code, monospace', fontSize: 11, fontWeight: 600 }}>↑ RX</span>
                        <span>{t('receive')}</span>
                    </div>
                </div>
            </div>

            <div className="topology-viewport">
                {loading && nodes.length === 0 ? (
                    <div className="topology-loading">
                        <div className="loader" />
                        <span>{t('loadingNetworkMap')}</span>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        snapToGrid
                        snapGrid={[15, 15]}
                    >
                        <Background color="#1e293b" variant="dots" gap={20} size={1} />
                        <Controls className="bg-slate-800 border-slate-700 fill-white" />
                        <MiniMap
                            nodeStrokeColor={(n) => {
                                if (n.type === 'mainServer') return '#3b82f6';
                                if (n.type === 'machine' && n.data.status === 'online') return '#10b981';
                                return '#94a3b8';
                            }}
                            nodeColor="#0f172a"
                            className="bg-slate-900/50 backdrop-blur-sm border-slate-700"
                        />
                    </ReactFlow>
                )}
            </div>

            <style>{`
        .topology-container {
          height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .topology-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }

        .topology-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .topology-title h1 {
          font-family: 'Fira Code', monospace;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .topology-stats {
          display: flex;
          gap: 20px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .topology-viewport {
          flex: 1;
          background: var(--bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-default);
          overflow: hidden;
          position: relative;
          box-shadow: var(--shadow-card);
        }

        html.dark .topology-viewport {
          background: #0b0f1a;
        }

        .topology-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: var(--bg-base);
          opacity: 0.9;
          backdrop-filter: blur(4px);
          z-index: 10;
          color: var(--text-secondary);
        }

        .loader {
          width: 32px;
          height: 32px;
          border: 3px solid var(--accent-glow);
          border-top: 3px solid var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Node Styles */
        .topology-node {
          padding: 10px 14px;
          border-radius: var(--radius-lg);
          background: var(--bg-card);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 180px;
          box-shadow: var(--shadow-card);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        html.dark .topology-node {
           background: rgba(30, 41, 59, 0.7);
           border-color: rgba(255, 255, 255, 0.1);
        }

        .topology-node:hover {
          transform: translateY(-2px);
          border-color: var(--accent-blue);
          box-shadow: var(--shadow-elevated), var(--shadow-glow);
        }

        .node-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 2;
        }

        .node-info {
          display: flex;
          flex-direction: column;
          z-index: 2;
        }

        .node-label {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .node-sub {
          font-size: 11px;
          color: var(--text-muted);
          font-family: 'Fira Code', monospace;
        }

        .node-glow {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .status-glow {
          position: absolute;
          right: -20px;
          top: -20px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          z-index: 1;
          filter: blur(20px);
        }

        .server-node {
          border: 1px solid var(--accent-blue);
        }

        .machine-node.online {
          border-left: 3px solid var(--success);
        }

        .machine-node.offline {
          opacity: 0.7;
          border-left: 3px solid var(--text-muted);
        }

        .agent-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          background: var(--accent-glow);
          border: 1px solid var(--accent-cyan);
          color: var(--accent-cyan);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        .react-flow__edge-path {
          transition: stroke 0.3s, stroke-width 0.3s;
        }

        .react-flow__controls-button {
          background: var(--bg-surface) !important;
          border-bottom: 1px solid var(--border-subtle) !important;
          fill: var(--text-primary) !important;
        }

        .react-flow__controls-button:hover {
          background: var(--bg-hover) !important;
        }
      `}</style>
        </div>
    );
};

export default NetworkTopology;
