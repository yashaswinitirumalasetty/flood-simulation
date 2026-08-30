import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, Gauge, Droplet, Sparkles } from 'lucide-react';
import { SimulationResult } from '../types';

interface TimeSliderControllerProps {
  simulation: SimulationResult | null;
  currentTimestep: number;
  onTimestepChange: (step: number) => void;
}

export const TimeSliderController: React.FC<TimeSliderControllerProps> = ({
  simulation,
  currentTimestep,
  onTimestepChange
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  const snapshots = simulation?.snapshots || [];
  const maxSteps = Math.max(0, snapshots.length - 1);
  const currentSnap = snapshots[currentTimestep] || null;

  // Auto playback interval
  useEffect(() => {
    let interval: any;
    if (isPlaying && maxSteps > 0) {
      interval = setInterval(() => {
        onTimestepChange(currentTimestep >= maxSteps ? 0 : currentTimestep + 1);
      }, 1200 / speedMultiplier);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxSteps, speedMultiplier, currentTimestep, onTimestepChange]);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl glass-panel p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 text-slate-200 select-none">
      <div className="flex flex-col space-y-2.5">
        {/* Top Stats Bar */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 font-semibold text-slate-100">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-300">
                T + {currentSnap ? `${currentSnap.time_hours.toFixed(1)} hrs` : '00:00'}
              </span>
              <span className="text-slate-500">/ {simulation ? `${simulation.total_simulation_hours.toFixed(1)}h` : '6.0h'}</span>
            </span>

            {simulation?.engine && (
              <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{simulation.engine.includes('Fast AI') ? 'AI Surrogate (FNO)' : '2D Physics (SWE)'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1 text-slate-400">
              <Droplet className="w-3.5 h-3.5 text-blue-400" />
              <span>Inundated Area:</span>
              <strong className="text-slate-100">{currentSnap ? `${currentSnap.inundated_area_km2.toFixed(3)} km²` : '0.000 km²'}</strong>
            </div>

            <div className="hidden sm:flex items-center space-x-1 text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              <span>Max Depth:</span>
              <strong className="text-slate-100">{currentSnap ? `${currentSnap.max_depth_m.toFixed(2)} m` : '0.00 m'}</strong>
            </div>
          </div>
        </div>

        {/* Timeline Slider with Hour Tick Marks */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={maxSteps}
            step={1}
            value={currentTimestep}
            onChange={(e) => onTimestepChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 z-10"
          />
        </div>

        {/* Bottom Playback & Speed Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onTimestepChange(0)}
              title="Rewind to start"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onTimestepChange(Math.max(0, currentTimestep - 1))}
              title="Previous Timestep"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-md shadow-cyan-500/20"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play Animation</span>
                </>
              )}
            </button>

            <button
              onClick={() => onTimestepChange(Math.min(maxSteps, currentTimestep + 1))}
              title="Next Timestep"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Multipliers */}
          <div className="flex items-center space-x-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeedMultiplier(s)}
                className={`px-2 py-0.5 rounded transition-all ${
                  speedMultiplier === s
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
