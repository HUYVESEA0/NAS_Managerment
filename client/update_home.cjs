const fs = require('fs');

const fileContent = `import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Activity, Server, Users, Wifi, ShieldCheck, Cpu, HardDrive, AlertCircle } from 'lucide-react';

const Home = () => {
    const { t } = useLanguage();

    const stats = [
        { label: 'Active Nodes', value: '4/4', icon: Server, color: 'text-success' },
        { label: 'Network Load', value: '1.2 GB/s', icon: Wifi, color: 'text-accent' },
        { label: 'Users', value: '12', icon: Users, color: 'text-blue-500' },
        { label: 'Security', value: 'Secure', icon: ShieldCheck, color: 'text-success' }
    ];

    const alerts = [
        { type: 'warning', msg: 'High CPU usage on Node-02 (89%)', time: '2m ago' },
        { type: 'error', msg: 'Failed connection attempt from 192.168.1.104', time: '15m ago' },
        { type: 'info', msg: 'Backup completed successfully', time: '1h ago' }
    ];

    return (
        <div className="space-y-6">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-default pb-6">
                <div>
                    <h1 className="text-3xl font-bold font-mono text-primary flex items-center gap-3">
                        <Activity className="text-accent" size={32} />
                        SYSTEM_OVERVIEW
                    </h1>
                    <p className="text-secondary mt-1 max-w-2xl text-sm">
                        Real-time telemetry and management interface for the distributed NAS infrastructure.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-accent text-white font-bold rounded shadow-sm hover:opacity-90 transition-opacity">
                        Generate Report
                    </button>
                    <button className="px-4 py-2 border border-border-strong bg-surface text-primary font-bold rounded shadow-sm hover:bg-hover transition-colors">
                        Settings
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="bg-surface rounded-xl border border-border-default shadow-sm p-5 relative overflow-hidden group hover:border-accent transition-colors">
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                                    <h3 className="text-2xl font-bold text-primary tracking-tight">{stat.value}</h3>
                                </div>
                                <div className={\`p-3 bg-base rounded-lg \${stat.color}\`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                            
                            {/* Decorative background accent */}
                            <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Icon size={100} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Graph Area */}
                <div className="lg:col-span-2">
                    <div className="bg-surface rounded-xl border border-border-default shadow-sm h-[400px] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-base/50">
                            <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                                <Activity size={18} className="text-accent" />
                                CLUSTER_PERFORMANCE
                            </h2>
                            <div className="flex gap-2 text-xs font-mono">
                                <button className="px-2 py-1 bg-accent/10 text-accent rounded font-bold">1H</button>
                                <button className="px-2 py-1 text-muted hover:text-primary">24H</button>
                                <button className="px-2 py-1 text-muted hover:text-primary">7D</button>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-stripes">
                            <div className="text-muted font-mono text-sm">[Telemetry Graph View]</div>
                        </div>
                    </div>
                </div>

                {/* System Alerts */}
                <div>
                    <div className="bg-surface rounded-xl border border-border-default shadow-sm h-[400px] flex flex-col">
                        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-base/50">
                            <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                                <AlertCircle size={18} className="text-warning" />
                                RECENT_EVENTS
                            </h2>
                            <span className="text-xs font-bold bg-danger/10 text-danger px-2 py-0.5 rounded-full">3</span>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {alerts.map((alert, i) => (
                                <div key={i} className="p-3 mb-2 rounded border border-border-subtle bg-base flex gap-3 items-start">
                                    <div className={\`mt-0.5 \${
                                        alert.type === 'error' ? 'text-danger' : 
                                        alert.type === 'warning' ? 'text-warning' : 'text-blue-500'
                                    }\`}>
                                        <AlertCircle size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-primary">{alert.msg}</p>
                                        <p className="text-xs text-muted font-mono mt-1">{alert.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Node Status */}
            <div>
                 <div className="bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-border-subtle bg-base/50">
                        <h2 className="font-mono font-bold text-primary flex items-center gap-2">
                            <Server size={18} className="text-accent" />
                            NODE_MATRIX
                        </h2>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(node => (
                            <div key={node} className="border border-border-subtle rounded-lg p-4 bg-base relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-mono font-bold text-primary flex items-center gap-2">
                                        <HardDrive size={16} className="text-muted" />
                                        Node-0{node}
                                    </span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-secondary">CPU</span>
                                        <span className="font-mono text-primary font-bold">{Math.floor(Math.random() * 40 + 10)}%</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-secondary">RAM</span>
                                        <span className="font-mono text-primary font-bold">{Math.floor(Math.random() * 60 + 20)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>

        </div>
    );
};

export default Home;`
fs.writeFileSync('src/pages/Home.jsx', fileContent);
console.log('Updated Home page to red accent style');
