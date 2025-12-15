import React, { useState, useMemo, useEffect } from 'react';
import ChartRenderer from './ChartRenderer';
import Toolbar from './Toolbar';
import { Settings, X, Plus, ChevronDown, BarChart2, LayoutDashboard, ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AnalyticsEngineProps {
    data: any[];
    title?: string;
    readOnly?: boolean;
    onSaveToDashboard?: (config: any) => void;
    config?: any;
}

type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut' | 'radar' | 'composed' | 'heatmap';

const AnalyticsEngine: React.FC<AnalyticsEngineProps> = ({ data, title, readOnly = false, onSaveToDashboard, config }) => {
    // ---- State ----
    const [chartType, setChartType] = useState<ChartType>('line');
    const [xAxisCol, setXAxisCol] = useState<string>('');
    const [yAxisCols, setYAxisCols] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState(!readOnly);
    const [showTrendline, setShowTrendline] = useState(false);
    const [annotationMode, setAnnotationMode] = useState(false);
    const [filters, setFilters] = useState<{ col: string, val: string }[]>([]);

    // Date Range Filter & Time Grain
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [timeGrain, setTimeGrain] = useState<'raw' | 'hour' | 'day' | 'week' | 'month'>('raw');

    // Set default date range (Last Month)
    useEffect(() => {
        // Only set default if NO config was loaded (or if config didn't have dateRange)
        // We check if dateRange is empty, which implies initial state.
        // However, hydration happens in a separate effect.
        // To avoid race conditions, we can trust that if config exists, we should probably prefer it.
        // But this effect runs on `data` change too.

        if (config && config.dateRange) return; // Skip default if config provided

        if (data.length > 0 && xAxisCol && /date|time|timestamp/i.test(xAxisCol)) {
            // Find max date
            const dates = data.map(d => new Date(d[xAxisCol]).getTime()).filter(t => !isNaN(t));
            if (dates.length > 0) {
                const maxDate = new Date(Math.max(...dates));
                const minDate = new Date(maxDate);
                minDate.setMonth(minDate.getMonth() - 1);

                setDateRange({
                    start: minDate.toISOString().split('T')[0],
                    end: maxDate.toISOString().split('T')[0]
                });
            }
        }
    }, [data, xAxisCol, config]);

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
        }
    }, [config]);

    // Pagination
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // ---- Data Analysis (Columns) ----
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]);
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
                if (timeGrain === 'hour') key = d.toISOString().substring(0, 13) + ':00:00';
                else if (timeGrain === 'day') key = d.toISOString().substring(0, 10);
                else if (timeGrain === 'month') key = d.toISOString().substring(0, 7);
                else if (timeGrain === 'week') {
                    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(d.setDate(diff));
                    key = monday.toISOString().substring(0, 10);
                }

                if (!grouped[key]) {
                    grouped[key] = { [xAxisCol]: key };
                    counts[key] = {};
                    yAxisCols.forEach(c => {
                        grouped[key][c] = 0;
                        counts[key][c] = 0;
                    });
                }

                yAxisCols.forEach(c => {
                    const rawVal = row[c];
                    // STRICT CHECK: Ignore null, undefined, empty string to avoid dragging down average
                    if (rawVal === null || rawVal === undefined || rawVal === '') return;

                    const val = Number(rawVal);
                    if (!isNaN(val)) {
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
                    row[c] = count > 0 ? row[c] / count : 0; // Avoid divide by zero, default to 0 (or null?)
                    // Precision fix
                    row[c] = Math.round(row[c] * 1000) / 1000;
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

    // Dynamic Columns for Table (based on processed/aggregated data)
    const displayColumns = useMemo(() => {
        if (!processedData || processedData.length === 0) return [];
        return Object.keys(processedData[0]);
    }, [processedData]);


    // ---- Handlers ----
    const handleExportExcel = () => {
        if (!processedData.length) return;
        const ws = XLSX.utils.json_to_sheet(processedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Analytics Data");
        XLSX.writeFile(wb, `analytics_export_${Date.now()}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const toggleYAxis = (col: string) => {
        setYAxisCols(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        );
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-500 bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                <BarChart2 size={48} className="mb-4 opacity-20" />
                <p>No Data Available for Analysis</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-950 rounded-xl overflow-hidden shadow-2xl border border-gray-900">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-800 bg-gray-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">{title || 'Data Analytics'}</h2>
                    <p className="text-xs text-gray-500">{processedData.length} rows loaded</p>
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
                                snapshotData: processedData // Save current data view
                            })}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white text-xs font-medium transition-colors"
                        >
                            <LayoutDashboard size={14} /> Save to Dashboard
                        </button>
                    )}
                    {/* Date Filter Inputs */}
                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 mx-2">
                        <Calendar size={14} className="text-gray-500" />
                        <input
                            type="date"
                            className="bg-transparent text-xs text-white outline-none w-24"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                        <span className="text-gray-600">-</span>
                        <input
                            type="date"
                            className="bg-transparent text-xs text-white outline-none w-24"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>

                    {/* Time Grain Selector */}
                    {xAxisCol && /date|time|timestamp/i.test(xAxisCol) && (
                        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 mx-2">
                            <Clock size={14} className="text-gray-500" />
                            <select
                                className="bg-transparent text-xs text-white outline-none"
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
                    />
                    {!readOnly && (
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}`}
                        >
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Main Chart Area */}
                <div className="flex-1 p-6 overflow-auto bg-gray-950 relative print-area">
                    <div className="h-[600px] w-full bg-gray-900/40 rounded-2xl border border-gray-800/50 p-4 shadow-inner">
                        <ChartRenderer
                            type={chartType}
                            data={processedData}
                            xAxisKey={xAxisCol}
                            dataKeys={yAxisCols}
                        />
                    </div>

                    {/* Data Preview Table (Bottom) */}
                    <div className="mt-8">
                        <h3 className="text-gray-400 font-bold mb-4 text-sm uppercase tracking-wider">Data Snapshot (First 50 Rows)</h3>
                        <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-900/30 max-h-96">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-800/80 text-gray-200 sticky top-0 backdrop-blur-md">
                                    <tr>
                                        {displayColumns.map(k => <th key={k} className="p-3 font-semibold whitespace-nowrap">{k}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {processedData.slice((page - 1) * pageSize, page * pageSize).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-800/50 transition-colors">
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
                                    className="p-1 rounded hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-mono">Page {page} of {Math.ceil(processedData.length / pageSize)}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(Math.ceil(processedData.length / pageSize), p + 1))}
                                    disabled={page >= Math.ceil(processedData.length / pageSize)}
                                    className="p-1 rounded hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Panel (Sidebar) */}
                <div className={`w-80 bg-gray-900 border-l border-gray-800 flex-col overflow-y-auto transition-all duration-300 absolute right-0 h-full z-20 shadow-2xl ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}>
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
                                                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
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
                                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg p-2.5 appearance-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                                        <label key={col} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-800 cursor-pointer group">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                                ${yAxisCols.includes(col) ? 'bg-blue-600 border-blue-600' : 'border-gray-600 group-hover:border-gray-500'}`}>
                                                {yAxisCols.includes(col) && <Plus size={10} className="text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={yAxisCols.includes(col)}
                                                onChange={() => toggleYAxis(col)}
                                            />
                                            <span className={`text-sm ${yAxisCols.includes(col) ? 'text-white' : 'text-gray-400'}`}>{col}</span>
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
                                    <div key={idx} className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                                        <div className="flex-1 space-y-1">
                                            <select
                                                value={f.col}
                                                onChange={(e) => {
                                                    const newFilters = [...filters];
                                                    newFilters[idx].col = e.target.value;
                                                    setFilters(newFilters);
                                                }}
                                                className="w-full bg-transparent text-xs text-gray-300 border-none p-0 focus:ring-0"
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
                                                className="w-full bg-gray-900/50 rounded px-2 py-1 text-xs text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
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

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsEngine;
