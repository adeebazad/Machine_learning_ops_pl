import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Database, Layers, Settings, FileText, CheckCircle, FlaskConical } from 'lucide-react';
import { experimentService, databaseService } from '../services/api';

const SectionHeader = ({ icon: Icon, title }: any) => (
    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-white/10">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Icon size={20} />
        </div>
        <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
    </div>
);

const InputField = ({ label, value, onChange, type = "text", placeholder }: any) => (
    <div className="group">
        <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider group-focus-within:text-blue-400 transition-colors">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-gray-700"
        />
    </div>
);

export const Config = () => {
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [activeConfigId, setActiveConfigId] = useState<number | null>(null);

    const [configData, setConfigData] = useState<any>({});
    const [configName, setConfigName] = useState('');

    const [loading, setLoading] = useState(false);
    const [tables, setTables] = useState<string[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [newConfigName, setNewConfigName] = useState('');

    useEffect(() => {
        loadExperiments();
    }, []);

    useEffect(() => {
        if (selectedExperiment) {
            loadConfigs(parseInt(selectedExperiment));
        } else {
            setConfigs([]);
            setActiveConfigId(null);
        }
    }, [selectedExperiment]);

    useEffect(() => {
        if (activeConfigId) {
            loadConfigDetails(activeConfigId);
        } else {
            setConfigData({
                mlflow: {
                    tracking_uri: 'http://localhost:5000',
                    experiment_name: 'Default'
                }
            });
            setConfigName('');
        }
    }, [activeConfigId]);

    const loadExperiments = async () => {
        try {
            const res: any = await experimentService.list();
            setExperiments(res);
            if (res.length > 0 && !selectedExperiment) setSelectedExperiment(res[0].id.toString());
        } catch (err) {
            console.error(err);
        }
    };

    const loadConfigs = async (experimentId: number) => {
        try {
            const res: any = await experimentService.listConfigs(experimentId);
            setConfigs(res);
        } catch (err) {
            console.error(err);
        }
    };

    const loadConfigDetails = async (configId: number) => {
        setLoading(true);
        try {
            const res: any = await experimentService.getConfig(configId);
            setConfigData(res.config_json);
            setConfigName(res.name);
            if (res.config_json.database) {
                testConnection(res.config_json.database);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!activeConfigId || !configName) return;
        try {
            await experimentService.updateConfig(activeConfigId, configName, configData);
            alert('Configuration saved successfully!');
            loadConfigs(parseInt(selectedExperiment)); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Failed to save configuration');
        }
    };

    const handleCreate = async () => {
        if (!newConfigName || !selectedExperiment) return;
        try {
            await experimentService.createConfig(parseInt(selectedExperiment), newConfigName, configData);
            setNewConfigName('');
            loadConfigs(parseInt(selectedExperiment));
            // We don't auto-select the new one because we don't know its ID easily without reloading or checking response
            // The response returns the new config
            // const res = ...
            // setActiveConfigId(res.data.id);
        } catch (err) {
            alert('Failed to create configuration');
        }
    };

    // Helper to update nested state
    const updateConfig = (section: string, key: string, value: any) => {
        setConfigData((prev: any) => ({
            ...prev,
            [section]: {
                ...(prev[section] || {}),
                [key]: value
            }
        }));
    };

    const testConnection = async (dbConfig: any) => {
        try {
            const res: any = await databaseService.test(dbConfig);
            setTables(res.tables);
        } catch (err) {
            console.error("DB Connection failed", err);
            setTables([]);
        }
    };

    const fetchColumns = async (table: string) => {
        if (!configData?.database) return;
        try {
            const res: any = await databaseService.getColumns(table, configData.database);
            setColumns(res.columns);
        } catch (err) {
            console.error("Failed to fetch columns", err);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-140px)]">
            {/* Sidebar: Experiment & Config List */}
            <div className="glass-card p-6 flex flex-col h-full">
                <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FlaskConical size={20} className="text-purple-400" />
                            Experiment
                        </h2>
                        <a href="/experiments/new" className="text-xs text-blue-400 hover:text-blue-300">+ New</a>
                    </div>
                    <select
                        value={selectedExperiment}
                        onChange={(e) => setSelectedExperiment(e.target.value)}
                        className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="">Select Experiment</option>
                        {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                        <FileText size={16} />
                        Configurations
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar mb-4">
                    {configs.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setActiveConfigId(c.id)}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-all flex items-center justify-between group ${activeConfigId === c.id
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span className="truncate">{c.name}</span>
                            {activeConfigId === c.id && <CheckCircle size={14} />}
                        </button>
                    ))}
                </div>

                <div className="pt-4 border-t border-white/10 space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New config name"
                            value={newConfigName}
                            onChange={(e) => setNewConfigName(e.target.value)}
                            className="flex-1 bg-[#0B0C10] border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                        <button onClick={handleCreate} disabled={!selectedExperiment} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50">
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="lg:col-span-3 space-y-6 overflow-y-auto no-scrollbar pr-2">
                {/* Header with Save Button */}
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Configuration Editor</h2>
                    {activeConfigId && (
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    )}
                </div>
                {/* Database Configuration */}
                <div className="glass-card p-8">
                    <SectionHeader icon={Database} title="Database Connection" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                            label="Type"
                            value={configData?.database?.type || ''}
                            onChange={(e: any) => updateConfig('database', 'type', e.target.value)}
                            placeholder="mysql / postgresql"
                        />
                        <InputField
                            label="Host"
                            value={configData?.database?.host || ''}
                            onChange={(e: any) => updateConfig('database', 'host', e.target.value)}
                        />
                        <InputField
                            label="Port"
                            value={configData?.database?.port || ''}
                            onChange={(e: any) => updateConfig('database', 'port', parseInt(e.target.value))}
                            type="number"
                        />
                        <InputField
                            label="Database Name"
                            value={configData?.database?.database || ''}
                            onChange={(e: any) => updateConfig('database', 'database', e.target.value)}
                        />
                        <InputField
                            label="User"
                            value={configData?.database?.user || ''}
                            onChange={(e: any) => updateConfig('database', 'user', e.target.value)}
                        />
                        <InputField
                            label="Password"
                            value={configData?.database?.password || ''}
                            onChange={(e: any) => updateConfig('database', 'password', e.target.value)}
                            type="password"
                        />
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={() => testConnection(configData.database)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg text-sm font-medium transition-colors border border-blue-500/20"
                        >
                            Test Connection
                        </button>
                    </div>
                </div>

                {/* Data Selection */}
                <div className="glass-card p-8">
                    <SectionHeader icon={Layers} title="Data Selection" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Training Table</label>
                            <select
                                value={configData?.database?.training_table || ''}
                                onChange={(e) => {
                                    updateConfig('database', 'training_table', e.target.value);
                                    fetchColumns(e.target.value);
                                }}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Select Table</option>
                                {tables.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Prediction Table</label>
                            <select
                                value={configData?.database?.prediction_table || ''}
                                onChange={(e) => updateConfig('database', 'prediction_table', e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Select Table</option>
                                {tables.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Model Configuration */}
                <div className="glass-card p-8">
                    <SectionHeader icon={Settings} title="Model Configuration" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Task Type</label>
                            <select
                                value={configData?.model?.task_type || 'classification'}
                                onChange={(e) => updateConfig('model', 'task_type', e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="classification">Classification</option>
                                <option value="regression">Regression</option>
                            </select>
                        </div>
                        <InputField
                            label="Model Name"
                            value={configData?.model?.name || ''}
                            onChange={(e: any) => updateConfig('model', 'name', e.target.value)}
                            placeholder="e.g. RandomForestClassifier"
                        />
                        <div className="group">
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Target Column</label>
                            <select
                                value={configData?.model?.target_col || ''}
                                onChange={(e) => updateConfig('model', 'target_col', e.target.value)}
                                className="w-full bg-[#0B0C10] border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Select Column</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preprocessing Configuration */}
                <div className="glass-card p-8">
                    <SectionHeader icon={Settings} title="Preprocessing" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                            label="Script Path"
                            value={configData?.preprocessing?.script_path || 'src/features/preprocess.py'}
                            onChange={(e: any) => updateConfig('preprocessing', 'script_path', e.target.value)}
                            placeholder="src/features/preprocess.py"
                        />
                    </div>
                </div>

                {/* MLflow Configuration */}
                <div className="glass-card p-8">
                    <SectionHeader icon={Settings} title="MLflow Configuration" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                            label="Tracking URI"
                            value={configData?.mlflow?.tracking_uri || 'http://localhost:5000'}
                            onChange={(e: any) => updateConfig('mlflow', 'tracking_uri', e.target.value)}
                            placeholder="http://localhost:5000"
                        />
                        <InputField
                            label="Experiment Name"
                            value={configData?.mlflow?.experiment_name || 'Default'}
                            onChange={(e: any) => updateConfig('mlflow', 'experiment_name', e.target.value)}
                            placeholder="Default"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
