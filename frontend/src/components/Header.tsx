import React from 'react';
import { Waves, Zap, Cpu, ShieldCheck, Download, Bot, Layers, BarChart3, Box, ArrowLeftRight } from 'lucide-react';
import { SimulationParameters } from '../types';

interface HeaderProps {
  params: SimulationParameters;
  onParamsChange: (newParams: Partial<SimulationParameters>) => void;
  activeTab: '2d_map' | '3d_terrain' | 'impact' | 'comparison';
  setActiveTab: (tab: '2d_map' | '3d_terrain' | 'impact' | 'comparison') => void;
  onOpenAssistant: () => void;
  onOpenExport: () => void;
  isSimulating: boolean;
  latencyMs?: number;
}

export const Header: React.FC<HeaderProps> = ({
  params,
  onParamsChange,
  activeTab,
  setActiveTab,
  onOpenAssistant,
  onOpenExport,
  isSimulating,
  latencyMs
}) => {
  return (
    <header className="h-16 bg-[#0f172a]/95 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30 sticky top-0 backdrop-blur-md">
      {/* Brand & Project Info */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Waves className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-200 to-white">
              HydroForge AI
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              v1.0 Hybrid
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Catchment: <strong className="text-slate-200 font-medium">Lower Basin Catchment #04</strong></span>
            <span>•</span>
            <span className="text-slate-400">Grid: 48×48 (12.5m)</span>
          </div>
        </div>
      </div>

      {/* Center View Tabs */}
      <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => setActiveTab('2d_map')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === '2d_map'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2D Map</span>
        </button>

        <button
          onClick={() => setActiveTab('3d_terrain')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === '3d_terrain'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Terrain</span>
        </button>

        <button
          onClick={() => setActiveTab('impact')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'impact'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Risk & Impact</span>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'comparison'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Delta Compare</span>
        </button>
      </div>

      {/* Right Controls: Mode Toggle & Actions */}
      <div className="flex items-center space-x-3">
        {/* Engine Mode Toggle */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => onParamsChange({ engine_mode: 'fast_ai' })}
            title="Sub-second FNO Neural Surrogate (<100ms)"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              params.engine_mode === 'fast_ai'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast AI</span>
          </button>

          <button
            onClick={() => onParamsChange({ engine_mode: 'physics_lisflood' })}
            title="2D Shallow Water Physics Solver (LISFLOOD-FP)"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              params.engine_mode === 'physics_lisflood'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>2D Physics</span>
          </button>

          <button
            onClick={() => onParamsChange({ engine_mode: 'hybrid_auto' })}
            title="Hybrid Mode: Fast AI Inference + Auto Physics Verification"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              params.engine_mode === 'hybrid_auto'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hybrid</span>
          </button>
        </div>

        {/* Live Latency telemetry */}
        {latencyMs !== undefined && (
          <div className="hidden lg:flex flex-col text-[10px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-slate-300 font-mono">{latencyMs}ms</span>
            </span>
            <span className="text-slate-500">Latency</span>
          </div>
        )}

        {/* AI Co-Pilot Button */}
        <button
          onClick={onOpenAssistant}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-900/50 to-indigo-900/50 hover:from-purple-800/60 hover:to-indigo-800/60 text-purple-200 border border-purple-700/50 text-xs font-medium transition-all shadow-sm hover:shadow-purple-500/20"
        >
          <Bot className="w-4 h-4 text-purple-300" />
          <span>AI Co-Pilot</span>
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
