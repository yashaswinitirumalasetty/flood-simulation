import React from 'react';
import { WeatherData } from '../types';
import { CloudRain, Wind, Droplets, Thermometer, AlertTriangle, Compass, Clock, X, ShieldAlert } from 'lucide-react';

interface WeatherPanelProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherData | undefined;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({
  isOpen,
  onClose,
  weather
}) => {
  if (!isOpen || !weather) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 text-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/30">
              <CloudRain className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">{weather.location} Meteorological Intelligence</h3>
              <span className="text-[11px] text-sky-400 font-mono">{weather.river} Basin Telemetry</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* IMD Severe Alert Banner */}
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 flex items-start space-x-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-rose-300 font-mono uppercase">{weather.alert_level}</span>
              <span className="text-[10px] text-rose-400 bg-rose-900/60 px-1.5 py-0.2 rounded">Active Warning</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">{weather.alert_message}</p>
          </div>
        </div>

        {/* Current Atmospheric Conditions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Thermometer className="w-3.5 h-3.5 text-orange-400" />
              <span>Temperature</span>
            </span>
            <div className="text-xl font-bold font-mono text-slate-100">{weather.temperature_c}°C</div>
            <span className="text-[10px] text-slate-500">{weather.condition}</span>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Humidity</span>
            </span>
            <div className="text-xl font-bold font-mono text-cyan-400">{weather.humidity_pct}%</div>
            <span className="text-[10px] text-slate-500">Relative Humidity</span>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Wind className="w-3.5 h-3.5 text-indigo-400" />
              <span>Wind Speed</span>
            </span>
            <div className="text-xl font-bold font-mono text-indigo-300">{weather.wind_speed_kmh} km/h</div>
            <span className="text-[10px] text-slate-500">Gusts up to 55 km/h</span>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              <span>Rainfall Prob</span>
            </span>
            <div className="text-xl font-bold font-mono text-sky-400">{weather.precipitation_prob_pct}%</div>
            <span className="text-[10px] text-slate-500">Recorded: {weather.recorded_24h_rain_mm} mm</span>
          </div>
        </div>

        {/* 24-Hour Forecast Timeline */}
        {weather.hourly_forecast && (
          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Catchment Rainfall Evolution (Next 24h)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">IMD Doppler Radar Telemetry</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
              {weather.hourly_forecast.map((hf, i) => (
                <div key={i} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-mono">{hf.hour}</span>
                  <CloudRain className="w-3.5 h-3.5 text-sky-400 mx-auto" />
                  <span className="text-xs font-bold text-sky-300 font-mono block">{hf.rain_mmhr} mm</span>
                  <span className="text-[9px] text-slate-500 block">{hf.temp_c}°C</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close Weather Panel
          </button>
        </div>
      </div>
    </div>
  );
};
