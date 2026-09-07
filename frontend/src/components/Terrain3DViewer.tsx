import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  Crosshair,
  Waves,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Maximize2,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface Terrain3DViewerProps {
  gisData: GISData;
  simulation: SimulationResult | null;
  currentTimestep: number;
}

interface CalloutDef {
  id: string;
  category: 'hydrology' | 'infrastructure' | 'risk' | 'terrain';
  title: string;
  subtitle: string;
  gridXRatio: number; // 0.0 to 1.0 in domain
  gridYRatio: number;
  badgeType: 'inflow' | 'barrage' | 'hill' | 'urban' | 'lowland' | 'southbank' | 'front';
  cardOffset: { x: number; y: number }; // Screen offset relative to anchor in pixels
  cameraFocus: { pos: [number, number, number]; target: [number, number, number] };
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
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera animation state
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);
  const currentLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  const [mode3D, setMode3D] = useState<'sat_flood' | 'sat_only' | 'flood_only' | 'dem_tint'>('sat_flood');
  const [activePreset, setActivePreset] = useState<'overview' | 'top' | 'barrage' | 'temple' | 'floodplain'>('overview');
  const [verticalExag, setVerticalExag] = useState<number>(1.0); // 1.0x realistic relief
  const [floodOpacity, setFloodOpacity] = useState<number>(0.55);
  const [calloutFilter, setCalloutFilter] = useState<'all' | 'hydrology' | 'infrastructure' | 'risk' | 'minimal'>('all');
  const [selectedCalloutId, setSelectedCalloutId] = useState<string | null>(null);

  // Projected 2D screen positions of callout anchors
  const [screenAnchors, setScreenAnchors] = useState<{ [id: string]: { x: number; y: number; visible: boolean } }>({});

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;
  const dem = gisData.dem_grid;
  const minElev = gisData.min_elevation;

  // Architectural / Engineering Callout Definitions (Calibrated to Real GPS Coordinates)
  const callouts: CalloutDef[] = useMemo(() => [
    {
      id: 'krishna_inflow',
      category: 'hydrology',
      title: 'KRISHNA RIVER INFLOW',
      subtitle: 'Upstream Discharge Source (NW Reach)',
      gridXRatio: 0.05,
      gridYRatio: 0.04,
      badgeType: 'inflow',
      cardOffset: { x: -160, y: -110 },
      cameraFocus: { pos: [-35, 45, 10], target: [-30, 2, -25] }
    },
    {
      id: 'prakasam_barrage',
      category: 'infrastructure',
      title: 'PRAKASAM BARRAGE & REGULATOR',
      subtitle: '70 Radial Gates / Hydraulic Control',
      gridXRatio: 0.2857,
      gridYRatio: 0.5583,
      badgeType: 'barrage',
      cardOffset: { x: -180, y: -90 },
      cameraFocus: { pos: [-15, 32, 45], target: [0, 2, 0] }
    },
    {
      id: 'indrakeeladri_hill',
      category: 'terrain',
      title: 'INDRAKEELADRI HILL (TEMPLE RIDGE)',
      subtitle: 'Natural Barrier & Evacuation High Ground',
      gridXRatio: 0.2971,
      gridYRatio: 0.4417,
      badgeType: 'hill',
      cardOffset: { x: -170, y: -130 },
      cameraFocus: { pos: [-45, 48, -25], target: [-15, 8, -12] }
    },
    {
      id: 'vijayawada_urban',
      category: 'infrastructure',
      title: 'VIJAYAWADA URBAN CENTER',
      subtitle: 'North Bank High-Density Zone / GGH Hospital',
      gridXRatio: 0.5714,
      gridYRatio: 0.4167,
      badgeType: 'urban',
      cardOffset: { x: 90, y: -120 },
      cameraFocus: { pos: [35, 45, 10], target: [15, 4, -18] }
    },
    {
      id: 'krishna_lanka',
      category: 'risk',
      title: 'KRISHNA LANKA LOWLANDS',
      subtitle: 'High-Risk Embankment Overflow Depression',
      gridXRatio: 0.5200,
      gridYRatio: 0.5500,
      badgeType: 'lowland',
      cardOffset: { x: 100, y: -80 },
      cameraFocus: { pos: [25, 30, 55], target: [18, 2, -2] }
    },
    {
      id: 'tadepalli_floodplain',
      category: 'risk',
      title: 'TADEPALLI & UNDAVALLI BASIN',
      subtitle: 'South Bank Peri-Urban Floodplain',
      gridXRatio: 0.4800,
      gridYRatio: 0.7500,
      badgeType: 'southbank',
      cardOffset: { x: -170, y: 70 },
      cameraFocus: { pos: [20, 38, 80], target: [5, 2, 22] }
    },
    {
      id: 'flood_propagation_front',
      category: 'hydrology',
      title: 'INUNDATION PROPAGATION FRONT',
      subtitle: 'Simulated Water Depth & Spread Vector',
      gridXRatio: 0.7600,
      gridYRatio: 0.7800,
      badgeType: 'front',
      cardOffset: { x: 90, y: 60 },
      cameraFocus: { pos: [45, 35, 60], target: [25, 2, 12] }
    }
  ], []);

  // 1. Build Multi-Tile High-Resolution Georeferenced Satellite Orthomosaic Texture
  const loadSatelliteTexture = useCallback((): Promise<THREE.CanvasTexture> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const canvasSize = 2048; // Ultra-crisp 2K texture
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(new THREE.CanvasTexture(canvas));
        return;
      }

      const zoom = 14;
      const xTiles = [11858, 11859, 11860, 11861, 11862];
      const yTiles = [7352, 7353, 7354, 7355];
      const totalTiles = xTiles.length * yTiles.length;
      let loadedCount = 0;

      const tileWidth = canvasSize / xTiles.length;
      const tileHeight = canvasSize / yTiles.length;

      ctx.fillStyle = '#172722';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      let hasResolved = false;
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          const tex = new THREE.CanvasTexture(canvas);
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = 16;
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
              tex.magFilter = THREE.LinearFilter;
              tex.anisotropy = 16;
              resolve(tex);
            }
          };

          img.onerror = () => {
            loadedCount++;
            if (loadedCount >= totalTiles && !hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              const tex = new THREE.CanvasTexture(canvas);
              tex.generateMipmaps = true;
              resolve(tex);
            }
          };
        });
      });
    });
  }, []);

  // 2. Initialize Three.js Viewport & Animation Loop
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d18');
    scene.fog = new THREE.FogExp2('#070d18', 0.0032);
    sceneRef.current = scene;

    // High Aerial Oblique Perspective Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2500);
    camera.position.set(75, 95, 105);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    currentLookAtRef.current.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Natural Sunlight & Atmospheric Illumination
    const ambientLight = new THREE.AmbientLight('#ffffff', 1.05);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.65);
    sunLight.position.set(70, 140, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const skyFill = new THREE.DirectionalLight('#38bdf8', 0.45);
    skyFill.position.set(-80, 50, -80);
    scene.add(skyFill);

    // 3. Realistic DEM Terrain Plane
    const planeGeo = new THREE.PlaneGeometry(100, 100, grid_size - 1, grid_size - 1);
    planeGeo.rotateX(-Math.PI / 2);

    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      pos.setY(i, (elev - minElev) * 0.24 * verticalExag);
    }
    planeGeo.computeVertexNormals();

    // DEM Hypsometric Tint
    const colors = new Float32Array(pos.count * 3);
    const maxElev = gisData.max_elevation;
    for (let i = 0; i < pos.count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      const norm = (elev - minElev) / (maxElev - minElev || 1);

      if (elev < 15.0) {
        colors[i * 3] = 0.08; colors[i * 3 + 1] = 0.16; colors[i * 3 + 2] = 0.24;
      } else if (elev < 24.0) {
        colors[i * 3] = 0.16 + norm * 0.08; colors[i * 3 + 1] = 0.22 + norm * 0.10; colors[i * 3 + 2] = 0.18 + norm * 0.06;
      } else {
        colors[i * 3] = 0.35 + norm * 0.2; colors[i * 3 + 1] = 0.28 + norm * 0.12; colors[i * 3 + 2] = 0.18 + norm * 0.08;
      }
    }
    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.05,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMeshRef.current = terrainMesh;
    scene.add(terrainMesh);

    loadSatelliteTexture().then((tex) => {
      if (terrainMeshRef.current) {
        (terrainMeshRef.current.material as THREE.MeshStandardMaterial).map = tex;
        (terrainMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });

    // 4. Volumetric Semi-Transparent Flood Water Surface
    const waterGeo = new THREE.PlaneGeometry(100, 100, grid_size - 1, grid_size - 1);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: floodOpacity,
      roughness: 0.05,
      metalness: 0.15,
      transmission: 0.72,
      ior: 1.333,
      reflectivity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);

    // 5. Scientific Flow Streamlines along Krishna River
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      const px = (t - 0.5) * 90;
      const pz = (0.45 * (px / 45) * 45 + Math.sin(px * 0.08) * 10) + (Math.random() - 0.5) * 8;
      
      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = 1.0;
      particlePositions[i * 3 + 2] = pz;
      particleSpeeds[i] = 0.22 + Math.random() * 0.35;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: '#38bdf8',
      size: 1.2,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // Mouse Interaction (Orbit / Pan / Tilt)
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        previousMousePosRef.current = { x: e.clientX, y: e.clientY };
        targetCamPosRef.current = null; // Cancel automated camera animation on user input
        targetLookAtRef.current = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePosRef.current.x;
      const deltaY = e.clientY - previousMousePosRef.current.y;

      const angleX = deltaX * 0.004;
      const angleY = deltaY * 0.004;

      const cam = cameraRef.current;
      const target = currentLookAtRef.current;
      const radius = Math.sqrt((cam.position.x - target.x) ** 2 + (cam.position.z - target.z) ** 2);
      const currentAngle = Math.atan2(cam.position.z - target.z, cam.position.x - target.x);

      cam.position.x = target.x + radius * Math.cos(currentAngle - angleX);
      cam.position.z = target.z + radius * Math.sin(currentAngle - angleX);
      cam.position.y = Math.max(15, Math.min(180, cam.position.y + angleY * 25));
      cam.lookAt(target);

      previousMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Continuous Animation & Real-Time 3D-to-2D Anchor Projection
    let animationFrameId: number;
    let waveTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      waveTime += 0.03;

      const cam = cameraRef.current;
      if (!cam || !mountRef.current) return;

      // Smooth Camera Transition (Fly-To on Callout Click)
      if (targetCamPosRef.current && targetLookAtRef.current) {
        cam.position.lerp(targetCamPosRef.current, 0.06);
        currentLookAtRef.current.lerp(targetLookAtRef.current, 0.06);
        cam.lookAt(currentLookAtRef.current);

        if (cam.position.distanceTo(targetCamPosRef.current) < 0.2) {
          targetCamPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      // Dynamic Volumetric Water Height
      if (waterMeshRef.current) {
        const wPos = waterMeshRef.current.geometry.attributes.position;
        const depths = currentSnapshot?.depth_grid;
        const showWater = (mode3D === 'sat_flood' || mode3D === 'flood_only');

        for (let i = 0; i < wPos.count; i++) {
          const gx = i % grid_size;
          const gy = Math.floor(i / grid_size);
          const elev = (dem[gy][gx] - minElev) * 0.24 * verticalExag;
          const d = (depths && showWater) ? depths[gy][gx] : 0;

          if (d > 0.02) {
            const ripple = Math.sin(gx * 0.4 + waveTime) * Math.cos(gy * 0.4 + waveTime) * 0.08;
            wPos.setY(i, elev + d * 0.24 * verticalExag + ripple);
          } else {
            wPos.setY(i, elev - 8.0);
          }
        }
        wPos.needsUpdate = true;
      }

      // Animate Velocity Particles
      if (particlesRef.current) {
        const pPos = particlesRef.current.geometry.attributes.position;
        const pArray = pPos.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          pArray[i * 3] += particleSpeeds[i] * 0.55;
          const currentPx = pArray[i * 3];
          pArray[i * 3 + 2] = (0.45 * (currentPx / 45) * 45 + Math.sin(currentPx * 0.07) * 9);

          if (pArray[i * 3] > 48) {
            pArray[i * 3] = -48;
          }
        }
        pPos.needsUpdate = true;
      }

      // Calculate 2D Screen Projections for all Callouts
      const containerW = mountRef.current.clientWidth;
      const containerH = mountRef.current.clientHeight;
      const newAnchors: { [id: string]: { x: number; y: number; visible: boolean } } = {};

      callouts.forEach((c) => {
        const gx = Math.floor(c.gridXRatio * (grid_size - 1));
        const gy = Math.floor(c.gridYRatio * (grid_size - 1));
        const elev = (dem[gy][gx] - minElev) * 0.24 * verticalExag;
        const d = currentSnapshot?.depth_grid[gy]?.[gx] || 0;
        const totalHeight = elev + Math.max(0, d * 0.24 * verticalExag);

        const worldX = (c.gridXRatio - 0.5) * 100;
        const worldZ = (c.gridYRatio - 0.5) * 100;
        const worldPos = new THREE.Vector3(worldX, totalHeight + 1.2, worldZ);

        worldPos.project(cam);

        // Check if anchor is in front of camera
        const isVisible = worldPos.z < 1.0;
        const screenX = (worldPos.x * 0.5 + 0.5) * containerW;
        const screenY = (-(worldPos.y * 0.5) + 0.5) * containerH;

        newAnchors[c.id] = {
          x: Math.round(screenX),
          y: Math.round(screenY),
          visible: isVisible && screenX >= 20 && screenX <= containerW - 20 && screenY >= 20 && screenY <= containerH - 20
        };
      });

      setScreenAnchors(newAnchors);
      renderer.render(scene, cam);
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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gisData, mode3D, verticalExag, callouts]);

  // 3. Layer Mode & Opacity
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
      terrainMat.vertexColors = false;
      terrainMat.color.set('#ffffff');
      waterMeshRef.current.visible = (mode3D === 'sat_flood');
      terrainMat.needsUpdate = true;
    }

    waterMat.opacity = floodOpacity;
  }, [mode3D, floodOpacity]);

  // 4. Smooth Camera Fly-To on Preset or Callout Focus
  const flyTo = (pos: [number, number, number], target: [number, number, number]) => {
    targetCamPosRef.current = new THREE.Vector3(...pos);
    targetLookAtRef.current = new THREE.Vector3(...target);
  };

  const handleSelectCallout = (callout: CalloutDef) => {
    setSelectedCalloutId(callout.id);
    flyTo(callout.cameraFocus.pos, callout.cameraFocus.target);
  };

  const setCameraPreset = (preset: 'overview' | 'top' | 'barrage' | 'temple' | 'floodplain') => {
    setActivePreset(preset);
    setSelectedCalloutId(null);

    if (preset === 'overview') {
      flyTo([75, 95, 105], [0, 0, 0]);
    } else if (preset === 'top') {
      flyTo([0, 140, 2], [0, 0, 0]);
    } else if (preset === 'barrage') {
      flyTo([-20, 35, 50], [0, 2, 0]);
    } else if (preset === 'temple') {
      flyTo([-45, 50, -30], [10, 2, 10]);
    } else {
      flyTo([30, 40, 70], [5, 2, 10]);
    }
  };

  // Filter callouts based on active tab
  const visibleCallouts = useMemo(() => {
    if (calloutFilter === 'minimal') return [];
    if (calloutFilter === 'all') return callouts;
    return callouts.filter(c => c.category === calloutFilter);
  }, [callouts, calloutFilter]);

  return (
    <div className="relative w-full h-full bg-[#070d18] overflow-hidden select-none font-sans">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* SVG Vector Leader Lines Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>
        </defs>
        {visibleCallouts.map((c) => {
          const anchor = screenAnchors[c.id];
          if (!anchor || !anchor.visible) return null;

          const isSelected = selectedCalloutId === c.id;
          const cardX = anchor.x + c.cardOffset.x;
          const cardY = anchor.y + c.cardOffset.y;
          const elbowX = anchor.x + c.cardOffset.x * 0.45;
          const elbowY = anchor.y + c.cardOffset.y * 0.45;

          return (
            <g key={`svg-leader-${c.id}`} className="transition-opacity duration-300">
              {/* Ground Anchor Ring & Target Dot */}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={isSelected ? 6 : 4}
                fill="#38bdf8"
                className="animate-pulse"
              />
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={isSelected ? 14 : 9}
                fill="none"
                stroke={isSelected ? '#38bdf8' : '#38bdf8aa'}
                strokeWidth={1.5}
                strokeDasharray={isSelected ? 'none' : '3 2'}
              />

              {/* Architectural Elbow Leader Line */}
              <polyline
                points={`${anchor.x},${anchor.y} ${elbowX},${elbowY} ${cardX},${cardY}`}
                fill="none"
                stroke={isSelected ? '#38bdf8' : '#64748b'}
                strokeWidth={isSelected ? 2 : 1.2}
                strokeDasharray={isSelected ? 'none' : '4 3'}
                className="transition-all"
              />
            </g>
          );
        })}
      </svg>

      {/* 2D HTML/CSS Explanatory Callout Cards Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {visibleCallouts.map((c) => {
          const anchor = screenAnchors[c.id];
          if (!anchor || !anchor.visible) return null;

          const gx = Math.floor(c.gridXRatio * (grid_size - 1));
          const gy = Math.floor(c.gridYRatio * (grid_size - 1));
          const elev = dem[gy][gx];
          const depth = currentSnapshot?.depth_grid[gy]?.[gx] || 0;
          const vel = currentSnapshot?.velocity_grid[gy]?.[gx] || 0;
          const isSelected = selectedCalloutId === c.id;

          const cardLeft = anchor.x + c.cardOffset.x;
          const cardTop = anchor.y + c.cardOffset.y;

          return (
            <div
              key={`card-${c.id}`}
              style={{
                transform: `translate(${cardLeft}px, ${cardTop}px)`,
                transformOrigin: 'center center'
              }}
              onClick={() => handleSelectCallout(c)}
              className={`absolute pointer-events-auto cursor-pointer transition-all duration-200 -translate-x-1/2 -translate-y-1/2 group ${
                isSelected ? 'scale-105 z-30' : 'hover:scale-102 opacity-90 hover:opacity-100'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl border backdrop-blur-md shadow-2xl space-y-1 w-56 text-left transition-all ${
                  isSelected
                    ? 'bg-slate-900/95 border-cyan-400 shadow-cyan-500/20 ring-1 ring-cyan-400'
                    : 'bg-[#0b1329]/90 border-slate-700/80 hover:border-cyan-500/60 shadow-black/60'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-300 flex items-center space-x-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${depth > 0.1 ? 'bg-rose-400 animate-ping' : 'bg-cyan-400'}`}></span>
                    <span>{c.title}</span>
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {c.category.toUpperCase()}
                  </span>
                </div>

                {/* Subtitle / Description */}
                <p className="text-[11px] font-medium text-slate-200 leading-tight">
                  {c.subtitle}
                </p>

                {/* Dynamic Telemetry Metrics Footer */}
                <div className="pt-1.5 border-t border-slate-800 grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500 block">Elevation</span>
                    <span className="text-slate-300 font-semibold">{elev.toFixed(1)}m MSL</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Water Depth</span>
                    <span className={`font-semibold ${depth > 0.1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {depth > 0.05 ? `${depth.toFixed(2)}m` : 'Dry (0.0m)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Floating Control Bar: Explanatory Mode & Callout Filters */}
      <div className="absolute top-4 left-4 z-30 flex flex-col space-y-2 max-w-2xl pointer-events-auto">
        {/* Main 3D Modes */}
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
            <span>Explanatory 3D Flood Diagram</span>
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
            <span>Satellite Base</span>
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
        </div>

        {/* Technical Callout Filter Tabs */}
        <div className="glass-panel p-1.5 rounded-xl flex items-center space-x-1 text-xs border border-slate-800 shadow-xl text-slate-300">
          <span className="flex items-center space-x-1 text-slate-400 px-2 font-mono text-[10px] uppercase">
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>Callouts:</span>
          </span>

          <button
            onClick={() => setCalloutFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              calloutFilter === 'all' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Callouts (7)
          </button>

          <button
            onClick={() => setCalloutFilter('hydrology')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              calloutFilter === 'hydrology' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hydrology & River
          </button>

          <button
            onClick={() => setCalloutFilter('infrastructure')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              calloutFilter === 'infrastructure' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Urban & Assets
          </button>

          <button
            onClick={() => setCalloutFilter('risk')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              calloutFilter === 'risk' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Risk Lowlands
          </button>

          <button
            onClick={() => setCalloutFilter('minimal')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
              calloutFilter === 'minimal' ? 'bg-slate-700 text-white font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Clean Map
          </button>
        </div>
      </div>

      {/* Top Right: Camera Presets & Vertical Relief Control */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end space-y-2 pointer-events-auto">
        <div className="glass-panel p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-800 shadow-2xl text-xs">
          <button
            onClick={() => setCameraPreset('overview')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activePreset === 'overview' && !selectedCalloutId ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
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
            Top-Down (90°)
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

        {/* Vertical Relief & Opacity */}
        <div className="glass-panel px-3 py-1.5 rounded-xl flex items-center space-x-3 text-xs border border-slate-800 shadow-xl text-slate-300">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px]">Relief:</span>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              {[1.0, 1.5, 2.0].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setVerticalExag(ex)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                    verticalExag === ex ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ex.toFixed(1)}×
                </button>
              ))}
            </div>
          </div>

          <div className="h-3 w-[1px] bg-slate-700"></div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Water Alpha:</span>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={floodOpacity}
              onChange={(e) => setFloodOpacity(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="font-mono text-cyan-400 text-[11px]">{Math.round(floodOpacity * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Left: Engineering Inundation Scale Legend */}
      <div className="absolute bottom-6 left-4 z-30 glass-panel p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 w-64 border border-slate-800 pointer-events-auto">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
          <span>Inundation Depth Scale</span>
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
          <span>Click any callout to focus view</span>
          <span className="text-cyan-400">Krishna River</span>
        </div>
      </div>

      {/* Mandatory Satellite & DEM Attribution */}
      <div className="absolute bottom-1 right-24 z-30 text-[9px] text-slate-400/80 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/60 pointer-events-none">
        Satellite Imagery © Esri, Maxar, Earthstar Geographics, USGS | DEM: SRTM / Copernicus 30m
      </div>
    </div>
  );
};
