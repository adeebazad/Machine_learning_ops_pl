import React, { useState, useMemo, useEffect } from 'react';
import ChartRenderer from './ChartRenderer';
import Toolbar from './Toolbar';
import { Settings, X, Plus, ChevronDown, BarChart2 } from 'lucide-react';

interface AnalyticsEngineProps {
    data: any[];
    title?: string;
}

type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut' | 'radar' | 'composed' | 'heatmap';

const AnalyticsEngine: React.FC<AnalyticsEngineProps> = ({ data, title }) => {
    // ---- State ----
    const [chartType, setChartType] = useState<ChartType>('line');
    const [xAxisCol, setXAxisCol] = useState<string>('');
    const [yAxisCols, setYAxisCols] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState(true);
    const [showTrendline, setShowTrendline] = useState(false);
    const [annotationMode, setAnnotationMode] = useState(false);
    const [filters, setFilters] = useState<{ col: string, val: string }[]>([]);

    // ---- Data Analysis (Columns) ----
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]);
    }, [data]);

    const numericCols = useMemo(() => {
        if (!data || data.length === 0) return [];
        return columns.filter(c => typeof data[0][c] === 'number');
    }, [data, columns]);

    const categoricalCols = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Treat anything not strictly number as categorical (dates are strings in JSON)
        return columns;
    }, [data, columns]);

    // Auto-select defaults
    useEffect(() => {
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
    }, [columns, numericCols, xAxisCol, yAxisCols]);


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
        return res;
    }, [data, filters]);


    // ---- Handlers ----
    const handleExportCSV = () => {
        if (!processedData.length) return;
        const headers = columns.join(',');
        const rows = processedData.map(row => columns.map(c => row[c]).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                    <Toolbar
                        onExportCSV={handleExportCSV}
                        onPrint={handlePrint}
                        showTrendline={showTrendline}
                        onToggleTrendline={() => setShowTrendline(!showTrendline)}
                        annotationMode={annotationMode}
                        onToggleAnnotation={() => setAnnotationMode(!annotationMode)}
                    />
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}`}
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Main Chart Area */}
                <div className="flex-1 p-6 overflow-auto bg-gray-950 relative">
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
                                        {columns.map(k => <th key={k} className="p-3 font-semibold whitespace-nowrap">{k}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {processedData.slice(0, 50).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                                            {columns.map(c => (
                                                <td key={c} className="p-3 whitespace-nowrap max-w-[200px] truncate text-xs font-mono">
                                                    {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
