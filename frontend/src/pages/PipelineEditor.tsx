import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { pipelineService, fileService, experimentService } from '../services/api';

interface PipelineStep {
    id?: number;
    name: string;
    step_type: 'extraction' | 'preprocessing' | 'training' | 'prediction' | 'save';
    order: number;
    config_json: any;
}

const PipelineEditor: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [steps, setSteps] = useState<PipelineStep[]>([]);
    const [loading, setLoading] = useState(false);
    const [stepLoading, setStepLoading] = useState<{ [key: number]: boolean }>({});
    const [stepResults, setStepResults] = useState<{ [key: number]: any }>({});
    const [stepError, setStepError] = useState<{ [key: number]: string }>({});

    // Script editing state
    const [editingScriptIndex, setEditingScriptIndex] = useState<number | null>(null);
    const [scriptContent, setScriptContent] = useState('');
    const [scriptLoading, setScriptLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetchPipeline(parseInt(id));
        }
        fetchTables();
    }, [id]);

    const fetchPipeline = async (pipelineId: number) => {
        try {
            const data: any = await pipelineService.getPipeline(pipelineId);
            setName(data.name);
            setDescription(data.description || '');
            setScheduleEnabled(data.schedule_enabled || false);
            setScheduleTime(utcToIst(data.schedule_time || ''));
            setSteps(data.steps);
        } catch (err) {
            alert('Failed to load pipeline');
        }
    };

    const fetchTables = async () => {
        try {
            // Assuming mysql for now, ideally should be dynamic based on selected DB
            // const config = { type: 'mysql', host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'alter_managment' };
            // This is a bit hacky, ideally we have a separate endpoint to list tables without full config
            // For now, we'll just let the user type table names or use a hardcoded list if API fails
        } catch (err) {
            console.error(err);
        }
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
                return { model_uri: '' }; // Empty means use model from previous step
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

    const getModelOptions = (taskType: string) => {
        const options: { [key: string]: string[] } = {
            classification: [
                "LogisticRegression", "KNeighborsClassifier", "DecisionTreeClassifier",
                "RandomForestClassifier", "ExtraTreesClassifier", "GradientBoostingClassifier",
                "XGBClassifier", "LGBMClassifier", "CatBoostClassifier",
                "NaiveBayes", "SVC", "MLPClassifier"
            ],
            regression: [
                "LinearRegression", "Ridge", "Lasso", "ElasticNet",
                "DecisionTreeRegressor", "RandomForestRegressor", "KNeighborsRegressor",
                "XGBRegressor", "LGBMRegressor", "CatBoostRegressor",
                "SVR", "MLPRegressor"
            ],
            clustering: [
                "KMeans", "DBSCAN", "OPTICS", "MeanShift",
                "AgglomerativeClustering", "GaussianMixture", "Birch"
            ],
            dimensionality_reduction: [
                "PCA", "LDA"
            ],
            time_series: [
                "Prophet", "ARIMA", "SARIMA"
            ],
            deep_learning: [
                "DNN (MLP)", "LSTM", "CNN"
            ]
        };
        return options[taskType] || [];
    };

    const getDefaultParams = (modelName: string) => {
        switch (modelName) {
            case 'RandomForestClassifier':
            case 'RandomForestRegressor':
            case 'ExtraTreesClassifier':
            case 'GradientBoostingClassifier':
                return { n_estimators: 100, max_depth: 10 };
            case 'XGBClassifier':
            case 'XGBRegressor':
            case 'LGBMClassifier':
            case 'LGBMRegressor':
            case 'CatBoostClassifier':
            case 'CatBoostRegressor':
                return { n_estimators: 100, learning_rate: 0.1, max_depth: 6 };
            case 'LogisticRegression':
                return { C: 1.0, solver: 'lbfgs' };
            case 'LinearRegression':
                return {};
            case 'Ridge':
            case 'Lasso':
                return { alpha: 1.0 };
            case 'ElasticNet':
                return { alpha: 1.0, l1_ratio: 0.5 };
            case 'SVC':
            case 'SVR':
                return { C: 1.0, kernel: 'rbf' };
            case 'KNeighborsClassifier':
            case 'KNeighborsRegressor':
                return { n_neighbors: 5 };
            case 'DecisionTreeClassifier':
            case 'DecisionTreeRegressor':
                return { max_depth: 10 };
            case 'KMeans':
                return { n_clusters: 3 };
            case 'DBSCAN':
                return { eps: 0.5, min_samples: 5 };
            case 'PCA':
                return { n_components: 2 };
            case 'Prophet':
                return { seasonality_mode: 'additive' };
            case 'ARIMA':
                return { order: [1, 1, 1] };
            case 'SARIMA':
                return { order: [1, 1, 1], seasonal_order: [0, 0, 0, 0] };
            case 'DNN (MLP)':
                return { layers: [64, 32], activation: 'relu', epochs: 10 };
            case 'LSTM':
                return { units: 50, epochs: 10 };
            case 'CNN':
                return { filters: 32, kernel_size: [3, 3], epochs: 10 };
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
        // Reorder
        newSteps.forEach((step, i) => step.order = i);
        setSteps(newSteps);
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;

        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];

        // Update order
        newSteps.forEach((step, i) => step.order = i);
        setSteps(newSteps);
    };

    // Helper functions for time conversion
    const utcToIst = (utcTime: string) => {
        if (!utcTime) return '';
        const [h, m] = utcTime.split(':').map(Number);
        let istH = h + 5;
        let istM = m + 30;
        if (istM >= 60) {
            istH += 1;
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
            // We need to use the step order, which we maintain as index
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
            // If file doesn't exist, we can start with a template or empty
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

    const handleCancelEdit = () => {
        setEditingScriptIndex(null);
        setScriptContent('');
    };

    const [showConfigModal, setShowConfigModal] = useState(false);
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperimentId, setSelectedExperimentId] = useState<string>('');
    const [newConfigName, setNewConfigName] = useState('');

    useEffect(() => {
        if (showConfigModal) {
            fetchExperiments();
        }
    }, [showConfigModal]);

    const fetchExperiments = async () => {
        try {
            const res: any = await experimentService.list();
            setExperiments(res);
            if (res.length > 0) setSelectedExperimentId(res[0].id.toString());
        } catch (err) {
            console.error("Failed to fetch experiments", err);
        }
    };

    const handleSaveToConfig = async () => {
        if (!selectedExperimentId || !newConfigName) {
            alert("Please select an experiment and enter a config name");
            return;
        }

        // Extract config from steps
        const extractionStep = steps.find(s => s.step_type === 'extraction');
        const preprocessingStep = steps.find(s => s.step_type === 'preprocessing');
        const trainingStep = steps.find(s => s.step_type === 'training');
        const saveStep = steps.find(s => s.step_type === 'save');

        const configData = {
            database: {
                ...(extractionStep?.config_json.database || {}),
                training_table: extractionStep?.config_json.query?.match(/FROM\s+(\w+)/i)?.[1] || '', // Simple regex to guess table
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
        <div className="p-8 max-w-5xl mx-auto pb-24" >
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">
                    {id ? 'Edit Pipeline' : 'New Pipeline'}
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                    >
                        <Save size={20} />
                        Save as Config
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save size={20} />
                        {loading ? 'Saving...' : 'Save Pipeline'}
                    </button>
                </div>
            </div>

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

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Scheduling</h3>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="schedule_enabled"
                            checked={scheduleEnabled}
                            onChange={(e) => setScheduleEnabled(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="schedule_enabled" className="text-gray-300">Run Daily</label>
                    </div>

                    {scheduleEnabled && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-400">At Time (IST):</label>
                            <input
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}
                </div>
            </div>

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

                        {/* Step Configuration Forms */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {step.step_type === 'extraction' && (
                                <>
                                    <div className="col-span-2 grid grid-cols-3 gap-4 mb-2 p-3 bg-gray-900/50 rounded border border-gray-700">
                                        <div className="col-span-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Database Configuration</div>

                                        <div>
                                            <label className="block text-gray-400 mb-1">Type</label>
                                            <select
                                                value={step.config_json.database?.type}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'type', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            >
                                                <option value="mysql">MySQL</option>
                                                <option value="postgres">PostgreSQL</option>
                                                <option value="cratedb">CrateDB</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Host</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.host}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'host', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Port</label>
                                            <input
                                                type="number"
                                                value={step.config_json.database?.port}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'port', parseInt(e.target.value))}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">User</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.user}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'user', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={step.config_json.database?.password}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'password', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">DB Name / Schema</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.database || step.config_json.database?.schema}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'database', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-gray-400 mb-1">SQL Query</label>
                                        <textarea
                                            value={step.config_json.query}
                                            onChange={(e) => updateStepConfig(index, 'query', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono text-xs h-20"
                                        />
                                    </div>
                                </>
                            )}

                            {step.step_type === 'preprocessing' && (
                                <>
                                    <div className="col-span-2">
                                        <label className="block text-gray-400 mb-1">Script Path</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={step.config_json.script_path}
                                                onChange={(e) => updateStepConfig(index, 'script_path', e.target.value)}
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                                placeholder="src/features/your_script.py"
                                            />
                                            <button
                                                onClick={() => handleLoadScript(index)}
                                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
                                            >
                                                Edit Script
                                            </button>
                                        </div>
                                    </div>

                                    {editingScriptIndex === index && (
                                        <div className="col-span-2 mt-2 p-4 bg-gray-900 rounded border border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-gray-300">Editing: {step.config_json.script_path}</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveScript(index)}
                                                        disabled={scriptLoading}
                                                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
                                                    >
                                                        <Save size={12} />
                                                        {scriptLoading ? 'Saving...' : 'Save File'}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                value={scriptContent}
                                                onChange={(e) => setScriptContent(e.target.value)}
                                                className="w-full h-64 bg-black text-gray-300 font-mono text-sm p-4 rounded border border-gray-700 focus:border-purple-500 outline-none"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-gray-400 mb-1">Target Column (Optional)</label>
                                        <input
                                            type="text"
                                            value={step.config_json.target_col || ''}
                                            onChange={(e) => updateStepConfig(index, 'target_col', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                            placeholder="Leave empty for inference"
                                        />
                                    </div>
                                </>
                            )}

                            {step.step_type === 'training' && (
                                <>
                                    <div>
                                        <label className="block text-gray-400 mb-1">Task Type</label>
                                        <select
                                            value={step.config_json.model?.task_type}
                                            onChange={(e) => {
                                                const newTaskType = e.target.value;
                                                // Reset model name when task type changes
                                                const defaultModel = getModelOptions(newTaskType)[0] || '';
                                                const defaultParams = getDefaultParams(defaultModel);

                                                // Update task type, model name, AND params
                                                const newModelConfig = {
                                                    ...step.config_json.model,
                                                    task_type: newTaskType,
                                                    name: defaultModel,
                                                    params: defaultParams
                                                };

                                                updateStepConfig(index, 'model', newModelConfig);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        >
                                            <option value="classification">Classification</option>
                                            <option value="regression">Regression</option>
                                            <option value="clustering">Clustering</option>
                                            <option value="dimensionality_reduction">Dimensionality Reduction</option>
                                            <option value="time_series">Time Series</option>
                                            <option value="deep_learning">Deep Learning</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">Model Name</label>
                                        <select
                                            value={step.config_json.model?.name}
                                            onChange={(e) => {
                                                const newModelName = e.target.value;
                                                const defaultParams = getDefaultParams(newModelName);

                                                const newModelConfig = {
                                                    ...step.config_json.model,
                                                    name: newModelName,
                                                    params: defaultParams
                                                };
                                                updateStepConfig(index, 'model', newModelConfig);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        >
                                            {getModelOptions(step.config_json.model?.task_type || 'classification').map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">Parameters (JSON)</label>
                                        <textarea
                                            value={JSON.stringify(step.config_json.model?.params || {}, null, 2)}
                                            onChange={(e) => {
                                                try {
                                                    const params = JSON.parse(e.target.value);
                                                    updateNestedConfig(index, 'model', 'params', params);
                                                } catch (err) {
                                                    // Allow typing invalid JSON while editing
                                                }
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono text-xs h-24"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">MLflow Experiment</label>
                                        <input
                                            type="text"
                                            value={step.config_json.mlflow?.experiment_name}
                                            onChange={(e) => updateNestedConfig(index, 'mlflow', 'experiment_name', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </>
                            )}

                            {step.step_type === 'save' && (
                                <>
                                    <div className="col-span-2 grid grid-cols-3 gap-4 mb-2 p-3 bg-gray-900/50 rounded border border-gray-700">
                                        <div className="col-span-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Database Configuration</div>

                                        <div>
                                            <label className="block text-gray-400 mb-1">Type</label>
                                            <select
                                                value={step.config_json.database?.type}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'type', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            >
                                                <option value="mysql">MySQL</option>
                                                <option value="postgres">PostgreSQL</option>
                                                <option value="cratedb">CrateDB</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Host</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.host}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'host', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Port</label>
                                            <input
                                                type="number"
                                                value={step.config_json.database?.port}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'port', parseInt(e.target.value))}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">User</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.user}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'user', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={step.config_json.database?.password}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'password', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">DB Name / Schema</label>
                                            <input
                                                type="text"
                                                value={step.config_json.database?.database || step.config_json.database?.schema}
                                                onChange={(e) => updateNestedConfig(index, 'database', 'database', e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-gray-400 mb-1">Table Name</label>
                                        <input
                                            type="text"
                                            value={step.config_json.table_name}
                                            onChange={(e) => updateStepConfig(index, 'table_name', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </>
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

                <div className="flex justify-center gap-4 mt-8">
                    <button onClick={() => addStep('extraction')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-blue-400 border border-blue-500/30">+ Extraction</button>
                    <button onClick={() => addStep('preprocessing')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-purple-400 border border-purple-500/30">+ Preprocessing</button>
                    <button onClick={() => addStep('training')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-green-400 border border-green-500/30">+ Training</button>
                    <button onClick={() => addStep('prediction')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-orange-400 border border-orange-500/30">+ Prediction</button>
                    <button onClick={() => addStep('save')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-teal-400 border border-teal-500/30">+ Save</button>
                </div>
            </div>
        </div >
    );
};

// Helper component for Step Output
const StepOutput = ({ result }: { result: any }) => {
    if (!result) return null;

    if (result.type === 'table') {
        return (
            <div className="mt-4 bg-black/30 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-2 bg-gray-800/50 border-b border-gray-700 text-xs font-mono text-gray-400 flex justify-between">
                    <span>Preview ({result.rows} rows)</span>
                    <span>{result.columns.length} columns</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                        <thead>
                            <tr className="bg-gray-800/30">
                                {result.columns.map((col: string) => (
                                    <th key={col} className="p-2 border-b border-gray-700 font-mono">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {result.data.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-white/5">
                                    {result.columns.map((col: string) => (
                                        <td key={`${i}-${col}`} className="p-2 border-b border-gray-800 font-mono whitespace-nowrap">
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
            {result.data}
        </div>
    );
};

export default PipelineEditor;
