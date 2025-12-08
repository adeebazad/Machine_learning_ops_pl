import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Trash2, Clock, AlertCircle } from 'lucide-react';
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

    if (loading) return <div className="p-8 text-center text-gray-400">Loading pipelines...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Automated Pipelines
                    </h1>
                    <p className="text-gray-400 mt-2">Manage and schedule your ML workflows</p>
                </div>
                <button
                    onClick={() => navigate('/pipelines/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <Plus size={20} />
                    New Pipeline
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {pipelines.map((pipeline) => (
                    <div
                        key={pipeline.id}
                        onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                        className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                                    {pipeline.name}
                                </h3>
                                <p className="text-gray-400 mt-1">{pipeline.description || 'No description'}</p>
                                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Clock size={14} />
                                        Created: {new Date(pipeline.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleRun(pipeline.id, e)}
                                    className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors"
                                    title="Run Pipeline"
                                >
                                    <Play size={20} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(pipeline.id, e)}
                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                    title="Delete Pipeline"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {pipelines.length === 0 && (
                    <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                        <p className="text-gray-400">No pipelines found. Create your first one!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pipelines;
