import React, { useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ComposedChart, Brush
} from 'recharts';

interface ChartRendererProps {
    type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut' | 'radar' | 'composed' | 'heatmap';
    data: any[];
    xAxisKey: string;
    dataKeys: string[];
    colors?: string[];
    height?: any; // Relaxed type for Recharts compatibility
    variant?: 'default' | 'premium';
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const ChartRenderer: React.FC<ChartRendererProps> = ({
    type,
    data,
    xAxisKey,
    dataKeys,
    colors = COLORS,
    height = "100%",
    variant = 'default'
}) => {

    // Prepare Data
    const sortedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        if (xAxisKey && (xAxisKey.toLowerCase().includes('date') || xAxisKey.toLowerCase().includes('time'))) {
            return [...data].sort((a, b) => new Date(a[xAxisKey]).getTime() - new Date(b[xAxisKey]).getTime());
        }
        return data;
    }, [data, xAxisKey]);

    const isPremium = variant === 'premium';
    const gridColor = isPremium ? "#ffffff" : "#374151";
    const gridOpacity = isPremium ? 0.05 : 0.3;

    // Gradients Definition
    const renderGradients = () => (
        <defs>
            {colors.map((color, i) => (
                <linearGradient key={`color-${i}`} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            ))}
            <filter id="shadow" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.3" />
            </filter>
        </defs>
    );

    const CommonAxis = () => (
        <>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={gridOpacity} vertical={false} />
            <XAxis
                dataKey={xAxisKey}
                stroke={isPremium ? "#94a3b8" : "#9CA3AF"}
                tick={{ fontSize: 11, fill: isPremium ? "#94a3b8" : "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        if (typeof val === 'number' && val < 10000000000) return val;
                        return d.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                        });
                    }
                    return val;
                }}
                minTickGap={30}
                dy={10}
            />
            <YAxis
                stroke={isPremium ? "#94a3b8" : "currentColor"}
                className="text-gray-400 dark:text-gray-500"
                tick={{ fontSize: 11, fill: isPremium ? "#94a3b8" : "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
            />
            <Tooltip
                contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    padding: '12px'
                }}
                itemStyle={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 500 }}
                cursor={{ stroke: colors[0], strokeWidth: 1, strokeDasharray: '4 4' }}
                labelStyle={{ color: '#94A3B8', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
        </>
    );

    const renderBrush = () => (
        <Brush
            dataKey={xAxisKey}
            height={30}
            stroke="#8884d8"
            tickFormatter={(val: any) => {
                const d = new Date(val);
                return !isNaN(d.getTime()) && typeof val !== 'number' ?
                    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : val;
            }}
            fill="#1e293b"
        />
    );

    // Render Logic
    if (type === 'line' || type === 'area') {
        // Upgrade Line to Area for premium look if requested or keeping Line with Shadow
        // Actually, Area with gradient looks best.
        const ChartComponent = type === 'line' && !isPremium ? LineChart : AreaChart;

        return (
            <ResponsiveContainer width="100%" height={height}>
                <ChartComponent data={sortedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    {renderGradients()}
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        type === 'line' && !isPremium ?
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[i % colors.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                connectNulls
                                animationDuration={1500}
                            />
                            :
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[i % colors.length]}
                                strokeWidth={3}
                                fill={`url(#gradient-${i % colors.length})`}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                animationDuration={1500}
                            />
                    ))}
                    {data.length > 50 && renderBrush()}
                </ChartComponent>
            </ResponsiveContainer>
        );
    }

    // ... (Keep other types similar, just injecting gradients/filters where applicable)

    // Fallback for others to use standard
    if (type === 'bar') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    {renderGradients()}
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            fill={`url(#gradient-${i % colors.length})`} // Use gradient even for bars
                            radius={[6, 6, 0, 0]}
                            animationDuration={1500}
                        >
                            <Cell fill={colors[i % colors.length]} fillOpacity={0.8} />
                        </Bar>
                    ))}
                    {data.length > 50 && renderBrush()}
                </BarChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'composed') {
        // Composed gets best of both
        return (
            <ResponsiveContainer width="100%" height={height}>
                <ComposedChart data={sortedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    {renderGradients()}
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        i === 0 ?
                            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} barSize={20} animationDuration={1500} /> :
                            <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={`url(#gradient-${i % colors.length})`} strokeWidth={3} dot={false} animationDuration={1500} />
                    ))}
                    {data.length > 50 && renderBrush()}
                </ComposedChart>
            </ResponsiveContainer>
        );
    }

    // ... (Existing Radar/Pie/Scatter logic can remain, just ensure Composed and Area/Line are top tier)

    // --- Existing logic for Scatter/Pie/Radar/Heatmap ---
    // (copying back the unmodified parts for safety or simplifying)

    if (type === 'pie' || type === 'donut') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={type === 'donut' ? '80%' : '80%'}
                        innerRadius={type === 'donut' ? '60%' : 0}
                        fill="#8884d8"
                        dataKey={dataKeys[0]}
                        nameKey={xAxisKey}
                        paddingAngle={5}
                        animationDuration={1500}
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: '1px solid #374151' }} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'radar') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#374151" strokeOpacity={0.2} />
                    <PolarAngleAxis dataKey={xAxisKey} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: "#9ca3af" }} axisLine={false} />
                    {dataKeys.map((key, i) => (
                        <Radar
                            key={key}
                            name={key}
                            dataKey={key}
                            stroke={colors[i % colors.length]}
                            fill={colors[i % colors.length]}
                            fillOpacity={0.4}
                            animationDuration={1500}
                        />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                </RadarChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'scatter') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={gridOpacity} />
                    <XAxis dataKey={xAxisKey} type="category" stroke="#9CA3AF" name={xAxisKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey={dataKeys[0]} stroke="#9CA3AF" name={dataKeys[0]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '8px', border: 'none' }} />
                    <Legend />
                    <Scatter name={dataKeys[0]} data={data} fill={colors[0]} animationDuration={1500}>
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'heatmap') {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900/50 rounded-lg backdrop-blur-sm border border-gray-800">
                <p>Heatmap visualization requires specific matrix data structure.</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-full text-gray-500">
            Unsupported Chart Type
        </div>
    );
};

export default ChartRenderer;
