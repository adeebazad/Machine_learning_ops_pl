import React, { useState } from 'react';
import { Copy, Shield, Globe, Search, Code } from 'lucide-react';

const RouteRegistry: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const routes = [
        { path: '/', name: 'Home / Dashboard', type: 'Protected', description: 'Main overview dashboard for the platform.' },
        { path: '/pipelines', name: 'Pipeline Manager', type: 'Protected', description: 'List and manage ML pipelines.' },
        { path: '/pipelines/new', name: 'Pipeline Editor', type: 'Protected', description: 'Create or edit pipeline configurations.' },
        { path: '/training', name: 'Model Training', type: 'Protected', description: 'Monitor and trigger model training jobs.' },
        { path: '/inference', name: 'Inference Interface', type: 'Protected', description: 'Run predictions using trained models.' },
        { path: '/code', name: 'Code Studio', type: 'Protected', description: 'In-browser IDE for custom code execution.' },
        { path: '/experiments/new', name: 'Experiment Tracking', type: 'Protected', description: 'Track and compare ML experiments.' },
        { path: '/dashboards', name: 'Analytics Dashboards', type: 'Protected', description: 'View and create custom analytics dashboards.' },
        { path: '/dashboard/analytics', name: 'Standalone Analytics', type: 'Protected', description: 'Direct analytics view for specific pipelines.' },
        { path: '/shared/dashboard/:uuid', name: 'Embedded Dashboard', type: 'Public (Iframe Only)', description: 'Secure view for embedding dashboards in external apps.' },
        { path: '/routes', name: 'Route Registry', type: 'Protected', description: 'Centralized directory of all system routes.' },
    ];

    const filteredRoutes = routes.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.path.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(window.location.origin + text);
        // Could add toast notification here
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 border-b border-gray-800 pb-6 flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Route Registry</h1>
                        <p className="text-gray-400">Centralized management for all application navigation paths and redirection URLs.</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search routes..."
                            className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {/* Quick Stats */}
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                        <div className="text-gray-500 text-sm mb-1">Total Routes</div>
                        <div className="text-3xl font-bold">{routes.length}</div>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                        <div className="text-gray-500 text-sm mb-1">Public / Embedded</div>
                        <div className="text-3xl font-bold text-green-400">{routes.filter(r => r.type.includes('Public')).length}</div>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                        <div className="text-gray-500 text-sm mb-1">Protected</div>
                        <div className="text-3xl font-bold text-blue-400">{routes.filter(r => r.type === 'Protected').length}</div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold">Page Name</th>
                                <th className="p-4 font-semibold">URL Pattern</th>
                                <th className="p-4 font-semibold">Access Type</th>
                                <th className="p-4 font-semibold">Description</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filteredRoutes.map((route, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="p-4 font-medium text-gray-200">{route.name}</td>
                                    <td className="p-4 font-mono text-sm text-blue-400">{route.path}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${route.type.includes('Public')
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {route.type.includes('Public') ? <Globe size={12} /> : <Shield size={12} />}
                                            {route.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">{route.description}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => copyToClipboard(route.path)}
                                                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Copy Link pattern"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            {route.type.includes('Iframe') && (
                                                <button
                                                    className="p-2 hover:bg-gray-700 rounded-lg text-purple-400 hover:text-purple-300 transition-colors"
                                                    title="Get Embed Code"
                                                    onClick={() => alert(`Use this generic code:\n<iframe src="${window.location.origin}${route.path.replace(':uuid', 'YOUR_DASHBOARD_UUID')}" width="100%" height="800" frameborder="0"></iframe>`)}
                                                >
                                                    <Code size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRoutes.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No routes found matching your search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RouteRegistry;
