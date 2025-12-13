import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, BarChart, Bar, Cell
} from 'recharts';
import {
    Activity, Database, Brain, Clock, AlertTriangle, CheckCircle,
    FileText, LayoutDashboard, Table as TableIcon
} from 'lucide-react';

interface StepResult {
    data: any[];
    type: 'json' | 'table' | 'dataframe';
    columns?: string[];
}

interface AnalyticsDashboardProps {
    steps: any[];
    stepResults: { [key: number]: StepResult };
    stepError: { [key: number]: string };
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ steps, stepResults, stepError }) => {
    const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

    // Calculate Summary Metrics
    const summary = useMemo(() => {
        const totalSteps = steps.length;
        const executedSteps = Object.keys(stepResults).length;
        const failedSteps = Object.keys(stepError).length;
        const successRate = totalSteps > 0 ? ((executedSteps - failedSteps) / totalSteps) * 100 : 0;

        return { totalSteps, executedSteps, failedSteps, successRate };
    }, [steps, stepResults, stepError]);

    const activeResult = stepResults[selectedStepIndex];
    const activeStep = steps[selectedStepIndex];

    // Chart Rendering Logic (Reused & Enhanced)
    const renderVisualization = (result: StepResult, stepConfig: any) => {
        if (!result || !result.data || !Array.isArray(result.data)) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500 bg-gray-800/30 rounded-xl border border-gray-700/50">
                    <Activity size={48} className="mb-4 opacity-20" />
                    <p>No visualization data available for this step.</p>
                </div>
            );
        }

        const data = result.data;
        const columns = Object.keys(data[0] || {});

        // --- Smart Column Detection ---
        const dateCol = columns.find(c => ['date', 'timestamp', 'dateissuedutc', 'ds', 'time'].includes(c.toLowerCase()));

        const predCol = columns.find(c => c === 'prediction' || c.startsWith('prediction_'));

        // Target Detect Priority: Config > Forecasting Config > Prediction Name > Fallback
        let valueCol = null;
        if (stepConfig?.target_col && columns.includes(stepConfig.target_col)) valueCol = stepConfig.target_col;
        else if (stepConfig?.forecasting?.target_col && columns.includes(stepConfig.forecasting.target_col)) valueCol = stepConfig.forecasting.target_col;

        if (!valueCol && predCol && predCol.startsWith('prediction_')) {
            const derived = predCol.replace('prediction_', '');
            if (columns.includes(derived)) valueCol = derived;
        }

        if (!valueCol) {
            valueCol = columns.find(c => ['aqi', 'pm10', 'pm2_5', 'value', 'price', 'target', 'y'].includes(c.toLowerCase())) ||
                columns.find(c => !['dateissuedutc', 'timestamp', 'prediction', 'run_id', 'model_type', 'address', 'is_forecast', 'forecast_horizon'].includes(c) && typeof data[0][c] === 'number');
        }

        // --- Visualization Type Selection ---

        // 1. Time Series / Regression Check
        if (dateCol && (valueCol || predCol)) {
            const sortedData = [...data].sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime());
            const isAnomaly = predCol && sortedData.some(d => d[predCol] === -1);

            // Anomaly Scatter
            if (isAnomaly) {
                return (
                    <div className="h-[500px] w-full bg-gray-900 rounded-xl p-4 border border-gray-800">
                        <h4 className="text-gray-400 mb-4 text-center">Anomaly Detection Results</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey={dateCol} type="category" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30}
                                    tickFormatter={(str) => { try { return new Date(Number(str) || str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return str; } }} />
                                <YAxis dataKey={valueCol || ''} stroke="#9CA3AF" />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: '1px solid #374151' }} />
                                <Legend />
                                <Scatter name="Normal" data={sortedData.filter(d => d[predCol] !== -1)} fill="#3B82F6" shape="circle" />
                                <Scatter name="Anomaly" data={sortedData.filter(d => d[predCol] === -1)} fill="#EF4444" shape="cross" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                );
            }

            // Standard Line Chart (Forecast/Actual)
            return (
                <div className="h-[500px] w-full bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-gray-400 mb-4 text-center">Time Series Analysis</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                            <XAxis dataKey={dateCol} stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={50}
                                tickFormatter={(str) => { try { return new Date(Number(str) || str).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' }); } catch { return str; } }} />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: '1px solid #374151' }} />
                            <Legend />
                            {valueCol && <Line type="monotone" dataKey={valueCol} stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 8 }} name="Actual" />}
                            {predCol && <Line type="monotone" dataKey={predCol} stroke="#10B981" strokeWidth={3} dot={false} strokeDasharray="5 5" name="Predicted" />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        // 2. Classification / Categorical
        if (predCol || valueCol) {
            const target = predCol || valueCol;
            // Histogram / count distribution
            const counts: { [key: string]: number } = {};
            data.forEach(d => {
                const val = d[target];
                counts[val] = (counts[val] || 0) + 1;
            });
            const chartData = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));

            return (
                <div className="h-[500px] w-full bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-gray-400 mb-4 text-center">Distribution Analysis ({target})</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                            <Bar dataKey="count" fill="#8884d8">
                                {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        return <div className="p-8 text-center text-gray-500">Data structure does not support automatic visualization. View as Table.</div>;
    };

    return (
        <div className="bg-gray-950 min-h-screen p-6 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg shadow-blue-900/10">
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><LayoutDashboard size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400 font-medium">Total Steps</p>
                        <h3 className="text-2xl font-bold text-white">{summary.totalSteps}</h3>
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg shadow-green-900/10">
                    <div className="p-3 bg-green-500/10 text-green-400 rounded-xl"><CheckCircle size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400 font-medium">Executed</p>
                        <h3 className="text-2xl font-bold text-white">{summary.executedSteps}</h3>
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg shadow-red-900/10">
                    <div className="p-3 bg-red-500/10 text-red-400 rounded-xl"><AlertTriangle size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400 font-medium">Failed</p>
                        <h3 className="text-2xl font-bold text-white">{summary.failedSteps}</h3>
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl"><Clock size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400 font-medium">Last Run</p>
                        <h3 className="text-lg font-bold text-white">Just Now</h3>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Sidebar Step Selector */}
                <div className="w-full lg:w-1/4 space-y-3">
                    <h3 className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-wider">Pipeline Steps</h3>
                    {steps.map((step, index) => {
                        const hasResult = !!stepResults[index];
                        const hasError = !!stepError[index];
                        const isSelected = selectedStepIndex === index;

                        return (
                            <button
                                key={index}
                                onClick={() => setSelectedStepIndex(index)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group
                                    ${isSelected
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/10' : 'bg-gray-800'}`}>
                                        {step.step_type === 'extraction' && <Database size={16} />}
                                        {step.step_type === 'preprocessing' && <FileText size={16} />}
                                        {step.step_type === 'training' && <Brain size={16} />}
                                        {step.step_type === 'prediction' && <Activity size={16} />}
                                    </div>
                                    <span className="font-medium">{step.name}</span>
                                </div>
                                <div>
                                    {hasError ? <AlertTriangle size={16} className="text-red-400" /> :
                                        hasResult ? <CheckCircle size={16} className={isSelected ? "text-white" : "text-green-500"} /> :
                                            <div className="w-2 h-2 rounded-full bg-gray-700" />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Visualization Area */}
                <div className="w-full lg:w-3/4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden min-h-[600px] shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {activeStep?.name} <span className="text-gray-500 text-sm font-normal uppercase px-2 py-1 bg-gray-800 rounded border border-gray-700">{activeStep?.step_type}</span>
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">Output Analysis</p>
                            </div>

                            {/* View Toggles */}
                            {activeResult && (
                                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                                    <button
                                        onClick={() => setViewMode('chart')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'chart' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-2"><Activity size={16} /> Chart</div>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-2"><TableIcon size={16} /> Table</div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {activeResult ? (
                                viewMode === 'chart' ? (
                                    renderVisualization(activeResult, activeStep?.config_json)
                                ) : (
                                    <div className="overflow-auto max-h-[500px] border border-gray-800 rounded-xl">
                                        <table className="w-full text-left text-sm text-gray-400">
                                            <thead className="bg-gray-800/50 text-gray-200 sticky top-0 backdrop-blur-sm">
                                                <tr>
                                                    {Object.keys(activeResult.data[0] || {}).map(k => <th key={k} className="p-4 font-semibold">{k}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {activeResult.data.slice(0, 100).map((row: any, i: number) => (
                                                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                                                        {Object.values(row).map((val: any, j) => (
                                                            <td key={j} className="p-4 border-b border-gray-800/50 max-w-xs truncate font-mono text-xs">
                                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
                                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                        <Database size={32} className="opacity-50" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2">No Output Generated</h3>
                                    <p>Run this step to generate analytics data.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
