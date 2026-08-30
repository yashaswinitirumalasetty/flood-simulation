import React from 'react';
import { SimulationResult, ImpactData, SimulationParameters } from '../types';
import { ArrowLeftRight, TrendingDown, TrendingUp, CheckCircle, ShieldAlert, CloudRain, Waves } from 'lucide-react';

interface ScenarioComparisonProps {
  currentSim: SimulationResult | null;
  currentImpact: ImpactData | null;
  currentParams: SimulationParameters;
  onApplyPreset?: (rain: number, discharge: number) => void;
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({
  currentSim,
  currentImpact,
  currentParams,
  onApplyPreset
}) => {
  if (!currentSim || !currentImpact) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-500 text-xs">
        Run a simulation to enable multi-scenario rainfall & discharge comparison.
      </div>
    );
  }

  // Baseline standard design storm (e.g. 50 mm/hr, 1.5 Lakh Cusecs)
  const baselineLossM = 2.45;
  const baselineAreaKm2 = 0.165;
  const baselineBuildings = 18;

  const currentLossM = currentImpact.total_economic_loss_usd / 1e6;
  const currentAreaKm2 = currentSim.peak_inundated_area_km2;
  const currentBuildings = currentImpact.total_damaged_buildings;

  const deltaLossM = currentLossM - baselineLossM;
  const deltaAreaKm2 = currentAreaKm2 - baselineAreaKm2;
  const deltaBuildings = currentBuildings - baselineBuildings;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#070d18] text-slate-200 space-y-6 select-none">
      <div>
        <div className="flex items-center space-x-2">
          <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-slate-100">
            {currentParams.river} ({currentParams.location}) Multi-Scenario Delta Analysis
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Evaluating how increased rainfall intensity (50 $\to$ 150 $\to$ 250 mm/hr) and Prakasam Barrage discharge affect inundation extents.
        </p>
      </div>

      {/* Delta KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Delta Economic Structural Loss</span>
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

      {/* Side-by-Side Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Scenario 1: 50 mm/hr */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300">Scenario A: Moderate Storm</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">50 mm/hr</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <div className="flex justify-between"><span>Rainfall:</span> <strong className="text-slate-200">50 mm/hr</strong></div>
            <div className="flex justify-between"><span>Discharge:</span> <strong className="text-slate-200">1.5 Lakh Cusecs</strong></div>
            <div className="flex justify-between"><span>Inundated Area:</span> <strong className="text-cyan-300">0.165 km²</strong></div>
            <div className="flex justify-between"><span>Max Depth:</span> <strong className="text-cyan-300">1.45 m</strong></div>
            <div className="flex justify-between"><span>Damaged Units:</span> <strong className="text-amber-300">18 Units</strong></div>
            <div className="flex justify-between"><span>Direct Loss:</span> <strong className="text-rose-400">$2.45M</strong></div>
          </div>
          {onApplyPreset && (
            <button
              onClick={() => onApplyPreset(50, 150000)}
              className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              Load Scenario A
            </button>
          )}
        </div>

        {/* Scenario 2: 150 mm/hr */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/40 space-y-3 bg-gradient-to-br from-slate-900 to-cyan-950/20">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-300">Scenario B: Severe Flood</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono">150 mm/hr</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <div className="flex justify-between"><span>Rainfall:</span> <strong className="text-slate-200">150 mm/hr</strong></div>
            <div className="flex justify-between"><span>Discharge:</span> <strong className="text-slate-200">5.0 Lakh Cusecs</strong></div>
            <div className="flex justify-between"><span>Inundated Area:</span> <strong className="text-cyan-300">0.245 km²</strong></div>
            <div className="flex justify-between"><span>Max Depth:</span> <strong className="text-cyan-300">2.65 m</strong></div>
            <div className="flex justify-between"><span>Damaged Units:</span> <strong className="text-amber-300">42 Units</strong></div>
            <div className="flex justify-between"><span>Direct Loss:</span> <strong className="text-rose-400">$6.80M</strong></div>
          </div>
          {onApplyPreset && (
            <button
              onClick={() => onApplyPreset(150, 500000)}
              className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition-colors"
            >
              Load Scenario B
            </button>
          )}
        </div>

        {/* Scenario 3: 250 mm/hr */}
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/40 space-y-3 bg-gradient-to-br from-slate-900 to-rose-950/20">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-rose-300">Scenario C: Sept 2024 Catastrophe</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-mono">250 mm/hr</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <div className="flex justify-between"><span>Rainfall:</span> <strong className="text-slate-200">250 mm/hr</strong></div>
            <div className="flex justify-between"><span>Discharge:</span> <strong className="text-slate-200">8.5 Lakh Cusecs</strong></div>
            <div className="flex justify-between"><span>Inundated Area:</span> <strong className="text-cyan-300">0.380 km²</strong></div>
            <div className="flex justify-between"><span>Max Depth:</span> <strong className="text-cyan-300">3.85 m</strong></div>
            <div className="flex justify-between"><span>Damaged Units:</span> <strong className="text-amber-300">68 Units</strong></div>
            <div className="flex justify-between"><span>Direct Loss:</span> <strong className="text-rose-400">$12.40M</strong></div>
          </div>
          {onApplyPreset && (
            <button
              onClick={() => onApplyPreset(250, 850000)}
              className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition-colors"
            >
              Load Scenario C
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
