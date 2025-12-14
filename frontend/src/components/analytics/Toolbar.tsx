import React from 'react';
import { Camera, Highlighter, TrendingUp, Share2, FileSpreadsheet, Printer } from 'lucide-react';

interface ToolbarProps {
    onExportCSV: () => void;
    onPrint: () => void;
    showTrendline: boolean;
    onToggleTrendline: () => void;
    annotationMode: boolean;
    onToggleAnnotation: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
    onExportCSV,
    onPrint,
    showTrendline,
    onToggleTrendline,
    annotationMode,
    onToggleAnnotation
}) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-2">
                <button
                    onClick={onExportCSV}
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-green-400 transition-colors tooltip-trigger"
                    title="Export CSV"
                >
                    <FileSpreadsheet size={18} />
                </button>
                <button
                    onClick={onPrint}
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                    title="Print / Save PDF"
                >
                    <Printer size={18} />
                </button>
                <button
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-purple-400 transition-colors"
                    title="Snapshot (Image)"
                    onClick={() => alert("Snapshot feature coming soon (Press Print Screen!)")}
                >
                    <Camera size={18} />
                </button>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onToggleTrendline}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${showTrendline ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-700 text-gray-400'}`}
                    title="Toggle Trendline"
                >
                    <TrendingUp size={18} />
                    <span className="text-xs font-medium hidden sm:inline">Trends</span>
                </button>

                <button
                    onClick={onToggleAnnotation}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${annotationMode ? 'bg-yellow-600/20 text-yellow-400' : 'hover:bg-gray-700 text-gray-400'}`}
                    title="Add Annotations"
                >
                    <Highlighter size={18} />
                    <span className="text-xs font-medium hidden sm:inline">Annotate</span>
                </button>
            </div>

            <div className="ml-auto">
                <button
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Share Dashboard"
                >
                    <Share2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
