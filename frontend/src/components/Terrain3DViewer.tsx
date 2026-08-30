import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GISData, SimulationResult } from '../types';
import {
  Satellite,
  Box,
  Layers,
  Compass,
  Sparkles,
  Navigation,
  Eye,
  Sliders,
  Activity,
  Maximize2,
  Crosshair,
  Waves
} from 'lucide-react';

interface Terrain3DViewerProps {
  gisData: GISData;
  simulation: SimulationResult | null;
  currentTimestep: number;
}

interface Probe3D {
  x: number;
  y: number;
  elevation_m: number;
  depth_m: number;
  velocity_ms: number;
  locality: string;
}

export const Terrain3DViewer: React.FC<Terrain3DViewerProps> = ({
  gisData,
  simulation,
  currentTimestep
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [mode3D, setMode3D] = useState<'sat_flood' | 'sat_only' | 'flood_only' | 'dem_tint'>('sat_flood');
  const [activePreset, setActivePreset] = useState<'overview' | 'top' | 'barrage' | 'temple' | 'floodplain'>('overview');
  const [probe, setProbe] = useState<Probe3D | null>(null);
  const [floodOpacity, setFloodOpacity] = useState<number>(0.65);
  const [isTextureLoaded, setIsTextureLoaded] = useState<boolean>(false);

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;

  // 1. Build Multi-Tile High-Resolution Georeferenced Satellite Texture Canvas
  const loadSatelliteTexture = useCallback((): Promise<THREE.CanvasTexture> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const canvasSize = 1024;
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(new THREE.CanvasTexture(canvas));
        return;
      }

      // Esri World Imagery tiles at zoom level 14 for Vijayawada extent
      // x: 11858 to 11863, y: 7352 to 7355
      const zoom = 14;
      const xTiles = [11858, 11859, 11860, 11861, 11862];
      const yTiles = [7352, 7353, 7354, 7355];
      const totalTiles = xTiles.length * yTiles.length;
      let loadedCount = 0;

      const tileWidth = canvasSize / xTiles.length;
      const tileHeight = canvasSize / yTiles.length;

      // Draw baseline background in case tile fetches are delayed
      ctx.fillStyle = '#0f231e';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      let hasResolved = false;
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          const tex = new THREE.CanvasTexture(canvas);
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          setIsTextureLoaded(true);
          resolve(tex);
        }
      }, 4000);

      xTiles.forEach((xt, col) => {
        yTiles.forEach((yt, row) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${yt}/${xt}`;

          img.onload = () => {
            ctx.drawImage(img, col * tileWidth, row * tileHeight, tileWidth, tileHeight);
            loadedCount++;
            if (loadedCount >= totalTiles && !hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              const tex = new THREE.CanvasTexture(canvas);
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              setIsTextureLoaded(true);
              resolve(tex);
            }
          };

          img.onerror = () => {
            loadedCount++;
            if (loadedCount >= totalTiles && !hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              const tex = new THREE.CanvasTexture(canvas);
              setIsTextureLoaded(true);
              resolve(tex);
            }
          };
        });
      });
    });
  }, []);

  // 2. Initialize Three.js 3D Viewport
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d18');
    scene.fog = new THREE.FogExp2('#070d18', 0.005);
    sceneRef.current = scene;

    // Perspective Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1500);
    camera.position.set(65, 75, 85);
    camera.lookAt(0, 5, 0);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Natural Sunlight & Atmospheric Fill Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 1.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.8);
    sunLight.position.set(50, 110, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const skyFill = new THREE.DirectionalLight('#38bdf8', 0.6);
    skyFill.position.set(-60, 40, -60);
    scene.add(skyFill);

    // 3. Real DEM Elevation Plane Geometry for Vijayawada
    const planeGeo = new THREE.PlaneGeometry(90, 90, grid_size - 1, grid_size - 1);
    planeGeo.rotateX(-Math.PI / 2);

    const pos = planeGeo.attributes.position;
    const dem = gisData.dem_grid;
    const minElev = gisData.min_elevation;
    const maxElev = gisData.max_elevation;

    for (let i = 0; i < pos.count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      // Accurate elevation scaling
      pos.setY(i, (elev - minElev) * 0.72);
    }
    planeGeo.computeVertexNormals();

    // DEM Hypsometric Tint Vertex Colors
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      const norm = (elev - minElev) / (maxElev - minElev || 1);

      if (elev < 15.0) {
        colors[i * 3] = 0.08; colors[i * 3 + 1] = 0.16; colors[i * 3 + 2] = 0.24;
      } else if (elev < 26.0) {
        colors[i * 3] = 0.15 + norm * 0.1; colors[i * 3 + 1] = 0.22 + norm * 0.12; colors[i * 3 + 2] = 0.18 + norm * 0.08;
      } else {
        colors[i * 3] = 0.35 + norm * 0.25; colors[i * 3 + 1] = 0.26 + norm * 0.16; colors[i * 3 + 2] = 0.18 + norm * 0.1;
      }
    }
    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Standard Terrain Material
    const terrainMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMeshRef.current = terrainMesh;
    scene.add(terrainMesh);

    // Asynchronously load real multi-tile satellite texture
    loadSatelliteTexture().then((tex) => {
      if (terrainMeshRef.current) {
        (terrainMeshRef.current.material as THREE.MeshStandardMaterial).map = tex;
        (terrainMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });

    // 4. Volumetric Semi-Transparent Flood Water Surface
    const waterGeo = new THREE.PlaneGeometry(90, 90, grid_size - 1, grid_size - 1);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.72,
      roughness: 0.04,
      metalness: 0.18,
      transmission: 0.75,
      ior: 1.333,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);

    // 5. Water Flow Velocity Particles (Streamlines following Krishna River channel)
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      const px = (t - 0.5) * 85;
      const pz = (0.45 * (px / 45) * 45 + Math.sin(px * 0.08) * 10) + (Math.random() - 0.5) * 10;
      
      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = 2.0;
      particlePositions[i * 3 + 2] = pz;
      particleSpeeds[i] = 0.28 + Math.random() * 0.42;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: '#38bdf8',
      size: 1.4,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 6. Professional Landmark GPS Pins in 3D
    const lmGroup = new THREE.Group();
    landmarksGroupRef.current = lmGroup;

    const landmarks3D = [
      { name: 'Prakasam Barrage', gx: intRatio(0.48), gy: intRatio(0.48), type: 'barrage' },
      { name: 'Indrakeeladri Hill (Kanaka Durga)', gx: intRatio(0.35), gy: intRatio(0.42), type: 'temple' },
      { name: 'GGH Vijayawada Hospital', gx: intRatio(0.62), gy: intRatio(0.36), type: 'hospital' },
      { name: 'Pandit Nehru Bus Station (PNBS)', gx: intRatio(0.54), gy: intRatio(0.44), type: 'transit' },
      { name: 'Tadepalli South Bank', gx: intRatio(0.46), gy: intRatio(0.68), type: 'substation' },
    ];

    function intRatio(r: number) {
      return Math.floor(r * (grid_size - 1));
    }

    landmarks3D.forEach((lm) => {
      const lx = ((lm.gx / (grid_size - 1)) - 0.5) * 90;
      const lz = ((lm.gy / (grid_size - 1)) - 0.5) * 90;
      const lElev = (dem[lm.gy][lm.gx] - minElev) * 0.72;

      // Pin post
      const pinGeo = new THREE.CylinderGeometry(0.35, 0.35, 4.0, 8);
      const pinMat = new THREE.MeshStandardMaterial({
        color: lm.type === 'hospital' ? '#ef4444' : lm.type === 'barrage' ? '#0284c7' : '#f59e0b',
        roughness: 0.3
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(lx, lElev + 2.0, lz);

      // Pin head sphere
      const headGeo = new THREE.SphereGeometry(0.9, 12, 12);
      const headMesh = new THREE.Mesh(headGeo, pinMat);
      headMesh.position.set(lx, lElev + 4.2, lz);

      lmGroup.add(pinMesh);
      lmGroup.add(headMesh);
    });

    scene.add(lmGroup);

    // Mouse Interaction (Orbit / Pan / Tilt)
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        previousMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePosRef.current.x;
      const deltaY = e.clientY - previousMousePosRef.current.y;

      const angleX = deltaX * 0.005;
      const angleY = deltaY * 0.005;

      const cam = cameraRef.current;
      const radius = Math.sqrt(cam.position.x ** 2 + cam.position.z ** 2);
      const currentAngle = Math.atan2(cam.position.z, cam.position.x);

      cam.position.x = radius * Math.cos(currentAngle - angleX);
      cam.position.z = radius * Math.sin(currentAngle - angleX);
      cam.position.y = Math.max(10, Math.min(140, cam.position.y + angleY * 20));
      cam.lookAt(0, 5, 0);

      previousMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Click Raycaster for 3D Coordinate & Inundation Inspection
    const handleClick = (e: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !terrainMeshRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObject(terrainMeshRef.current);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        // Convert world X, Z to grid index
        const gx = Math.min(grid_size - 1, Math.max(0, Math.floor(((point.x / 90) + 0.5) * (grid_size - 1))));
        const gy = Math.min(grid_size - 1, Math.max(0, Math.floor(((point.z / 90) + 0.5) * (grid_size - 1))));

        const elev = dem[gy][gx];
        const currentSnap = simulation?.snapshots[currentTimestep];
        const d = currentSnap?.depth_grid[gy]?.[gx] ?? 0.0;
        const vel = currentSnap?.velocity_grid[gy]?.[gx] ?? 0.0;

        let locality = "Vijayawada Urban";
        if (gy > grid_size * 0.52) locality = "Tadepalli / Undavalli South Bank";
        else if (gx < grid_size * 0.4) locality = "Indrakeeladri / Bhavanipuram";
        else locality = "Krishna Lanka / Governorpet";

        setProbe({
          x: gx,
          y: gy,
          elevation_m: Number(elev.toFixed(1)),
          depth_m: Number(d.toFixed(2)),
          velocity_ms: Number(vel.toFixed(2)),
          locality
        });
      } else {
        setProbe(null);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('click', handleClick);

    // Continuous Animation Loop
    let animationFrameId: number;
    let waveTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      waveTime += 0.035;

      // 1. Dynamic Geographically-Constrained Volumetric Water Height
      if (waterMeshRef.current) {
        const wPos = waterMeshRef.current.geometry.attributes.position;
        const depths = currentSnapshot?.depth_grid;
        const showWater = (mode3D === 'sat_flood' || mode3D === 'flood_only');

        for (let i = 0; i < wPos.count; i++) {
          const gx = i % grid_size;
          const gy = Math.floor(i / grid_size);
          const elev = (dem[gy][gx] - minElev) * 0.72;
          const d = (depths && showWater) ? depths[gy][gx] : 0;

          if (d > 0.03) {
            // Natural undulating river ripples
            const ripple = Math.sin(gx * 0.45 + waveTime) * Math.cos(gy * 0.45 + waveTime) * 0.15;
            wPos.setY(i, elev + d * 0.72 + ripple);
          } else {
            wPos.setY(i, elev - 5.0); // Completely hidden beneath dry terrain
          }
        }
        wPos.needsUpdate = true;
      }

      // 2. Animate Water Flow Particles along River Channel
      if (particlesRef.current) {
        const pPos = particlesRef.current.geometry.attributes.position;
        const pArray = pPos.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          pArray[i * 3] += particleSpeeds[i] * 0.65;
          const currentPx = pArray[i * 3];
          pArray[i * 3 + 2] = (0.45 * (currentPx / 45) * 45 + Math.sin(currentPx * 0.07) * 9);

          if (pArray[i * 3] > 44) {
            pArray[i * 3] = -44;
          }
        }
        pPos.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('click', handleClick);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gisData, mode3D]);

  // 3. Handle 3D Layer Mode Switching (Satellite / DEM Tint / Flood Only)
  useEffect(() => {
    if (!terrainMeshRef.current || !waterMeshRef.current) return;

    const terrainMat = terrainMeshRef.current.material as THREE.MeshStandardMaterial;
    const waterMat = waterMeshRef.current.material as THREE.MeshPhysicalMaterial;

    if (mode3D === 'dem_tint') {
      terrainMat.vertexColors = true;
      terrainMat.map = null;
      terrainMat.needsUpdate = true;
      waterMeshRef.current.visible = true;
    } else if (mode3D === 'flood_only') {
      terrainMat.vertexColors = false;
      terrainMat.map = null;
      terrainMat.color.set('#0b1329');
      terrainMat.needsUpdate = true;
      waterMeshRef.current.visible = true;
    } else {
      // Satellite Terrain (Default)
      terrainMat.vertexColors = false;
      terrainMat.color.set('#ffffff');
      waterMeshRef.current.visible = (mode3D === 'sat_flood');
      terrainMat.needsUpdate = true;
    }

    waterMat.opacity = floodOpacity;
  }, [mode3D, floodOpacity]);

  // 4. Camera View Presets
  const setCameraPreset = (preset: 'overview' | 'top' | 'barrage' | 'temple' | 'floodplain') => {
    if (!cameraRef.current) return;
    setActivePreset(preset);

    if (preset === 'overview') {
      // Isometric regional perspective
      cameraRef.current.position.set(65, 75, 85);
      cameraRef.current.lookAt(0, 5, 0);
    } else if (preset === 'top') {
      // Orthographic-like 90 degree top-down view
      cameraRef.current.position.set(0, 120, 2);
      cameraRef.current.lookAt(0, 0, 0);
    } else if (preset === 'barrage') {
      // Close reach looking through Prakasam Barrage gorge
      cameraRef.current.position.set(-15, 22, 45);
      cameraRef.current.lookAt(2, 6, 0);
    } else if (preset === 'temple') {
      // High elevation lookout from Indrakeeladri Hill
      cameraRef.current.position.set(-35, 60, -25);
      cameraRef.current.lookAt(10, 5, 10);
    } else {
      // Floodplain inspection (Krishna Lanka & Tadepalli)
      cameraRef.current.position.set(25, 30, 60);
      cameraRef.current.lookAt(5, 4, 10);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#070d18] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Remote Sensing Control Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2 max-w-xl">
        <div className="glass-panel p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-800 shadow-2xl text-xs">
          <button
            onClick={() => setMode3D('sat_flood')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mode3D === 'sat_flood'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellite + 3D Flood (Default)</span>
          </button>

          <button
            onClick={() => setMode3D('sat_only')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mode3D === 'sat_only'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Satellite Terrain</span>
          </button>

          <button
            onClick={() => setMode3D('dem_tint')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mode3D === 'dem_tint'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-slate-300" />
            <span>DEM Elevation</span>
          </button>

          <button
            onClick={() => setMode3D('flood_only')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              mode3D === 'flood_only'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Flood Only</span>
          </button>
        </div>

        {/* 3D Flood Opacity Slider */}
        {mode3D === 'sat_flood' && (
          <div className="glass-panel px-3 py-2 rounded-xl flex items-center space-x-3 text-xs border border-slate-800 shadow-xl text-slate-300">
            <span className="flex items-center space-x-1.5 font-medium">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Water Transparency:</span>
            </span>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={floodOpacity}
              onChange={(e) => setFloodOpacity(parseFloat(e.target.value))}
              className="w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="font-mono text-cyan-400 font-bold w-10 text-right">
              {Math.round(floodOpacity * 100)}%
            </span>
            <span className="text-slate-500 text-[10px]">• Satellite imagery visible beneath</span>
          </div>
        )}
      </div>

      {/* Camera View Presets */}
      <div className="absolute top-4 right-4 z-10 glass-panel p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-800 shadow-2xl text-xs">
        <button
          onClick={() => setCameraPreset('overview')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            activePreset === 'overview' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Overview (45°)
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            activePreset === 'top' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Top View (90°)
        </button>
        <button
          onClick={() => setCameraPreset('barrage')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            activePreset === 'barrage' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Prakasam Barrage
        </button>
        <button
          onClick={() => setCameraPreset('temple')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            activePreset === 'temple' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Indrakeeladri
        </button>
        <button
          onClick={() => setCameraPreset('floodplain')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            activePreset === 'floodplain' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Floodplain
        </button>
      </div>

      {/* Bottom Left 3D Inundation Legend */}
      <div className="absolute bottom-6 left-4 z-10 glass-panel p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 w-64 border border-slate-800">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
          <span>3D Inundation Depth Scale</span>
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
          <span>Click 3D terrain to probe depth</span>
          <span className="text-cyan-400">Krishna River</span>
        </div>
      </div>

      {/* Mandatory Satellite & DEM Attribution */}
      <div className="absolute bottom-1 right-24 z-10 text-[9px] text-slate-400/80 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/60 pointer-events-none">
        Satellite Imagery © Esri, Maxar, Earthstar Geographics, USGS | DEM: SRTM / Copernicus 30m
      </div>

      {/* Point Probe Hydrograph Overlay */}
      {probe && (
        <div className="absolute bottom-6 right-4 z-20 glass-panel p-4 rounded-2xl shadow-2xl border border-cyan-500/30 w-72 text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>3D Terrain Hydrograph Probe</span>
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
              <span className="text-slate-400">Locality:</span>
              <strong className="text-slate-100 font-sans">{probe.locality}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ground Elevation:</span>
              <strong className="text-slate-100">{probe.elevation_m} m MSL</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Simulated Water Depth:</span>
              <strong className="text-cyan-400">{probe.depth_m} m</strong>
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
