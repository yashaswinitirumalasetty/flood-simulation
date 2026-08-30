import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GISData, SimulationResult, DamagedBuilding } from '../types';
import { MapPin, Navigation, Compass, Crosshair, AlertCircle, Info, Activity } from 'lucide-react';

interface MapViewer2DProps {
  gisData: GISData;
  simulation: SimulationResult | null;
  currentTimestep: number;
  layerVisibility: {
    dem: boolean;
    floodDepth: boolean;
    velocityVectors: boolean;
    buildings: boolean;
    roads: boolean;
    criticalFacilities: boolean;
  };
  damagedBuildings?: DamagedBuilding[];
  onSelectBuilding?: (building: any) => void;
}

interface ProbePoint {
  gridX: number;
  gridY: number;
  elevation: number;
  currentDepth: number;
  peakDepth: number;
  velocity: number;
  depthHistory: number[];
  screenX: number;
  screenY: number;
}

export const MapViewer2D: React.FC<MapViewer2DProps> = ({
  gisData,
  simulation,
  currentTimestep,
  layerVisibility,
  damagedBuildings,
  onSelectBuilding
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<ProbePoint | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<any | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;

  // Render function
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = (Math.min(width, height) / grid_size) * zoom;
    const offsetX = (width - grid_size * cellSize) / 2 + pan.x;
    const offsetY = (height - grid_size * cellSize) / 2 + pan.y;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Base Terrain DEM
    const dem = gisData.dem_grid;
    const minElev = gisData.min_elevation;
    const maxElev = gisData.max_elevation;

    for (let y = 0; y < grid_size; y++) {
      for (let x = 0; x < grid_size; x++) {
        const elev = dem[y][x];
        const normElev = (elev - minElev) / (maxElev - minElev || 1);

        // Terrain color palette: Valley dark slate/green -> Highlands brown/sand
        const r = Math.floor(18 + normElev * 45);
        const g = Math.floor(28 + normElev * 48);
        const b = Math.floor(38 + normElev * 30);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }

    // 2. Draw Dynamic Flood Depth Raster
    if (layerVisibility.floodDepth && currentSnapshot) {
      const depthGrid = currentSnapshot.depth_grid;

      for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
          const depth = depthGrid[y][x];
          if (depth > 0.02) {
            // Hydraulic Color Ramp: Light Cyan -> Royal Blue -> Deep Ocean -> Red Shock
            let r = 2, g = 132, b = 199, alpha = 0.65;
            if (depth < 0.3) {
              // Shallow water: Cyan
              r = 56; g = 189; b = 248; alpha = Math.min(0.7, 0.3 + depth * 1.5);
            } else if (depth < 1.0) {
              // Moderate: Ocean Blue
              r = 2; g = 132; b = 199; alpha = 0.8;
            } else if (depth < 2.0) {
              // Deep: Dark Indigo/Navy
              r = 30; g = 58; b = 138; alpha = 0.88;
            } else {
              // Severe Flood: Crimson
              r = 225; g = 29; b = 72; alpha = 0.92;
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    }

    // 3. Draw Animated Velocity Flow Vectors
    if (layerVisibility.velocityVectors && currentSnapshot) {
      const velGrid = currentSnapshot.velocity_grid;
      const depthGrid = currentSnapshot.depth_grid;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;

      for (let y = 1; y < grid_size - 1; y += 3) {
        for (let x = 1; x < grid_size - 1; x += 3) {
          const vel = velGrid[y][x];
          const depth = depthGrid[y][x];
          if (depth > 0.05 && vel > 0.08) {
            const px = offsetX + (x + 0.5) * cellSize;
            const py = offsetY + (y + 0.5) * cellSize;
            
            // Flow vector direction driven by topography slope
            const gradX = dem[y][x + 1] - dem[y][x - 1];
            const gradY = dem[y + 1][x] - dem[y - 1][x];
            const angle = Math.atan2(-gradY, -gradX);
            const arrowLen = Math.min(cellSize * 1.2, 3 + vel * 3);

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(angle) * arrowLen, py + Math.sin(angle) * arrowLen);
            ctx.stroke();

            // Arrowhead
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(px + Math.cos(angle) * arrowLen, py + Math.sin(angle) * arrowLen, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 4. Draw Road Network Lines
    if (layerVisibility.roads) {
      const roads = gisData.assets.roads;
      const depthGrid = currentSnapshot?.depth_grid;

      roads.forEach((road) => {
        const sx = offsetX + (road.start_x + 0.5) * cellSize;
        const sy = offsetY + (road.start_y + 0.5) * cellSize;
        const ex = offsetX + (road.end_x + 0.5) * cellSize;
        const ey = offsetY + (road.end_y + 0.5) * cellSize;

        let roadDepth = 0;
        if (depthGrid) {
          roadDepth = Math.max(depthGrid[road.start_y][road.start_x] || 0, depthGrid[road.end_y][road.end_x] || 0);
        }

        // Passability color
        if (roadDepth < 0.15) {
          ctx.strokeStyle = '#22c55e'; // Green Passable
        } else if (roadDepth < 0.30) {
          ctx.strokeStyle = '#eab308'; // Yellow 4WD
        } else {
          ctx.strokeStyle = '#ef4444'; // Red Severed
        }

        ctx.lineWidth = road.critical_evacuation_route ? 2.8 : 1.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
    }

    // 5. Draw Building Footprints
    if (layerVisibility.buildings) {
      const buildings = gisData.assets.buildings;
      const depthGrid = currentSnapshot?.depth_grid;

      buildings.forEach((b) => {
        const bx = offsetX + b.grid_x * cellSize;
        const by = offsetY + b.grid_y * cellSize;
        const bDepth = depthGrid ? depthGrid[b.grid_y][b.grid_x] || 0 : 0;

        // Damage Tier Color
        if (bDepth <= 0.05) {
          ctx.fillStyle = '#64748b'; // Safe Grey
          ctx.strokeStyle = '#94a3b8';
        } else if (bDepth < 0.3) {
          ctx.fillStyle = '#eab308'; // Low Risk Yellow
          ctx.strokeStyle = '#fef08a';
        } else if (bDepth < 1.0) {
          ctx.fillStyle = '#f97316'; // Moderate Orange
          ctx.strokeStyle = '#fed7aa';
        } else {
          ctx.fillStyle = '#ef4444'; // High/Critical Red
          ctx.strokeStyle = '#fecaca';
        }

        ctx.lineWidth = 1;
        ctx.fillRect(bx + 1, by + 1, cellSize - 2, cellSize - 2);
        ctx.strokeRect(bx + 1, by + 1, cellSize - 2, cellSize - 2);
      });
    }

    // 6. Draw Critical Facilities
    if (layerVisibility.criticalFacilities) {
      const facilities = gisData.assets.critical_facilities;
      const depthGrid = currentSnapshot?.depth_grid;

      facilities.forEach((fac) => {
        const fx = offsetX + (fac.grid_x + 0.5) * cellSize;
        const fy = offsetY + (fac.grid_y + 0.5) * cellSize;
        const fDepth = depthGrid ? depthGrid[fac.grid_y][fac.grid_x] || 0 : 0;

        // Outer glow halo
        ctx.beginPath();
        ctx.arc(fx, fy, 8, 0, Math.PI * 2);
        ctx.fillStyle = fDepth > 0.1 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.3)';
        ctx.fill();

        // Marker pin
        ctx.beginPath();
        ctx.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx.fillStyle = fac.type === 'Hospital' ? '#ef4444' : fac.type === 'Fire Station' ? '#f97316' : '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 7. Draw Probe Reticle
    if (probe) {
      const px = offsetX + (probe.gridX + 0.5) * cellSize;
      const py = offsetY + (probe.gridY + 0.5) * cellSize;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px - 14, py);
      ctx.lineTo(px + 14, py);
      ctx.moveTo(px, py - 14);
      ctx.lineTo(px, py + 14);
      ctx.stroke();
    }
  }, [gisData, simulation, currentTimestep, layerVisibility, zoom, pan, probe]);

  // Handle Resize and Animation Trigger
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        renderMap();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderMap]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Handle Map Click for Point Probe
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cellSize = (Math.min(canvas.width, canvas.height) / grid_size) * zoom;
    const offsetX = (canvas.width - grid_size * cellSize) / 2 + pan.x;
    const offsetY = (canvas.height - grid_size * cellSize) / 2 + pan.y;

    const gx = Math.floor((clickX - offsetX) / cellSize);
    const gy = Math.floor((clickY - offsetY) / cellSize);

    if (gx >= 0 && gx < grid_size && gy >= 0 && gy < grid_size) {
      const elev = gisData.dem_grid[gy][gx];
      const curDepth = currentSnapshot?.depth_grid[gy][gx] || 0;
      const peakDepth = simulation?.peak_depth_grid[gy][gx] || 0;
      const vel = currentSnapshot?.velocity_grid[gy][gx] || 0;

      // Extract time-series depth history across all snapshots
      const history = simulation ? simulation.snapshots.map(s => s.depth_grid[gy][gx]) : [];

      setProbe({
        gridX: gx,
        gridY: gy,
        elevation: elev,
        currentDepth: curDepth,
        peakDepth: peakDepth,
        velocity: vel,
        depthHistory: history,
        screenX: clickX,
        screenY: clickY
      });
    } else {
      setProbe(null);
    }
  };

  // Zoom and Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(prev => Math.min(3.5, Math.max(0.6, prev * zoomDelta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#070d18] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        <div className="glass-panel px-3 py-2 rounded-xl text-xs flex items-center space-x-3 text-slate-300 shadow-xl">
          <div className="flex items-center space-x-1.5">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">2D Spatial Engine</span>
          </div>
          <span className="text-slate-500">•</span>
          <span>Zoom: <strong className="font-mono text-cyan-400">{zoom.toFixed(1)}x</strong></span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Click to probe hydrograph</span>
        </div>
      </div>

      {/* Dynamic Hydraulic Color-Ramp Legend */}
      <div className="absolute bottom-6 left-4 z-10 glass-panel p-3 rounded-xl shadow-2xl text-xs space-y-2 w-64 border border-slate-800">
        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-300">
          <span>Inundation Depth (m)</span>
          <span className="font-mono text-cyan-400">0.0m - 3.0m+</span>
        </div>
        <div className="h-3 rounded-md bg-gradient-to-r from-sky-300 via-blue-600 via-indigo-900 to-rose-600 shadow-inner"></div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>0.0m</span>
          <span>0.5m</span>
          <span>1.0m</span>
          <span>2.0m</span>
          <span>3.0m+</span>
        </div>
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Passable</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>4WD Only</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Severed Road</span>
          </span>
        </div>
      </div>

      {/* Point Probe Inspector Overlay */}
      {probe && (
        <div className="absolute top-4 right-4 z-20 glass-panel p-4 rounded-xl shadow-2xl border border-cyan-500/30 w-72 text-xs space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>Point Hydrograph Probe</span>
            </span>
            <button
              onClick={() => setProbe(null)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Ground Elevation</span>
              <strong className="font-mono text-sm text-slate-100">{probe.elevation.toFixed(2)} m</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Current Water Depth</span>
              <strong className="font-mono text-sm text-cyan-400">{probe.currentDepth.toFixed(2)} m</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Peak Max Depth</span>
              <strong className="font-mono text-sm text-indigo-400">{probe.peakDepth.toFixed(2)} m</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Flow Velocity</span>
              <strong className="font-mono text-sm text-emerald-400">{probe.velocity.toFixed(2)} m/s</strong>
            </div>
          </div>

          {/* Mini Hydrograph Curve Sparkline */}
          <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Depth Over Time (0h - 6h)</span>
              <span className="text-cyan-400">Peak: {probe.peakDepth.toFixed(2)}m</span>
            </div>
            <div className="h-14 flex items-end space-x-1 pt-1">
              {probe.depthHistory.map((d, i) => {
                const heightPct = Math.min(100, Math.max(10, (d / (probe.peakDepth || 1)) * 100));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-all ${
                        i === currentTimestep ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-cyan-700/60'
                      }`}
                    ></div>
                    <span className="text-[8px] text-slate-500 font-mono mt-1">{i}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
