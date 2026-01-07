import { useState, useEffect, type ReactNode, type ElementType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Code, PlayCircle, Activity, Terminal, Layers, Sun, Moon, BarChart, Settings, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: ElementType; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 font-medium text-sm",
                isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 shadow-sm ring-1 ring-brand-200 dark:ring-brand-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
            )}
        >
            <Icon size={18} className={clsx(
                isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
            )} />
            <span>{label}</span>
        </Link>
    );
};

export const Layout = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('theme')) {
            return localStorage.getItem('theme');
        }
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        if (theme) {
            localStorage.setItem('theme', theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className="min-h-screen font-sans bg-slate-50 dark:bg-[#0B0C10] transition-colors duration-300">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-[#1f2833]/90 backdrop-blur-md z-50 border-b border-slate-200 dark:border-white/5 px-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
                            <Terminal size={18} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">NEXUS</h1>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider -mt-1">MLOps Platform</p>
                        </div>
                    </Link>

                    {/* Navigation */}
                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
                    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
                        <NavItem to="/" icon={LayoutDashboard} label="Overview" />
                        <NavItem to="/code" icon={Code} label="Preprocessing" />
                        <NavItem to="/pipelines" icon={Layers} label="Work Flow" />
                        <NavItem to="/training" icon={PlayCircle} label="Logging" />
                        <NavItem to="/inference" icon={Activity} label="ALP" />
                        <NavItem to="/dashboards" icon={BarChart} label="Analytics" />
                        <NavItem to="/trends" icon={TrendingUp} label="Trends" />
                        <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                        <NavItem to="/routes" icon={Settings} label="System" />
                    </nav>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {/* System Status */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">System Operational</span>
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-12 px-6 max-w-[1600px] mx-auto">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
};
