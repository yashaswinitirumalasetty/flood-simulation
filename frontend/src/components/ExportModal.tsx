import React from 'react';
import { X, FileText, Download, Database, Check } from 'lucide-react';
import { SimulationResult, ImpactData, SimulationParameters } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: SimulationResult | null;
  impact: ImpactData | null;
  params: SimulationParameters;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  simulation,
  impact,
  params
}) => {
  if (!isOpen) return null;

  const downloadJSON = (filename: string, data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!impact) return;
    const headers = "ID,Name,Type,Latitude,Longitude,PeakDepth_m,DamagePct,LossUSD,RiskTier\n";
    const rows = impact.damaged_buildings_list.map(b => 
      `"${b.id}","${b.name}","${b.type}",${b.lat},${b.lon},${b.depth_m},${b.damage_pct},${b.loss_usd},"${b.risk_tier}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HydroForge_Damaged_Assets_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-slate-100">Export Simulation & Risk Artifacts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Generate and download regulatory compliance datasets, asset inventories, and hydrodynamic raster grids.
        </p>

        <div className="space-y-3">
          {/* Executive Report JSON */}
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Executive Flood Risk Assessment</h4>
              <span className="text-[11px] text-slate-500">JSON • Full damage summary, parameters & metrics</span>
            </div>
            <button
              onClick={() => downloadJSON(`HydroForge_Report_${Date.now()}.json`, { params, simulation, impact })}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>

          {/* Asset Damage CSV */}
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Damaged Asset Inventory</h4>
              <span className="text-[11px] text-slate-500">CSV • Parcel & building-level HAZUS loss breakdown</span>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Hydrodynamic Grid Matrix */}
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Spatiotemporal Depth & Velocity Grids</h4>
              <span className="text-[11px] text-slate-500">JSON • 2D 48x48 Matrix time-series array</span>
            </div>
            <button
              onClick={() => downloadJSON(`HydroForge_Depth_Grids_${Date.now()}.json`, simulation?.snapshots)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Export Grid</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
