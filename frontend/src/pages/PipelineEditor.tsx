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
    const [scheduleInterval, setScheduleInterval] = useState<number>(0);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [steps, setSteps] = useState<PipelineStep[]>([]);

    // ... inside fetchPipeline ...
    const fetchPipeline = async (pipelineId: number) => {
        try {
            const data: any = await pipelineService.getPipeline(pipelineId);
            setName(data.name);
            setDescription(data.description || '');
            setScheduleEnabled(data.schedule_enabled || false);
            setScheduleTime(utcToIst(data.schedule_time || ''));
            setScheduleInterval(data.schedule_interval || 0);
            setSteps(data.steps);
        } catch (err) {
            alert('Failed to load pipeline');
        }
    };

    // ... inside handleSave ...
    const pipelineData = {
        name,
        description,
        schedule_enabled: scheduleEnabled,
        schedule_time: istToUtc(scheduleTime),
        schedule_interval: scheduleInterval,
        steps
    };

    // ... Rendering ...
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
                                    onChange={() => setScheduleInterval(1)} // Default to 1 hour
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
