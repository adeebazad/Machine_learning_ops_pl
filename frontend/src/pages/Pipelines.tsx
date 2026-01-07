import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Trash2, Clock, AlertCircle, Layers } from 'lucide-react';
import { pipelineService } from '../services/api';

interface Pipeline {
    id: number;
    name: string;
    description: string;
    created_at: string;
}

const Pipelines: React.FC = () => {
    const navigate = useNavigate();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const data: any = await pipelineService.listPipelines();
            if (Array.isArray(data)) {
                setPipelines(data);
            } else {
                setPipelines([]);
            }
        } catch (err) {
            setError('Failed to load pipelines');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this pipeline?')) {
            try {
                await pipelineService.deletePipeline(id);
                fetchPipelines();
            } catch (err) {
                alert('Failed to delete pipeline');
            }
        }
    };

    const handleRun = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await pipelineService.runPipeline(id);
            alert('Pipeline execution started');
        } catch (err) {
            alert('Failed to start pipeline');
        }
    };

    if (loading) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-slate-400">
                <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                <p>Loading pipelines...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Layers size={28} />
                        </div>
                        Automated Work Flows
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Manage and schedule your ML workflows</p>
                </div>
                <button
                    onClick={() => navigate('/pipelines/new')}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                >
                    <Plus size={20} />
                    New Pipeline
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {pipelines.map((pipeline) => (
                    <div
                        key={pipeline.id}
                        onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                        className="glass-card p-6 bg-white dark:bg-gray-900 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {pipeline.name}
                                </h3>
                                <p className="text-slate-500 dark:text-gray-400 mt-1 mb-4">{pipeline.description || 'No description provided.'}</p>
                                <div className="flex items-center gap-4 text-sm text-slate-400 dark:text-gray-500">
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5">
                                        <Clock size={14} />
                                        Created: {new Date(pipeline.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        v1.0.0
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleRun(pipeline.id, e)}
                                    className="p-2 hover:bg-green-500/10 text-slate-400 hover:text-green-500 dark:hover:text-green-400 rounded-lg transition-colors border border-transparent hover:border-green-500/20"
                                    title="Run Pipeline"
                                >
                                    <Play size={20} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(pipeline.id, e)}
                                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                    title="Delete Pipeline"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {pipelines.length === 0 && !loading && !error && (
                    <div className="text-center py-16 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <Layers size={32} className="text-slate-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-gray-300">No pipelines found</h3>
                        <p className="text-slate-500 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                            Get started by automating your machine learning workflow with a new pipeline.
                        </p>
                        <button
                            onClick={() => navigate('/pipelines/new')}
                            className="mt-6 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                            Create Pipeline
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pipelines;
