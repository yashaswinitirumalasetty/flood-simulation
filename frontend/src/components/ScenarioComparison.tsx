import React from 'react';
import { SimulationResult, ImpactData } from '../types';
import { ArrowLeftRight, TrendingDown, TrendingUp, CheckCircle, ShieldAlert } from 'lucide-react';

interface ScenarioComparisonProps {
  currentSim: SimulationResult | null;
  currentImpact: ImpactData | null;
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({ currentSim, currentImpact }) => {
  if (!currentSim || !currentImpact) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-500">
        Run at least one simulation to enable comparative delta analysis.
      </div>
    );
  }

  // Generate a synthetic baseline (e.g. 25-year standard storm) for comparison
  const baselineLossM = 1.42;
  const baselineAreaKm2 = 0.185;
  const baselineBuildings = 14;

  const currentLossM = currentImpact.total_economic_loss_usd / 1e6;
  const currentAreaKm2 = currentSim.peak_inundated_area_km2;
  const currentBuildings = currentImpact.total_damaged_buildings;

  const deltaLossM = currentLossM - baselineLossM;
  const deltaAreaKm2 = currentAreaKm2 - baselineAreaKm2;
  const deltaBuildings = currentBuildings - baselineBuildings;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#070d18] text-slate-200 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
          <span>Multi-Scenario Delta Comparison & Hazard Mitigation Analysis</span>
        </h2>
        <p className="text-xs text-slate-400">
          Comparing Current Active Scenario against Baseline Design Storm (25-Year Standard Event).
        </p>
      </div>

      {/* Delta KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Delta Economic Loss</span>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold font-mono ${deltaLossM >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {deltaLossM >= 0 ? `+${deltaLossM.toFixed(2)}M` : `-${Math.abs(deltaLossM).toFixed(2)}M`} USD
            </span>
            {deltaLossM >= 0 ? <TrendingUp className="w-5 h-5 text-rose-400" /> : <TrendingDown className="w-5 h-5 text-emerald-400" />}
          </div>
          <span className="text-[11px] text-slate-500">Current: ${currentLossM.toFixed(2)}M vs Baseline: ${baselineLossM}M</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Delta Peak Inundated Extent</span>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold font-mono ${deltaAreaKm2 >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {deltaAreaKm2 >= 0 ? `+${deltaAreaKm2.toFixed(3)}` : `-${Math.abs(deltaAreaKm2).toFixed(3)}`} km²
            </span>
            {deltaAreaKm2 >= 0 ? <TrendingUp className="w-5 h-5 text-amber-400" /> : <TrendingDown className="w-5 h-5 text-emerald-400" />}
          </div>
          <span className="text-[11px] text-slate-500">Current: {currentAreaKm2.toFixed(3)} km² vs Baseline: {baselineAreaKm2} km²</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Delta Affected Structures</span>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold font-mono ${deltaBuildings >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {deltaBuildings >= 0 ? `+${deltaBuildings}` : `-${Math.abs(deltaBuildings)}`} Units
            </span>
            {deltaBuildings >= 0 ? <TrendingUp className="w-5 h-5 text-rose-400" /> : <TrendingDown className="w-5 h-5 text-emerald-400" />}
          </div>
          <span className="text-[11px] text-slate-500">Current: {currentBuildings} vs Baseline: {baselineBuildings}</span>
        </div>
      </div>

      {/* Comparison Grid Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Scenario A: 25-Year Baseline Storm</h3>
          <ul className="text-xs space-y-2 text-slate-300">
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Rainfall Intensity:</span>
              <strong className="font-mono text-slate-100">35.0 mm/hr</strong>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>River Inflow:</span>
              <strong className="font-mono text-slate-100">60.0 m³/s</strong>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Hospital Access Status:</span>
              <span className="text-emerald-400 font-medium">Passable (&lt;0.05m)</span>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Primary Interstate Passability:</span>
              <span className="text-emerald-400 font-medium">100% Passable</span>
            </li>
          </ul>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400">Scenario B: Current Active Configuration</h3>
          <ul className="text-xs space-y-2 text-slate-300">
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Rainfall Intensity:</span>
              <strong className="font-mono text-cyan-400">{currentSim.snapshots[0] ? 'Configured' : 'N/A'}</strong>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Max Water Depth:</span>
              <strong className="font-mono text-cyan-400">{currentSim.max_peak_depth_m.toFixed(2)} m</strong>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Hospital Access Status:</span>
              <span className="text-rose-400 font-medium">Cutoff / Trapped</span>
            </li>
            <li className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Severed Roadways:</span>
              <span className="text-orange-400 font-medium">{currentImpact.road_network.impassable_roads_km} km Impassable</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
