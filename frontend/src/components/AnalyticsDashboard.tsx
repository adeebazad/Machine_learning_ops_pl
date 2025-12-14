import React, { useState, useMemo } from 'react';
import {
    Activity, Database, Brain, AlertTriangle, CheckCircle,
    FileText, LayoutDashboard, GitCompare, Clock
} from 'lucide-react';
import AnalyticsEngine from './analytics/AnalyticsEngine';


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

    // Calculate Summary Metrics
    const summary = useMemo(() => {
        const totalSteps = steps.length;
        const executedSteps = Object.keys(stepResults).length;
        const failedSteps = Object.keys(stepError).length;
        const successRate = totalSteps > 0 ? ((executedSteps - failedSteps) / totalSteps) * 100 : 0;

        return { totalSteps, executedSteps, executedStepsOnly: executedSteps - failedSteps, failedSteps, successRate };
    }, [steps, stepResults, stepError]);

    // Comparison Data Logic (Preserved)
    const comparisonData = useMemo(() => {
        const prepIndex = steps.findIndex(s => s.step_type === 'preprocessing');
        const predIndex = steps.findIndex(s => s.step_type === 'prediction');

        if (prepIndex === -1 || predIndex === -1) return null;

        const prepResult = stepResults[prepIndex];
        const predResult = stepResults[predIndex];

        if (!prepResult?.data || !predResult?.data) return null;

        // Identify columns
        const prepCols = Object.keys(prepResult.data[0] || {});
        const predCols = Object.keys(predResult.data[0] || {});

        const dateCol = prepCols.find(c => ['date', 'timestamp', 'dateissuedutc', 'ds'].includes(c.toLowerCase()));
        if (!dateCol) return null;

        // Find Target and Prediction columns
        const targetCol = steps[prepIndex].config_json?.target_col ||
            prepCols.find(c => c.toLowerCase().includes('target') || c.toLowerCase() === 'y');

        const predCol = predCols.find(c => c === 'prediction' || c.startsWith('prediction_'));

        if (!targetCol || !predCol) return null;

        // Merge logic
        const actualsMap = new Map();
        prepResult.data.forEach(row => {
            const dateStr = new Date(row[dateCol]).toISOString();
            actualsMap.set(dateStr, row[targetCol]);
        });

        const merged: any[] = [];
        const processedDates = new Set();

        predResult.data.forEach(row => {
            const d = new Date(row[dateCol]);
            if (isNaN(d.getTime())) return;
            const dateStr = d.toISOString();

            processedDates.add(dateStr);
            const actual = actualsMap.get(dateStr);

            merged.push({
                date: row[dateCol],
                timestamp: d.getTime(),
                actual: actual !== undefined ? Number(actual) : null,
                predicted: Number(row[predCol]),
                isForecast: actual === undefined
            });
        });

        prepResult.data.forEach(row => {
            const d = new Date(row[dateCol]);
            if (isNaN(d.getTime())) return;
            const dateStr = d.toISOString();

            if (!processedDates.has(dateStr)) {
                merged.push({
                    date: row[dateCol],
                    timestamp: d.getTime(),
                    actual: Number(row[targetCol]),
                    predicted: null,
                    isForecast: false
                });
            }
        });

        return merged.sort((a, b) => a.timestamp - b.timestamp);
    }, [steps, stepResults]);

    const activeResult = selectedStepIndex === -1 ? null : stepResults[selectedStepIndex];
    const activeStep = selectedStepIndex === -1 ? { name: 'Model Comparison', step_type: 'analysis', config_json: {} } : steps[selectedStepIndex];


    // Render Comparison Chart (Custom implementation for specific use case)
    const renderComparisonChart = () => {
        if (!comparisonData || comparisonData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <AlertTriangle size={48} className="mb-4 opacity-20" />
                    <p>Insufficient data for automated comparison.</p>
                </div>
            );
        }

        // Use AnalyticsEngine for comparison too? 
        // Actually, pure comparison needs specific structure (Actual vs Predicted). 
        // Let's pass the merged data to AnalyticsEngine but it treats them as columns.
        // It's better to use AnalyticsEngine generic capabilities.
        return <AnalyticsEngine data={comparisonData} title="Model Comparison (Actual vs Predicted)" />;
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
                        <h3 className="text-2xl font-bold text-white">{summary.executedStepsOnly}</h3>
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
            <div className="flex flex-col lg:flex-row gap-6 h-[800px]">

                {/* Sidebar Step Selector */}
                <div className="w-full lg:w-1/4 flex flex-col gap-3 overflow-y-auto pr-2">
                    <h3 className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-wider">Analysis</h3>
                    <button
                        onClick={() => setSelectedStepIndex(-1)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group
                            ${selectedStepIndex === -1
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-lg'
                                : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selectedStepIndex === -1 ? 'bg-white/20' : 'bg-gray-800'}`}>
                                <GitCompare size={16} />
                            </div>
                            <span className="font-medium">Model Comparison</span>
                        </div>
                    </button>

                    <h3 className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-wider mt-6">Pipeline Steps</h3>
                    {steps.map((step, index) => {
                        if (!['preprocessing', 'prediction', 'extraction', 'training'].includes(step.step_type)) return null;

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
                <div className="w-full lg:w-3/4 h-full">
                    {selectedStepIndex === -1 ? (
                        renderComparisonChart()
                    ) : activeResult ? (
                        <AnalyticsEngine data={activeResult.data} title={activeStep.name} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gray-900 border border-gray-800 rounded-2xl text-gray-500">
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
    );
};

export default AnalyticsDashboard;
