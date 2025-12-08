import { useEffect, useState, useRef } from 'react';
import { Play, Terminal, Activity } from 'lucide-react';
import { trainingService, experimentService } from '../services/api';

export const Training = () => {
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedConfig, setSelectedConfig] = useState<string>('');

    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadExperiments();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/system/ws/logs`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            setLogs(prev => [...prev, event.data]);
        };

        return () => ws.close();
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        if (selectedExperiment) {
            loadConfigs(parseInt(selectedExperiment));
        } else {
            setConfigs([]);
            setSelectedConfig('');
        }
    }, [selectedExperiment]);

    const loadExperiments = async () => {
        try {
            const res: any = await experimentService.list();
            if (Array.isArray(res)) {
                setExperiments(res);
                if (res.length > 0 && !selectedExperiment) setSelectedExperiment(res[0].id.toString());
            } else {
                console.error("Experiment list response is not an array:", res);
                setExperiments([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadConfigs = async (experimentId: number) => {
        try {
            const res: any = await experimentService.listConfigs(experimentId);
            if (Array.isArray(res)) {
                setConfigs(res);
                if (res.length > 0) setSelectedConfig(res[0].id.toString());
            } else {
                console.error("Config list response is not an array:", res);
                setConfigs([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const startTraining = async () => {
        if (!selectedConfig) return;
        setStatus('running');
        setLogs([]);
        try {
            await trainingService.train(parseInt(selectedConfig));
            setStatus('completed');
        } catch (err) {
            console.error(err);
            setStatus('error');
            setLogs(prev => [...prev, "Error starting training job."]);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6">
            {/* Header / Actions */}
            <div className="glass-card p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">Model Training</h2>
                        <p className="text-gray-400 text-sm">Execute and monitor training pipelines</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/20 border border-white/5">
                        <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">Status</span>
                        {status === 'idle' && <span className="text-gray-400 font-mono text-sm">IDLE</span>}
                        {status === 'running' && <span className="text-blue-400 font-mono text-sm animate-pulse">RUNNING...</span>}
                        {status === 'completed' && <span className="text-green-400 font-mono text-sm">COMPLETED</span>}
                        {status === 'error' && <span className="text-red-400 font-mono text-sm">ERROR</span>}
                    </div>

                    <div className="flex gap-2">
                        <div className="w-48">
                            <select
                                value={selectedExperiment}
                                onChange={(e) => setSelectedExperiment(e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                            >
                                <option value="">Select Experiment</option>
                                {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div className="w-48">
                            <select
                                value={selectedConfig}
                                onChange={(e) => setSelectedConfig(e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                            >
                                <option value="">Select Config</option>
                                {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={startTraining}
                        disabled={status === 'running' || !selectedConfig}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {status === 'running' ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        ) : (
                            <Play size={20} fill="currentColor" />
                        )}
                        Start Training
                    </button>
                </div>
            </div>

            {/* Console Output */}
            <div className="flex-1 glass-card flex flex-col overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#0B0C10] to-transparent z-10 pointer-events-none" />

                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Logs</span>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-1 bg-[#050505]/50">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4">
                            <Terminal size={48} className="opacity-20" />
                            <p>Ready to initialize training sequence...</p>
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="text-gray-300 hover:bg-white/5 px-2 py-0.5 rounded transition-colors border-l-2 border-transparent hover:border-blue-500/50">
                                <span className="text-gray-600 mr-3 select-none">{(i + 1).toString().padStart(3, '0')}</span>
                                {log}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};
