import React, { useState, useEffect } from 'react';
import { dashboardService, pipelineService } from '../services/api';
import AnalyticsEngine from '../components/analytics/AnalyticsEngine';
import { Plus, LayoutDashboard, Trash2, Share2 } from 'lucide-react';


const DashboardBuilder: React.FC = () => {
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
        if (selectedDashboard) {
            loadDashboardCharts(selectedDashboard.id);
        }
    }, [selectedDashboard]);

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
            // First refresh dashboard details to get latest charts
            const dashboard: any = await dashboardService.get(id);
            setSelectedDashboard(dashboard);

            const dataMap: any = {};
            // Fetch data for each chart
            for (const chart of dashboard.charts) {
                if (chart.config?.pipeline_id && chart.config?.step_id) {
                    try {
                        const res: any = await pipelineService.testStep(
                            chart.config.pipeline_id,
                            chart.config.step_order || 999, // Fallback if order not saved, assume prediction/latet
                            { id: chart.config.step_id } // Override step if needed
                        );
                        // Also handle order if we simply saved the step reference.
                        // Actually, testStep needs (pipelineId, order, stepDef). 
                        // If we saved pipeline_id and step_order, we can use that.

                        // FIX: Logic depends on how we saved it. 
                        // In StandAloneAnalytics, we'll save: pipeline_id, step_id, step_order.

                        if (res.data) {
                            // Sort if Preprocessing (copied logic)
                            if (chart.config.step_type === 'preprocessing' && Array.isArray(res.data)) {
                                const cols = Object.keys(res.data[0] || {});
                                const dateCol = cols.find(c => ['date', 'timestamp', 'dateissuedutc'].includes(c.toLowerCase()));
                                if (dateCol) {
                                    res.data.sort((a: any, b: any) => new Date(b[dateCol]).getTime() - new Date(a[dateCol]).getTime());
                                }
                            }
                            dataMap[chart.id] = res.data;
                        }
                    } catch (e) {
                        console.error(`Failed to load data for chart ${chart.name}`, e);
                    }
                }
            }
            setChartData(dataMap);
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

    const handleShare = () => {
        if (!selectedDashboard) return;
        const url = `${window.location.origin}/shared/dashboard/${selectedDashboard.uuid}`;
        navigator.clipboard.writeText(url);
        alert("Dashboard URL copied to clipboard!");
    };

    return (
        <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
            {/* Sidebar List */}
            <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <LayoutDashboard size={20} className="text-blue-500" /> Dashboards
                    </h2>
                    <button onClick={() => setShowCreateModal(true)} className="p-1 hover:bg-gray-800 rounded text-blue-400">
                        <Plus size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {dashboards.map(d => (
                        <div
                            key={d.id}
                            onClick={() => { setSelectedDashboard(d); setChartData({}); }}
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
                                <p className="text-xs text-gray-500">{selectedDashboard.description}</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={loadDashboards} // Just trigger a re-fetch of list if needed? Or re-fetch charts
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

                        <div className="flex-1 overflow-auto p-6">
                            {loading ? (
                                <div className="text-center py-20 text-gray-500 animate-pulse">Loading Charts...</div>
                            ) : selectedDashboard.charts?.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                                    <p className="text-gray-500 mb-2">This dashboard is empty.</p>
                                    <p className="text-sm text-gray-600">Go to "Analytics" to explore data and add charts here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {selectedDashboard.charts?.map((chart: any) => (
                                        <div key={chart.id} className="h-[500px] border border-gray-800 rounded-xl overflow-hidden flex flex-col bg-gray-900 relative group">
                                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => deleteChart(chart.id)}
                                                    className="p-2 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-200 rounded-lg backdrop-blur shadow-lg border border-gray-700"
                                                    title="Remove Chart"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {/* Reuse Analytics Engine in Read-Only Mode */}
                                            {chartData[chart.id] ? (
                                                <AnalyticsEngine
                                                    data={chartData[chart.id]}
                                                    title={chart.name}
                                                    readOnly={true}
                                                    config={chart.config}
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
