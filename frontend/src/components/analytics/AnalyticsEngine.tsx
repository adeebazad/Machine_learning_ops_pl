import React, { useState, useMemo, useEffect } from 'react';
import ChartRenderer from './ChartRenderer';
import Toolbar from './Toolbar';
import { Settings, X, Plus, ChevronDown, BarChart2, LayoutDashboard, ChevronLeft, ChevronRight, Calendar, Clock, Sparkles, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculatePearson } from '../../utils/statistics';
import Plot from 'react-plotly.js';
import { getPearlApiUrl } from '../../config';

interface AnalyticsEngineProps {
    data: any[];
    title?: string;
    readOnly?: boolean;
    onSaveToDashboard?: (config: any) => void;
    config?: any;
    isDashboardItem?: boolean; // New prop to prevent print overlap
    onDelete?: () => void; // Add onDelete prop for dashboard deletion integration
    onObservationChange?: (val: string) => void;
    variant?: 'default' | 'premium';
    defaultSettingsOpen?: boolean;
}

type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut' | 'radar' | 'composed' | 'heatmap';

const AnalyticsEngine: React.FC<AnalyticsEngineProps> = ({ data, title, readOnly = false, onSaveToDashboard, config, isDashboardItem = false, onDelete, onObservationChange, variant = 'default', defaultSettingsOpen }) => {
    // ---- State ----
    const [chartType, setChartType] = useState<ChartType>('line');
    const [xAxisCol, setXAxisCol] = useState<string>('');
    const [yAxisCols, setYAxisCols] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState(defaultSettingsOpen ?? !readOnly);
    const [showTrendline, setShowTrendline] = useState(false);
    const [annotationMode, setAnnotationMode] = useState(false);
    const [filters, setFilters] = useState<{ col: string, val: string }[]>([]);

    // Date Range Filter & Time Grain
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [timeGrain, setTimeGrain] = useState<'raw' | 'hour' | 'day' | 'week' | 'month'>('raw');

    // Correlation Mode State
    const [correlationMode, setCorrelationMode] = useState(false);
    const [corrBaseCol, setCorrBaseCol] = useState<string>('');
    const [corrTargetCols, setCorrTargetCols] = useState<string[]>([]);
    const [groupByCol, setGroupByCol] = useState<string>('');

    // Set default date range (Last Month)
    useEffect(() => {
        if (data.length > 0 && xAxisCol && /date|time|timestamp/i.test(xAxisCol)) {
            // Find max date
            const dates = data.map(d => new Date(d[xAxisCol]).getTime()).filter(t => !isNaN(t));
            if (dates.length > 0) {
                const maxDate = new Date(Math.max(...dates));

                // AUTO-EXTEND Logic for Dashboard:
                // If we have a saved config with a date range, BUT the new data goes significantly beyond it,
                // we assume the user wants to see the new data (Live View).
                if (config && config.dateRange && isDashboardItem) {
                    const savedEnd = new Date(config.dateRange.end).getTime();
                    // If new data is newer than saved end date (by at least 1 minute to avoid jitter)
                    if (maxDate.getTime() > savedEnd + 60000) {
                        // Keep the saved start date, but update end date to new max
                        setDateRange({
                            start: config.dateRange.start, // Respect saved start
                            end: maxDate.toISOString().split('T')[0] // Auto-extend end
                        });
                        return;
                    }
                }

                if (config && config.dateRange) return; // Respect saved config if no extension needed

                // Default "Last Month" logic for new charts
                const minDate = new Date(maxDate);
                minDate.setMonth(minDate.getMonth() - 1);

                setDateRange({
                    start: minDate.toISOString().split('T')[0],
                    end: maxDate.toISOString().split('T')[0]
                });
            }
        }
    }, [data, xAxisCol, config, isDashboardItem]);

    // Hydrate from config
    useEffect(() => {
        if (config) {
            if (config.chartType) setChartType(config.chartType);
            if (config.xAxisCol) setXAxisCol(config.xAxisCol);
            if (config.yAxisCols) setYAxisCols(config.yAxisCols);
            if (config.filters) setFilters(config.filters);
            if (config.showTrendline !== undefined) setShowTrendline(config.showTrendline);
            if (config.annotationMode !== undefined) setAnnotationMode(config.annotationMode);
            // Hydrate new fields
            if (config.dateRange) setDateRange(config.dateRange);
            if (config.timeGrain) setTimeGrain(config.timeGrain);
            // Correlation Hydration
            if (config.correlationMode) setCorrelationMode(config.correlationMode);
            if (config.corrBaseCol) setCorrBaseCol(config.corrBaseCol);
            if (config.corrTargetCols) setCorrTargetCols(config.corrTargetCols);
            if (config.groupByCol) setGroupByCol(config.groupByCol);
        }
    }, [config]);

    // Pagination
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // ---- Data Analysis (Columns) ----
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Robust Key Extraction: Scan first 50 rows to find all available keys
        // (Solves issue where optional fields like 'address' are missing in the first row)
        const keys = new Set<string>();
        data.slice(0, 50).forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys);
    }, [data]);

    const numericCols = useMemo(() => {
        if (!data || data.length === 0) return [];
        return columns.filter(c => {
            // Check first 100 rows to find if it holds numeric data (handling nulls)
            // AND ensure it is NOT a date/time column (timestamps look like numbers but shouldn't be summed)
            const isNumber = data.slice(0, 100).some(row => typeof row[c] === 'number');
            const isDate = /date|time|timestamp|utc/i.test(c);
            return isNumber && !isDate;
        });
    }, [data, columns]);

    const categoricalCols = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Treat anything not strictly number as categorical (dates are strings in JSON)
        return columns;
    }, [data, columns]);

    // Auto-select defaults
    useEffect(() => {
        if (config) return; // BLOCK DEFAULTS if config exists (hydration handles it)

        if (xAxisCol === '' && columns.length > 0) {
            // Prefer date/time
            const dateCol = columns.find(c => /date|time|timestamp|utc/i.test(c));
            setXAxisCol(dateCol || columns[0]);
        }
        if (yAxisCols.length === 0 && numericCols.length > 0) {
            // Select first numeric that isn't the x-axis or 'id'
            const target = numericCols.find(c => c !== xAxisCol && !/id|index/i.test(c));
            setYAxisCols([target || numericCols[0]]);
        }
    }, [columns, numericCols, xAxisCol, yAxisCols, config]);


    // ---- Processed Data ----
    const processedData = useMemo(() => {
        let res = [...data];
        // Apply filters
        filters.forEach(f => {
            if (!f.col || f.val === '') return;
            res = res.filter(row => {
                const cv = String(row[f.col]).toLowerCase();
                return cv.includes(f.val.toLowerCase());
            });
        });
        // Apply Date Range
        if (xAxisCol && (dateRange.start || dateRange.end) && /date|time|timestamp/i.test(xAxisCol)) {
            const start = dateRange.start ? new Date(dateRange.start).getTime() : -Infinity;
            const end = dateRange.end ? new Date(dateRange.end).getTime() + 86400000 : Infinity; // Include end date

            res = res.filter(row => {
                const d = new Date(row[xAxisCol]).getTime();
                return !isNaN(d) && d >= start && d < end;
            });
        }


        // Time Grain Aggregation (only if datetime axis)
        if (xAxisCol && /date|time|timestamp|utc/i.test(xAxisCol) && timeGrain !== 'raw') {
            const grouped: { [key: string]: any } = {};
            const counts: { [key: string]: { [col: string]: number } } = {};

            res.forEach(row => {
                const d = new Date(row[xAxisCol]);
                if (isNaN(d.getTime())) return;

                let key = '';
                // CRITICAL FIX: Append 'Z' to treat these as UTC ISO strings. 
                // Otherwise 'YYYY-MM-DDTHH:00:00' is parsed as Local Time, shifting data by Timezone offset.
                if (timeGrain === 'hour') key = d.toISOString().substring(0, 13) + ':00:00Z';
                else if (timeGrain === 'day') key = d.toISOString().substring(0, 10) + 'T00:00:00Z';
                else if (timeGrain === 'month') key = d.toISOString().substring(0, 7) + '-01T00:00:00Z'; // standardize month
                else if (timeGrain === 'week') {
                    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(d.setDate(diff));
                    key = monday.toISOString().substring(0, 10) + 'T00:00:00Z';
                }

                if (!grouped[key]) {
                    grouped[key] = { [xAxisCol]: key };
                    counts[key] = {};
                    yAxisCols.forEach(c => {
                        grouped[key][c] = 0; // Temp Sum
                        counts[key][c] = 0;
                    });
                }

                yAxisCols.forEach(c => {
                    const rawVal = row[c];
                    // STRICT CHECK: Ignore null, undefined, empty string to avoid dragging down average
                    if (rawVal === null || rawVal === undefined || rawVal === '') return;

                    const val = Number(rawVal);
                    // Treat 0 as missing data (sensor dropout) to prevent skewing average
                    if (!isNaN(val) && val !== 0) {
                        grouped[key][c] += val;
                        counts[key][c]++;
                    }
                });
            });

            // Average using per-column counts
            res = Object.keys(grouped).map(key => {
                const row = grouped[key];
                yAxisCols.forEach(c => {
                    const count = counts[key][c];
                    if (count > 0) {
                        row[c] = row[c] / count;
                        // Precision fix
                        row[c] = Math.round(row[c] * 1000) / 1000;
                    } else {
                        row[c] = null; // Don't return 0 for missing data
                    }
                });
                return row;
            }).sort((a, b) => a[xAxisCol].localeCompare(b[xAxisCol]));
        }

        // Pie/Donut Aggregation (Group by Category, Sum Value)
        if ((chartType === 'pie' || chartType === 'donut') && xAxisCol) {
            const grouped: { [key: string]: any } = {};
            const valCol = yAxisCols[0]; // Primary value

            res.forEach(row => {
                const key = String(row[xAxisCol]);
                if (!grouped[key]) grouped[key] = { [xAxisCol]: key, [valCol]: 0, count: 0 };

                if (valCol) {
                    const val = Number(row[valCol]);
                    if (!isNaN(val)) grouped[key][valCol] += val;
                    grouped[key].count++;
                } else {
                    grouped[key].count++; // Just count occurrences if no value col
                }
            });

            res = Object.values(grouped).map((r: any) => valCol ? r : ({ ...r, [valCol || 'count']: r.count }));
            // Pie needs to define the value key if not present
            if (!valCol && yAxisCols.length === 0) setYAxisCols(['count']);
        }

        return res;
    }, [data, filters, dateRange, xAxisCol, timeGrain, chartType, yAxisCols]);

    // ---- Correlation Analysis ----
    const correlationResults = useMemo(() => {
        if (!correlationMode || !corrBaseCol || corrTargetCols.length === 0 || !processedData.length) return [];

        const calculateForData = (subset: any[]) => {
            const baseValues = subset.map(d => Number(d[corrBaseCol]));
            const results: any = {};
            corrTargetCols.forEach(target => {
                const targetValues = subset.map(d => Number(d[target]));
                results[target] = calculatePearson(baseValues, targetValues);
            });
            return results;
        };

        if (groupByCol) {
            // Group By Analysis (e.g., Correlation per Location)
            const groups: { [key: string]: any[] } = {};
            processedData.forEach(row => {
                let rawKey = row[groupByCol];
                // Handle null/undefined/empty string
                let key = (rawKey === null || rawKey === undefined || rawKey === '') ? 'Unknown' : String(rawKey);

                // Auto-format Date/Timestamp columns to be human readable
                if (/date|time|timestamp|utc/i.test(groupByCol)) {
                    const d = new Date(rawKey);
                    if (!isNaN(d.getTime())) {
                        // Format: YYYY-MM-DD HH:mm (Readable & Sortable)
                        key = d.toISOString().replace('T', ' ').substring(0, 16);
                    }
                }

                if (!groups[key]) groups[key] = [];
                groups[key].push(row);
            });

            return Object.keys(groups).map(groupKey => {
                const scores = calculateForData(groups[groupKey]);
                return { name: groupKey, ...scores };
            });
        } else {
            // Global Analysis
            const scores = calculateForData(processedData);
            return Object.keys(scores).map(feature => ({
                name: feature,
                value: scores[feature]
            }));
        }
    }, [processedData, correlationMode, corrBaseCol, corrTargetCols, groupByCol]);

    // Dynamic Columns for Table (based on processed/aggregated data)
    const displayColumns = useMemo(() => {
        if (!processedData || processedData.length === 0) return [];
        // Robust Key Extraction for Table Headers
        const keys = new Set<string>();
        processedData.slice(0, 50).forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys);
    }, [processedData]);


    // ---- Handlers ----
    const handleExportExcel = () => {
        if (!processedData.length) return;
        const ws = XLSX.utils.json_to_sheet(processedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Analytics Data");
        XLSX.writeFile(wb, `analytics_export_${Date.now()}.xlsx`);
    };

    const [observations, setObservations] = useState(config?.observations || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [printMode, setPrintMode] = useState(false);

    const handleGenerateAnalysis = async () => {
        if (!processedData.length) return;
        setIsAnalyzing(true);
        setObservations(''); // Clear previous

        try {
            // Context strategy: Send summarized data to avoid token limits
            // Take first 5 and last 5 rows to show range, plus some aggregate stats if possible
            const snippet = processedData.length > 20
                ? [...processedData.slice(0, 5), ...processedData.slice(-5)]
                : processedData;

            const query = `
                You are an AI Data Analyst. Analyze the following dataset (snippet) representing ${title || 'data'}.
                Columns: ${yAxisCols.join(', ')} over ${xAxisCol}.
                
                Data Snippet: ${JSON.stringify(snippet)}

                Identify key trends, anomalies, or insights. Keep it professional, concise (under 80 words), and bulleted.
            `;

            const payload = {
                query: query.trim(),
                stream: false
            };

            const response = await fetch(getPearlApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to fetch analysis');

            const resData = await response.json();
            const analysis = resData.response || "No insights generated.";
            setObservations(analysis);
            if (onObservationChange) onObservationChange(analysis);

        } catch (error) {
            console.error("AI Analysis failed:", error);
            setObservations("Error: Unable to generate analysis. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        if (config?.observations) setObservations(config.observations);
    }, [config]);

    // Handle Global Browser Print (Ctrl+P)
    useEffect(() => {
        const handleBeforePrint = () => setPrintMode(true);
        const handleAfterPrint = () => setPrintMode(false);

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    const handlePrint = () => {
        setPrintMode(true);
        // Small timeout to allow state update before print dialog
        setTimeout(() => {
            window.print();
            // We rely on afterprint to reset, but explicitly resetting here is also safe
        }, 500);
    };

    const toggleYAxis = (col: string) => {
        setYAxisCols(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        );
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-800">
                <BarChart2 size={48} className="mb-4 opacity-20" />
                <p>No Data Available for Analysis</p>
            </div>
        );
    }

    // Prepare Plotly Configuration for Correlation
    const renderPlotlyCorrelation = () => {
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)'; // Transparent
        const textColor = isDark ? '#e2e8f0' : '#1e293b';

        // 1. Heatmap Mode (when correlating multiple targets against a base, or grouped)
        if (groupByCol || corrTargetCols.length > 1) {
            // If grouped, we have {name: Group, target1: val, target2: val}
            // Z needs to be a matrix of values
            // X axis: Targets
            // Y axis: Groups (or just 'Global' if not grouped)

            let xLabels = corrTargetCols;
            let yLabels: string[] = [];
            let zValues: number[][] = [];

            if (groupByCol) {
                // correlationResults is array of objects {name: groupKey, target1: score...}
                correlationResults.forEach((res: any) => {
                    yLabels.push(res.name);
                    const row: number[] = [];
                    xLabels.forEach(t => row.push(res[t] || 0));
                    zValues.push(row);
                });
            } else {
                // Global Analysis: correlationResults is [{name: target1, value: score}, ...]
                // This structure from useMemo above is a bit different for global vs grouped. 
                // Let's re-read useMemo for global:
                // return Object.keys(scores).map(feature => ({ name: feature, value: scores[feature] }));

                // For global heatmap, it's just 1 row (Global) vs Targets
                yLabels = ['Global'];
                const row: number[] = [];
                // correlationResults has ALL scores, but we only want corrTargetCols
                // Wait, the hook returns array of {name, value}.
                // Let's map it back
                const scoreMap: any = {};
                correlationResults.forEach((r: any) => scoreMap[r.name] = r.value);

                xLabels.forEach(t => row.push(scoreMap[t] || 0));
                zValues.push(row);
            }

            return (
                <Plot
                    data={[{
                        z: zValues,
                        x: xLabels,
                        y: yLabels,
                        type: 'heatmap',
                        colorscale: 'RdBu',
                        zmin: -1,
                        zmax: 1,
                        colorbar: { title: { text: 'Pearson Coeff' } }
                    }]}
                    layout={{
                        width: undefined, // Responsive
                        height: 500,
                        title: { text: `Correlation Heatmap (${corrBaseCol})` },
                        paper_bgcolor: bgColor,
                        plot_bgcolor: bgColor,
                        font: { color: textColor },
                        xaxis: { title: { text: 'Variables' } },
                        yaxis: { title: { text: groupByCol || 'Context' } }
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                />
            );
        }

        // 2. Scatter Plot Mode (Single Target - Show actual data points!)
        // If we only have 1 target and NO grouping, user likely wants to see the SCATTER of Base vs Target
        if (!groupByCol && corrTargetCols.length === 1) {
            const targetCol = corrTargetCols[0];
            const xVal = processedData.map(d => Number(d[corrBaseCol]));
            const yVal = processedData.map(d => Number(d[targetCol]));

            // Calculate Trendline
            // Simple Linear Regression: y = mx + c
            const n = xVal.length;
            const sumX = xVal.reduce((a, b) => a + b, 0);
            const sumY = yVal.reduce((a, b) => a + b, 0);
            const sumXY = xVal.reduce((a, b, i) => a + b * yVal[i], 0);
            const sumXX = xVal.reduce((a, b) => a + b * b, 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            const trendX = [Math.min(...xVal), Math.max(...xVal)];
            const trendY = trendX.map(x => slope * x + intercept);

            return (
                <Plot
                    data={[
                        {
                            x: xVal,
                            y: yVal,
                            mode: 'markers',
                            type: 'scatter',
                            name: 'Data Points',
                            marker: { color: '#3b82f6', opacity: 0.7 }
                        },
                        {
                            x: trendX,
                            y: trendY,
                            mode: 'lines',
                            name: 'Trendline',
                            line: { color: '#ef4444', width: 2, dash: 'dash' }
                        }
                    ]}
                    layout={{
                        width: undefined,
                        height: 500,
                        title: { text: `${corrBaseCol} vs ${targetCol} (Correlation)` },
                        paper_bgcolor: bgColor,
                        plot_bgcolor: bgColor,
                        font: { color: textColor },
                        xaxis: { title: { text: corrBaseCol } },
                        yaxis: { title: { text: targetCol } },
                        showlegend: true
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                />
            );
        }

        // Fallback
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select multiple targets for Heatmap or single target for Scatter Plot.</p>
            </div>
        );
    };

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-gray-950 rounded-xl overflow-hidden shadow-sm dark:shadow-2xl border border-gray-200 dark:border-gray-900 ${printMode ? 'print-chart-block bg-white text-black border-none shadow-none h-auto' : ''}`}>
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">{title || 'Data Analytics'}</h2>
                    <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-US').format(processedData.length)} rows loaded
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                    {!readOnly && onSaveToDashboard && (
                        <button
                            onClick={() => onSaveToDashboard({
                                chartType,
                                xAxisCol,
                                yAxisCols,
                                filters,
                                showTrendline,
                                annotationMode,
                                dateRange,
                                timeGrain,
                                snapshotData: processedData, // Save current data view
                                observations // Save observations
                            })}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white text-xs font-medium transition-colors"
                        >
                            <LayoutDashboard size={14} /> Save to Dashboard
                        </button>
                    )}
                    {/* Date Filter Inputs */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 mx-2">
                        <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                        <input
                            type="date"
                            className="bg-transparent text-xs text-slate-800 dark:text-white outline-none w-24"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                        <input
                            type="date"
                            className="bg-transparent text-xs text-slate-800 dark:text-white outline-none w-24"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>

                    {/* Time Grain Selector */}
                    {xAxisCol && /date|time|timestamp/i.test(xAxisCol) && (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 mx-2">
                            <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                            <select
                                className="bg-transparent text-xs text-slate-800 dark:text-white outline-none"
                                value={timeGrain}
                                onChange={(e) => setTimeGrain(e.target.value as any)}
                            >
                                <option value="raw">Raw Data</option>
                                <option value="hour">Hourly</option>
                                <option value="day">Daily</option>
                                <option value="week">Weekly</option>
                                <option value="month">Monthly</option>
                            </select>
                        </div>
                    )}

                    <Toolbar
                        onExportCSV={handleExportExcel}
                        onPrint={handlePrint}
                        showTrendline={showTrendline}
                        onToggleTrendline={() => setShowTrendline(!showTrendline)}
                        annotationMode={annotationMode}
                        onToggleAnnotation={() => setAnnotationMode(!annotationMode)}
                        onDelete={onDelete} // Pass delete handler to toolbar
                    />
                    {!readOnly && (
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
                        >
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Main Chart Area */}
                <div className={`flex-1 p-6 overflow-auto bg-gray-50 dark:bg-gray-950 relative ${isDashboardItem ? '' : 'print-area'}`}>
                    {/* FIXED HEIGHT FOR PRINT: ResponsiveContainer needs explicit height. h-auto causes collapse (white out). */}
                    <div className={`w-full bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800/50 p-4 shadow-sm dark:shadow-inner ${printMode ? 'h-[500px] border-none bg-white p-0 shadow-none' : 'h-[600px]'}`}>
                        {correlationMode ? (
                            renderPlotlyCorrelation()
                        ) : (
                            <ChartRenderer
                                type={chartType}
                                data={processedData}
                                xAxisKey={xAxisCol}
                                dataKeys={yAxisCols}
                                variant={variant}
                            />
                        )}
                    </div>

                    {/* Observations Section */}
                    <div className="mt-6 mb-8 group">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <Sparkles size={14} className="text-indigo-500" />
                                Analysis Observations
                            </label>
                            <button
                                onClick={handleGenerateAnalysis}
                                disabled={isAnalyzing || processedData.length === 0}
                                className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                            >
                                {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                {isAnalyzing ? 'Analyzing...' : 'Auto-Generate'}
                            </button>
                        </div>
                        <textarea
                            value={observations}
                            onChange={(e) => {
                                setObservations(e.target.value);
                                if (onObservationChange) onObservationChange(e.target.value);
                            }}
                            readOnly={readOnly && !printMode}
                            placeholder={readOnly ? "No observations recorded." : "Add your analysis observations, key insights, and anomalies detected here..."}
                            className={`w-full bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-slate-800 dark:text-gray-300 outline-none transition-all 
                                ${readOnly ? 'resize-none' : 'focus:ring-2 focus:ring-blue-500/50 hover:bg-gray-50 dark:hover:bg-gray-900'}
                                ${printMode ? 'border-none bg-white text-black p-0 h-auto resize-none overflow-visible min-h-[100px]' : 'h-32'}
                            `}
                        />
                    </div>

                    {/* Data Preview Table (Bottom) - Always visible now for "Report Mode" */}
                    <div className="mt-8">
                        <h3 className="text-gray-400 font-bold mb-4 text-sm uppercase tracking-wider">
                            Data Snapshot (First 50 Rows)
                        </h3>
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900/30 max-h-96">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-gray-400">
                                <thead className="bg-gray-100 dark:bg-gray-800/80 text-slate-700 dark:text-gray-200 sticky top-0 backdrop-blur-md">
                                    <tr>
                                        {displayColumns.map(k => <th key={k} className="p-3 font-semibold whitespace-nowrap">{k}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
                                    {processedData.slice((page - 1) * pageSize, page * pageSize).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            {displayColumns.map(c => (
                                                <td key={c} className="p-3 whitespace-nowrap max-w-[200px] truncate text-xs font-mono">
                                                    {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                            <div>
                                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, processedData.length)} of {processedData.length} entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-mono">Page {page} of {Math.ceil(processedData.length / pageSize)}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(Math.ceil(processedData.length / pageSize), p + 1))}
                                    disabled={page >= Math.ceil(processedData.length / pageSize)}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Settings Panel (Sidebar) */}
                <div className={`w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex-col overflow-y-auto transition-all duration-300 absolute right-0 h-full z-20 shadow-2xl ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-6 space-y-8">

                        {/* 1. Chart Type */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Chart Type</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {['line', 'bar', 'area', 'scatter', 'pie', 'donut', 'radar', 'composed'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setChartType(t as ChartType)}
                                        className={`px-2 py-2 rounded-lg text-xs font-medium capitalize border transition-all
                                            ${chartType === t
                                                ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-500/50'
                                                : 'bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Axes Configuration */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Dimensions & Measures</h4>

                            <div className="mb-4">
                                <label className="block text-xs text-gray-400 mb-1">X-Axis (Dimension)</label>
                                <div className="relative">
                                    <select
                                        value={xAxisCol}
                                        onChange={(e) => setXAxisCol(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-gray-200 text-sm rounded-lg p-2.5 appearance-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    >
                                        {categoricalCols.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Y-Axis (Metrics)</label>
                                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {numericCols.map(col => (
                                        <label key={col} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                                ${yAxisCols.includes(col) ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-600 group-hover:border-gray-500'}`}>
                                                {yAxisCols.includes(col) && <Plus size={10} className="text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={yAxisCols.includes(col)}
                                                onChange={() => toggleYAxis(col)}
                                            />
                                            <span className={`text-sm ${yAxisCols.includes(col) ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-gray-400'}`}>{col}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. Filters */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between items-center">
                                Filters
                                <button onClick={() => setFilters([...filters, { col: columns[0], val: '' }])} className="text-blue-400 hover:text-blue-300">
                                    <Plus size={14} />
                                </button>
                            </h4>
                            <div className="space-y-2">
                                {filters.map((f, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="flex-1 space-y-1">
                                            <select
                                                value={f.col}
                                                onChange={(e) => {
                                                    const newFilters = [...filters];
                                                    newFilters[idx].col = e.target.value;
                                                    setFilters(newFilters);
                                                }}
                                                className="w-full bg-transparent text-xs text-slate-700 dark:text-gray-300 border-none p-0 focus:ring-0"
                                            >
                                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <input
                                                placeholder="Contains..."
                                                value={f.val}
                                                onChange={(e) => {
                                                    const newFilters = [...filters];
                                                    newFilters[idx].val = e.target.value;
                                                    setFilters(newFilters);
                                                }}
                                                className="w-full bg-white dark:bg-gray-900/50 rounded px-2 py-1 text-xs text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                                            className="text-gray-500 hover:text-red-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {filters.length === 0 && <p className="text-xs text-gray-600 italic">No filters applied.</p>}
                            </div>
                        </div>

                        {/* 4. Correlation Analysis */}
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correlation Analysis</h4>
                                <button
                                    onClick={() => setCorrelationMode(!correlationMode)}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${correlationMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${correlationMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {correlationMode && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    {/* Base Column */}
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Base Variable (Target)</label>
                                        <select
                                            value={corrBaseCol}
                                            onChange={(e) => setCorrBaseCol(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-gray-200 text-xs rounded p-2"
                                        >
                                            <option value="">Select Column...</option>
                                            {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    {/* Target Columns */}
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Correlate With</label>
                                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar bg-gray-100 dark:bg-gray-900/50 p-1 rounded border border-gray-200 dark:border-gray-800">
                                            {numericCols.filter(c => c !== corrBaseCol).map(col => (
                                                <label key={col} className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-400 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-blue-600 focus:ring-0"
                                                        checked={corrTargetCols.includes(col)}
                                                        onChange={() => {
                                                            setCorrTargetCols(prev =>
                                                                prev.includes(col) ? prev.filter(p => p !== col) : [...prev, col]
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-gray-300">{col}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Group By */}
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Group By (Optional)</label>
                                        <select
                                            value={groupByCol}
                                            onChange={(e) => setGroupByCol(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-gray-200 text-xs rounded p-2"
                                        >
                                            <option value="">None (Global Analysis)</option>
                                            {categoricalCols.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsEngine;
