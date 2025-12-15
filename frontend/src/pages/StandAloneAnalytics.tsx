import React, { useState, useEffect } from 'react';
import { pipelineService } from '../services/api';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AnalyticsEngine from '../components/analytics/AnalyticsEngine';
import { LayoutDashboard, RefreshCw, ChevronLeft, ArrowRight, Layers, Clock, Activity, Save, X, Plus, Trash2 } from 'lucide-react';
import { dashboardService } from '../services/api';

const StandAloneAnalytics: React.FC = () => {
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
    const [steps, setSteps] = useState<any[]>([]);
    const [stepResults, setStepResults] = useState<{ [key: number]: any }>({});
    const [stepError, setStepError] = useState<{ [key: number]: string }>({});
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);

    // Save Logic
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [dashboards, setDashboards] = useState<any[]>([]);
    const [saveConfig, setSaveConfig] = useState<any>(null);
    const [targetDashboardId, setTargetDashboardId] = useState<string>('');
    const [newDashboardName, setNewDashboardName] = useState('');
    const [chartName, setChartName] = useState('');

    // Sandbox Logic
    const [sandboxCharts, setSandboxCharts] = useState<{ id: string, stepIndex: number }[]>([]);
    const [selectedStepForSandbox, setSelectedStepForSandbox] = useState<number>(-1);

    const addSandboxChart = () => {
        if (selectedStepForSandbox === -1) return;
        setSandboxCharts([...sandboxCharts, { id: Date.now().toString(), stepIndex: selectedStepForSandbox }]);
    };

    const removeSandboxChart = (id: string) => {
        setSandboxCharts(sandboxCharts.filter(c => c.id !== id));
    };

    const handleSaveChart = (stepId: any, stepOrder: any, stepType: string, chartConfig: any) => {
        if (!selectedPipelineId) return;
        setSaveConfig({
            ...chartConfig,
            pipeline_id: parseInt(selectedPipelineId),
            step_id: stepId,
            step_order: stepOrder,
            step_type: stepType
        });
        setChartName(stepType === 'comparison' ? 'Model Comparison' : `Analytics Chart`);

        dashboardService.list().then((res: any) => {
            setDashboards(res);
            if (res.length > 0) setTargetDashboardId(res[0].id.toString());
            else setTargetDashboardId('new');
            setShowSaveModal(true);
        });
    };

    const confirmSave = async () => {
        if (!saveConfig) return;

        try {
            let dashboardId = targetDashboardId;

            if (targetDashboardId === 'new') {
                if (!newDashboardName) return alert("Enter dashboard name");
                const res: any = await dashboardService.create({ name: newDashboardName });
                dashboardId = res.id.toString();
            }

            if (!dashboardId) return;

            await dashboardService.addChart(parseInt(dashboardId), {
                name: chartName,
                chart_type: saveConfig.chartType,
                config: saveConfig
            });

            setShowSaveModal(false);
            alert("Chart saved to dashboard!");
        } catch (err) {
            console.error(err);
            alert("Failed to save chart");
        }
    };

    useEffect(() => {
        fetchPipelines();
    }, []);

    // Handle URL params for direct linking
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const idFromUrl = params.get('pipeline_id');
        if (idFromUrl) {
            setSelectedPipelineId(idFromUrl);
        }
    }, []);

    useEffect(() => {
        if (selectedPipelineId) {
            fetchPipelineDetails(parseInt(selectedPipelineId));
        } else {
            // Reset state when going back to list
            setSteps([]);
            setStepResults({});
            setStepError({});
        }
    }, [selectedPipelineId]);

    const fetchPipelines = async () => {
        try {
            const res: any = await pipelineService.listPipelines();
            setPipelines(res);
        } catch (err) {
            console.error("Failed to list pipelines", err);
        }
    };

    const fetchPipelineDetails = async (id: number) => {
        setLoading(true);
        setStepResults({});
        setStepError({});
        try {
            const data: any = await pipelineService.getPipeline(id);
            // Sort steps by order
            const sortedSteps = data.steps.sort((a: any, b: any) => a.order - b.order);
            setSteps(sortedSteps);

            // Auto-load data (Run Preview)
            loadPipelineData(id, sortedSteps);
        } catch (err) {
            console.error("Failed to load pipeline details", err);
        } finally {
            setLoading(false);
        }
    };

    const loadPipelineData = async (pipelineId: number, currentSteps: any[]) => {
        setRunning(true);
        const results: any = {};
        const errors: any = {};

        // Run 'testStep' for relevant steps (Extraction, Preprocessing, Prediction)
        const stepsToRun = currentSteps.filter(s =>
            ['extraction', 'preprocessing', 'prediction'].includes(s.step_type)
        );

        for (const step of stepsToRun) {
            try {
                const index = currentSteps.findIndex(s => s.id === step.id);
                if (index === -1) continue;

                const res: any = await pipelineService.testStep(pipelineId, step.order, step);

                // Sort Preprocessing desc per user request
                if (step.step_type === 'preprocessing' && res.data && Array.isArray(res.data)) {
                    const cols = Object.keys(res.data[0] || {});
                    const dateCol = cols.find(c => ['date', 'timestamp', 'dateissuedutc'].includes(c.toLowerCase()));
                    if (dateCol) {
                        res.data.sort((a: any, b: any) => new Date(b[dateCol]).getTime() - new Date(a[dateCol]).getTime());
                    }
                }

                results[index] = res;
            } catch (err: any) {
                console.error(`Failed to load data for step ${step.name}`, err);
                const index = currentSteps.findIndex(s => s.id === step.id);
                errors[index] = "Failed to load preview data";
            }
        }

        setStepResults(results);
        setStepError(errors);
        setRunning(false);
    };

    const handleBack = () => {
        setSelectedPipelineId(null);
        // Clear URL param without reloading
        const url = new URL(window.location.href);
        url.searchParams.delete('pipeline_id');
        window.history.pushState({}, '', url);
    };

    return (
        <div className="bg-gray-950 min-h-screen text-white flex flex-col font-sans">
            {/* Header */}
            <header className="h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-4">
                    {selectedPipelineId ? (
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                            title="Back to Pipelines"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    ) : (
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                            <LayoutDashboard size={20} />
                        </div>
                    )}

                    <div>
                        <h1 className="font-bold text-lg tracking-wide text-gray-100">
                            {selectedPipelineId
                                ? pipelines.find(p => p.id.toString() === selectedPipelineId)?.name || 'Pipeline Analytics'
                                : 'Analytics Dashboard'
                            }
                        </h1>
                        {selectedPipelineId && (
                            <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Live Preview
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {selectedPipelineId && (
                        <button
                            onClick={() => fetchPipelineDetails(parseInt(selectedPipelineId))}
                            disabled={running}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <RefreshCw size={14} className={running ? "animate-spin" : ""} />
                            Refresh Data
                        </button>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {!selectedPipelineId ? (
                    // Pipeline Selection Grid
                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-8 text-center sm:text-left">
                            <h2 className="text-3xl font-bold text-white mb-2">Select a Pipeline</h2>
                            <p className="text-gray-400">Choose a pipeline to view detailed analytics and performance metrics.</p>
                        </div>

                        {pipelines.length === 0 ? (
                            <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                                <Layers size={48} className="mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-500 text-lg">No pipelines found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pipelines.map(pipeline => (
                                    <div
                                        key={pipeline.id}
                                        onClick={() => setSelectedPipelineId(pipeline.id.toString())}
                                        className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-1 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <ArrowRight className="text-blue-400" />
                                        </div>

                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                                <Layers size={24} />
                                            </div>
                                            {pipeline.schedule_enabled && (
                                                <div className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20 flex items-center gap-1">
                                                    <Clock size={10} /> Scheduled
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                            {pipeline.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6 line-clamp-2">
                                            {pipeline.description || 'No description provided.'}
                                        </p>

                                        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-4 mt-auto">
                                            <div className="flex items-center gap-1">
                                                <Activity size={12} />
                                                <span>{pipeline.steps?.length || 0} Steps</span>
                                            </div>
                                            <span className="group-hover:translate-x-1 transition-transform duration-300 text-blue-400 font-medium">
                                                View Analytics
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // Dashboard View
                    <div className="h-full">
                        {loading ? (
                            <div className="flex h-full items-center justify-center text-gray-500 gap-3">
                                <RefreshCw className="animate-spin" /> Loading Pipeline Configuration...
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                {/* Pipeline Description Section */}
                                <div className="bg-gray-900 border-b border-gray-800 p-6">
                                    <div className="max-w-7xl mx-auto">
                                        <h2 className="text-xl font-bold text-white mb-2">
                                            {pipelines.find(p => p.id.toString() === selectedPipelineId)?.name}
                                        </h2>
                                        <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                                            {pipelines.find(p => p.id.toString() === selectedPipelineId)?.description || 'No description provided for this pipeline.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto bg-gray-950 p-6">
                                    <AnalyticsDashboard
                                        steps={steps}
                                        stepResults={stepResults}

                                        stepError={stepError}
                                        onSaveChart={handleSaveChart}
                                    />

                                    {/* Custom Analysis Sandbox */}
                                    <div className="mt-12 border-t border-gray-800 pt-8 no-print">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Custom Analysis Sandbox</h3>
                                                <p className="text-sm text-gray-500">Add custom charts below to explore data from different steps.</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-lg border border-gray-800">
                                                <select
                                                    className="bg-transparent text-sm text-gray-300 outline-none p-1"
                                                    value={selectedStepForSandbox}
                                                    onChange={e => setSelectedStepForSandbox(parseInt(e.target.value))}
                                                >
                                                    <option value={-1}>Select Step Data...</option>
                                                    {steps.map((s, idx) => (
                                                        <option key={s.id} value={idx}>{s.name} ({s.step_type})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={addSandboxChart}
                                                    disabled={selectedStepForSandbox === -1}
                                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            {sandboxCharts.map(chart => {
                                                const step = steps[chart.stepIndex];
                                                const res = stepResults[chart.stepIndex];
                                                const data = res?.data || (Array.isArray(res) ? res : []);

                                                return (
                                                    <div key={chart.id} className="relative group">
                                                        <div className="absolute -top-3 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => removeSandboxChart(chart.id)}
                                                                className="p-1.5 bg-red-900/80 text-red-400 rounded-full border border-red-800 hover:bg-red-900 hover:text-white"
                                                                title="Remove Chart"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        <AnalyticsEngine
                                                            data={data}
                                                            title={`Custom: ${step.name}`}
                                                            onSaveToDashboard={(cfg) => handleSaveChart(step.id, step.order, step.step_type, cfg)}
                                                        />
                                                    </div>
                                                );
                                            })}
                                            {sandboxCharts.length === 0 && (
                                                <div className="text-center py-10 bg-gray-900/30 rounded-xl border border-gray-800 border-dashed text-gray-600">
                                                    Select a step above to add a custom chart.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>


            {/* Save Modal */}
            {
                showSaveModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-96 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Save to Dashboard</h3>
                                <button onClick={() => setShowSaveModal(false)}><X size={20} className="text-gray-500 hover:text-white" /></button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Chart Name</label>
                                    <input
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={chartName}
                                        onChange={e => setChartName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Select Dashboard</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={targetDashboardId}
                                        onChange={e => setTargetDashboardId(e.target.value)}
                                    >
                                        {dashboards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        <option value="new">+ Create New Dashboard</option>
                                    </select>
                                </div>

                                {targetDashboardId === 'new' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-xs text-gray-400 mb-1">New Dashboard Name</label>
                                        <input
                                            autoFocus
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newDashboardName}
                                            onChange={e => setNewDashboardName(e.target.value)}
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={confirmSave}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium flex items-center justify-center gap-2 mt-2"
                                >
                                    <Save size={16} /> Save Chart
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default StandAloneAnalytics;
