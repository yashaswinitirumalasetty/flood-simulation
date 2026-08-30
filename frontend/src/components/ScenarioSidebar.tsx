import React from 'react';
import { CloudRain, Wind, Play, RotateCcw, AlertTriangle, CheckCircle2, Sliders, Layers, Droplets } from 'lucide-react';
import { SimulationParameters } from '../types';

interface ScenarioSidebarProps {
  params: SimulationParameters;
  onParamsChange: (newParams: Partial<SimulationParameters>) => void;
  onRunSimulation: () => void;
  isSimulating: boolean;
  layerVisibility: {
    dem: boolean;
    floodDepth: boolean;
    velocityVectors: boolean;
    buildings: boolean;
    roads: boolean;
    criticalFacilities: boolean;
  };
  onToggleLayer: (layerKey: keyof ScenarioSidebarProps['layerVisibility']) => void;
}

export const ScenarioSidebar: React.FC<ScenarioSidebarProps> = ({
  params,
  onParamsChange,
  onRunSimulation,
  isSimulating,
  layerVisibility,
  onToggleLayer
}) => {
  const returnPeriods = [
    { label: '10-Yr', rain: 28.0, flow: 45.0, yr: 10 },
    { label: '50-Yr', rain: 52.0, flow: 95.0, yr: 50 },
    { label: '100-Yr', rain: 75.0, flow: 140.0, yr: 100 },
    { label: '500-Yr (Extreme)', rain: 110.0, flow: 220.0, yr: 500 },
  ];

  return (
    <aside className="w-80 bg-[#0f172a]/95 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none text-slate-300 z-20 overflow-y-auto">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">Scenario Builder</h2>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            {params.return_period_years ? `${params.return_period_years}-Year Event` : 'Custom'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Return Period Quick Presets */}
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wide">
            Design Storm Presets
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {returnPeriods.map((rp) => (
              <button
                key={rp.label}
                onClick={() => onParamsChange({
                  rainfall_intensity_mmhr: rp.rain,
                  river_discharge_m3s: rp.flow,
                  return_period_years: rp.yr
                })}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                  params.return_period_years === rp.yr
                    ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {rp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rainfall Intensity Slider */}
        <div className="space-y-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-300 font-medium">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              <span>Rainfall Intensity</span>
            </span>
            <span className="font-mono text-cyan-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {params.rainfall_intensity_mmhr} mm/hr
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={140}
            step={2}
            value={params.rainfall_intensity_mmhr}
            onChange={(e) => onParamsChange({ rainfall_intensity_mmhr: parseFloat(e.target.value), return_period_years: undefined })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>10 mm/hr (Light)</span>
            <span>75 mm/hr (Heavy)</span>
            <span>140 mm/hr (Extreme)</span>
          </div>
        </div>

        {/* Storm Duration Slider */}
        <div className="space-y-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-300 font-medium">
              <Wind className="w-3.5 h-3.5 text-indigo-400" />
              <span>Storm Duration</span>
            </span>
            <span className="font-mono text-indigo-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {params.duration_hours} hrs
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={params.duration_hours}
            onChange={(e) => onParamsChange({ duration_hours: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>1.0 hr</span>
            <span>4.0 hrs</span>
            <span>8.0 hrs</span>
          </div>
        </div>

        {/* Upstream River Discharge Inflow */}
        <div className="space-y-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-300 font-medium">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span>River Inflow (Q)</span>
            </span>
            <span className="font-mono text-blue-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {params.river_discharge_m3s} m³/s
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={250}
            step={5}
            value={params.river_discharge_m3s}
            onChange={(e) => onParamsChange({ river_discharge_m3s: parseFloat(e.target.value), return_period_years: undefined })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>20 m³/s (Base)</span>
            <span>120 m³/s (Bankfull)</span>
            <span>250 m³/s (Severe)</span>
          </div>
        </div>

        {/* GIS Map Layers Control */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5 uppercase tracking-wide">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Active GIS Layers</span>
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.floodDepth}
                onChange={() => onToggleLayer('floodDepth')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Flood Depth</span>
            </label>

            <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.velocityVectors}
                onChange={() => onToggleLayer('velocityVectors')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Velocity Vectors</span>
            </label>

            <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.buildings}
                onChange={() => onToggleLayer('buildings')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Buildings (OSM)</span>
            </label>

            <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.roads}
                onChange={() => onToggleLayer('roads')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Road Passability</span>
            </label>

            <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700 col-span-2">
              <input
                type="checkbox"
                checked={layerVisibility.criticalFacilities}
                onChange={() => onToggleLayer('criticalFacilities')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Critical Facilities (Hospitals, Power)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Action Button Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/80">
        <button
          onClick={onRunSimulation}
          disabled={isSimulating}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg ${
            isSimulating
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98]'
          }`}
        >
          {isSimulating ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Simulating ({params.engine_mode === 'fast_ai' ? 'Fast AI' : 'Physics'})...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>
                Run {params.engine_mode === 'fast_ai' ? 'Fast AI Inference' : params.engine_mode === 'physics_lisflood' ? '2D Physics Solve' : 'Hybrid Simulation'}
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
