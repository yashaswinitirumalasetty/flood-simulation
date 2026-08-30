export interface Building {
  id: string;
  name: string;
  type: string;
  grid_x: number;
  grid_y: number;
  lat: number;
  lon: number;
  elevation_m: number;
  area_sqm: number;
  asset_value_usd: number;
  floors: number;
}

export interface CriticalFacility {
  id: string;
  name: string;
  type: string;
  grid_x: number;
  grid_y: number;
  lat: number;
  lon: number;
  elevation_m: number;
  capacity_beds?: number;
  vehicles?: number;
  voltage_kv?: number;
  shelter_capacity?: number;
}

export interface RoadSegment {
  id: string;
  name: string;
  type: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  elevation_m: number;
  critical_evacuation_route: boolean;
}

export interface GISData {
  grid_size: number;
  cell_size_m: number;
  dem_grid: number[][];
  roughness_grid: number[][];
  min_elevation: number;
  max_elevation: number;
  assets: {
    buildings: Building[];
    critical_facilities: CriticalFacility[];
    roads: RoadSegment[];
    total_buildings: number;
    total_roads_count: number;
  };
}

export interface SimulationSnapshot {
  timestep_index: number;
  time_hours: number;
  depth_grid: number[][];
  velocity_grid: number[][];
  inundated_area_km2: number;
  max_depth_m: number;
  mean_depth_m: number;
}

export interface SimulationResult {
  engine: string;
  execution_time_ms: number;
  mass_balance_error_pct?: number;
  ai_confidence_index?: number;
  hybrid_verified?: boolean;
  physics_residual_mae_m?: number;
  grid_size: number;
  cell_size_m: number;
  total_simulation_hours: number;
  snapshots: SimulationSnapshot[];
  peak_depth_grid: number[][];
  arrival_time_grid: number[][];
  max_peak_depth_m: number;
  peak_inundated_area_km2: number;
}

export interface DamagedBuilding {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  depth_m: number;
  arrival_time_hr: number | null;
  damage_pct: number;
  loss_usd: number;
  risk_tier: 'None' | 'Low' | 'Moderate' | 'High' | 'Critical';
}

export interface CriticalFacilityStatus {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  depth_m: number;
  is_flooded: boolean;
  cutoff_time_hr: number | null;
  status: string;
  recommendation: string;
}

export interface ImpactData {
  total_economic_loss_usd: number;
  total_damaged_buildings: number;
  loss_by_building_type: Record<string, number>;
  damaged_count_by_type: Record<string, number>;
  damaged_buildings_list: DamagedBuilding[];
  critical_facilities_status: CriticalFacilityStatus[];
  road_network: {
    impassable_roads_km: number;
    emergency_only_roads_km: number;
    passable_roads_km: number;
    total_network_km: number;
  };
  population_metrics: {
    exposed_population: number;
    displaced_population: number;
  };
}

export interface SimulationParameters {
  rainfall_intensity_mmhr: number;
  duration_hours: number;
  river_discharge_m3s: number;
  return_period_years?: number;
  engine_mode: 'fast_ai' | 'physics_lisflood' | 'hybrid_auto';
}

export interface FullSimulationResponse {
  simulation: SimulationResult;
  impact: ImpactData;
  parameters: SimulationParameters;
  total_latency_ms: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  applied_actions?: string[];
}
