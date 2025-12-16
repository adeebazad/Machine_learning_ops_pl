import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService, pipelineService } from '../services/api';
import AnalyticsEngine from '../components/analytics/AnalyticsEngine';
import { Plus, LayoutDashboard, Trash2, Share2, Edit2 } from 'lucide-react';


const DashboardBuilder: React.FC = () => {
    const navigate = useNavigate();
    const [dashboards, setDashboards] = useState<any[]>([]);
    const [selectedDashboard, setSelectedDashboard] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<{ [key: number]: any[] }>({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [newDashboardDesc, setNewDashboardDesc] = useState('');

    useEffect(() => {
        loadDashboards();
    }, []);

    useEffect(() => {
        if (selectedDashboard?.id) {
            loadDashboardCharts(selectedDashboard.id);
        }
    }, [selectedDashboard?.id]);

    const loadDashboards = async () => {
        try {
            const res: any = await dashboardService.list();
            setDashboards(res);
        } catch (err) {
            console.error("Failed to list dashboards", err);
        }
    };

    const createDashboard = async () => {
        if (!newDashboardName) return;
        try {
            const res = await dashboardService.create({ name: newDashboardName, description: newDashboardDesc });
            setDashboards([...dashboards, res]);
            setShowCreateModal(false);
            setNewDashboardName('');
            setNewDashboardDesc('');
        } catch (err) {
            console.error("Failed to create dashboard", err);
        }
    };

    const deleteDashboard = async (id: number) => {
        if (!confirm("Are you sure you want to delete this dashboard?")) return;
        try {
            await dashboardService.delete(id);
            setDashboards(dashboards.filter(d => d.id !== id));
            if (selectedDashboard?.id === id) setSelectedDashboard(null);
        } catch (err) {
            console.error("Failed to delete dashboard", err);
        }
    };

    const loadDashboardCharts = async (id: number) => {
        setLoading(true);
        try {
            // Refetch dashboard to ensure we have latest charts config
            // NOTE: We only update selectedDashboard if charts list size changed or force refresh
            // But for now, let's trust the ID check prevents render loop.
            const dashboard: any = await dashboardService.get(id);
            // Updating this causes re-render, but effect won't fire if ID is same.

            // Parallel Fetch
            const chartPromises = (dashboard.charts || []).map(async (chart: any) => {
                // 1. Try to load from Snapshot (Config)
                if (chart.config?.snapshotData) {
                    return { id: chart.id, data: chart.config.snapshotData };
                }

                // 2. Legacy: Fetch from Pipeline if no snapshot
                if (chart.config?.pipeline_id && chart.config?.step_id) {
                    try {
                        const res: any = await pipelineService.testStep(
                            chart.config.pipeline_id,
                            chart.config.step_order || 999,
                            { id: chart.config.step_id }
                        );

                        if (res.data) {
                            // Sort logic
                            if (chart.config.step_type === 'preprocessing' && Array.isArray(res.data)) {
                                const cols = Object.keys(res.data[0] || {});
                                const dateCol = cols.find(c => ['date', 'timestamp', 'dateissuedutc'].includes(c.toLowerCase()));
                                if (dateCol) {
                                    res.data.sort((a: any, b: any) => new Date(b[dateCol]).getTime() - new Date(a[dateCol]).getTime());
                                }
                            }
                            return { id: chart.id, data: res.data };
                        }
                    } catch (e) {
                        console.error(`Failed to load data for chart ${chart.name}`, e);
                        return { id: chart.id, error: "Unable to load data" };
                    }
                }
                return null;
            });

            const results = await Promise.all(chartPromises);
            const newDataMap: any = {};
            results.forEach((res: any) => {
                if (res) {
                    if (res.error) {
                        newDataMap[res.id] = { error: res.error }; // Store error
                    } else {
                        newDataMap[res.id] = res.data;
                    }
                }
            });

            setChartData(newDataMap);
            setSelectedDashboard(dashboard); // Update with latest config
        } catch (err) {
            console.error("Failed to load dashboard details", err);
        } finally {
            setLoading(false);
        }
    };

    const deleteChart = async (chartId: number) => {
        if (!selectedDashboard) return;
        if (!confirm("Delete this chart?")) return;
        try {
            await dashboardService.deleteChart(selectedDashboard.id, chartId);
            // Reload
            loadDashboardCharts(selectedDashboard.id);
        } catch (err) {
            console.error("Failed to delete chart", err);
        }
    };

    const [showShareModal, setShowShareModal] = useState(false);

    const handleShare = () => {
        if (!selectedDashboard) return;
        setShowShareModal(true);
    };

    // ... inside return ...
    // Replaced the alert logic with modal trigger

    const updateDashboardDescription = async (desc: string) => {
        if (!selectedDashboard) return;
        try {
            await dashboardService.update(selectedDashboard.id, { description: desc });
            setSelectedDashboard({ ...selectedDashboard, description: desc });
        } catch (e) {
            console.error("Failed to update description", e);
        }
    };

    const handleUpdateChart = async (chartId: number, config: any) => {
        if (!selectedDashboard) return;
        try {
            await dashboardService.updateChart(selectedDashboard.id, chartId, { config });
            loadDashboardCharts(selectedDashboard.id);
            alert("Chart updated successfully!");
        } catch (e) {
            console.error("Failed to update chart", e);
            alert("Failed to update chart.");
        }
    };

    const [isEditingSummary, setIsEditingSummary] = useState(false);
    const [summaryText, setSummaryText] = useState('');

    useEffect(() => {
        if (selectedDashboard) setSummaryText(selectedDashboard.description || '');
    }, [selectedDashboard]);

    // ...

    return (
        <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
            {/* Sidebar List */}
            <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <LayoutDashboard size={20} className="text-blue-500" /> Dashboards
                        </h2>
                        <button onClick={() => setShowCreateModal(true)} className="p-1 hover:bg-gray-800 rounded text-blue-400">
                            <Plus size={20} />
                        </button>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard/analytics')}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> New Analysis
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {dashboards.map(d => (
                        <div
                            key={d.id}
                            onClick={() => {
                                if (selectedDashboard?.id === d.id) {
                                    setChartData({});
                                    loadDashboardCharts(d.id);
                                } else {
                                    setSelectedDashboard(d);
                                    setChartData({});
                                }
                            }}
                            className={`p-3 rounded-lg cursor-pointer flex justify-between group transition-colors ${selectedDashboard?.id === d.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-gray-800 text-gray-400'}`}
                        >
                            <span className="truncate">{d.name}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteDashboard(d.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedDashboard ? (
                    <>
                        <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-bold">{selectedDashboard.name}</h1>
                                {/* Executive Summary / Description */}
                                <div className="mt-1">
                                    {isEditingSummary ? (
                                        <div className="flex items-start gap-2">
                                            <textarea
                                                className="bg-gray-800 border-gray-700 text-xs w-[400px] rounded p-2 outline-none h-16"
                                                value={summaryText}
                                                onChange={e => setSummaryText(e.target.value)}
                                                placeholder="Enter Executive Summary..."
                                            />
                                            <div className="flex flex-col gap-1">
                                                <button onClick={() => { updateDashboardDescription(summaryText); setIsEditingSummary(false); }} className="px-2 py-1 bg-green-600 text-[10px] rounded hover:bg-green-500">Save</button>
                                                <button onClick={() => setIsEditingSummary(false)} className="px-2 py-1 bg-gray-700 text-[10px] rounded hover:bg-gray-600">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p
                                            className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer flex items-center gap-2 group print-visible"
                                            onClick={() => { setSummaryText(selectedDashboard.description || ''); setIsEditingSummary(true); }}
                                        >
                                            {selectedDashboard.description || "Add Executive Summary..."}
                                            <span className="opacity-0 group-hover:opacity-100"><Edit2 size={10} /></span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => loadDashboardCharts(selectedDashboard.id)}
                                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                                >
                                    Refresh
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Share2 size={16} /> Share
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-auto p-6 scroll-smooth print-area">
                            {/* Print Only Header */}
                            <div className="print-only mb-8 pb-6 border-b border-gray-200">
                                <h1 className="text-4xl font-bold text-black mb-4">{selectedDashboard.name}</h1>
                                <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                    <h2 className="text-lg font-bold mb-2 uppercase tracking-wider text-gray-600">Executive Summary</h2>
                                    {selectedDashboard.description || "No summary provided."}
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center py-20 text-gray-500 animate-pulse">Loading Charts...</div>
                            ) : selectedDashboard.charts?.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                                    <p className="text-gray-500 mb-2">This dashboard is empty.</p>
                                    <p className="text-sm text-gray-600">Go to "Analytics" to explore data and add charts here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 print-stack">
                                    {selectedDashboard.charts?.map((chart: any) => (
                                        <div key={chart.id} className="min-h-[800px] border border-gray-800 rounded-xl overflow-hidden flex flex-col bg-gray-900 relative group print-chart-block">
                                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                <button
                                                    onClick={() => deleteChart(chart.id)}
                                                    className="p-2 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-200 rounded-lg backdrop-blur shadow-lg border border-gray-700"
                                                    title="Remove Chart"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {/* Analytics Engine with Update Capability */}
                                            {chartData[chart.id] && (chartData[chart.id] as any).error ? (
                                                <div className="flex flex-col items-center justify-center h-full text-red-400 bg-red-900/10 gap-2">
                                                    <span className="font-bold">Error Loading Chart</span>
                                                    <span className="text-xs text-red-500/70">Source data may be missing</span>
                                                </div>
                                            ) : chartData[chart.id] ? (
                                                <AnalyticsEngine
                                                    data={chartData[chart.id]}
                                                    title={chart.name}
                                                    readOnly={false} // Enable interactions
                                                    config={chart.config}
                                                    onSaveToDashboard={(newConfig) => handleUpdateChart(chart.id, newConfig)} // Handle Update
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                                    Loading Chart Data...
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Select a dashboard to view
                    </div>
                )}
            </div>

            {/* Share / Embed Modal */}
            {showShareModal && selectedDashboard && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-[500px] shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Share2 size={20} className="text-blue-500" /> Share Dashboard
                            </h3>
                            <button onClick={() => setShowShareModal(false)} className="text-gray-500 hover:text-white">
                                <Trash2 size={20} className="rotate-45" /> {/* Using Trash2 as close icon temporarily or imports? Better to use X if available or just close logic */}
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Dashboard UUID</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm font-mono text-blue-400">
                                        {selectedDashboard.uuid}
                                    </code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(selectedDashboard.uuid)}
                                        className="px-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Public Link</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 outline-none"
                                        value={`${window.location.origin}/shared/dashboard/${selectedDashboard.uuid}`}
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/shared/dashboard/${selectedDashboard.uuid}`)}
                                        className="px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Embed Code (Iframe)</label>
                                <div className="relative">
                                    <textarea
                                        readOnly
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-400 h-24 resize-none outline-none"
                                        value={`<iframe src="${window.location.origin}/shared/dashboard/${selectedDashboard.uuid}" width="100%" height="800" frameborder="0"></iframe>`}
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(`<iframe src="${window.location.origin}/shared/dashboard/${selectedDashboard.uuid}" width="100%" height="800" frameborder="0"></iframe>`)}
                                        className="absolute top-2 right-2 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-medium transition-colors"
                                    >
                                        Copy Code
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-96 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4">Create Dashboard</h3>
                        <input
                            autoFocus
                            placeholder="Dashboard Name"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 mb-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newDashboardName}
                            onChange={e => setNewDashboardName(e.target.value)}
                        />
                        <textarea
                            placeholder="Description (Optional)"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 mb-4 text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            value={newDashboardDesc}
                            onChange={e => setNewDashboardDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createDashboard}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardBuilder;
