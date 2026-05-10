"use client";

import { useEffect, useState, useRef } from "react";

const NeuralSpinner = () => (
    <div className="relative w-8 h-8">
        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-ping"></div>
        <div className="absolute inset-1 border-2 border-blue-400/40 rounded-full animate-pulse"></div>
        <div className="absolute inset-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
    </div>
);

export default function Home() {
  const [logs, setLogs] = useState<{content: string, level: string}[]>([]);
  const [status, setStatus] = useState<string>("Idle");
  const [goal, setGoal] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [plan, setPlan] = useState<string[]>([]);
  const [memory, setMemory] = useState<string>("");
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [useSandbox, setUseSandbox] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<{content: string, index: number, total: number} | null>(null);
  const endOfLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
        ws = new WebSocket("ws://localhost:8000/ws/logs");
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "log") {
            setLogs((prev) => [...prev, {content: data.content, level: data.level}]);
          } else if (data.type === "status") {
            setStatus(data.content);
            if (data.content === "Idle") {
                setIsRunning(false);
                setMemory("");
                fetchFiles();
                setShowSuccess(true);
            }
          } else if (data.type === "plan") {
            setPlan(data.steps);
          } else if (data.type === "memory") {
            setMemory(data.content);
          } else if (data.type === "step") {
            setCurrentStep({content: data.content, index: data.index, total: data.total});
          }
        };

        ws.onclose = () => {
            console.log("WS Disconnected. Reconnecting...");
            reconnectTimer = setTimeout(connect, 2000);
        };
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch("http://localhost:8000/api/config");
            const data = await res.json();
            setUseSandbox(data.use_sandbox);
        } catch (err) {}
    };

    const fetchFiles = async () => {
        try {
            const res = await fetch("http://localhost:8000/api/files");
            const data = await res.json();
            setFileTree(data.tree);
        } catch (err) {}
    };

    fetchConfig();
    fetchFiles();
    connect();

    return () => {
        if (ws) ws.close();
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const handleToggleSandbox = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
        const res = await fetch("http://localhost:8000/api/config/toggle-sandbox", { method: "POST" });
        const data = await res.json();
        if (data.status === "success") {
            setUseSandbox(data.new_value);
        }
    } catch (err) {
    } finally {
        setIsToggling(false);
    }
  };

  const handleFileClick = async (path: string) => {
    setSelectedFile(path);
    setFileContent("Loading...");
    setIsModalOpen(true); // Open pop-up immediately
    try {
        const res = await fetch(`http://localhost:8000/api/files/content?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (data.content) setFileContent(data.content);
        else setFileContent("Error: " + data.error);
    } catch (err) {
        setFileContent("Failed to fetch file content.");
    }
  };

  const FileItem = ({ item, depth = 0 }: { item: any, depth?: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    const isDir = item.type === "directory";

    return (
        <div className="select-none">
            <div 
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-zinc-800 transition-colors ${selectedFile === item.path ? 'bg-zinc-800 text-blue-400' : ''}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => isDir ? setIsOpen(!isOpen) : handleFileClick(item.path)}
            >
                <span className="text-[10px] opacity-50 w-4">
                    {isDir ? (isOpen ? '▼' : '▶') : '📄'}
                </span>
                <span className={`truncate ${isDir ? 'font-semibold text-zinc-300' : 'text-zinc-400'}`}>
                    {item.name}
                </span>
                {!isDir && <span className="text-[9px] opacity-30 ml-auto">{item.size}</span>}
            </div>
            {isDir && isOpen && item.children?.map((child: any, i: number) => (
                <FileItem key={i} item={child} depth={depth + 1} />
            ))}
        </div>
    );
  };

  useEffect(() => {
    endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = async () => {
    if (!goal.trim()) return;
    setIsRunning(true);
    setLogs([]);
    setPlan([]);
    setMemory("");
    setCurrentStep(null);
    setShowSuccess(false);
    try {
      const res = await fetch("http://localhost:8000/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal })
      });
      if (!res.ok) setIsRunning(false);
    } catch (err) {
      console.error(err);
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans p-6 grid grid-cols-12 gap-6">
      
      {/* Header spanning all columns */}
      <div className="col-span-12 flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-white">Antigravity Control Plane</h1>
        <div className="flex gap-4 items-center w-1/2">
            <input 
              type="text" 
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter operator goal..." 
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleStart}
              disabled={isRunning}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${isRunning ? 'bg-zinc-700 text-zinc-500' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {isRunning ? 'Running...' : 'Execute'}
            </button>
            {isRunning && (
              <button 
                onClick={async () => await fetch("http://localhost:8000/api/stop", {method: "POST"})}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 transition-colors"
              >
                Stop
              </button>
            )}
        </div>
      </div>

      {/* Left Panel: Plan / Steps */}
      <div className="col-span-3 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex flex-col h-[calc(100vh-140px)]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Execution Graph</h2>
            {(status === "Planning..." || status === "Initializing...") && <NeuralSpinner />}
        </div>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-blue-500 animate-pulse' : 'bg-zinc-700'}`}></div>
            <span className={`text-sm font-medium ${isRunning ? 'text-blue-100' : 'text-zinc-500'}`}>
              {isRunning ? status : "Idle"}
            </span>
          </div>
          
          <div className="space-y-3">
            {plan.map((step, i) => {
                const isCompleted = currentStep ? i + 1 < currentStep.index : false;
                const isActive = currentStep ? i + 1 === currentStep.index : false;
                
                return (
                    <div key={i} className={`p-3 rounded-lg border text-xs transition-all ${
                        isActive ? 'bg-blue-900/20 border-blue-500/50 text-blue-100' : 
                        isCompleted ? 'bg-zinc-800/30 border-zinc-800 text-zinc-500' : 
                        'bg-zinc-900/50 border-zinc-800/50 text-zinc-600'
                    }`}>
                        <div className="flex justify-between mb-1">
                            <span className="font-mono opacity-50">STEP {i+1}</span>
                            {isCompleted && <span className="text-green-500">✓</span>}
                            {isActive && <span className="text-blue-400 animate-pulse">●</span>}
                        </div>
                        {step}
                    </div>
                );
            })}
            {!isRunning && plan.length === 0 && (
                <div className="text-center py-10 opacity-20 italic text-xs">
                    No active plan
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Center Panel: Console Stream */}
      <div className="col-span-6 bg-black p-6 rounded-xl border border-zinc-800 flex flex-col h-[calc(100vh-140px)] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
            <h2 className="text-sm font-mono text-green-500">terminal@sandbox ~</h2>
            <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
        </div>
        <div className="flex-1 overflow-auto font-mono text-xs text-zinc-400 space-y-1">
          {logs.length === 0 && <span className="opacity-50">Waiting for operator connection...</span>}
          {logs.map((log, i) => (
            <div key={i} className={`break-words ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'INFO' ? 'text-blue-300' : log.level === 'WARNING' ? 'text-yellow-400' : ''}`}>
                {log.content}
            </div>
          ))}
          <div ref={endOfLogsRef} />
        </div>
      </div>

      {/* Right Panel: Metadata & Memory */}
      <div className="col-span-3 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex flex-col h-[calc(100vh-140px)] relative overflow-hidden">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">System State</h2>
        
        <div className="space-y-6 flex-1 flex flex-col">
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs text-zinc-500 uppercase">Docker Sandbox</h3>
                    <button 
                        onClick={handleToggleSandbox}
                        disabled={isToggling}
                        className={`w-8 h-4 rounded-full relative transition-colors ${useSandbox ? 'bg-blue-600' : 'bg-zinc-700'} ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${useSandbox ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                </div>
                <div className={`flex items-center gap-2 text-sm ${useSandbox ? 'text-green-400' : 'text-zinc-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${useSandbox ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                    {useSandbox ? 'Active & Isolated' : 'Disabled (Local Host)'}
                </div>
            </div>

            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                <h3 className="text-xs text-zinc-500 uppercase mb-2">Models Active</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Router</span>
                        <span className="text-zinc-500">llama3.2</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Coder</span>
                        <span className="text-zinc-500">qwen2.5-coder</span>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50 flex flex-col h-64 overflow-hidden">
                <h3 className="text-xs text-zinc-500 uppercase mb-2">Workspace</h3>
                <div className="overflow-auto flex-1 scrollbar-hide text-xs">
                    {fileTree.length > 0 ? (
                        fileTree.map((item, i) => <FileItem key={i} item={item} />)
                    ) : (
                        <div className="text-zinc-600 italic p-2">Scanning workspace...</div>
                    )}
                </div>
            </div>

            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50 flex-1 overflow-auto">
                <h3 className="text-xs text-zinc-500 uppercase mb-2">Recalled Memory</h3>
                <div className="text-xs text-zinc-400 leading-relaxed font-serif italic">
                    {memory || "Vector context will stream here when tasks are planned."}
                </div>
            </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-12">
              <div className="bg-zinc-900 w-full h-full rounded-2xl border border-zinc-800 flex flex-col shadow-2xl overflow-hidden">
                  <div className="bg-zinc-800/50 p-4 flex justify-between items-center border-b border-zinc-700">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 text-sm font-mono">{selectedFile}</span>
                        <span className="bg-blue-900/30 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-900/50">Read Only Mode</span>
                      </div>
                      <button 
                        onClick={() => setIsModalOpen(false)}
                        className="text-zinc-400 hover:text-white text-xl"
                      >
                        ✕
                      </button>
                  </div>
                  <div className="flex-1 overflow-auto p-8 font-mono text-sm text-zinc-300 leading-relaxed bg-zinc-950/50">
                      <pre className="whitespace-pre-wrap">{fileContent}</pre>
                  </div>
                  <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-4">
                    <button 
                         onClick={() => { setGoal(`Modify ${selectedFile} to `); setIsModalOpen(false); setSelectedFile(null); }}
                         className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
                    >
                        Command AI to Edit
                    </button>
                  </div>
              </div>
          </div>
      )}

      {/* Mission Accomplished Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-zinc-900 border border-green-500/50 p-12 rounded-3xl shadow-2xl shadow-green-500/20 max-w-2xl w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/10 blur-3xl rounded-full"></div>
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    
                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Mission Accomplished</h2>
                    <p className="text-zinc-400 mb-8 text-lg">Goal achieved successfully with 100% precision.</p>

                    <div className="bg-zinc-800/50 border border-zinc-700/50 p-6 rounded-2xl mb-8 text-left">
                        <h3 className="text-xs text-zinc-500 uppercase mb-3 tracking-widest">Final Report</h3>
                        <p className="text-white font-medium text-lg leading-relaxed">{goal}</p>
                    </div>

                    <button 
                        onClick={() => setShowSuccess(false)}
                        className="bg-green-600 hover:bg-green-500 text-white px-10 py-4 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-green-600/20"
                    >
                        Return to Control Plane
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
