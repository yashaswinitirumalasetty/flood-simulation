import numpy as np
from typing import Dict, Any, List

class SyntheticGISGenerator:
    """
    Generates realistic synthetic GIS layers (DEM, rivers, Manning's roughness,
    buildings, road networks, critical infrastructure) for a selected bounding box.
    """
    def __init__(self, grid_size: int = 64, cell_size_m: float = 10.0):
        self.grid_size = grid_size
        self.cell_size_m = cell_size_m
        self.rng = np.random.RandomState(42)

    def generate_dem(self) -> np.ndarray:
        """
        Generates a realistic topographical elevation grid (DEM) with a main valley,
        meandering river trough, surrounding hills, and natural terrain noise.
        """
        x = np.linspace(-3, 3, self.grid_size)
        y = np.linspace(-3, 3, self.grid_size)
        X, Y = np.meshgrid(x, y)

        # Regional valley gradient (highlands in North-East, lowlands in South-West)
        elevation = 25.0 + 12.0 * X + 8.0 * Y

        # Surrounding ridges / hills
        hills = 15.0 * np.exp(-((X - 1.2)**2 + (Y + 1.0)**2) / 1.5) + \
                18.0 * np.exp(-((X + 1.8)**2 + (Y - 1.5)**2) / 2.0)
        elevation += hills

        # Meandering main river channel trough (carving down)
        river_path_y = np.sin(X * 1.2) * 1.2
        dist_to_river = np.abs(Y - river_path_y)
        river_trough = -8.0 * np.exp(-(dist_to_river**2) / 0.15)
        elevation += river_trough

        # High-frequency natural terrain fractal noise
        noise = 1.2 * np.sin(5 * X) * np.cos(5 * Y) + 0.6 * np.cos(10 * X) * np.sin(10 * Y)
        elevation += noise

        # Ensure realistic minimum elevation
        elevation = np.maximum(elevation, 5.0)
        return np.round(elevation, 2)

    def generate_roughness(self, dem: np.ndarray) -> np.ndarray:
        """
        Generates Manning's n surface roughness grid based on slope and topography.
        Water body = 0.030, Urban = 0.120, Forest = 0.100, Pasture/Open = 0.045, Roads = 0.018
        """
        roughness = np.full((self.grid_size, self.grid_size), 0.045) # Default open land

        # River channel has low roughness
        dy, dx = np.gradient(dem)
        slope = np.sqrt(dx**2 + dy**2)
        
        # Center region is urbanized
        mid_start, mid_end = int(self.grid_size * 0.35), int(self.grid_size * 0.75)
        roughness[mid_start:mid_end, mid_start:mid_end] = 0.110 # Urban

        # River bed
        roughness[dem < np.percentile(dem, 15)] = 0.030 # River channel

        # Steep slopes = Forest
        roughness[slope > np.percentile(slope, 80)] = 0.095 # Forest/Dense veg
        return np.round(roughness, 3)

    def generate_infrastructure_assets(self, dem: np.ndarray) -> Dict[str, Any]:
        """
        Generates synthetic building footprints, road segments, and critical facilities.
        """
        buildings = []
        b_types = ["Residential", "Commercial", "Industrial", "Public"]
        b_values = {"Residential": 350000, "Commercial": 1200000, "Industrial": 2800000, "Public": 1500000}

        # Place 70 buildings in urban and suburban sectors
        np.random.seed(101)
        for i in range(70):
            gx = int(np.random.uniform(8, self.grid_size - 8))
            gy = int(np.random.uniform(8, self.grid_size - 8))
            b_type = np.random.choice(b_types, p=[0.6, 0.2, 0.1, 0.1])
            elev = float(dem[gy, gx])
            
            # Skip if placed right in the deep river bed
            if elev < np.percentile(dem, 12):
                continue

            buildings.append({
                "id": f"BLD-{1000 + i}",
                "name": f"{b_type} Structure #{i+1}",
                "type": b_type,
                "grid_x": gx,
                "grid_y": gy,
                "lat": round(29.95 + gy * 0.0015, 5),
                "lon": round(-90.08 + gx * 0.0015, 5),
                "elevation_m": elev,
                "area_sqm": int(np.random.uniform(120, 850)),
                "asset_value_usd": b_values[b_type] * np.random.uniform(0.8, 1.4),
                "floors": 1 if b_type == "Residential" else 3
            })

        # Critical Infrastructure
        critical_facilities = [
            {
                "id": "CRIT-HOSP-01",
                "name": "St. Jude Metropolitan Hospital",
                "type": "Hospital",
                "grid_x": int(self.grid_size * 0.42),
                "grid_y": int(self.grid_size * 0.48),
                "lat": round(29.95 + int(self.grid_size * 0.48) * 0.0015, 5),
                "lon": round(-90.08 + int(self.grid_size * 0.42) * 0.0015, 5),
                "elevation_m": float(dem[int(self.grid_size * 0.48), int(self.grid_size * 0.42)]),
                "capacity_beds": 350,
                "emergency_power": True
            },
            {
                "id": "CRIT-FIRE-01",
                "name": "Central Emergency Fire Station #4",
                "type": "Fire Station",
                "grid_x": int(self.grid_size * 0.65),
                "grid_y": int(self.grid_size * 0.38),
                "lat": round(29.95 + int(self.grid_size * 0.38) * 0.0015, 5),
                "lon": round(-90.08 + int(self.grid_size * 0.65) * 0.0015, 5),
                "elevation_m": float(dem[int(self.grid_size * 0.38), int(self.grid_size * 0.65)]),
                "vehicles": 8
            },
            {
                "id": "CRIT-POWER-01",
                "name": "Valley Grid Electrical Substation",
                "type": "Power Substation",
                "grid_x": int(self.grid_size * 0.32),
                "grid_y": int(self.grid_size * 0.62),
                "lat": round(29.95 + int(self.grid_size * 0.62) * 0.0015, 5),
                "lon": round(-90.08 + int(self.grid_size * 0.32) * 0.0015, 5),
                "elevation_m": float(dem[int(self.grid_size * 0.62), int(self.grid_size * 0.32)]),
                "voltage_kv": 115
            },
            {
                "id": "CRIT-SCH-01",
                "name": "Lincoln High Community Evacuation Center",
                "type": "School / Shelter",
                "grid_x": int(self.grid_size * 0.72),
                "grid_y": int(self.grid_size * 0.70),
                "lat": round(29.95 + int(self.grid_size * 0.70) * 0.0015, 5),
                "lon": round(-90.08 + int(self.grid_size * 0.72) * 0.0015, 5),
                "elevation_m": float(dem[int(self.grid_size * 0.70), int(self.grid_size * 0.72)]),
                "shelter_capacity": 1200
            }
        ]

        # Roads Network (Main Arterials and Secondary Streets)
        roads = []
        # Main East-West Highway
        for x in range(5, self.grid_size - 5, 2):
            y = int(self.grid_size * 0.45)
            roads.append({
                "id": f"ROAD-HWY-{x}",
                "name": "Interstate Route 90 Express",
                "type": "Arterial Highway",
                "start_x": x,
                "start_y": y,
                "end_x": min(x + 2, self.grid_size - 1),
                "end_y": y,
                "elevation_m": float(dem[y, x]),
                "critical_evacuation_route": True
            })
        
        # North-South Boulevard
        for y in range(5, self.grid_size - 5, 2):
            x = int(self.grid_size * 0.50)
            roads.append({
                "id": f"ROAD-BLVD-{y}",
                "name": "Riverside Grand Boulevard",
                "type": "Primary Arterial",
                "start_x": x,
                "start_y": y,
                "end_x": x,
                "end_y": min(y + 2, self.grid_size - 1),
                "elevation_m": float(dem[y, x]),
                "critical_evacuation_route": True
            })

        # Hospital Access Connector
        for x in range(int(self.grid_size * 0.42), int(self.grid_size * 0.50)):
            y = int(self.grid_size * 0.48)
            roads.append({
                "id": f"ROAD-HOSP-{x}",
                "name": "Hospital Emergency Access Way",
                "type": "Emergency Connector",
                "start_x": x,
                "start_y": y,
                "end_x": x + 1,
                "end_y": y,
                "elevation_m": float(dem[y, x]),
                "critical_evacuation_route": True
            })

        return {
            "buildings": buildings,
            "critical_facilities": critical_facilities,
            "roads": roads,
            "total_buildings": len(buildings),
            "total_roads_count": len(roads)
        }
