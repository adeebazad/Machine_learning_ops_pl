import React from 'react';
import { Camera, Highlighter, TrendingUp, Share2, FileSpreadsheet, Printer, Trash2 } from 'lucide-react';

interface ToolbarProps {
    onExportCSV: () => void;
    onPrint: () => void;
    showTrendline: boolean;
    onToggleTrendline: () => void;
    annotationMode: boolean;
    onToggleAnnotation: () => void;
    onDelete?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
    onExportCSV,
    onPrint,
    showTrendline,
    onToggleTrendline,
    annotationMode,
    onToggleAnnotation,
    onDelete
}) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-2">
                <button
                    onClick={onExportCSV}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-slate-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors tooltip-trigger"
                    title="Export CSV"
                >
                    <FileSpreadsheet size={18} />
                </button>
                <button
                    onClick={onPrint}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Print / Save PDF"
                >
                    <Printer size={18} />
                </button>
                <button
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-slate-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    title="Snapshot (Image)"
                    onClick={() => alert("Snapshot feature coming soon (Press Print Screen!)")}
                >
                    <Camera size={18} />
                </button>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onToggleTrendline}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${showTrendline ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400'}`}
                    title="Toggle Trendline"
                >
                    <TrendingUp size={18} />
                    <span className="text-xs font-medium hidden sm:inline">Trends</span>
                </button>

                <button
                    onClick={onToggleAnnotation}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${annotationMode ? 'bg-yellow-600/20 text-yellow-600 dark:text-yellow-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400'}`}
                    title="Add Annotations"
                >
                    <Highlighter size={18} />
                    <span className="text-xs font-medium hidden sm:inline">Annotate</span>
                </button>
            </div>

            <div className="ml-auto flex items-center gap-1">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-slate-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors border-l border-gray-200 dark:border-gray-700 pl-2 ml-2"
                        title="Delete Chart"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
                <button
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    title="Share Dashboard"
                >
                    <Share2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
