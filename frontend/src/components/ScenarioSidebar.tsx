import React from 'react';
import { CloudRain, Wind, Play, RotateCcw, Sliders, Layers, Droplets, AlertTriangle, ShieldCheck, Waves } from 'lucide-react';
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
    observedSatellite?: boolean;
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
  const rainfallPresets = [
    { label: '20 mm/hr (Light)', val: 20 },
    { label: '50 mm/hr (Moderate)', val: 50 },
    { label: '100 mm/hr (Heavy)', val: 100 },
    { label: '150 mm/hr (Severe)', val: 150 },
    { label: '200 mm/hr (Very Heavy)', val: 200 },
    { label: '300 mm/hr (Cloudburst)', val: 300 },
  ];

  const durationOptions = [1, 3, 6, 12, 24];

  const dischargePresets = [
    { label: 'Normal Flow', cusecs: 75000, desc: '0.75 Lakh Cusecs' },
    { label: 'Warning Stage', cusecs: 250000, desc: '2.5 Lakh Cusecs' },
    { label: 'Danger Flood', cusecs: 500000, desc: '5.0 Lakh Cusecs' },
    { label: 'Sept 2024 Peak', cusecs: 850000, desc: '8.5 Lakh Cusecs' },
    { label: 'Historic Max', cusecs: 1150000, desc: '11.5 Lakh Cusecs' },
  ];

  const currentLakhCusecs = (params.river_discharge_cusecs / 100000).toFixed(2);
  const currentCumecs = Math.round(params.river_discharge_cusecs * 0.0283168);

  return (
    <aside className="w-80 bg-[#0f172a]/95 border-r border-slate-800 flex flex-col h-[calc(100vh-4rem)] select-none text-slate-300 z-20 overflow-y-auto">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-xs text-slate-100 uppercase tracking-wider">Hydrology & Scenario</h2>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            {params.river}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-4 flex-1">
        {/* River Discharge Control (Prakasam Barrage Inflow) */}
        <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-200 font-medium">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              <span>River Inflow Discharge</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
              {currentLakhCusecs} Lakh Cusecs
            </span>
          </div>

          <input
            type="range"
            min={25000}
            max={1200000}
            step={25000}
            value={params.river_discharge_cusecs}
            onChange={(e) => onParamsChange({ river_discharge_cusecs: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>{params.river_discharge_cusecs.toLocaleString()} cusecs</span>
            <span className="text-cyan-400">{currentCumecs.toLocaleString()} m³/s</span>
          </div>

          {/* Quick Discharge Buttons */}
          <div className="grid grid-cols-2 gap-1 pt-1">
            {dischargePresets.slice(0, 4).map((dp) => (
              <button
                key={dp.label}
                onClick={() => onParamsChange({ river_discharge_cusecs: dp.cusecs })}
                className={`py-1 px-1.5 rounded text-[10px] font-mono border text-center transition-all ${
                  Math.abs(params.river_discharge_cusecs - dp.cusecs) < 1000
                    ? 'bg-cyan-600/25 text-cyan-200 border-cyan-500 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {dp.label} ({dp.desc})
              </button>
            ))}
          </div>
        </div>

        {/* Rainfall Intensity Slider (20 to 300 mm/hr) */}
        <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-200 font-medium">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              <span>Rainfall Intensity</span>
            </span>
            <span className="font-mono text-sky-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
              {params.rainfall_intensity_mmhr} mm/hr
            </span>
          </div>

          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={params.rainfall_intensity_mmhr}
            onChange={(e) => onParamsChange({ rainfall_intensity_mmhr: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />

          {/* Preset Buttons */}
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>20 mm/hr</span>
            <span>150 mm/hr</span>
            <span>300 mm/hr</span>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1">
            {[20, 50, 100, 150, 200, 300].map((rVal) => (
              <button
                key={rVal}
                onClick={() => onParamsChange({ rainfall_intensity_mmhr: rVal })}
                className={`py-1 px-1 rounded text-[10px] font-mono border text-center transition-all ${
                  params.rainfall_intensity_mmhr === rVal
                    ? 'bg-sky-600/30 text-sky-200 border-sky-500 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {rVal} mm/hr
              </button>
            ))}
          </div>
        </div>

        {/* Storm Duration Selector */}
        <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-slate-200 font-medium">
              <Wind className="w-3.5 h-3.5 text-indigo-400" />
              <span>Precipitation Duration</span>
            </span>
            <span className="font-mono text-indigo-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
              {params.duration_hours} hrs
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1 pt-1">
            {durationOptions.map((dur) => (
              <button
                key={dur}
                onClick={() => onParamsChange({ duration_hours: dur })}
                className={`py-1.5 rounded text-xs font-mono border text-center transition-all ${
                  params.duration_hours === dur
                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {dur}h
              </button>
            ))}
          </div>
        </div>

        {/* GIS Map Layers Control */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5 uppercase tracking-wide">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>GIS & Remote Sensing Layers</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <label className="flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.floodDepth}
                onChange={() => onToggleLayer('floodDepth')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Flood Depth</span>
            </label>

            <label className="flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.velocityVectors}
                onChange={() => onToggleLayer('velocityVectors')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Flow Vectors</span>
            </label>

            <label className="flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.buildings}
                onChange={() => onToggleLayer('buildings')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Buildings (OSM)</span>
            </label>

            <label className="flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={layerVisibility.roads}
                onChange={() => onToggleLayer('roads')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Roads (NH-16)</span>
            </label>

            <label className="flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700 col-span-2">
              <input
                type="checkbox"
                checked={layerVisibility.criticalFacilities}
                onChange={() => onToggleLayer('criticalFacilities')}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Prakasam Barrage & GGH Hospital</span>
            </label>
          </div>
        </div>
      </div>

      {/* Action Button Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-900/80">
        <button
          onClick={onRunSimulation}
          disabled={isSimulating}
          className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg ${
            isSimulating
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98]'
          }`}
        >
          {isSimulating ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Simulating {params.location} Flood...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Run {params.location} Inundation Simulation</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
