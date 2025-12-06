import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2, ArrowUp, ArrowDown, Play, Plus, X } from 'lucide-react';
import { pipelineService, fileService, experimentService } from '../services/api';

interface PipelineStep {
    id?: number;
    name: string;
    step_type: 'extraction' | 'preprocessing' | 'training' | 'prediction' | 'save';
    order: number;
    config_json: any;
}

const AVAILABLE_MODELS = {
    classification: [
        "RandomForestClassifier", "LogisticRegression", "DecisionTreeClassifier",
        "KNeighborsClassifier", "GradientBoostingClassifier", "SVC", "MLPClassifier",
        "NaiveBayes", "ExtraTreesClassifier", "XGBClassifier", "LGBMClassifier", "CatBoostClassifier"
    ],
    regression: [
        "RandomForestRegressor", "LinearRegression", "Ridge", "Lasso", "ElasticNet",
        "DecisionTreeRegressor", "KNeighborsRegressor", "SVR", "MLPRegressor",
        "XGBRegressor", "LGBMRegressor", "CatBoostRegressor"
    ],
    time_series: ["Prophet", "ARIMA", "SARIMA"],
    clustering: ["KMeans", "DBSCAN", "GaussianMixture"],
    deep_learning: ["DNN (MLP)", "LSTM", "CNN"]
};

const PipelineEditor: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleInterval, setScheduleInterval] = useState<number>(0);
    const [steps, setSteps] = useState<PipelineStep[]>([]);
    const [loading, setLoading] = useState(false);

    // Step execution state
    const [stepLoading, setStepLoading] = useState<{ [key: number]: boolean }>({});
    const [stepResults, setStepResults] = useState<{ [key: number]: any }>({});
    const [stepError, setStepError] = useState<{ [key: number]: string }>({});

    // Script editing state
    const [editingScriptIndex, setEditingScriptIndex] = useState<number | null>(null);
    const [scriptContent, setScriptContent] = useState('');
    const [scriptLoading, setScriptLoading] = useState(false);

    // Config Modal state
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperimentId, setSelectedExperimentId] = useState<string>('');
    const [newConfigName, setNewConfigName] = useState('');

    useEffect(() => {
        if (id) {
            fetchPipeline(parseInt(id));
        }
        // fetchTables(); // Placeholder
    }, [id]);

    useEffect(() => {
        if (showConfigModal) {
            fetchExperiments();
        }
    }, [showConfigModal]);

    const fetchPipeline = async (pipelineId: number) => {
        try {
            const data: any = await pipelineService.getPipeline(pipelineId);
            setName(data.name);
            setDescription(data.description || '');
            setScheduleEnabled(data.schedule_enabled || false);
            setScheduleTime(utcToIst(data.schedule_time || ''));
            setScheduleInterval(data.schedule_interval || 0);
            setSteps(data.steps.sort((a: any, b: any) => a.order - b.order));
        } catch (err) {
            console.error(err);
            alert('Failed to load pipeline');
        }
    };

    const fetchExperiments = async () => {
        try {
            const res: any = await experimentService.list();
            setExperiments(res);
            if (res.length > 0) setSelectedExperimentId(res[0].id.toString());
        } catch (err) {
            console.error("Failed to fetch experiments", err);
        }
    };

    const handleSave = async () => {
        if (!name) {
            alert('Please enter a pipeline name');
            return;
        }

        setLoading(true);
        try {
            const pipelineData = {
                name,
                description,
                schedule_enabled: scheduleEnabled,
                schedule_time: istToUtc(scheduleTime),
                schedule_interval: scheduleInterval,
                steps
            };

            if (id) {
                await pipelineService.updatePipeline(parseInt(id), pipelineData);
                alert('Pipeline updated successfully!');
            } else {
                const response = await pipelineService.createPipeline(pipelineData);
                alert('Pipeline created successfully!');
                navigate(`/pipelines/${response.data.id}`);
            }
        } catch (err) {
            console.error('Failed to save pipeline:', err);
            alert('Failed to save pipeline');
        } finally {
            setLoading(false);
        }
    };

    const handleRunStep = async (index: number) => {
        if (!id) {
            alert("Please save the pipeline first before running individual steps.");
            return;
        }

        setStepLoading(prev => ({ ...prev, [index]: true }));
        setStepError(prev => ({ ...prev, [index]: '' }));
        setStepResults(prev => ({ ...prev, [index]: null }));

        try {
            const stepOrder = steps[index].order;
            const stepDef = steps[index];
            const res: any = await pipelineService.testStep(parseInt(id), stepOrder, stepDef);
            setStepResults(prev => ({ ...prev, [index]: res }));
        } catch (err: any) {
            console.error("Step execution failed:", err);
            setStepError(prev => ({ ...prev, [index]: err.response?.data?.detail || "Step execution failed" }));
        } finally {
            setStepLoading(prev => ({ ...prev, [index]: false }));
        }
    };

    // ... Helper functions ...
    const utcToIst = (utcTime: string) => {
        if (!utcTime) return '';
        const [h, m] = utcTime.split(':').map(Number);
        let istH = h + 5;
        let istM = m + 30;
        if (istM >= 60) {
            istH += 1; // istM = istM - 60
            istM -= 60;
        }
        if (istH >= 24) istH -= 24;
        return `${istH.toString().padStart(2, '0')}:${istM.toString().padStart(2, '0')}`;
    };

    const istToUtc = (istTime: string) => {
        if (!istTime) return '';
        const [h, m] = istTime.split(':').map(Number);
        let utcH = h - 5;
        let utcM = m - 30;
        if (utcM < 0) {
            utcH -= 1;
            utcM += 60;
        }
        if (utcH < 0) utcH += 24;
        return `${utcH.toString().padStart(2, '0')}:${utcM.toString().padStart(2, '0')}`;
    };

    const addStep = (type: PipelineStep['step_type']) => {
        const newStep: PipelineStep = {
            name: `New ${type} step`,
            step_type: type,
            order: steps.length,
            config_json: getDefaultConfig(type)
        };
        setSteps([...steps, newStep]);
    };

    const getDefaultParams = (modelName: string) => {
        if (modelName.includes('RandomForest') || modelName.includes('ExtraTrees') || modelName.includes('Bagging')) {
            return { n_estimators: 100 };
        }
        if (modelName.includes('XGB') || modelName.includes('LGBM') || modelName.includes('CatBoost')) {
            return { n_estimators: 100, learning_rate: 0.1 };
        }
        if (modelName.includes('KMeans')) {
            return { n_clusters: 3 };
        }
        if (['DNN (MLP)', 'LSTM', 'CNN'].includes(modelName)) {
            return { epochs: 10, batch_size: 32, learning_rate: 0.001 };
        }
        // Most other models (LinearRegression, ARIMA, etc.) assume default parameters
        return {};
    };

    const getDefaultConfig = (type: string) => {
        switch (type) {
            case 'extraction':
                return {
                    database: {
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                        user: 'root',
                        password: '',
                        database: 'mlops'
                    },
                    query: 'SELECT * FROM my_table LIMIT 100'
                };
            case 'preprocessing':
                return { script_path: 'src/features/preprocess.py', target_col: 'Target' };
            case 'training':
                return {
                    mlflow: { tracking_uri: 'http://localhost:5000', experiment_name: 'Pipeline_Exp' },
                    model: { name: 'RandomForestClassifier', task_type: 'classification', params: { n_estimators: 100 } }
                };
            case 'prediction':
                return { model_uri: '' };
            case 'save':
                return {
                    database: {
                        type: 'mysql',
                        host: 'localhost',
                        port: 3306,
                        user: 'root',
                        password: '',
                        database: 'mlops'
                    },
                    table_name: 'predictions'
                };
            default:
                return {};
        }
    };

    const updateStep = (index: number, field: keyof PipelineStep, value: any) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const updateStepConfig = (index: number, key: string, value: any) => {
        const newSteps = [...steps];
        newSteps[index].config_json = { ...newSteps[index].config_json, [key]: value };
        setSteps(newSteps);
    };

    const updateNestedConfig = (index: number, section: string, key: string, value: any) => {
        const newSteps = [...steps];
        const currentConfig = newSteps[index].config_json;
        newSteps[index].config_json = {
            ...currentConfig,
            [section]: {
                ...currentConfig[section],
                [key]: value
            }
        };
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        newSteps.forEach((step, i) => step.order = i);
        setSteps(newSteps);
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;

        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
        newSteps.forEach((step, i) => step.order = i);
        setSteps(newSteps);
    };

    // Script handling
    const handleLoadScript = async (index: number) => {
        const path = steps[index].config_json.script_path;
        if (!path) {
            alert("Please specify a script path first");
            return;
        }

        setScriptLoading(true);
        try {
            const res: any = await fileService.read(path);
            setScriptContent(res.data.content);
            setEditingScriptIndex(index);
        } catch (err) {
            console.error("Failed to load script:", err);
            setScriptContent("# Write your preprocessing code here\n# import pandas as pd\n\n# def preprocess(df):\n#     return df\n");
            setEditingScriptIndex(index);
        } finally {
            setScriptLoading(false);
        }
    };

    const handleSaveScript = async (index: number) => {
        const path = steps[index].config_json.script_path;
        if (!path) {
            alert("Please specify a script path first");
            return;
        }

        setScriptLoading(true);
        try {
            await fileService.save(path, scriptContent);
            alert("Script saved successfully!");
            setEditingScriptIndex(null);
        } catch (err) {
            console.error("Failed to save script:", err);
            alert("Failed to save script");
        } finally {
            setScriptLoading(false);
        }
    };

    const handleSaveToConfig = async () => {
        if (!selectedExperimentId || !newConfigName) {
            alert("Please select an experiment and enter a config name");
            return;
        }

        const extractionStep = steps.find(s => s.step_type === 'extraction');
        const preprocessingStep = steps.find(s => s.step_type === 'preprocessing');
        const trainingStep = steps.find(s => s.step_type === 'training');
        const saveStep = steps.find(s => s.step_type === 'save');

        const configData = {
            database: {
                ...(extractionStep?.config_json.database || {}),
                training_table: extractionStep?.config_json.query?.match(/FROM\s+(\w+)/i)?.[1] || '',
                prediction_table: saveStep?.config_json.table_name || ''
            },
            preprocessing: {
                script_path: preprocessingStep?.config_json.script_path || ''
            },
            model: {
                ...(trainingStep?.config_json.model || {}),
                target_col: preprocessingStep?.config_json.target_col || ''
            },
            mlflow: trainingStep?.config_json.mlflow || {}
        };

        try {
            await experimentService.createConfig(parseInt(selectedExperimentId), newConfigName, configData);
            alert("Configuration saved successfully!");
            setShowConfigModal(false);
            setNewConfigName('');
        } catch (err) {
            console.error("Failed to save config", err);
            alert("Failed to save configuration");
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">
                    {id ? 'Edit Pipeline' : 'New Pipeline'}
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white"
                    >
                        <Save size={20} />
                        Save as Config
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 text-white"
                    >
                        <Save size={20} />
                        {loading ? 'Saving...' : 'Save Pipeline'}
                    </button>
                </div>
            </div>

            {/* Config Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
                        <h3 className="text-xl font-bold text-white mb-4">Save Configuration</h3>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-1">Select Experiment</label>
                            <select
                                value={selectedExperimentId}
                                onChange={(e) => setSelectedExperimentId(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            >
                                {experiments.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm text-gray-400 mb-1">Config Name</label>
                            <input
                                type="text"
                                value={newConfigName}
                                onChange={(e) => setNewConfigName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                placeholder="e.g. V1 Config"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveToConfig}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Basic Info */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="My Pipeline"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none h-24"
                            placeholder="Describe what this pipeline does..."
                        />
                    </div>
                </div>
            </div>

            {/* Scheduling */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Scheduling</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="schedule_enabled"
                            checked={scheduleEnabled}
                            onChange={(e) => setScheduleEnabled(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="schedule_enabled" className="text-gray-300">Enable Scheduling</label>
                    </div>

                    {scheduleEnabled && (
                        <div className="flex gap-6 ml-6">
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="schedule_daily"
                                    name="schedule_type"
                                    checked={scheduleInterval === 0}
                                    onChange={() => setScheduleInterval(0)}
                                    className="text-blue-600 bg-gray-900"
                                />
                                <label htmlFor="schedule_daily" className="text-gray-400">Run Daily</label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="schedule_interval"
                                    name="schedule_type"
                                    checked={scheduleInterval > 0}
                                    onChange={() => setScheduleInterval(1)}
                                    className="text-blue-600 bg-gray-900"
                                />
                                <label htmlFor="schedule_interval" className="text-gray-400">Run Interval</label>
                            </div>
                        </div>
                    )}

                    {scheduleEnabled && scheduleInterval === 0 && (
                        <div className="flex items-center gap-2 ml-6">
                            <label className="text-sm text-gray-400">At Time (IST):</label>
                            <input
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}

                    {scheduleEnabled && scheduleInterval > 0 && (
                        <div className="flex items-center gap-2 ml-6">
                            <label className="text-sm text-gray-400">Run every:</label>
                            <input
                                type="number"
                                min="1"
                                value={scheduleInterval}
                                onChange={(e) => setScheduleInterval(parseInt(e.target.value) || 0)}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white w-20 text-center"
                            />
                            <span className="text-sm text-gray-400">hours</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-4">
                {steps.map((step, index) => (
                    <div key={index} className="bg-gray-800 border border-gray-700 rounded-xl p-6 relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs uppercase font-bold">
                                    {step.step_type}
                                </span>
                                <input
                                    type="text"
                                    value={step.name}
                                    onChange={(e) => updateStep(index, 'name', e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none text-lg font-semibold text-white"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ArrowUp size={18} /></button>
                                <button onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ArrowDown size={18} /></button>
                                <button onClick={() => removeStep(index)} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><Trash2 size={18} /></button>
                            </div>
                        </div>

                        {/* Config Area - Simplified for brevity in this repair, relying on generic JSON/Input handling could be better but sticking to previous structure */}
                        <div className="space-y-4">
                            {step.step_type === 'extraction' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">SQL Query</label>
                                        <textarea
                                            value={step.config_json.query || ''}
                                            onChange={(e) => updateStepConfig(index, 'query', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono text-sm h-24"
                                            placeholder="SELECT * FROM table"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">DB Type</label>
                                            <select
                                                value={step.config_json.database?.type || 'mysql'}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'type', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            >
                                                <option value="mysql">MySQL</option>
                                                <option value="postgresql">PostgreSQL</option>
                                                <option value="cratedb">CrateDB</option>
                                                <option value="sqlite">SQLite</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Host</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.host || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'host', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                                placeholder="localhost"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Port</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.port || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'port', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                                placeholder="3306"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">User</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.user || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'user', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={step.config_json.database?.password || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'password', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Database Name</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.database || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'database', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step.step_type === 'preprocessing' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Script Path</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={step.config_json.script_path || ''}
                                                onChange={(e) => updateStepConfig(index, 'script_path', e.target.value)}
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                            <button
                                                onClick={() => handleLoadScript(index)}
                                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Target Column</label>
                                        <input
                                            type="text"
                                            value={step.config_json.target_col || ''}
                                            onChange={(e) => updateStepConfig(index, 'target_col', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {step.step_type === 'training' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Task Type</label>
                                            <select
                                                value={step.config_json.model?.task_type || 'classification'}
                                                onChange={(e) => {
                                                    const newTask = e.target.value;
                                                    // Reset model when task changes
                                                    const firstModel = AVAILABLE_MODELS[newTask as keyof typeof AVAILABLE_MODELS]?.[0] || '';
                                                    const newSteps = [...steps];
                                                    const currentConfig = newSteps[index].config_json;
                                                    newSteps[index].config_json = {
                                                        ...currentConfig,
                                                        model: {
                                                            ...currentConfig.model,
                                                            task_type: newTask,
                                                            name: firstModel,
                                                            params: getDefaultParams(firstModel)
                                                        }
                                                    };
                                                    setSteps(newSteps);
                                                }}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            >
                                                <option value="classification">Classification</option>
                                                <option value="regression">Regression</option>
                                                <option value="time_series">Time Series</option>
                                                <option value="clustering">Clustering</option>
                                                <option value="deep_learning">Deep Learning</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Model Name</label>
                                            <select
                                                value={step.config_json.model?.name || ''}
                                                onChange={(e) => {
                                                    const newModel = e.target.value;
                                                    const newSteps = [...steps];
                                                    const currentConfig = newSteps[index].config_json;
                                                    newSteps[index].config_json = {
                                                        ...currentConfig,
                                                        model: {
                                                            ...currentConfig.model,
                                                            name: newModel,
                                                            params: getDefaultParams(newModel)
                                                        }
                                                    };
                                                    setSteps(newSteps);
                                                }}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            >
                                                {AVAILABLE_MODELS[step.config_json.model?.task_type as keyof typeof AVAILABLE_MODELS]?.map((model) => (
                                                    <option key={model} value={model}>
                                                        {model}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">MLflow Experiment</label>
                                        <input
                                            type="text"
                                            value={step.config_json.mlflow?.experiment_name || ''}
                                            onChange={(e) => updateNestedConfig(index, 'mlflow', 'experiment_name', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {step.step_type === 'save' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">DB Type</label>
                                            <select
                                                value={step.config_json.database?.type || 'mysql'}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'type', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            >
                                                <option value="mysql">MySQL</option>
                                                <option value="postgresql">PostgreSQL</option>
                                                <option value="cratedb">CrateDB</option>
                                                <option value="sqlite">SQLite</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Host</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.host || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'host', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                                placeholder="localhost"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Port</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.port || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'port', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                                placeholder="3306"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">User</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.user || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'user', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={step.config_json.database?.password || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'password', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Database Name</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.database || ''}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'database', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Table Name</label>
                                        <input
                                            type="text"
                                            value={step.config_json.table_name || ''}
                                            onChange={(e) => updateStepConfig(index, 'table_name', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Run Step Button & Output */}
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Test this step independently</span>
                                <button
                                    onClick={() => handleRunStep(index)}
                                    disabled={stepLoading[index]}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                    <Play size={14} />
                                    {stepLoading[index] ? 'Running...' : 'Run Step'}
                                </button>
                            </div>
                            {stepError[index] && (
                                <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                                    Error: {stepError[index]}
                                </div>
                            )}
                            <StepOutput result={stepResults[index]} />
                        </div>
                    </div>
                ))}

                {steps.length === 0 && (
                    <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-xl">
                        <p className="text-gray-400">No steps defined. Add a step to get started.</p>
                    </div>
                )}
            </div>

            {/* Add Step Bar */}
            <div className="mt-8 flex justify-center gap-3">
                {['extraction', 'preprocessing', 'training', 'prediction', 'save'].map((type) => (
                    <button
                        key={type}
                        onClick={() => addStep(type as PipelineStep['step_type'])}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm text-gray-300 transition-colors capitalize"
                    >
                        <Plus size={16} />
                        {type}
                    </button>
                ))}
            </div>

            {/* Script Modal */}
            {editingScriptIndex !== null && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 w-3/4 h-3/4 flex flex-col rounded-xl border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h3 className="text-lg font-bold text-white">Edit Script</h3>
                            <button onClick={() => setEditingScriptIndex(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="flex-1 p-4">
                            <textarea
                                value={scriptContent}
                                onChange={(e) => setScriptContent(e.target.value)}
                                className="w-full h-full bg-black text-green-400 font-mono p-4 rounded border border-gray-800 focus:outline-none resize-none"
                                spellCheck={false}
                            />
                        </div>
                        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setEditingScriptIndex(null)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
                            <button onClick={() => handleSaveScript(editingScriptIndex)} disabled={scriptLoading} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold">
                                {scriptLoading ? 'Saving...' : 'Save Script'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StepOutput = ({ result }: { result: any }) => {
    if (!result) return null;

    if (result.type === 'dataframe' || result.type === 'table') {
        const columns = result.columns || Object.keys(result.data[0] || {});
        return (
            <div className="mt-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-400">
                        <thead className="bg-gray-800 text-gray-200 uppercase font-bold">
                            <tr>
                                {columns.map((col: string) => <th key={col} className="p-2 border-b border-gray-700">{col}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {result.data.slice(0, 10).map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-800/50">
                                    {columns.map((col: string) => (
                                        <td key={`${i}-${col}`} className="p-2 border-b border-gray-800 font-mono whitespace-nowrap max-w-xs truncate" title={typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}>
                                            {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (result.type === 'json') {
        return (
            <div className="mt-4 bg-black/30 rounded-lg border border-gray-700 p-4 font-mono text-xs text-green-400">
                <pre>{JSON.stringify(result.data, null, 2)}</pre>
            </div>
        );
    }

    return (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-300">
            {typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : String(result.data)}
        </div>
    );
};

export default PipelineEditor;
