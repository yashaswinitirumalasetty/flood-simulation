import React from 'react';
import { ImpactData } from '../types';
import { DollarSign, Building2, Car, Users, AlertTriangle, ShieldAlert, CheckCircle2, Hospital, Zap, Flame } from 'lucide-react';

interface ImpactDashboardProps {
  impact: ImpactData | null;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({ impact }) => {
  if (!impact) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-500">
        Run a simulation to generate risk & impact analytics.
      </div>
    );
  }

  const lossMillions = (impact.total_economic_loss_usd / 1e6).toFixed(2);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#070d18] text-slate-200 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Asset Vulnerability & Economic Damage Intelligence</h2>
          <p className="text-xs text-slate-400">
            Calculated via USACE HAZUS-MH / European Commission JRC depth-damage stage functions intersecting building footprints and road graphs.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-rose-950/80 text-rose-300 border border-rose-800 rounded-lg flex items-center space-x-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>FEMA HAZUS Standard Compliant</span>
        </span>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Loss */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Direct Structural Loss</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">${lossMillions}M</div>
          <span className="text-[11px] text-slate-400">Estimated replacement costs</span>
        </div>

        {/* Damaged Buildings */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Inundated Buildings</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{impact.total_damaged_buildings}</div>
          <span className="text-[11px] text-slate-400">Structures exceeding 0.05m depth</span>
        </div>

        {/* Severed Roads */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Severed Corridors</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Car className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-orange-400">{impact.road_network.impassable_roads_km} km</div>
          <span className="text-[11px] text-slate-400">Of {impact.road_network.total_network_km} km total road network</span>
        </div>

        {/* Displaced Population */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Displaced Population</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {impact.population_metrics.displaced_population.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {impact.population_metrics.exposed_population.toLocaleString()} exposed residents
          </span>
        </div>
      </div>

      {/* Breakdown Section: Loss by Typology & Road Passability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loss by Typology */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Economic Loss by Building Typology</h3>
          <div className="space-y-3">
            {Object.entries(impact.loss_by_building_type).map(([type, loss]) => {
              const pct = impact.total_economic_loss_usd > 0 ? (loss / impact.total_economic_loss_usd) * 100 : 0;
              const count = impact.damaged_count_by_type[type] || 0;
              return (
                <div key={type} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-300">{type} ({count} units)</span>
                    <span className="font-mono text-slate-200">${(loss / 1e3).toFixed(1)}k ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        type === 'Residential' ? 'bg-cyan-500' : type === 'Commercial' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Road Network Passability Breakdown */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Road Network Passability Distribution</h3>
          <div className="space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-emerald-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fully Passable (&lt;0.15m)</span>
                </span>
                <span className="font-mono">{impact.road_network.passable_roads_km} km</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  style={{ width: `${(impact.road_network.passable_roads_km / impact.road_network.total_network_km) * 100}%` }}
                  className="h-full bg-emerald-500 rounded-full"
                ></div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-amber-400 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>High-Clearance 4WD Only (0.15m - 0.30m)</span>
                </span>
                <span className="font-mono">{impact.road_network.emergency_only_roads_km} km</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  style={{ width: `${(impact.road_network.emergency_only_roads_km / impact.road_network.total_network_km) * 100}%` }}
                  className="h-full bg-amber-500 rounded-full"
                ></div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-rose-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Impassable / Severed (&ge;0.30m)</span>
                </span>
                <span className="font-mono">{impact.road_network.impassable_roads_km} km</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  style={{ width: `${(impact.road_network.impassable_roads_km / impact.road_network.total_network_km) * 100}%` }}
                  className="h-full bg-rose-500 rounded-full"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Facilities Detailed Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Critical Infrastructure Vulnerability & Isolation Timeline</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Facility Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Inundation Depth</th>
                <th className="p-3">Cutoff Time</th>
                <th className="p-3">Operational Status</th>
                <th className="p-3">Emergency Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {impact.critical_facilities_status.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-sans font-medium text-slate-200 flex items-center space-x-2">
                    {fac.type === 'Hospital' ? (
                      <Hospital className="w-4 h-4 text-rose-400" />
                    ) : fac.type === 'Fire Station' ? (
                      <Flame className="w-4 h-4 text-orange-400" />
                    ) : (
                      <Zap className="w-4 h-4 text-yellow-400" />
                    )}
                    <span>{fac.name}</span>
                  </td>
                  <td className="p-3 font-sans text-slate-400">{fac.type}</td>
                  <td className={`p-3 font-bold ${fac.depth_m > 0.1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fac.depth_m.toFixed(2)} m
                  </td>
                  <td className="p-3 text-slate-300">
                    {fac.cutoff_time_hr !== null ? `T+${fac.cutoff_time_hr} hrs` : 'None (Safe)'}
                  </td>
                  <td className="p-3 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      fac.is_flooded
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {fac.status}
                    </span>
                  </td>
                  <td className="p-3 font-sans text-slate-400">{fac.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
