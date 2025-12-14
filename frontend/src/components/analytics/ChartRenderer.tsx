import React, { useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ComposedChart
} from 'recharts';

interface ChartRendererProps {
    type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut' | 'radar' | 'composed' | 'heatmap';
    data: any[];
    xAxisKey: string;
    dataKeys: string[];
    colors?: string[];
    height?: any; // Relaxed type for Recharts compatibility
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const ChartRenderer: React.FC<ChartRendererProps> = ({
    type,
    data,
    xAxisKey,
    dataKeys,
    colors = COLORS,
    height = "100%"
}) => {

    // Prepare Data (Sort by X if it's a date/number for trend lines to work make sense)
    const sortedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Attempt sort if x is likely date
        if (xAxisKey && (xAxisKey.toLowerCase().includes('date') || xAxisKey.toLowerCase().includes('time'))) {
            return [...data].sort((a, b) => new Date(a[xAxisKey]).getTime() - new Date(b[xAxisKey]).getTime());
        }
        return data;
    }, [data, xAxisKey]);

    const CommonAxis = () => (
        <>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
            <XAxis
                dataKey={xAxisKey}
                stroke="#9CA3AF"
                tick={{ fontSize: 11 }}
                tickFormatter={(val) => {
                    // Try formatting dates (Handle string ISO and Number Epoch)
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        // Check if it's likely a timestamp (e.g., not a small number like index 0, 1, 2)
                        // Epoch for 2000 is 946684800000. Low numbers might be categories.
                        if (typeof val === 'number' && val < 10000000000) return val; // Assume it's a category/index if < 10 billion and number? Actually epoch is huge. 

                        return d.toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        });
                    }
                    return val;
                }}
                minTickGap={30}
            />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                itemStyle={{ color: '#E5E7EB' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
        </>
    );

    if (type === 'line') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={colors[i % colors.length]}
                            strokeWidth={2}
                            dot={data.length < 50} // Hide dots for dense data
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'area') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stackId="1" // Stack by default for area? Or make optional. Let's stack.
                            stroke={colors[i % colors.length]}
                            fill={colors[i % colors.length]}
                            fillOpacity={0.6}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'bar') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            fill={colors[i % colors.length]}
                            radius={[4, 4, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'composed') {
        // First key is Bar, Second is Line, etc. simple logic
        return (
            <ResponsiveContainer width="100%" height={height}>
                <ComposedChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CommonAxis />
                    {dataKeys.map((key, i) => (
                        i === 0 ?
                            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} barSize={20} /> :
                            <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={3} dot={false} />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'pie' || type === 'donut') {
        // Pie chart needs distinct data format usually: name, value.
        // We interpret the FIRST dataKey as the "Value" and xAxisKey as the "Name/Category"
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
                        dataKey={dataKeys[0]} // First numeric column
                        nameKey={xAxisKey} // Category column
                        paddingAngle={5}
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
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey={xAxisKey} tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: "#9CA3AF" }} />
                    {dataKeys.map((key, i) => (
                        <Radar
                            key={key}
                            name={key}
                            dataKey={key}
                            stroke={colors[i % colors.length]}
                            fill={colors[i % colors.length]}
                            fillOpacity={0.6}
                        />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                </RadarChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'scatter') {
        // Assume first datakey is Y, xAxisKey is X. 
        // If we have Z axis for bubble, we need more config. kept simple for now.
        return (
            <ResponsiveContainer width="100%" height={height}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey={xAxisKey} type="category" stroke="#9CA3AF" name={xAxisKey} />
                    <YAxis type="number" dataKey={dataKeys[0]} stroke="#9CA3AF" name={dataKeys[0]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                    <Legend />
                    <Scatter name={dataKeys[0]} data={data} fill={colors[0]}>
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        );
    }

    // Heatmap fallbacks or simpler grids
    if (type === 'heatmap') {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900/50 rounded-lg">
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
