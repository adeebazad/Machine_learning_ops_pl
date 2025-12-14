import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Database, Cpu, Zap, Info, Layers, ExternalLink } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
    <div className="glass-card p-6 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 ${color.text}`}>
            <Icon size={64} />
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-brand-50 dark:bg-white/5 ${color.text} shadow-sm`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">{title}</h3>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{value}</div>
            {subValue && <div className="text-xs text-slate-500 dark:text-slate-500 font-mono">{subValue}</div>}
        </div>
    </div>
);

export const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any[]>([]);
    const [currentCpu, setCurrentCpu] = useState(0);
    const [currentRam, setCurrentRam] = useState(0);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Fallback or Mock if WS fails/not present in dev
        const wsUrl = `${protocol}//${window.location.host}/api/system/ws/stats`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data && typeof data.cpu === 'number') {
                    setCurrentCpu(data.cpu);
                    setCurrentRam(data.ram);

                    setStats(prev => {
                        const newStats = [...prev, { time: new Date().toLocaleTimeString(), cpu: data.cpu, ram: data.ram }];
                        if (newStats.length > 20) newStats.shift();
                        return newStats;
                    });
                }
            } catch (e) {
                console.warn("Received non-JSON data from WebSocket:", event.data);
            }
        };

        return () => ws.close();
    }, []);

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="glass p-8 rounded-2xl border-l-4 border-brand-500 relative overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                        <span className="brand-text">NEC</span> Orchestrating a brighter world
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl leading-relaxed">
                        MLOps and Pipeline Command Center. Monitor infrastructure, manage training workflows, and deploy models with precision.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="CPU Load"
                    value={`${currentCpu.toFixed(1)}%`}
                    subValue="8 Cores Active"
                    icon={Cpu}
                    color={{ text: 'text-blue-500 dark:text-blue-400' }}
                />
                <StatCard
                    title="Memory Usage"
                    value={`${currentRam.toFixed(1)}%`}
                    subValue="32GB Total"
                    icon={Activity}
                    color={{ text: 'text-purple-500 dark:text-purple-400' }}
                />
                <StatCard
                    title="Active Models"
                    value="3"
                    subValue="Production Ready"
                    icon={Layers}
                    color={{ text: 'text-emerald-500 dark:text-emerald-400' }}
                />
                <StatCard
                    title="Database"
                    value="Connected"
                    subValue="Latency: 12ms"
                    icon={Database}
                    color={{ text: 'text-orange-500 dark:text-orange-400' }}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Real-time Chart */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="text-brand-500" size={20} />
                            System Performance
                        </h3>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1 text-xs text-blue-500"><div className="w-2 h-2 rounded-full bg-blue-500" /> CPU</span>
                            <span className="flex items-center gap-1 text-xs text-purple-500"><div className="w-2 h-2 rounded-full bg-purple-500" /> RAM</span>
                        </div>
                    </div>
                    <div className="h-[350px] w-full" style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" vertical={false} opacity={0.3} />
                                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                                    itemStyle={{ color: '#1e293b' }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                                <Area type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions / Info */}
                <div className="space-y-6">
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Zap className="text-yellow-500" size={20} />
                            Quick Actions
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/experiments/new')}
                                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-left text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between group"
                            >
                                <span>New Experiment</span>
                                <span className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </button>
                            <button
                                onClick={() => navigate('/inference')}
                                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-left text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between group"
                            >
                                <span>Deploy Model</span>
                                <span className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </button>
                            <button
                                onClick={() => window.open('/mlflow/', '_blank')}
                                className="w-full p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 border border-brand-200 dark:border-brand-500/30 text-left text-sm text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 transition-colors flex items-center justify-between group"
                            >
                                <span className="flex items-center gap-2">
                                    <ExternalLink size={14} />
                                    Open MLflow UI
                                </span>
                                <span className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </button>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Info className="text-slate-400" size={20} />
                            System Info
                        </h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-slate-200 dark:border-white/5 pb-2">
                                <span className="text-slate-500 dark:text-slate-400">Version</span>
                                <span className="text-slate-700 dark:text-white font-mono">v2.4.0-beta</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 dark:border-white/5 pb-2">
                                <span className="text-slate-500 dark:text-slate-400">Environment</span>
                                <span className="text-emerald-500 font-medium">Production</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Uptime</span>
                                <span className="text-slate-700 dark:text-white font-mono">4d 12h 30m</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
