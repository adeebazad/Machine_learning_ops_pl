import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Code, PlayCircle, Activity, Clock, Package, Terminal, Layers } from 'lucide-react';
import clsx from 'clsx';

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={clsx(
                "group flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 relative overflow-hidden",
                isActive
                    ? "text-white bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(69,162,158,0.3)]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
        >
            <div className={clsx(
                "absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 transition-opacity duration-300",
                isActive ? "opacity-100" : "group-hover:opacity-100"
            )} />

            <Icon size={18} className={clsx(
                "transition-colors duration-300 relative z-10",
                isActive ? "text-[#66FCF1]" : "group-hover:text-[#45A29E]"
            )} />
            <span className="relative z-10 font-medium tracking-wide">{label}</span>

            {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-purple-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            )}
        </Link>
    );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen text-[#e2e8f0] font-sans selection:bg-[#45A29E]/30 selection:text-[#66FCF1]">
            {/* Command Center Header */}
            <header className="fixed top-0 left-0 right-0 h-18 glass z-50 flex items-center justify-between px-6 border-b border-white/5">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-md" />
                            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1f2833] to-[#0B0C10] border border-white/10 flex items-center justify-center shadow-lg group-hover:border-blue-500/50 transition-colors duration-300">
                                <Terminal size={20} className="text-[#66FCF1]" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold neon-text tracking-wider">NEXUS</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-semibold">MLOps Command</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                        <NavItem to="/" icon={LayoutDashboard} label="Overview" />
                        <NavItem to="/config" icon={Settings} label="Config" />
                        <NavItem to="/code" icon={Code} label="Studio" />
                        <NavItem to="/pipelines" icon={Layers} label="Pipelines" />
                        <NavItem to="/training" icon={PlayCircle} label="Training" />
                        <NavItem to="/inference" icon={Activity} label="Inference" />
                        <NavItem to="/scheduler" icon={Clock} label="Scheduler" />
                        <NavItem to="/models" icon={Package} label="Registry" />
                    </nav>
                </div>

                {/* System Status */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#0B0C10]/50 border border-white/5 backdrop-blur-sm">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">System Status</span>
                            <span className="text-xs font-bold text-[#66FCF1] drop-shadow-[0_0_5px_rgba(102,252,241,0.5)]">OPERATIONAL</span>
                        </div>
                        <div className="relative w-3 h-3">
                            <div className="absolute inset-0 bg-[#66FCF1] rounded-full animate-ping opacity-75" />
                            <div className="relative w-3 h-3 bg-[#45A29E] rounded-full border border-[#0B0C10] shadow-[0_0_10px_#66FCF1]" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-28 pb-12 px-6 max-w-[1800px] mx-auto">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {children}
                </div>
            </main>
        </div>
    );
};
