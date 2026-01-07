import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardService, pipelineService } from '../services/api';
import AnalyticsEngine from '../components/analytics/AnalyticsEngine';
import { FileText, Loader2 } from 'lucide-react';
import { toJpeg } from 'html-to-image';

const EmbedDashboard: React.FC = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [chartData, setChartData] = useState<{ [key: number]: any[] }>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [observationsMap, setObservationsMap] = useState<{ [key: string]: string }>({});
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        if (uuid) loadDashboard(uuid);
    }, [uuid]);

    const loadDashboard = async (id: string) => {
        try {
            const res: any = await dashboardService.getPublic(id);
            setDashboard(res);
            loadChartsData(res);
        } catch (err) {
            console.error("Failed to load dashboard", err);
            setError("Dashboard not found or referenced pipeline is inaccessible.");
            setLoading(false);
        }
    };

    const loadChartsData = async (dash: any) => {
        const dataMap: any = {};
        try {
            for (const chart of dash.charts) {
                if (chart.config?.pipeline_id && chart.config?.step_id) {
                    try {
                        const res: any = await pipelineService.testStep(
                            chart.config.pipeline_id,
                            chart.config.step_order || 999,
                            { id: chart.config.step_id }
                        );
                        if (res.data) dataMap[chart.id] = res.data;
                    } catch (e) {
                        console.error(`Failed to load data for chart ${chart.name}`, e);
                    }
                }
            }
            setChartData(dataMap);
        } catch (e) {
            console.error("Error loading chart data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        setIsGeneratingReport(true);
        try {
            // Capture chart images
            const chartDataPromises = dashboard?.charts?.map(async (chart: any) => {
                let image = "";
                try {
                    const element = document.getElementById(`chart-container-${chart.id}`);
                    if (element) {
                        try {
                            const { clientWidth, clientHeight } = element;
                            // Use toJpeg with compression to avoid 413 Request Entity Too Large
                            image = await toJpeg(element, {
                                backgroundColor: '#111827',
                                canvasWidth: clientWidth,
                                canvasHeight: clientHeight,
                                pixelRatio: 1.5, // Reduced from 2
                                quality: 0.8,    // 80% quality
                                cacheBust: true,
                            });
                            console.log(`Captured chart ${chart.id}: ${image.length} chars (JPEG)`);
                        } catch (innerErr) {
                            console.warn(`Retry capture for chart ${chart.id}`, innerErr);
                        }
                    }
                } catch (imgErr) {
                    console.warn(`Failed to capture image for chart ${chart.id}`, imgErr);
                }

                return {
                    title: chart.name,
                    type: chart.config?.chartType || "custom",
                    observations: observationsMap[chart.id] || "No observations added.",
                    image: image,
                    data_snapshot: (() => {
                        const rawData = chartData[chart.id];
                        if (!rawData || rawData.length === 0) return [];

                        // Select only visible columns (X-Axis + Y-Axes) to ensure table fits on PDF
                        // User can control this by modifying the chart configuration
                        const visibleCols = new Set<string>();
                        if (chart.config?.xAxisCol) visibleCols.add(chart.config.xAxisCol);
                        if (chart.config?.yAxisCols) chart.config.yAxisCols.forEach((c: string) => visibleCols.add(c));

                        // Always include specific critical columns if they exist (Prediction, Date)
                        // But limit total columns to ~6-8 max for layout safety
                        const safeCols = Array.from(visibleCols).slice(0, 8);

                        return rawData.slice(0, 50).map((row: any) => {
                            const newRow: any = {};
                            safeCols.forEach(k => {
                                if (row[k] !== undefined) {
                                    let val = row[k];
                                    // Auto-format dates for PDF readability
                                    if (/date|time|timestamp|utc/i.test(k)) {
                                        const d = new Date(val);
                                        if (!isNaN(d.getTime())) {
                                            // Format: YYYY-MM-DD HH:mm
                                            val = d.toISOString().replace('T', ' ').substring(0, 16);
                                        }
                                    }
                                    newRow[k] = val;
                                }
                            });
                            return newRow;
                        });
                    })()
                };
            }) || [];

            const reportCharts = await Promise.all(chartDataPromises);

            const payload = {
                title: dashboard?.name || "Dashboard Report",
                description: dashboard?.description || `Generated on ${new Date().toLocaleString()}`,
                metrics: [],
                observations: "Consolidated report for " + (dashboard?.name || "dashboard"),
                charts: reportCharts
            };

            const response = await fetch('/api/report/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to generate PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(dashboard?.name || "Report").replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error("Report generation failed:", error);
            alert("Failed to download report.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Dashboard...</div>;
    if (error) return <div className="flex h-screen items-center justify-center bg-gray-900 text-red-400">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans p-6 overflow-auto">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{dashboard?.name}</h1>
                    <p className="text-gray-400">{dashboard?.description}</p>
                </div>
                <button
                    onClick={handleDownloadReport}
                    disabled={isGeneratingReport}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white border border-transparent rounded-xl font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGeneratingReport ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                    {isGeneratingReport ? 'Generating...' : 'Download Report'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {dashboard?.charts?.map((chart: any) => (
                    <div
                        key={chart.id}
                        id={`chart-container-${chart.id}`}
                        className="h-[750px] border border-gray-800 rounded-xl overflow-hidden flex flex-col bg-gray-900 shadow-xl print-chart-block"
                    >
                        {chartData[chart.id] ? (
                            <AnalyticsEngine
                                data={chartData[chart.id]}
                                title={chart.name}
                                readOnly={false}
                                defaultSettingsOpen={false}
                                config={chart.config}
                                onObservationChange={(val) => setObservationsMap(prev => ({ ...prev, [chart.id]: val }))}
                                variant="premium"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">Loading Chart...</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmbedDashboard;
