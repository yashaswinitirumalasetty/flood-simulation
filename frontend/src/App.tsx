import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ScenarioSidebar } from './components/ScenarioSidebar';
import { MapViewer2D } from './components/MapViewer2D';
import { Terrain3DViewer } from './components/Terrain3DViewer';
import { TimeSliderController } from './components/TimeSliderController';
import { ImpactDashboard } from './components/ImpactDashboard';
import { ScenarioComparison } from './components/ScenarioComparison';
import { ObservedSatelliteCompare } from './components/ObservedSatelliteCompare';
import { WeatherPanel } from './components/WeatherPanel';
import { AICoPilotSidebar } from './components/AICoPilotSidebar';
import { ExportModal } from './components/ExportModal';
import {
  GISData,
  SimulationResult,
  ImpactData,
  SimulationParameters,
  ChatMessage,
  FullSimulationResponse,
  RiverLocationHierarchy
} from './types';
import { RotateCw, AlertCircle, Sparkles } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://127.0.0.1:8000';

export const App: React.FC = () => {
  const [gisData, setGisData] = useState<GISData | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [currentTimestep, setCurrentTimestep] = useState<number>(3); // Peak 3h
  const [activeTab, setActiveTab] = useState<'3d_terrain' | '2d_map' | 'satellite' | 'impact' | 'comparison'>('3d_terrain');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(85);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState<boolean>(false);

  // Supported Hierarchy
  const [hierarchy, setHierarchy] = useState<RiverLocationHierarchy>({
    'Krishna River': {
      status: 'detailed',
      badge: 'Detailed DEM & GIS',
      default_location: 'Vijayawada',
      locations: [
        { id: 'vijayawada', name: 'Vijayawada', status: 'detailed', state: 'Andhra Pradesh' },
        { id: 'amaravati', name: 'Amaravati', status: 'detailed', state: 'Andhra Pradesh' },
        { id: 'tadepalli', name: 'Tadepalli', status: 'detailed', state: 'Andhra Pradesh' },
        { id: 'mangalagiri', name: 'Mangalagiri', status: 'detailed', state: 'Andhra Pradesh' },
        { id: 'ibrahimpatnam', name: 'Ibrahimpatnam', status: 'detailed', state: 'Andhra Pradesh' }
      ]
    },
    'Godavari River': {
      status: 'schematic',
      badge: 'Schematic / Approximate',
      default_location: 'Rajahmundry',
      locations: [
        { id: 'rajahmundry', name: 'Rajahmundry (Dowleswaram)', status: 'schematic', state: 'Andhra Pradesh' }
      ]
    },
    'Ganga River': {
      status: 'schematic',
      badge: 'Schematic / Approximate',
      default_location: 'Patna',
      locations: [
        { id: 'patna', name: 'Patna (Ganges-Son Confluence)', status: 'schematic', state: 'Bihar' }
      ]
    },
    'Yamuna River': {
      status: 'schematic',
      badge: 'Schematic / Approximate',
      default_location: 'Delhi',
      locations: [
        { id: 'delhi', name: 'Delhi (ITO / Yamuna Floodplain)', status: 'schematic', state: 'Delhi NCR' }
      ]
    },
    'Cauvery River': {
      status: 'schematic',
      badge: 'Schematic / Approximate',
      default_location: 'Tiruchirappalli',
      locations: [
        { id: 'tiruchirappalli', name: 'Tiruchirappalli (Grand Anicut)', status: 'schematic', state: 'Tamil Nadu' }
      ]
    }
  });

  // Scenario Parameters
  const [params, setParams] = useState<SimulationParameters>({
    river: 'Krishna River',
    location: 'Vijayawada',
    rainfall_intensity_mmhr: 50.0,
    duration_hours: 4.0,
    river_discharge_cusecs: 250000.0,
    engine_mode: 'fast_ai'
  });

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState({
    dem: true,
    floodDepth: true,
    velocityVectors: true,
    buildings: true,
    roads: true,
    criticalFacilities: true,
    observedSatellite: false,
  });

  // Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: '👋 Welcome to **HydroForge AI (Krishna River — Vijayawada Edition)**. I am your hydrodynamic co-pilot. You can adjust storm parameters, test 50 to 300 mm/hr rainfall, or ask me questions like *"Which hospitals lose access?"* or *"Set 150 mm/hr rainfall with 5 Lakh Cusecs discharge"*.',
      timestamp: 'Just now'
    }
  ]);
  const [isProcessingChat, setIsProcessingChat] = useState(false);

  const toggleLayer = (layerKey: keyof typeof layerVisibility) => {
    setLayerVisibility(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Run Simulation API Call
  const handleRunSimulation = useCallback(async (customParams?: Partial<SimulationParameters>) => {
    const activeParams = { ...params, ...(customParams || {}) };
    setIsSimulating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeParams)
      });

      if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`);
      const data: FullSimulationResponse = await res.json();

      setSimulation(data.simulation);
      setImpact(data.impact);
      setLatencyMs(data.total_latency_ms);
      if (customParams) {
        setParams(prev => ({ ...prev, ...customParams }));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect to backend simulation engine.');
    } finally {
      setIsSimulating(false);
    }
  }, [params]);

  // Fetch GIS data when River or Location changes
  const loadLocationGIS = useCallback(async (targetRiver: string, targetLoc: string) => {
    try {
      const gisRes = await fetch(`${API_BASE}/api/gis/data?river=${encodeURIComponent(targetRiver)}&location=${encodeURIComponent(targetLoc)}`);
      if (!gisRes.ok) throw new Error('Failed to load location GIS data');
      const gis: GISData = await gisRes.json();
      setGisData(gis);
      return gis;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch GIS data');
      return null;
    }
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch locations hierarchy
        const locRes = await fetch(`${API_BASE}/api/locations`);
        if (locRes.ok) {
          const hier = await locRes.json();
          setHierarchy(hier);
        }

        // Fetch Vijayawada GIS
        await loadLocationGIS('Krishna River', 'Vijayawada');

        // Run default baseline simulation
        await handleRunSimulation({
          river: 'Krishna River',
          location: 'Vijayawada',
          rainfall_intensity_mmhr: 50.0,
          river_discharge_cusecs: 250000.0,
        });
      } catch (err: any) {
        console.error(err);
        setError('Backend server offline. Please make sure the FastAPI server is running on port 8000.');
      }
    };
    init();
  }, []);

  // Handle River & Location selection change
  const handleParamsChange = async (newP: Partial<SimulationParameters>) => {
    const nextParams = { ...params, ...newP };
    setParams(nextParams);

    if (newP.river || newP.location) {
      const r = newP.river || params.river;
      const l = newP.location || params.location;
      await loadLocationGIS(r, l);
      await handleRunSimulation(nextParams);
    }
  };

  // Handle Assistant Query
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessingChat(true);

    try {
      const res = await fetch(`${API_BASE}/api/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: text,
          current_params: params
        })
      });

      if (!res.ok) throw new Error('Assistant query failed');
      const data = await res.json();

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: data.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        applied_actions: data.applied_actions
      };
      setMessages(prev => [...prev, botMsg]);

      // If parameters were updated, auto re-run simulation
      if (data.should_rerun_simulation && data.updated_params) {
        await handleParamsChange(data.updated_params);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `⚠️ Error processing query: ${err.message}`,
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setIsProcessingChat(false);
    }
  };

  if (error && !gisData) {
    return (
      <div className="h-screen w-screen bg-[#070d18] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">HydroForge AI Simulation Engine</h1>
        <p className="text-xs text-slate-400 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-2"
        >
          <RotateCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b111e] overflow-hidden">
      {/* Top Header with River & Location dropdowns */}
      <Header
        params={params}
        onParamsChange={handleParamsChange}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenWeather={() => setIsWeatherOpen(true)}
        hierarchy={hierarchy}
        isSimulating={isSimulating}
        latencyMs={latencyMs}
        dataStatus={gisData?.status || 'detailed'}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Hydrology & Scenario Sidebar */}
        <ScenarioSidebar
          params={params}
          onParamsChange={(newP) => setParams(prev => ({ ...prev, ...newP }))}
          onRunSimulation={() => handleRunSimulation()}
          isSimulating={isSimulating}
          layerVisibility={layerVisibility}
          onToggleLayer={toggleLayer}
        />

        {/* Center Main Viewport */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {gisData ? (
            <>
              {activeTab === '3d_terrain' && (
                <div className="flex-1 relative">
                  <Terrain3DViewer
                    gisData={gisData}
                    simulation={simulation}
                    currentTimestep={currentTimestep}
                  />
                  <TimeSliderController
                    simulation={simulation}
                    currentTimestep={currentTimestep}
                    onTimestepChange={setCurrentTimestep}
                  />
                </div>
              )}

              {activeTab === '2d_map' && (
                <div className="flex-1 relative">
                  <MapViewer2D
                    gisData={gisData}
                    simulation={simulation}
                    currentTimestep={currentTimestep}
                    layerVisibility={layerVisibility}
                    damagedBuildings={impact?.damaged_buildings_list}
                  />
                  <TimeSliderController
                    simulation={simulation}
                    currentTimestep={currentTimestep}
                    onTimestepChange={setCurrentTimestep}
                  />
                </div>
              )}

              {activeTab === 'satellite' && (
                <ObservedSatelliteCompare
                  gisData={gisData}
                  simulation={simulation}
                  impact={impact}
                />
              )}

              {activeTab === 'impact' && (
                <ImpactDashboard
                  impact={impact}
                  river={params.river}
                  location={params.location}
                />
              )}

              {activeTab === 'comparison' && (
                <ScenarioComparison
                  currentSim={simulation}
                  currentImpact={impact}
                  currentParams={params}
                  onApplyPreset={(rain, disch) => {
                    handleParamsChange({
                      rainfall_intensity_mmhr: rain,
                      river_discharge_cusecs: disch
                    });
                  }}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              <RotateCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
              <span>Loading {params.location} Topography & GIS Mesh...</span>
            </div>
          )}
        </main>

        {/* AI Co-Pilot Drawer */}
        <AICoPilotSidebar
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessingChat}
        />

        {/* Weather Intelligence Panel */}
        <WeatherPanel
          isOpen={isWeatherOpen}
          onClose={() => setIsWeatherOpen(false)}
          weather={gisData?.weather}
        />

        {/* Export Modal */}
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          simulation={simulation}
          impact={impact}
          params={params}
        />
      </div>
    </div>
  );
};
