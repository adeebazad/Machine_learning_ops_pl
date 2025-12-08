import { useEffect, useState } from 'react';
import { Package, GitBranch, Clock, CheckCircle, XCircle, Search, Filter, Box } from 'lucide-react';
import { mlflowService } from '../services/api';

export const ModelRegistry = () => {
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExp, setSelectedExp] = useState<string>('');
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadExperiments();
    }, []);

    useEffect(() => {
        if (selectedExp) loadRuns(selectedExp);
    }, [selectedExp]);

    const loadExperiments = async () => {
        try {
            const res: any = await mlflowService.listExperiments();
            if (res && Array.isArray(res.experiments)) {
                setExperiments(res.experiments);
                if (res.experiments.length > 0) {
                    setSelectedExp(res.experiments[0].id);
                }
            } else {
                setExperiments([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadRuns = async (expId: string) => {
        setLoading(true);
        try {
            const res: any = await mlflowService.listRuns(expId);
            if (res && Array.isArray(res.runs)) {
                setRuns(res.runs);
            } else {
                setRuns([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Model Registry</h2>
                    <p className="text-gray-400">Track experiments, versions, and model artifacts</p>
                </div>
            </div>

            <div className="glass-card p-6 space-y-6">
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Box size={16} className="text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                            </div>
                            <select
                                value={selectedExp}
                                onChange={(e) => setSelectedExp(e.target.value)}
                                className="pl-10 pr-8 py-2.5 bg-[#0B0C10] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none min-w-[200px]"
                            >
                                {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>

                        <div className="relative flex-1 md:w-64">
                            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search runs..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0C10] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder-gray-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2.5 bg-[#0B0C10] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 transition-all">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 bg-white/5">
                                    <th className="p-4">Run Name / ID</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Metrics</th>
                                    <th className="p-4">Parameters</th>
                                    <th className="p-4">Created</th>
                                    <th className="p-4">Artifacts</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-300 divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading experiments...</td></tr>
                                ) : runs.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
                                        <Package size={32} className="opacity-20" />
                                        No runs found for this experiment
                                    </td></tr>
                                ) : (
                                    runs.map((run: any, index: number) => (
                                        <tr key={run['info.run_id'] || `run-${index}`} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                        <GitBranch size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{run['tags.mlflow.runName'] || 'Untitled Run'}</div>
                                                        <div className="text-xs text-gray-500 font-mono">
                                                            {run['info.run_id'] ? run['info.run_id'].substring(0, 8) : 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {run['info.status'] === 'FINISHED' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                                                        <CheckCircle size={12} /> Finished
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                                                        <XCircle size={12} /> {run['info.status']}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-1.5">
                                                    {run['metrics.accuracy'] && (
                                                        <div className="flex items-center justify-between gap-4 text-xs">
                                                            <span className="text-gray-500">Accuracy</span>
                                                            <span className="font-mono text-green-400 bg-green-500/10 px-1.5 rounded">{parseFloat(run['metrics.accuracy']).toFixed(4)}</span>
                                                        </div>
                                                    )}
                                                    {run['metrics.mse'] && (
                                                        <div className="flex items-center justify-between gap-4 text-xs">
                                                            <span className="text-gray-500">MSE</span>
                                                            <span className="font-mono text-orange-400 bg-orange-500/10 px-1.5 rounded">{parseFloat(run['metrics.mse']).toFixed(4)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs text-gray-400 max-w-[200px] truncate" title={run['params.model_name']}>
                                                    {run['params.model_name'] ? (
                                                        <span className="px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-300">
                                                            {run['params.model_name']}
                                                        </span>
                                                    ) : '-'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs text-gray-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    {run['info.start_time'] ? new Date(parseInt(run['info.start_time'])).toLocaleDateString() : '-'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <button className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[150px] block" title={run['info.artifact_uri']}>
                                                    {run['info.artifact_uri'] ? run['info.artifact_uri'].split('/').pop() : '-'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
