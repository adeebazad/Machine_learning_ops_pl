import React, { useState, useEffect } from 'react';
import { pipelineService } from '../services/api';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { LayoutDashboard, RefreshCw, ChevronDown } from 'lucide-react';

const StandAloneAnalytics: React.FC = () => {
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [steps, setSteps] = useState<any[]>([]);
    const [stepResults, setStepResults] = useState<{ [key: number]: any }>({});
    const [stepError, setStepError] = useState<{ [key: number]: string }>({});
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        fetchPipelines();
    }, []);

    useEffect(() => {
        if (selectedPipelineId) {
            fetchPipelineDetails(parseInt(selectedPipelineId));
        }
    }, [selectedPipelineId]);

    const fetchPipelines = async () => {
        try {
            const res: any = await pipelineService.listPipelines();
            setPipelines(res);
            if (res.length > 0) {
                // Determine if we should auto-select based on URL param or just first one
                const params = new URLSearchParams(window.location.search);
                const idFromUrl = params.get('pipeline_id');
                setSelectedPipelineId(idFromUrl || res[0].id.toString());
            }
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
        // to populate the dashboard.
        const stepsToRun = currentSteps.filter(s =>
            ['extraction', 'preprocessing', 'prediction'].includes(s.step_type)
        );

        for (const step of stepsToRun) {
            try {
                // Find index in the main 'steps' array to match AnalyticsDashboard expectation
                const index = currentSteps.findIndex(s => s.id === step.id);
                if (index === -1) continue;

                const res: any = await pipelineService.testStep(pipelineId, step.order, step);

                // If this is Preprocessing, Sort Descending (Newest First) per user request
                if (step.step_type === 'preprocessing' && res.data && Array.isArray(res.data)) {
                    // Find date col
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

    return (
        <div className="bg-gray-950 min-h-screen text-white flex flex-col">
            {/* Separate Header */}
            <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                        <LayoutDashboard size={20} />
                    </div>
                    <h1 className="font-bold text-lg tracking-wide text-gray-100">Analytics Dashboard</h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Pipeline Selector */}
                    <div className="relative group">
                        <select
                            value={selectedPipelineId}
                            onChange={(e) => setSelectedPipelineId(e.target.value)}
                            className="appearance-none bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg pl-4 pr-10 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer min-w-[200px]"
                        >
                            {pipelines.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={() => selectedPipelineId && fetchPipelineDetails(parseInt(selectedPipelineId))}
                        disabled={running || !selectedPipelineId}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Reload Data"
                    >
                        <RefreshCw size={18} className={running ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>

            {/* Dashboard Content */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-gray-500 gap-3">
                        <RefreshCw className="animate-spin" /> Loading Pipeline Configuration...
                    </div>
                ) : (
                    <AnalyticsDashboard
                        steps={steps}
                        stepResults={stepResults}
                        stepError={stepError}
                    />
                )}
            </div>
        </div>
    );
};

export default StandAloneAnalytics;
