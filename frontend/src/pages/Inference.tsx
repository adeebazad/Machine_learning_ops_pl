import { useState, useEffect } from 'react';
import { Activity, ArrowRight, Zap, Database, Code, Layers, FlaskConical } from 'lucide-react';
import { inferenceService, experimentService, databaseService } from '../services/api';

export const Inference = () => {
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedConfig, setSelectedConfig] = useState<string>('');

    const [modelUri, setModelUri] = useState('');
    const [daysToPredict, setDaysToPredict] = useState(0);
    const [inputData, setInputData] = useState('[\n  {"feature1": 1.0, "feature2": 2.0}\n]');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadExperiments();
    }, []);

    useEffect(() => {
        if (selectedExperiment) {
            loadConfigs(parseInt(selectedExperiment));
        } else {
            setConfigs([]);
            setSelectedConfig('');
        }
    }, [selectedExperiment]);

    useEffect(() => {
        if (selectedConfig) {
            loadConfigAndColumns(parseInt(selectedConfig));
        }
    }, [selectedConfig]);

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

    const loadConfigAndColumns = async (configId: number) => {
        try {
            const configRes: any = await experimentService.getConfig(configId);
            const config = configRes.config_json;

            if (config.database && config.database.training_table) {
                const colRes: any = await databaseService.getColumns(config.database.training_table, config.database);
                const columns = colRes.columns;
                const targetCol = config.model?.target_col;

                const template: any = {};
                columns.forEach((col: string) => {
                    if (col !== targetCol) {
                        template[col] = 0;
                    }
                });

                setInputData(JSON.stringify([template], null, 2));
            }
        } catch (err) {
            console.error("Failed to load columns for template", err);
        }
    };

    const handlePredict = async () => {
        setLoading(true);
        setResult(null);
        try {
            const data = JSON.parse(inputData);
            const res: any = await inferenceService.predict(data, modelUri || undefined, selectedConfig ? parseInt(selectedConfig) : undefined, daysToPredict);
            setResult(res);
        } catch (err: any) {
            setResult({ error: err.response?.data?.detail || err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Inference Lab</h2>
                    <p className="text-gray-400">Real-time model predictions and forecasting</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="glass-card p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                                <Layers size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Configuration</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="group">
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Experiment</label>
                                <div className="relative">
                                    <select
                                        value={selectedExperiment}
                                        onChange={(e) => setSelectedExperiment(e.target.value)}
                                        className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-cyan-500/50 transition-all appearance-none"
                                    >
                                        <option value="">Select Experiment</option>
                                        {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                    <FlaskConical size={16} className="absolute left-3 top-3.5 text-gray-500" />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Model Config</label>
                                <div className="relative">
                                    <select
                                        value={selectedConfig}
                                        onChange={(e) => setSelectedConfig(e.target.value)}
                                        className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-cyan-500/50 transition-all appearance-none"
                                    >
                                        <option value="">Select Config</option>
                                        {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <Database size={16} className="absolute left-3 top-3.5 text-gray-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Model URI (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="runs:/<run_id>/model"
                                    value={modelUri}
                                    onChange={(e) => setModelUri(e.target.value)}
                                    className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Forecast Horizon (Days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={daysToPredict}
                                    onChange={(e) => setDaysToPredict(parseInt(e.target.value) || 0)}
                                    className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 flex flex-col h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                                    <Code size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Input Data</h3>
                            </div>
                            <span className="text-xs text-gray-500 font-mono">JSON</span>
                        </div>
                        <textarea
                            value={inputData}
                            onChange={(e) => setInputData(e.target.value)}
                            className="flex-1 bg-[#050505] border border-gray-800 rounded-lg p-4 text-gray-300 font-mono text-sm resize-none focus:outline-none focus:border-yellow-500/50 transition-all"
                            spellCheck={false}
                        />
                    </div>

                    <button
                        onClick={handlePredict}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-[1.02] flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                        ) : (
                            <>
                                <Zap size={24} fill="currentColor" />
                                Run Inference
                            </>
                        )}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-7 glass-card p-0 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                                <Activity size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Prediction Results</h3>
                        </div>
                        {result && !result.error && (
                            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                                Success
                            </span>
                        )}
                    </div>

                    <div className="flex-1 p-6 bg-[#0B0C10]/50 overflow-auto">
                        {result ? (
                            <div className="space-y-4">
                                {result.error ? (
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            <Activity size={20} /> Error
                                        </h4>
                                        <p className="font-mono text-sm">{result.error}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Highlighted Prediction if available */}
                                        {result.predictions && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {result.predictions && Array.isArray(result.predictions) && result.predictions.slice(0, 2).map((pred: any, idx: number) => (
                                                    <div key={idx} className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                                                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Prediction {idx + 1}</div>
                                                        <div className="text-2xl font-bold text-white font-mono">
                                                            {typeof pred === 'number' ? pred.toFixed(4) : pred}
                                                        </div>
                                                    </div>
                                                ))}
                                                {result.predictions.length > 2 && (
                                                    <div className="col-span-full text-center text-gray-500 text-sm">
                                                        + {result.predictions.length - 2} more predictions
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="rounded-xl bg-[#050505] border border-gray-800 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Raw Output</span>
                                                <span className="text-xs text-gray-600 font-mono">JSON</span>
                                            </div>
                                            <pre className="font-mono text-sm text-gray-300 overflow-x-auto">
                                                {JSON.stringify(result, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-6">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                                    <ArrowRight size={48} className="opacity-20" />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-lg font-bold text-gray-500 mb-2">No Data Generated</h4>
                                    <p className="text-sm text-gray-600 max-w-xs mx-auto">
                                        Configure your model parameters and click "Run Inference" to generate predictions.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
