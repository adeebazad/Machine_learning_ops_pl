import { useEffect, useState } from 'react';
import { Play, Square, Clock, Database, RefreshCw, Calendar } from 'lucide-react';
import { schedulerService, configService, databaseService } from '../services/api';

export const Scheduler = () => {
    const [jobs, setJobs] = useState<any[]>([]);
    const [configs, setConfigs] = useState<string[]>([]);
    const [selectedConfig, setSelectedConfig] = useState('');
    const [rowCount, setRowCount] = useState<number | null>(null);
    const [time, setTime] = useState('14:30'); // Default time

    useEffect(() => {
        loadJobs();
        loadConfigs();
    }, []);

    useEffect(() => {
        if (selectedConfig) {
            fetchRowCount();
        }
    }, [selectedConfig]);

    const loadJobs = async () => {
        const res: any = await schedulerService.getJobs();
        setJobs(res.jobs);
    };

    const loadConfigs = async () => {
        const res: any = await configService.list();
        setConfigs(res.files);
        if (res.files.length > 0) setSelectedConfig(res.files[0]);
    };

    const fetchRowCount = async () => {
        try {
            const configRes: any = await configService.get(selectedConfig);
            const configData = configRes;

            if (configData.database && configData.database.training_table) {
                const countRes: any = await databaseService.getRowCount(configData.database.training_table, configData.database);
                setRowCount(countRes.count);
            } else {
                setRowCount(null);
            }
        } catch (error) {
            console.error("Failed to fetch row count:", error);
            setRowCount(null);
        }
    };

    const handleStart = async () => {
        try {
            await schedulerService.start(`config/${selectedConfig}`, time);
            loadJobs();
        } catch (err) {
            alert('Failed to start scheduler');
        }
    };

    const handleStop = async (jobId: any) => {
        try {
            await schedulerService.stop(parseInt(jobId));
            loadJobs();
        } catch (err) {
            alert('Failed to stop scheduler');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Scheduler</h2>
                    <p className="text-gray-400">Manage automated training pipelines and data ingestion</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="glass-card p-6 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                            <Calendar size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">New Schedule</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Configuration</label>
                            <select
                                value={selectedConfig}
                                onChange={(e) => setSelectedConfig(e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                            >
                                {configs.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Time (Daily)</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                            />
                        </div>

                        {/* Row Count Stat */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Database size={18} className="text-blue-400" />
                                <span className="text-sm text-gray-300">Training Rows</span>
                            </div>
                            <span className="text-xl font-bold text-white font-mono">
                                {rowCount !== null ? rowCount.toLocaleString() : '-'}
                            </span>
                        </div>

                        <button
                            onClick={handleStart}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02]"
                        >
                            <Play size={20} /> Start Schedule
                        </button>
                    </div>
                </div>

                {/* Active Jobs List */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                                <Clock size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Active Jobs</h3>
                        </div>
                        <button onClick={loadJobs} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <RefreshCw size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {jobs.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                                <Clock size={48} className="mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-500">No active schedules found.</p>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <div key={job.id} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white">{job.config_name}</h4>
                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                                <span className="font-mono">ID: {job.id.toString().substring(0, 8)}</span>
                                                <span>•</span>
                                                <span>Started: {new Date(job.start_time).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleStop(job.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Stop Job"
                                    >
                                        <Square size={20} fill="currentColor" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
