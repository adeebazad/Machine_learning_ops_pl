import { useState, useEffect } from 'react';
import Editor from "@monaco-editor/react";
import { Play, Save, Folder, FileCode, Terminal, X } from 'lucide-react';
import { fileService } from '../services/api';

export const CodeStudio = () => {
    const [experiments, setExperiments] = useState<any[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedConfig, setSelectedConfig] = useState<string>('');

    const [files, setFiles] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string>('');
    const [code, setCode] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadFiles();
        loadExperiments();
    }, []);

    useEffect(() => {
        if (selectedExperiment) {
            loadConfigs(parseInt(selectedExperiment));
        } else {
            setConfigs([]);
            setSelectedConfig('');
        }
    }, [selectedExperiment]);

    useEffect(() => {
        if (selectedConfig) {
            loadConfigScript(parseInt(selectedConfig));
        }
    }, [selectedConfig]);

    const loadExperiments = async () => {
        try {
            const res: any = await import('../services/api').then(m => m.experimentService.list());
            if (Array.isArray(res)) {
                setExperiments(res);
            } else {
                setExperiments([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadConfigs = async (experimentId: number) => {
        try {
            const res: any = await import('../services/api').then(m => m.experimentService.listConfigs(experimentId));
            if (Array.isArray(res)) {
                setConfigs(res);
            } else {
                setConfigs([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadConfigScript = async (configId: number) => {
        try {
            const res: any = await import('../services/api').then(m => m.experimentService.getConfig(configId));
            const scriptPath = res.config_json?.preprocessing?.script_path;
            if (scriptPath) {
                setActiveFile(scriptPath);
                // Try to load content, if fails (404), set empty or template
                try {
                    const fileRes: any = await fileService.read(scriptPath);
                    setCode(fileRes.content);
                } catch (err) {
                    console.log("File not found, creating new...");
                    setCode("# New preprocessing script\n\nclass DataPreprocessor:\n    def __init__(self):\n        pass\n\n    def fit(self, df):\n        pass\n\n    def transform(self, df):\n        return df\n");
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadFiles = async () => {
        try {
            const res: any = await fileService.list();
            if (res && Array.isArray(res.files)) {
                setFiles(res.files);
            } else {
                setFiles([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadFileContent = async (filename: string) => {
        try {
            const res: any = await fileService.read(filename);
            setCode(res.content);
            setOutput('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fileService.save(activeFile, code);
            alert('File saved successfully!');
            loadFiles(); // Refresh list
        } catch (err) {
            alert('Failed to save file');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRun = async () => {
        setIsRunning(true);
        setOutput('Running script...');
        try {
            const res: any = await fileService.run(activeFile);
            setOutput(res.stdout || res.stderr || 'Script executed successfully with no output.');
        } catch (err: any) {
            setOutput(`Error: ${err.response?.data?.detail || err.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white tracking-tight">Code Studio</h2>

                {/* Experiment Selectors */}
                <div className="flex gap-4">
                    <select
                        value={selectedExperiment}
                        onChange={(e) => setSelectedExperiment(e.target.value)}
                        className="bg-[#0B0C10] border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    >
                        <option value="">Select Experiment</option>
                        {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <select
                        value={selectedConfig}
                        onChange={(e) => setSelectedConfig(e.target.value)}
                        className="bg-[#0B0C10] border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    >
                        <option value="">Select Config</option>
                        {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={!activeFile || isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#242424] hover:bg-[#2a2a2a] text-white rounded-lg border border-gray-800 transition-all"
                    >
                        <Save size={18} />
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={!activeFile || isRunning}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all"
                    >
                        {isRunning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Play size={18} fill="currentColor" />}
                        Run Script
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                {/* File Explorer */}
                <div className="col-span-2 glass-card flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-2">
                        <Folder size={16} className="text-blue-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Explorer</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {files.map(f => (
                            <button
                                key={f}
                                onClick={() => {
                                    setActiveFile(f);
                                    loadFileContent(f);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${activeFile === f
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <FileCode size={14} />
                                <span className="truncate">{f.split('/').pop()}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="col-span-10 flex flex-col gap-6 overflow-hidden">
                    <div className="flex-1 glass-card overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-white/5 bg-[#1e1e1e] flex items-center justify-between">
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-xs text-gray-500">{activeFile || 'No file selected'}</span>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            {activeFile ? (
                                <Editor
                                    height="100%"
                                    defaultLanguage="python"
                                    theme="vs-dark"
                                    value={code}
                                    onChange={(value) => setCode(value || '')}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        padding: { top: 16 },
                                        scrollBeyondLastLine: false,
                                        smoothScrolling: true,
                                        cursorBlinking: "smooth",
                                        cursorSmoothCaretAnimation: "on"
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                    <div className="text-center">
                                        <FileCode size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>Select a file or config to start editing</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Output Console */}
                    <div className="h-48 glass-card flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-white/5 bg-black/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal size={16} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Console Output</span>
                            </div>
                            {output && (
                                <button onClick={() => setOutput('')} className="text-gray-500 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 p-4 bg-[#050505] overflow-auto font-mono text-sm">
                            {output ? (
                                <pre className="text-gray-300 whitespace-pre-wrap">{output}</pre>
                            ) : (
                                <div className="text-gray-700 italic">No output to display...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
