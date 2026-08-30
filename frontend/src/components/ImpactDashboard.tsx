import React from 'react';
import { ImpactData } from '../types';
import { DollarSign, Building2, Car, Users, AlertTriangle, ShieldAlert, CheckCircle2, Hospital, Zap, Flame, Waves } from 'lucide-react';

interface ImpactDashboardProps {
  impact: ImpactData | null;
  river?: string;
  location?: string;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({ impact, river = "Krishna River", location = "Vijayawada" }) => {
  if (!impact) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-500 text-xs">
        Run a simulation to generate river-bank vulnerability and damage analytics.
      </div>
    );
  }

  const lossMillions = (impact.total_economic_loss_usd / 1e6).toFixed(2);
  const bankImpacts = impact.bank_impacts;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#070d18] text-slate-200 space-y-6 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Waves className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">{river} ({location}) Flood Risk & Bank Impact</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            USACE HAZUS-MH / European Commission JRC depth-damage stage functions intersecting Vijayawada urban building blocks, road corridors, and riverbanks.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-rose-950/80 text-rose-300 border border-rose-800 rounded-lg flex items-center space-x-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>FEMA / AP State Disaster Management Standard</span>
        </span>
      </div>

      {/* Primary KPI Metric Cards */}
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
          <span className="text-[11px] text-slate-400">Estimated structural replacement cost</span>
        </div>

        {/* Damaged Buildings */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Damaged Structures</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {impact.total_damaged_buildings} <span className="text-xs font-normal text-slate-400">({impact.pct_buildings_damaged}%)</span>
          </div>
          <span className="text-[11px] text-slate-400">Of {impact.total_buildings_in_domain} total structures in domain</span>
        </div>

        {/* Severed Roads */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Severed Corridors (NH-16/NH-65)</span>
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

      {/* River Bank Separation Impact Section */}
      {bankImpacts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* North Bank Impact Card */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 space-y-3 bg-gradient-to-br from-slate-900 to-cyan-950/30">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-cyan-300">North Bank: Vijayawada Urban & Krishna Lanka</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700">Primary Urban</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Inundated Area</span>
                <strong className="text-sm text-cyan-300">{bankImpacts.north_bank.inundated_area_km2} km²</strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Damaged Buildings</span>
                <strong className="text-sm text-amber-300">{bankImpacts.north_bank.damaged_buildings} / {bankImpacts.north_bank.total_buildings}</strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Direct Loss</span>
                <strong className="text-sm text-rose-400">${(bankImpacts.north_bank.loss_usd / 1e6).toFixed(2)}M</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Backwater accumulation along Krishna Lanka floodwall, Bhavanipuram, and low-lying One Town residential blocks.
            </p>
          </div>

          {/* South Bank Impact Card */}
          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-3 bg-gradient-to-br from-slate-900 to-emerald-950/30">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-emerald-300">South Bank: Tadepalli, Undavalli & Amaravati</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700">Capital Region</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Inundated Area</span>
                <strong className="text-sm text-emerald-300">{bankImpacts.south_bank.inundated_area_km2} km²</strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Damaged Buildings</span>
                <strong className="text-sm text-amber-300">{bankImpacts.south_bank.damaged_buildings} / {bankImpacts.south_bank.total_buildings}</strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Direct Loss</span>
                <strong className="text-sm text-rose-400">${(bankImpacts.south_bank.loss_usd / 1e6).toFixed(2)}M</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Riverine overbank spill into Tadepalli floodplains, Undavalli agricultural tracts, and AP Secretariat transit connectors.
            </p>
          </div>
        </div>
      )}

      {/* Critical Facilities Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Critical Infrastructure Vulnerability & Isolation Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Facility Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">River Bank</th>
                <th className="p-3">Inundation Depth</th>
                <th className="p-3">Cutoff Time</th>
                <th className="p-3">Status</th>
                <th className="p-3">Emergency Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {impact.critical_facilities_status.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-sans font-medium text-slate-200 flex items-center space-x-2">
                    {fac.type === 'Hospital' ? (
                      <Hospital className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : fac.type.includes('Barrage') ? (
                      <Waves className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                      <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                    )}
                    <span>{fac.name}</span>
                  </td>
                  <td className="p-3 font-sans text-slate-400">{fac.type}</td>
                  <td className="p-3 font-sans text-slate-300">{fac.bank || 'North Bank'}</td>
                  <td className={`p-3 font-bold ${fac.depth_m > 0.1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fac.depth_m.toFixed(2)} m
                  </td>
                  <td className="p-3 text-slate-300">
                    {fac.cutoff_time_hr !== null ? `T+${fac.cutoff_time_hr} hrs` : 'Safe'}
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
