import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GISData, SimulationResult } from '../types';
import { Eye, RotateCw, Box, Compass, Sparkles, Navigation, Layers, Satellite } from 'lucide-react';

interface Terrain3DViewerProps {
  gisData: GISData;
  simulation: SimulationResult | null;
  currentTimestep: number;
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
  const buildingMeshesRef = useRef<THREE.Mesh[]>([]);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const [activePreset, setActivePreset] = useState<'iso' | 'top' | 'river' | 'temple'>('iso');
  const [useSatelliteTexture, setUseSatelliteTexture] = useState<boolean>(true);

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene & Camera Setup
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d18');
    scene.fog = new THREE.FogExp2('#070d18', 0.007);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(65, 70, 85);
    camera.lookAt(0, 8, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // 2. Realistic Sun and Reflective Lighting
    const ambientLight = new THREE.AmbientLight('#94a3b8', 1.1);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#ffffff', 1.6);
    sunLight.position.set(45, 95, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const blueFill = new THREE.DirectionalLight('#38bdf8', 0.65);
    blueFill.position.set(-50, 40, -50);
    scene.add(blueFill);

    // 3. Terrain Heightfield Plane for Vijayawada
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
      pos.setY(i, (elev - minElev) * 0.72);
    }
    planeGeo.computeVertexNormals();

    // Setup Vertex Colors for Base GIS Mode
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      const norm = (elev - minElev) / (maxElev - minElev || 1);

      if (elev < 15.0) {
        colors[i * 3] = 0.06;
        colors[i * 3 + 1] = 0.12;
        colors[i * 3 + 2] = 0.18;
      } else if (elev < 26.0) {
        colors[i * 3] = 0.12 + norm * 0.08;
        colors[i * 3 + 1] = 0.18 + norm * 0.10;
        colors[i * 3 + 2] = 0.16 + norm * 0.06;
      } else {
        colors[i * 3] = 0.32 + norm * 0.22;
        colors[i * 3 + 1] = 0.24 + norm * 0.14;
        colors[i * 3 + 2] = 0.16 + norm * 0.08;
      }
    }
    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Load High-Resolution Satellite Texture (ESRI World Imagery for Vijayawada)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const satTexture = textureLoader.load(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7354/11860',
      () => {
        if (terrainMeshRef.current && useSatelliteTexture) {
          (terrainMeshRef.current.material as THREE.MeshStandardMaterial).map = satTexture;
          (terrainMeshRef.current.material as THREE.MeshStandardMaterial).vertexColors = false;
          (terrainMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
      }
    );
    satTexture.wrapS = THREE.ClampToEdgeWrapping;
    satTexture.wrapT = THREE.ClampToEdgeWrapping;

    const terrainMat = new THREE.MeshStandardMaterial({
      map: useSatelliteTexture ? satTexture : null,
      vertexColors: !useSatelliteTexture,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMeshRef.current = terrainMesh;
    scene.add(terrainMesh);

    // 4. Dynamic Water Mesh
    const waterGeo = new THREE.PlaneGeometry(90, 90, grid_size - 1, grid_size - 1);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.85,
      roughness: 0.06,
      metalness: 0.22,
      transmission: 0.68,
      ior: 1.333,
      reflectivity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);

    // 5. Water Flow Particles (Streamlines moving downstream through Prakasam Barrage)
    const particleCount = 300;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      const px = (t - 0.5) * 80;
      const pz = (0.45 * (px / 40) * 40 + Math.sin(px * 0.08) * 10) + (Math.random() - 0.5) * 8;
      
      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = 2.0;
      particlePositions[i * 3 + 2] = pz;
      particleSpeeds[i] = 0.25 + Math.random() * 0.45;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: '#38bdf8',
      size: 1.3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 6. 3D Extruded Buildings & Landmarks
    const bGroup = new THREE.Group();
    buildingMeshesRef.current = [];

    gisData.assets.buildings.forEach((b) => {
      const bx = ((b.grid_x / (grid_size - 1)) - 0.5) * 90;
      const bz = ((b.grid_y / (grid_size - 1)) - 0.5) * 90;
      const bElev = (b.elevation_m - minElev) * 0.72;
      const bHeight = Math.max(2.5, b.floors * 2.2);

      const bGeo = new THREE.BoxGeometry(1.5, bHeight, 1.5);
      const bMat = new THREE.MeshStandardMaterial({
        color: b.type === 'Commercial' ? '#94a3b8' : b.type === 'Industrial' ? '#64748b' : '#475569',
        roughness: 0.45,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(bx, bElev + bHeight / 2, bz);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      (bMesh as any).grid_x = b.grid_x;
      (bMesh as any).grid_y = b.grid_y;
      (bMesh as any).bElev = bElev;
      (bMesh as any).bHeight = bHeight;

      buildingMeshesRef.current.push(bMesh);
      bGroup.add(bMesh);
    });

    // Prakasam Barrage 3D Span
    const barrageGeo = new THREE.BoxGeometry(1.8, 3.2, 16.0);
    const barrageMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25 });
    const barrageMesh = new THREE.Mesh(barrageGeo, barrageMat);
    barrageMesh.position.set(-1.0, 5.5, 0.0);
    barrageMesh.castShadow = true;
    bGroup.add(barrageMesh);

    scene.add(bGroup);

    // Mouse Interaction
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      const angleX = deltaX * 0.005;
      const angleY = deltaY * 0.005;

      const cam = cameraRef.current;
      const radius = Math.sqrt(cam.position.x ** 2 + cam.position.z ** 2);
      const currentAngle = Math.atan2(cam.position.z, cam.position.x);

      cam.position.x = radius * Math.cos(currentAngle - angleX);
      cam.position.z = radius * Math.sin(currentAngle - angleX);
      cam.position.y = Math.max(12, Math.min(130, cam.position.y + angleY * 18));
      cam.lookAt(0, 8, 0);

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop
    let animationFrameId: number;
    let waveTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      waveTime += 0.035;

      // 1. Dynamic Volumetric Water Ripple Elevation
      if (waterMeshRef.current) {
        const wPos = waterMeshRef.current.geometry.attributes.position;
        const depths = currentSnapshot?.depth_grid;
        
        for (let i = 0; i < wPos.count; i++) {
          const gx = i % grid_size;
          const gy = Math.floor(i / grid_size);
          const elev = (dem[gy][gx] - minElev) * 0.72;
          const d = depths ? depths[gy][gx] : 0;

          if (d > 0.02) {
            const ripple = Math.sin(gx * 0.45 + waveTime) * Math.cos(gy * 0.45 + waveTime) * 0.18;
            wPos.setY(i, elev + d * 0.72 + ripple);
          } else {
            wPos.setY(i, elev - 2.0);
          }
        }
        wPos.needsUpdate = true;
      }

      // 2. Animate Water Flow Particles along Krishna Channel
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

      // 3. Dynamic Building Color Immersion Update
      if (buildingMeshesRef.current.length > 0 && currentSnapshot) {
        const depths = currentSnapshot.depth_grid;
        buildingMeshesRef.current.forEach((bMesh) => {
          const gx = (bMesh as any).grid_x;
          const gy = (bMesh as any).grid_y;
          const bDepth = depths ? depths[gy][gx] || 0 : 0;

          if (bDepth > 1.2) {
            (bMesh.material as THREE.MeshStandardMaterial).color.set('#ef4444');
          } else if (bDepth > 0.3) {
            (bMesh.material as THREE.MeshStandardMaterial).color.set('#f59e0b');
          } else {
            (bMesh.material as THREE.MeshStandardMaterial).color.set('#94a3b8');
          }
        });
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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gisData, useSatelliteTexture]);

  const setCameraPreset = (preset: 'iso' | 'top' | 'river' | 'temple') => {
    if (!cameraRef.current) return;
    setActivePreset(preset);
    if (preset === 'iso') {
      cameraRef.current.position.set(65, 70, 85);
      cameraRef.current.lookAt(0, 8, 0);
    } else if (preset === 'top') {
      cameraRef.current.position.set(0, 115, 5);
      cameraRef.current.lookAt(0, 0, 0);
    } else if (preset === 'river') {
      cameraRef.current.position.set(-20, 18, 45);
      cameraRef.current.lookAt(5, 6, 0);
    } else {
      cameraRef.current.position.set(-35, 55, -25);
      cameraRef.current.lookAt(10, 5, 10);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#070d18] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        <div className="glass-panel px-3 py-2 rounded-2xl text-xs flex items-center space-x-3 text-slate-300 shadow-2xl border border-slate-800">
          <div className="flex items-center space-x-1.5">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-100">3D Satellite Terrain Mesh</span>
          </div>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-300 font-mono font-medium">{gisData.river} — {gisData.location}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Drag to Orbit</span>
        </div>

        {/* Real Landmark Labels Overlay Banner */}
        <div className="glass-panel px-3 py-1.5 rounded-xl text-[11px] text-slate-400 flex items-center space-x-2 border border-slate-800/80">
          <span className="flex items-center space-x-1 text-slate-200">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Prakasam Barrage Gorge</span>
          </span>
          <span>•</span>
          <span className="text-amber-300">Indrakeeladri Hill (138m)</span>
          <span>•</span>
          <span className="text-rose-400">Krishna Lanka Floodplains</span>
          <span>•</span>
          <span className="text-emerald-400">Tadepalli South Bank</span>
        </div>
      </div>

      {/* Camera & Satellite Texture Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end space-y-2">
        <div className="glass-panel p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-800 shadow-2xl">
          {/* Satellite Texture Toggle */}
          <button
            onClick={() => setUseSatelliteTexture(prev => !prev)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              useSatelliteTexture
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900/80'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>{useSatelliteTexture ? 'Satellite Texture: ON' : 'GIS Hypsometric'}</span>
          </button>
        </div>

        {/* Camera Angle Presets */}
        <div className="glass-panel p-1.5 rounded-xl flex items-center space-x-1 border border-slate-800 shadow-xl">
          <button
            onClick={() => setCameraPreset('iso')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'iso' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Isometric
          </button>
          <button
            onClick={() => setCameraPreset('top')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'top' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Top-Down
          </button>
          <button
            onClick={() => setCameraPreset('river')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'river' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Barrage
          </button>
          <button
            onClick={() => setCameraPreset('temple')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'temple' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Indrakeeladri
          </button>
        </div>
      </div>
    </div>
  );
};
