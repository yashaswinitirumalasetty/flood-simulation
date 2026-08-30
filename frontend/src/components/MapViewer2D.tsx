import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GISData, SimulationResult, DamagedBuilding, SatelliteMapMode } from '../types';
import {
  Satellite,
  Layers,
  Radio,
  Sliders,
  Split,
  Eye,
  Activity,
  MapPin,
  Maximize2,
  Crosshair,
  Bug
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

interface ProbeInfo {
  lat: number;
  lng: number;
  elevation_m: number;
  depth_m: number;
  peak_depth_m: number;
  velocity_ms: number;
  locality: string;
}

export const MapViewer2D: React.FC<MapViewer2DProps> = ({
  gisData,
  simulation,
  currentTimestep,
  layerVisibility,
  mapMode = 'satellite_flood',
  onMapModeChange,
  floodOpacity = 0.55,
  onFloodOpacityChange,
  beforeAfterMode = false,
  onToggleBeforeAfter,
  damagedBuildings,
  onSelectBuilding
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const floodCanvasLayerRef = useRef<L.ImageOverlay | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const debugGroupRef = useRef<L.LayerGroup | null>(null);

  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [probe, setProbe] = useState<ProbeInfo | null>(null);

  // Center coordinate for Vijayawada & Prakasam Barrage
  const centerLat = 16.5065;
  const centerLng = 80.6050;

  // Geographic bounds for Vijayawada simulation domain
  const bounds: L.LatLngBoundsExpression = [
    [16.4800, 80.5750], // South-West (Tadepalli/Undavalli)
    [16.5400, 80.6800]  // North-East (Vijayawada Urban / Gunadala)
  ];

  // 1. Initialize Real Leaflet Map with True Satellite Tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false
    });

    // Add Esri World Imagery (Legitimate, high-resolution global satellite imagery)
    const esriSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Source: Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community'
      }
    ).addTo(map);

    tileLayerRef.current = esriSatellite;

    // Layer groups for markers and overlays
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    const debugGroup = L.layerGroup().addTo(map);
    debugGroupRef.current = debugGroup;

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Click handler for point inspection
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      // Calculate normalized grid position
      const minLat = 16.4800, maxLat = 16.5400;
      const minLon = 80.5750, maxLon = 80.6800;
      const grid_size = gisData.grid_size;

      const normX = (lng - minLon) / (maxLon - minLon);
      const normY = (maxLat - lat) / (maxLat - minLat);

      const gx = Math.min(grid_size - 1, Math.max(0, Math.floor(normX * grid_size)));
      const gy = Math.min(grid_size - 1, Math.max(0, Math.floor(normY * grid_size)));

      const currentSnap = simulation?.snapshots[currentTimestep];
      const curDepth = currentSnap?.depth_grid[gy]?.[gx] ?? 0.0;
      const peakDepth = simulation?.peak_depth_grid[gy]?.[gx] ?? 0.0;
      const vel = currentSnap?.velocity_grid[gy]?.[gx] ?? 0.0;
      const elev = gisData.dem_grid[gy]?.[gx] ?? 18.5;

      let locality = "Vijayawada Urban";
      if (lat < 16.505) locality = "Tadepalli / South Bank";
      else if (lng < 80.605) locality = "Indrakeeladri / Bhavanipuram";
      else locality = "Krishna Lanka / Governorpet";

      setProbe({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        elevation_m: Number(elev.toFixed(1)),
        depth_m: Number(curDepth.toFixed(2)),
        peak_depth_m: Number(peakDepth.toFixed(2)),
        velocity_ms: Number(vel.toFixed(2)),
        locality
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Real Map Tile Providers based on Selected Mode
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    let newTileLayer: L.TileLayer;

    if (mapMode === 'street_carto') {
      // CartoDB Voyager / OpenStreetMap Street Map
      newTileLayer = L.tileLayer(
        'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors © CARTO'
        }
      );
    } else if (mapMode === 'sar_radar') {
      // High-contrast Carto Dark for SAR-style radar backscatter base
      newTileLayer = L.tileLayer(
        'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        {
          maxZoom: 19,
          attribution: 'SAR Radar Style Base: © CARTO © OpenStreetMap'
        }
      );
    } else {
      // Default: Genuine Esri World Imagery (High-Resolution Real Satellite)
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA FSA, USGS'
        }
      );
    }

    newTileLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapMode]);

  // 3. Render Smooth, Georeferenced Semi-Transparent Flood Inundation Canvas Overlay
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentSnap = simulation?.snapshots[currentTimestep];
    const shouldShowFlood = (mapMode === 'satellite_flood' || mapMode === 'flood_only' || mapMode === 'street_carto' || mapMode === 'sar_radar') && layerVisibility.floodDepth && currentSnap;

    if (floodCanvasLayerRef.current) {
      mapInstanceRef.current.removeLayer(floodCanvasLayerRef.current);
      floodCanvasLayerRef.current = null;
    }

    if (!shouldShowFlood) return;

    // Create an offscreen smooth interpolated canvas
    const grid_size = gisData.grid_size;
    const canvas = document.createElement('canvas');
    const res = 512; // High-resolution smooth raster
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const depths = currentSnap.depth_grid;

    // Create smoothed flood raster
    const imgData = ctx.createImageData(res, res);
    const data = imgData.data;

    for (let py = 0; py < res; py++) {
      const gyFloat = (py / res) * (grid_size - 1);
      const gy0 = Math.floor(gyFloat);
      const gy1 = Math.min(grid_size - 1, gy0 + 1);
      const dy = gyFloat - gy0;

      for (let px = 0; px < res; px++) {
        const gxFloat = (px / res) * (grid_size - 1);
        const gx0 = Math.floor(gxFloat);
        const gx1 = Math.min(grid_size - 1, gx0 + 1);
        const dx = gxFloat - gx0;

        // Bilinear interpolation for smooth, realistic water body boundary
        const d00 = depths[gy0]?.[gx0] || 0;
        const d10 = depths[gy0]?.[gx1] || 0;
        const d01 = depths[gy1]?.[gx0] || 0;
        const d11 = depths[gy1]?.[gx1] || 0;

        const dInterp = (1 - dy) * ((1 - dx) * d00 + dx * d10) + dy * ((1 - dx) * d01 + dx * d11);

        const idx = (py * res + px) * 4;

        if (dInterp > 0.05) {
          let r = 2, g = 132, b = 199;
          if (dInterp < 0.3) {
            r = 56; g = 189; b = 248; // Light blue
          } else if (dInterp < 1.0) {
            r = 2; g = 132; b = 199;  // Medium blue
          } else if (dInterp < 2.0) {
            r = 30; g = 58; b = 138;  // Deep riverine blue
          } else {
            r = 225; g = 29; b = 72;  // Severe incursion red
          }

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          // Smooth alpha transparency at water's edge
          const edgeAlpha = Math.min(1.0, (dInterp - 0.05) / 0.15);
          data[idx + 3] = Math.floor(edgeAlpha * floodOpacity * 255);
        } else {
          data[idx + 3] = 0; // Transparent dry land
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Convert canvas to Leaflet ImageOverlay on accurate geographic bounds
    const dataUrl = canvas.toDataURL();
    const overlay = L.imageOverlay(dataUrl, bounds, {
      opacity: 1.0,
      interactive: false
    });

    overlay.addTo(mapInstanceRef.current);
    floodCanvasLayerRef.current = overlay;
  }, [simulation, currentTimestep, mapMode, floodOpacity, layerVisibility.floodDepth]);

  // 4. Render Authentic Landmark Labels & Critical Facilities on Real Map
  useEffect(() => {
    if (!markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();

    if (!layerVisibility.criticalFacilities) return;

    // Real landmarks in Vijayawada
    const landmarks = [
      { name: "Prakasam Barrage", lat: 16.5065, lon: 80.6050, type: "Barrage", status: "70 Gates Active" },
      { name: "Sri Durga Temple (Indrakeeladri)", lat: 16.5135, lon: 80.6062, type: "Temple", status: "Safe High Ground" },
      { name: "GGH Vijayawada Hospital", lat: 16.5150, lon: 80.6350, type: "Hospital", status: "Emergency Ready" },
      { name: "Pandit Nehru Bus Station (PNBS)", lat: 16.5080, lon: 80.6210, type: "Transit", status: "Evacuation Hub" },
      { name: "Tadepalli Substation", lat: 16.4850, lon: 80.6120, type: "Power", status: "Flood Watch" },
    ];

    landmarks.forEach((lm) => {
      const iconHtml = `
        <div class="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-slate-100 text-[10px] font-semibold border border-cyan-500/40 shadow-lg backdrop-blur-sm whitespace-nowrap">
          <span class="w-2 h-2 rounded-full ${lm.type === 'Hospital' ? 'bg-rose-500' : lm.type === 'Barrage' ? 'bg-cyan-400' : 'bg-amber-400'} animate-pulse"></span>
          <span>${lm.name}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-map-label',
        iconSize: [120, 20],
        iconAnchor: [60, 10]
      });

      const marker = L.marker([lm.lat, lm.lon], { icon: customIcon });
      markersGroupRef.current?.addLayer(marker);
    });
  }, [layerVisibility.criticalFacilities]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], 14, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-full bg-[#070d18] overflow-hidden select-none">
      {/* Real Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Remote Sensing Control Bar */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col space-y-2 max-w-xl">
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
            <span>Satellite + Flood (Default)</span>
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
            <span>Satellite Only</span>
          </button>

          <button
            onClick={() => onMapModeChange?.('street_carto')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mapMode === 'street_carto'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Street Map</span>
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
            <span>SAR Radar</span>
          </button>

          <button
            onClick={recenterMap}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Recenter to Prakasam Barrage / Vijayawada"
          >
            <Crosshair className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Flood Opacity Slider */}
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
          <span className="text-slate-500 text-[10px]">• Land features visible beneath</span>
        </div>
      </div>

      {/* Satellite Telemetry & Location Badge */}
      <div className="absolute top-4 right-4 z-[1000] glass-panel p-3 rounded-2xl border border-slate-800 shadow-2xl text-xs space-y-1.5 max-w-xs text-slate-300">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-100 flex items-center space-x-1.5">
            <Satellite className="w-4 h-4 text-cyan-400" />
            <span>Vijayawada Satellite Imagery</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
            Esri High-Res
          </span>
        </div>

        <div className="space-y-1 text-[11px] font-mono text-slate-400">
          <div className="flex justify-between">
            <span>Location:</span>
            <span className="text-cyan-300">Vijayawada, AP (16.51°N, 80.65°E)</span>
          </div>
          <div className="flex justify-between">
            <span>River Reach:</span>
            <span className="text-slate-200">Krishna (Prakasam Barrage)</span>
          </div>
          <div className="flex justify-between">
            <span>Coordinate System:</span>
            <span className="text-slate-200">WGS84 / EPSG:3857</span>
          </div>
        </div>
      </div>

      {/* Professional Remote Sensing Map Legend */}
      <div className="absolute bottom-6 left-4 z-[1000] glass-panel p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 w-64 border border-slate-800">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
          <span>Inundation Depth Overlay</span>
          <span className="font-mono text-cyan-400">0.0m - 3.5m+</span>
        </div>

        <div className="h-3 rounded-md bg-gradient-to-r from-sky-300 via-blue-600 via-indigo-900 to-rose-600 shadow-inner"></div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>0.0m</span>
          <span>0.5m</span>
          <span>1.0m</span>
          <span>2.0m</span>
          <span>3.0m+</span>
        </div>

        <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Click anywhere to probe depth</span>
          <span className="text-cyan-400">Prakasam Barrage</span>
        </div>
      </div>

      {/* Mandatory Satellite Imagery Provider Attribution */}
      <div className="absolute bottom-1 right-24 z-[1000] text-[9px] text-slate-400/80 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/60 pointer-events-none">
        Imagery © Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USGS, Aerogrid | Map © OpenStreetMap
      </div>

      {/* Point Probe Inspection Modal */}
      {probe && (
        <div className="absolute bottom-6 right-4 z-[1000] glass-panel p-4 rounded-2xl shadow-2xl border border-cyan-500/30 w-72 text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>Location Hydrograph Probe</span>
            </span>
            <button
              onClick={() => setProbe(null)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 text-slate-300 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Area:</span>
              <strong className="text-slate-100 font-sans">{probe.locality}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Coordinates:</span>
              <span>{probe.lat}°N, {probe.lng}°E</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ground Elevation:</span>
              <strong className="text-slate-100">{probe.elevation_m} m MSL</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Depth:</span>
              <strong className="text-cyan-400">{probe.depth_m} m</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Peak Inundation:</span>
              <strong className="text-indigo-400">{probe.peak_depth_m} m</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flow Velocity:</span>
              <strong className="text-emerald-400">{probe.velocity_ms} m/s</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
