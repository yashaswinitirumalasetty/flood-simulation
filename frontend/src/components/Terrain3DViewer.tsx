import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GISData, SimulationResult } from '../types';
import { Eye, RotateCw, Box } from 'lucide-react';

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
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const grid_size = gisData.grid_size;
  const currentSnapshot = simulation?.snapshots[currentTimestep] || null;

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene Setup
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070d18');
    scene.fog = new THREE.FogExp2('#070d18', 0.008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(60, 65, 85);
    camera.lookAt(0, 10, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight('#94a3b8', 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.4);
    dirLight.position.set(40, 80, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Terrain Heightfield Plane
    const planeGeo = new THREE.PlaneGeometry(80, 80, grid_size - 1, grid_size - 1);
    planeGeo.rotateX(-Math.PI / 2);

    const pos = planeGeo.attributes.position;
    const dem = gisData.dem_grid;
    const minElev = gisData.min_elevation;
    const maxElev = gisData.max_elevation;

    // Apply DEM elevations to vertices
    for (let i = 0; i < pos.count; i++) {
      const x = i % grid_size;
      const y = Math.floor(i / grid_size);
      const elev = dem[y][x];
      pos.setY(i, (elev - minElev) * 0.75); // Vertical scale
    }
    planeGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // 4. Dynamic Water Mesh
    const waterGeo = new THREE.PlaneGeometry(80, 80, grid_size - 1, grid_size - 1);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.82,
      roughness: 0.1,
      metalness: 0.15,
      transmission: 0.6,
      ior: 1.333,
      reflectivity: 0.8,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);

    // 5. 3D Building Extrusions
    const bGroup = new THREE.Group();
    gisData.assets.buildings.forEach((b) => {
      const bx = ((b.grid_x / (grid_size - 1)) - 0.5) * 80;
      const bz = ((b.grid_y / (grid_size - 1)) - 0.5) * 80;
      const bElev = (b.elevation_m - minElev) * 0.75;
      const bHeight = b.floors * 2.2;

      const bGeo = new THREE.BoxGeometry(1.4, bHeight, 1.4);
      const bMat = new THREE.MeshStandardMaterial({
        color: b.type === 'Commercial' ? '#64748b' : '#475569',
        roughness: 0.4,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(bx, bElev + bHeight / 2, bz);
      bMesh.castShadow = true;
      bGroup.add(bMesh);
    });
    scene.add(bGroup);

    // Mouse Drag Rotation
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
      cam.position.y = Math.max(15, Math.min(120, cam.position.y + angleY * 15));
      cam.lookAt(0, 10, 0);

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
      waveTime += 0.03;

      // Subtle water wave ripple effect
      if (waterMeshRef.current) {
        const wPos = waterMeshRef.current.geometry.attributes.position;
        const depths = currentSnapshot?.depth_grid;
        
        for (let i = 0; i < wPos.count; i++) {
          const gx = i % grid_size;
          const gy = Math.floor(i / grid_size);
          const elev = (dem[gy][gx] - minElev) * 0.75;
          const d = depths ? depths[gy][gx] : 0;

          if (d > 0.02) {
            const ripple = Math.sin(gx * 0.5 + waveTime) * Math.cos(gy * 0.5 + waveTime) * 0.15;
            wPos.setY(i, elev + d * 0.75 + ripple);
          } else {
            wPos.setY(i, elev - 1.0); // Hide dry water surface beneath terrain
          }
        }
        wPos.needsUpdate = true;
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
  }, [gisData]);

  const setCameraPreset = (preset: 'iso' | 'top' | 'low') => {
    if (!cameraRef.current) return;
    if (preset === 'iso') {
      cameraRef.current.position.set(60, 65, 85);
    } else if (preset === 'top') {
      cameraRef.current.position.set(0, 110, 5);
    } else {
      cameraRef.current.position.set(30, 20, 60);
    }
    cameraRef.current.lookAt(0, 10, 0);
  };

  return (
    <div className="relative w-full h-full bg-[#070d18] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D HUD */}
      <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
        <div className="glass-panel px-3 py-2 rounded-xl text-xs flex items-center space-x-3 text-slate-300 shadow-xl">
          <div className="flex items-center space-x-1.5">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">Three.js 3D Volumetric Engine</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Click & Drag to rotate camera</span>
        </div>
      </div>

      {/* Camera Angle Presets */}
      <div className="absolute top-4 right-4 z-10 glass-panel p-1.5 rounded-xl flex items-center space-x-1 border border-slate-800 shadow-xl">
        <button
          onClick={() => setCameraPreset('iso')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          Isometric (45°)
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          Top-Down (90°)
        </button>
        <button
          onClick={() => setCameraPreset('low')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
        >
          Low Bank View
        </button>
      </div>
    </div>
  );
};
