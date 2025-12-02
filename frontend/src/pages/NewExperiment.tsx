import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { experimentService } from '../services/api';
import { Play, Save, Plus } from 'lucide-react';

export const NewExperiment = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await experimentService.create(name, description);
            navigate('/config'); // Redirect to config page to start adding configs
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create experiment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Create New Experiment</h1>
                    <p className="text-gray-400">Define a new experiment container for your training runs.</p>
                </div>
            </div>

            <div className="glass-panel p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Experiment Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                            placeholder="e.g., customer-churn-prediction"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50 h-32"
                            placeholder="Describe the goal of this experiment..."
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : (
                                <>
                                    <Save size={18} />
                                    Create Experiment
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
