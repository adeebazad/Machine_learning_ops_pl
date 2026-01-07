import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Database, Cpu, Zap, Info, Layers, ExternalLink, Sparkles, Loader2, RefreshCw, Download, LayoutGrid, List, PauseCircle, PlayCircle, FileText } from 'lucide-react';
import { getPearlApiUrl } from '../config';

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

    // AI Observations State
    const [observations, setObservations] = useState<string>('');
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Dashboard Controls State
    const [isPaused, setIsPaused] = useState(false);
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

    const handleSnapshot = () => {
        const snapshot = {
            timestamp: new Date().toISOString(),
            stats: stats,
            currentCpu,
            currentRam,
            observations
        };

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard_snapshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = async () => {
        try {
            const payload = {
                title: "System Performance Report",
                description: `Generated on ${new Date().toLocaleString()}`,
                metrics: [
                    { label: "CPU Load", value: `${currentCpu.toFixed(1)}%` },
                    { label: "Memory Usage", value: `${currentRam.toFixed(1)}%` },
                    { label: "Active Models", value: "3" },
                    { label: "Database Latency", value: "12ms" }
                ],
                observations: observations || "No AI observations generated for this session.",
                charts: [
                    { title: "Real-time Resource Usage", type: "line", observations: "This section represents the real-time CPU and RAM usage trends over the monitored session." }
                ]
            };

            const response = await fetch('/api/report/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to generate PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `System_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error("PDF download failed:", error);
            alert("Failed to download PDF report. See console for details.");
        }
    };

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Fallback or Mock if WS fails/not present in dev
        const wsUrl = `${protocol}//${window.location.host}/api/system/ws/stats`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            if (isPaused) return; // Skip updates if paused

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
    }, [isPaused]); // Re-bind if pause state changes (or just keep ref? Re-bind is fine for now, or essentially valid)

    const generateObservations = async () => {
        if (stats.length === 0) return;
        setIsSummarizing(true);
        setObservations(''); // Clear previous

        try {
            // Construct a summary payload
            const recentStats = stats.slice(-10); // Last 10 points
            const query = `
                You are an AI System Monitor. Analyze the following system performance data and provide a brief, professional summary of the system health.
                Highlight any potential anomalies or high load. Keep it under 20 words.

                Data: ${JSON.stringify(recentStats)}
            `;

            // Assumption: Pearl API is proxied or accessible at relative path /pearl/ollama/ask or similar
            // If running standalone, might need full URL. Using relative for now assuming proxy setup as per task 'Pearl API'.
            // Based on previous files, endpoint is /ollama/ask

            // Based on reference from askbot.js
            const payload = {
                query: query.trim(),
                stream: false
                // model: REMOVED to use backend default as per askbot.js reference
            };

            const response = await fetch(getPearlApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to fetch summary from Pearl');

            const data = await response.json();
            // Assuming response format: { response: "text..." } from OllamaPlainTextOUT in Pearl
            setObservations(data.response || "No response content.");

        } catch (error) {
            console.error("Summarization failed:", error);
            setObservations("Unable to generate observations. Ensure Pearl AI service is reachable.");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="glass p-8 rounded-2xl border-l-4 border-brand-500 relative overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                <div className="relative z-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                            <span className="brand-text">NEC</span> Orchestrating a brighter world
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl leading-relaxed">
                            MLOps and Pipeline Command Center. Monitor infrastructure, manage training workflows, and deploy models with precision.
                        </p>
                    </div>
                    <button
                        onClick={handleSnapshot}
                        className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-700/50 backdrop-blur-md hover:bg-white/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Download size={18} />
                        Save Snapshot
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white border border-transparent rounded-xl font-medium transition-all shadow-sm hover:shadow-md ml-3"
                    >
                        <FileText size={18} />
                        Download Report
                    </button>
                </div>
            </div>

            {/* Dashboard Controls */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">View Layout:</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setLayoutMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${layoutMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setLayoutMode('list')}
                            className={`p-1.5 rounded-md transition-all ${layoutMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full ${isPaused ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                        {isPaused ? 'PAUSED' : 'LIVE FEED'}
                    </span>
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
                        title={isPaused ? "Resume Updates" : "Pause Updates"}
                    >
                        {isPaused ? <PlayCircle size={20} /> : <PauseCircle size={20} />}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={`grid gap-6 ${layoutMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
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

            {/* AI Observations Section */}
            <div className="glass-card p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="text-indigo-500" size={20} />
                        AI Analysis & Observations
                    </h3>
                    <button
                        onClick={generateObservations}
                        disabled={isSummarizing || stats.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95"
                    >
                        {isSummarizing ? (
                            <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                        ) : (
                            <><RefreshCw size={16} /> Generate Observations</>
                        )}
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-900/50 rounded-xl p-4 min-h-[80px] border border-indigo-200 dark:border-indigo-800/30 relative">
                    {observations ? (
                        <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
                            {observations}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2 opacity-70">
                            <Sparkles size={24} className="opacity-50" />
                            <p>Click "Generate Observations" to identify system anomalies and insights.</p>
                        </div>
                    )}
                </div>
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
