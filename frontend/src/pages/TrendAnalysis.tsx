import { useState, useEffect } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { TrendingUp, Activity, ArrowDownRight } from 'lucide-react';

const TrendAnalysis = () => {
    const [timeRange, setTimeRange] = useState('1M');
    const [data, setData] = useState<any[]>([]);

    // Mock Data Generator for Trends
    useEffect(() => {
        const generateData = () => {
            const points = timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : 12;
            const baseValue = 1000;
            const trend = 2; // Upward trend

            return Array.from({ length: points }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (points - i));

                const noise = Math.random() * 50 - 25;
                const value = baseValue + (i * trend) + noise;
                const forecast = i > points - 5 ? value + (Math.random() * 100) : null; // Forecast last 5 points

                return {
                    date: date.toISOString().split('T')[0],
                    value: Math.round(value),
                    forecast: forecast ? Math.round(forecast) : null,
                    ma7: Math.round(value - (Math.random() * 20)), // Moving Average Mock
                };
            });
        };

        setData(generateData());
    }, [timeRange]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={32} />
                        Trend Analysis & Forecasting
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Analyze historical performance and view AI-driven forecasts for key metrics.
                    </p>
                </div>

                <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                    {['1M', '3M', '1Y'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${timeRange === range
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase">Predicted Growth</span>
                        <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-xs font-bold">+12.5%</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">1,245</div>
                    <div className="text-slate-400 text-xs mt-1">vs. last month</div>
                </div>

                <div className="glass-card p-6 border-l-4 border-purple-500">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase">Confidence Score</span>
                        <Activity size={16} className="text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">94%</div>
                    <div className="text-slate-400 text-xs mt-1">Model Accuracy</div>
                </div>

                <div className="glass-card p-6 border-l-4 border-orange-500">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase">Anomaly Rate</span>
                        <ArrowDownRight size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">0.8%</div>
                    <div className="text-slate-400 text-xs mt-1">-0.2% improvement</div>
                </div>
            </div>

            {/* Main Forecast Chart */}
            <div className="glass-card p-6 h-[500px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Traffic Forecast Model</h3>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-slate-600 dark:text-slate-400">Historical</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-500 opacity-50 border border-purple-500 border-dashed"></div>
                            <span className="text-slate-600 dark:text-slate-400">Forecast</span>
                        </div>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height="85%">
                    <ComposedChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                            itemStyle={{ color: '#1e293b' }}
                            labelStyle={{ color: '#64748b' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="Actual Value" />
                        <Line type="monotone" dataKey="ma7" stroke="#fbbf24" strokeWidth={2} dot={false} name="7-Day MA" />
                        <Line type="monotone" dataKey="forecast" stroke="#a855f7" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} name="AI Forecast" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrendAnalysis;
