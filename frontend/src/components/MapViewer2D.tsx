import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GISData, SimulationResult, DamagedBuilding, SatelliteMapMode } from '../types';
import {
  MapPin,
  Navigation,
  Compass,
  Crosshair,
  AlertCircle,
  Info,
  Activity,
  Satellite,
  Layers,
  Radio,
  Sliders,
  Split,
  Eye,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

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
    observedSatellite?: boolean;
  };
  mapMode?: SatelliteMapMode;
  onMapModeChange?: (mode: SatelliteMapMode) => void;
  floodOpacity?: number;
  onFloodOpacityChange?: (opacity: number) => void;
  beforeAfterMode?: boolean;
  onToggleBeforeAfter?: () => void;
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
  sarBackscatterDb: number;
  depthHistory: number[];
  screenX: number;
  screenY: number;
}

export const MapViewer2D: React.FC<MapViewer2DProps> = ({
  gisData,
  simulation,
  currentTimestep,
  layerVisibility,
  mapMode = 'satellite_flood',
  onMapModeChange,
  floodOpacity = 0.65,
  onFloodOpacityChange,
  beforeAfterMode = false,
  onToggleBeforeAfter,
  damagedBuildings,
  onSelectBuilding
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const satelliteImageRef = useRef<HTMLImageElement | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  const [probe, setProbe] = useState<ProbePoint | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Split-screen comparison slider position (percentage 0 to 100)
  const [splitPos, setSplitPos] = useState<number>(50);
  const isSplitDragging = useRef<boolean>(false);

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;
  const opticalMeta = gisData.satellite_telemetry?.optical;
  const sarMeta = gisData.satellite_telemetry?.sar_radar;

  // Load satellite image tiles / composite
  useEffect(() => {
    // High-resolution satellite basemap for Vijayawada (16.50°N, 80.64°E)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Authentic ESRI World Imagery Tile / Sentinel-2 Composite for Vijayawada region
    img.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7354/11860';

    img.onload = () => {
      satelliteImageRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      // Fallback to high-definition raster generator if tile service is offline
      setIsImageLoaded(false);
    };
  }, [gisData.location]);

  // Render 2D Canvas Map
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

    const dem = gisData.dem_grid;
    const minElev = gisData.min_elevation;
    const maxElev = gisData.max_elevation;
    const sarGrid = sarMeta?.backscatter_grid_db;

    // 1. Base Layer Rendering based on Selected Map Mode
    if (mapMode === 'sar_radar' && sarGrid) {
      // Sentinel-1 SAR Calibrated Radar Backscatter Mode (Sigma0 dB)
      for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
          const db = sarGrid[y][x];
          // Map -25 dB (black/water) to 0 dB (white/urban)
          const norm = Math.max(0.0, Math.min(1.0, (db + 25.0) / 25.0));
          const gray = Math.floor(norm * 255);
          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    } else if (mapMode === 'street_carto') {
      // Street / Cartographic Vector Style
      for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
          const elev = dem[y][x];
          if (elev < 15.0) {
            ctx.fillStyle = '#0284c7'; // River Blue
          } else if (elev < 26.0) {
            ctx.fillStyle = '#1e293b'; // Slate Urban Land
          } else {
            ctx.fillStyle = '#334155'; // Hill Rock
          }
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    } else if (mapMode === 'flood_only') {
      // Pure Flood Mask on Neutral Dark Canvas
      ctx.fillStyle = '#070d18';
      ctx.fillRect(offsetX, offsetY, grid_size * cellSize, grid_size * cellSize);
    } else {
      // Default: Satellite Optical Imagery Base
      if (satelliteImageRef.current && isImageLoaded) {
        ctx.drawImage(
          satelliteImageRef.current,
          offsetX,
          offsetY,
          grid_size * cellSize,
          grid_size * cellSize
        );
      } else {
        // High-definition synthetic remote sensing terrain synthesis
        for (let y = 0; y < grid_size; y++) {
          for (let x = 0; x < grid_size; x++) {
            const elev = dem[y][x];
            const normElev = (elev - minElev) / (maxElev - minElev || 1);

            if (elev < 15.0) {
              // Deep Krishna River Channel: Deep Slate Blue
              ctx.fillStyle = '#0c1a2e';
            } else if (elev < 26.0) {
              // Vijayawada / Tadepalli Plain: Earth Olive Green/Slate
              const r = Math.floor(22 + normElev * 20);
              const g = Math.floor(38 + normElev * 30);
              const b = Math.floor(28 + normElev * 15);
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            } else {
              // Indrakeeladri / Gunadala Hills: Rocky Brown Terrain
              const r = Math.floor(65 + normElev * 50);
              const g = Math.floor(50 + normElev * 30);
              const b = Math.floor(35 + normElev * 20);
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            }
            ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    }

    // 2. Semi-Transparent Dynamic Flood Inundation Overlay
    const shouldRenderFlood = (mapMode === 'satellite_flood' || mapMode === 'flood_only' || mapMode === 'street_carto') && layerVisibility.floodDepth && currentSnapshot;

    if (shouldRenderFlood) {
      const depthGrid = currentSnapshot.depth_grid;
      const splitLimitX = beforeAfterMode ? offsetX + (grid_size * cellSize * (splitPos / 100)) : width;

      for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
          const px = offsetX + x * cellSize;
          // If beforeAfterMode is active, only render flood to the right of splitPos
          if (beforeAfterMode && px < splitLimitX) continue;

          const depth = depthGrid[y][x];
          if (depth > 0.02) {
            let r = 2, g = 132, b = 199;
            if (depth < 0.3) {
              r = 56; g = 189; b = 248; // Light Blue Shallow
            } else if (depth < 1.0) {
              r = 2; g = 132; b = 199;  // Medium Inundation
            } else if (depth < 2.0) {
              r = 30; g = 58; b = 138;  // Deep Flood
            } else {
              r = 225; g = 29; b = 72;  // Severe Red
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${floodOpacity})`;
            ctx.fillRect(px, offsetY + y * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    }

    // 3. Observed Satellite Reference Layer (ISRO / Sentinel-1 SAR Mask)
    if (layerVisibility.observedSatellite && gisData.observed_satellite) {
      const satMask = gisData.observed_satellite.grid_mask;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.45)'; // Purple overlay
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.2;

      for (let y = 0; y < grid_size; y++) {
        for (let x = 0; x < grid_size; x++) {
          if (satMask[y] && satMask[y][x] > 0.5) {
            const px = offsetX + x * cellSize;
            const py = offsetY + y * cellSize;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeRect(px, py, cellSize, cellSize);
          }
        }
      }
    }

    // 4. Flow Velocity Particles / Streamlines
    if (layerVisibility.velocityVectors && currentSnapshot) {
      const velGrid = currentSnapshot.velocity_grid;
      const depthGrid = currentSnapshot.depth_grid;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.2;

      for (let y = 1; y < grid_size - 1; y += 3) {
        for (let x = 1; x < grid_size - 1; x += 3) {
          const vel = velGrid[y][x];
          const depth = depthGrid[y][x];
          if (depth > 0.05 && vel > 0.08) {
            const px = offsetX + (x + 0.5) * cellSize;
            const py = offsetY + (y + 0.5) * cellSize;

            const gradX = dem[y][x + 1] - dem[y][x - 1];
            const gradY = dem[y + 1][x] - dem[y - 1][x];
            const angle = Math.atan2(-gradY, -gradX);
            const arrowLen = Math.min(cellSize * 1.3, 3 + vel * 3.2);

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(angle) * arrowLen, py + Math.sin(angle) * arrowLen);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(px + Math.cos(angle) * arrowLen, py + Math.sin(angle) * arrowLen, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 5. Road Networks (NH-16, NH-65, MG Road)
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

        ctx.strokeStyle = roadDepth < 0.15 ? '#22c55e' : roadDepth < 0.30 ? '#eab308' : '#ef4444';
        ctx.lineWidth = road.critical_evacuation_route ? 3.2 : 1.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
    }

    // 6. Buildings (OSM Footprints)
    if (layerVisibility.buildings) {
      const buildings = gisData.assets.buildings;
      const depthGrid = currentSnapshot?.depth_grid;

      buildings.forEach((b) => {
        const bx = offsetX + b.grid_x * cellSize;
        const by = offsetY + b.grid_y * cellSize;
        const bDepth = depthGrid ? depthGrid[b.grid_y][b.grid_x] || 0 : 0;

        if (bDepth <= 0.05) {
          ctx.fillStyle = '#64748b';
          ctx.strokeStyle = '#94a3b8';
        } else if (bDepth < 0.3) {
          ctx.fillStyle = '#eab308';
          ctx.strokeStyle = '#fef08a';
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#fecaca';
        }

        ctx.lineWidth = 1;
        ctx.fillRect(bx + 1, by + 1, cellSize - 2, cellSize - 2);
        ctx.strokeRect(bx + 1, by + 1, cellSize - 2, cellSize - 2);
      });
    }

    // 7. Critical Infrastructure & Landmarks
    if (layerVisibility.criticalFacilities) {
      const facilities = gisData.assets.critical_facilities;
      const depthGrid = currentSnapshot?.depth_grid;

      facilities.forEach((fac) => {
        const fx = offsetX + (fac.grid_x + 0.5) * cellSize;
        const fy = offsetY + (fac.grid_y + 0.5) * cellSize;
        const fDepth = depthGrid ? depthGrid[fac.grid_y][fac.grid_x] || 0 : 0;

        ctx.beginPath();
        ctx.arc(fx, fy, 8, 0, Math.PI * 2);
        ctx.fillStyle = fDepth > 0.1 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx.fillStyle = fac.type === 'Hospital' ? '#ef4444' : fac.type.includes('Barrage') ? '#0284c7' : '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 8. Before/After Split Line Renderer
    if (beforeAfterMode) {
      const splitX = offsetX + (grid_size * cellSize * (splitPos / 100));
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(splitX, offsetY);
      ctx.lineTo(splitX, offsetY + grid_size * cellSize);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badges
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(splitX - 85, offsetY + 12, 80, 22);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('BEFORE FLOOD', splitX - 80, offsetY + 27);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(splitX + 5, offsetY + 12, 80, 22);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.fillText('PEAK FLOOD', splitX + 10, offsetY + 27);
    }

    // 9. Probe Reticle
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
  }, [
    gisData,
    simulation,
    currentTimestep,
    layerVisibility,
    mapMode,
    floodOpacity,
    beforeAfterMode,
    splitPos,
    zoom,
    pan,
    probe,
    isImageLoaded
  ]);

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
      const sarDb = sarMeta?.backscatter_grid_db[gy]?.[gx] ?? -12.5;
      const history = simulation ? simulation.snapshots.map(s => s.depth_grid[gy][gx]) : [];

      setProbe({
        gridX: gx,
        gridY: gy,
        elevation: elev,
        currentDepth: curDepth,
        peakDepth: peakDepth,
        velocity: vel,
        sarBackscatterDb: sarDb,
        depthHistory: history,
        screenX: clickX,
        screenY: clickY
      });
    } else {
      setProbe(null);
    }
  };

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

      {/* Top Floating Controls: Remote Sensing Layer Modes & Opacity */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2 max-w-xl">
        {/* Layer Mode Selector Bar */}
        <div className="glass-panel p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-800 shadow-2xl text-xs">
          <button
            onClick={() => onMapModeChange?.('satellite_flood')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mapMode === 'satellite_flood'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellite + Flood</span>
          </button>

          <button
            onClick={() => onMapModeChange?.('satellite_optical')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mapMode === 'satellite_optical'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Optical Base</span>
          </button>

          <button
            onClick={() => onMapModeChange?.('sar_radar')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mapMode === 'sar_radar'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-purple-300" />
            <span>Sentinel-1 SAR</span>
          </button>

          <button
            onClick={() => onMapModeChange?.('street_carto')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all ${
              mapMode === 'street_carto'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Carto</span>
          </button>

          <button
            onClick={onToggleBeforeAfter}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all border ${
              beforeAfterMode
                ? 'bg-amber-600/30 text-amber-200 border-amber-500 font-bold'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Split-Screen Comparison: Before Flood vs Peak Inundation"
          >
            <Split className="w-3.5 h-3.5 text-amber-400" />
            <span>Split View</span>
          </button>
        </div>

        {/* Flood Opacity Slider Floating Widget */}
        <div className="glass-panel px-3 py-2 rounded-xl flex items-center space-x-3 text-xs border border-slate-800 shadow-xl text-slate-300">
          <span className="flex items-center space-x-1.5 font-medium">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flood Opacity:</span>
          </span>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={floodOpacity}
            onChange={(e) => onFloodOpacityChange?.(parseFloat(e.target.value))}
            className="w-32 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="font-mono text-cyan-400 font-bold w-10 text-right">
            {Math.round(floodOpacity * 100)}%
          </span>
        </div>
      </div>

      {/* Satellite Sensor Telemetry Metadata Badge */}
      <div className="absolute top-4 right-4 z-10 glass-panel p-3 rounded-2xl border border-slate-800 shadow-2xl text-xs space-y-1.5 max-w-xs text-slate-300">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-100 flex items-center space-x-1.5">
            <Satellite className="w-4 h-4 text-cyan-400" />
            <span>Earth Observation Telemetry</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
            10m GSD
          </span>
        </div>

        <div className="space-y-1 text-[11px] font-mono text-slate-400">
          <div className="flex justify-between">
            <span>Sensor:</span>
            <span className="text-slate-200">{mapMode === 'sar_radar' ? 'Sentinel-1 C-SAR' : 'Sentinel-2 MSI / High-Res Optical'}</span>
          </div>
          <div className="flex justify-between">
            <span>Location:</span>
            <span className="text-cyan-300">Vijayawada (16.50°N, 80.64°E)</span>
          </div>
          <div className="flex justify-between">
            <span>Pass Date:</span>
            <span className="text-slate-200">{mapMode === 'sar_radar' ? '02-SEP-2024' : '18-AUG-2024 (Cloud-Free)'}</span>
          </div>
          <div className="flex justify-between">
            <span>Provider:</span>
            <span className="text-slate-200">ESA Copernicus / NRSC / ESRI</span>
          </div>
        </div>
      </div>

      {/* Professional Remote Sensing Map Legend */}
      <div className="absolute bottom-6 left-4 z-10 glass-panel p-3.5 rounded-2xl shadow-2xl text-xs space-y-2.5 w-72 border border-slate-800">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
          <span>Satellite Inundation Legend</span>
          <span className="font-mono text-cyan-400">0.0m - 3.5m+</span>
        </div>

        {/* Dynamic Hydraulic Color Gradient */}
        <div className="h-3 rounded-md bg-gradient-to-r from-sky-300 via-blue-600 via-indigo-900 to-rose-600 shadow-inner"></div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>0.0m</span>
          <span>0.5m</span>
          <span>1.0m</span>
          <span>2.0m</span>
          <span>3.0m+</span>
        </div>

        {/* Features Legend */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
            <span>Observed (SAR)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span>
            <span>Simulated Flood</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span>NH-16 Passable</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
            <span>Severed Highway</span>
          </span>
        </div>
      </div>

      {/* Point Hydrograph & SAR Probe Inspector */}
      {probe && (
        <div className="absolute bottom-6 right-4 z-20 glass-panel p-4 rounded-2xl shadow-2xl border border-cyan-500/30 w-80 text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>Location Radar & Hydrograph Probe</span>
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
              <strong className="font-mono text-sm text-slate-100">{probe.elevation.toFixed(2)} m MSL</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Simulated Water Depth</span>
              <strong className="font-mono text-sm text-cyan-400">{probe.currentDepth.toFixed(2)} m</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Flow Velocity</span>
              <strong className="font-mono text-sm text-emerald-400">{probe.velocity.toFixed(2)} m/s</strong>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">SAR Backscatter (σ⁰)</span>
              <strong className="font-mono text-sm text-purple-300">{probe.sarBackscatterDb.toFixed(1)} dB</strong>
            </div>
          </div>

          <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Depth Over Time (0h - 6h)</span>
              <span className="text-cyan-400">Peak: {probe.peakDepth.toFixed(2)}m</span>
            </div>
            <div className="h-12 flex items-end space-x-1 pt-1">
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
