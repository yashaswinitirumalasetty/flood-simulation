import numpy as np
from typing import Dict, Any, List

class ImpactDamageEngine:
    """
    Impact, Vulnerability, and Damage Assessment Engine implementing
    USACE / HAZUS-MH depth-damage functions, road passability classification,
    and critical facility isolation timeline analytics.
    """
    def __init__(self, cell_size_m: float = 10.0):
        self.cell_size_m = cell_size_m

    def compute_damage_percentage(self, depth_m: float, building_type: str) -> float:
        """
        USACE / HAZUS-MH Depth-Damage empirical stage curves.
        Returns percentage damage to building structure (0.0 to 1.0).
        """
        if depth_m <= 0.05:
            return 0.0
        
        # Empirical piecewise damage curves
        if building_type == "Residential":
            if depth_m < 0.3:
                return 0.08 + (depth_m / 0.3) * 0.12
            elif depth_m < 1.0:
                return 0.20 + ((depth_m - 0.3) / 0.7) * 0.30
            elif depth_m < 2.0:
                return 0.50 + ((depth_m - 1.0) / 1.0) * 0.25
            else:
                return min(0.95, 0.75 + (depth_m - 2.0) * 0.10)
        elif building_type == "Commercial":
            if depth_m < 0.5:
                return (depth_m / 0.5) * 0.25
            elif depth_m < 1.5:
                return 0.25 + ((depth_m - 0.5) / 1.0) * 0.35
            else:
                return min(0.90, 0.60 + (depth_m - 1.5) * 0.15)
        elif building_type == "Industrial":
            if depth_m < 0.5:
                return (depth_m / 0.5) * 0.30
            else:
                return min(0.85, 0.30 + ((depth_m - 0.5) / 2.0) * 0.50)
        else: # Public / Shelter
            return min(0.80, (depth_m / 2.0) * 0.60)

    def assess_impacts(
        self,
        peak_depth_grid: List[List[float]],
        arrival_time_grid: List[List[float]],
        assets: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates asset damage, road passability, and facility cutoff times.
        """
        depths = np.array(peak_depth_grid, dtype=np.float32)
        arrivals = np.array(arrival_time_grid, dtype=np.float32)

        # 1. Building Assessments
        total_economic_loss_usd = 0.0
        damaged_buildings = []
        loss_by_type = {"Residential": 0.0, "Commercial": 0.0, "Industrial": 0.0, "Public": 0.0}
        count_by_type = {"Residential": 0, "Commercial": 0, "Industrial": 0, "Public": 0}

        for b in assets["buildings"]:
            gx, gy = b["grid_x"], b["grid_y"]
            depth = float(depths[gy, gx])
            arr_time = float(arrivals[gy, gx])
            
            damage_pct = self.compute_damage_percentage(depth, b["type"])
            loss_usd = b["asset_value_usd"] * damage_pct
            
            # Assign Risk Tier
            if depth < 0.15:
                risk_tier = "Low" if depth > 0.02 else "None"
            elif depth < 0.60:
                risk_tier = "Moderate"
            elif depth < 1.50:
                risk_tier = "High"
            else:
                risk_tier = "Critical"

            if depth > 0.05:
                total_economic_loss_usd += loss_usd
                loss_by_type[b["type"]] += loss_usd
                count_by_type[b["type"]] += 1
                damaged_buildings.append({
                    "id": b["id"],
                    "name": b["name"],
                    "type": b["type"],
                    "lat": b["lat"],
                    "lon": b["lon"],
                    "depth_m": round(depth, 2),
                    "arrival_time_hr": round(arr_time, 1) if arr_time >= 0 else None,
                    "damage_pct": round(damage_pct * 100, 1),
                    "loss_usd": round(loss_usd, 2),
                    "risk_tier": risk_tier
                })

        # 2. Critical Facilities Analysis
        critical_status = []
        for fac in assets["critical_facilities"]:
            gx, gy = fac["grid_x"], fac["grid_y"]
            depth = float(depths[gy, gx])
            arr_time = float(arrivals[gy, gx])
            
            is_flooded = depth > 0.10
            cutoff_hr = arr_time if is_flooded and arr_time >= 0 else None

            status = "Operational"
            if depth > 0.50:
                status = "Severely Inundated / Evacuate"
            elif depth > 0.15:
                status = "Access Restricted / Flood Trapped"
            elif depth > 0.02:
                status = "Minor Water Incursion"

            critical_status.append({
                "id": fac["id"],
                "name": fac["name"],
                "type": fac["type"],
                "lat": fac["lat"],
                "lon": fac["lon"],
                "depth_m": round(depth, 2),
                "is_flooded": is_flooded,
                "cutoff_time_hr": cutoff_hr,
                "status": status,
                "recommendation": "Deploy mobile sandbag levees & stage medical evacuation" if is_flooded else "Standard flood watch standby"
            })

        # 3. Roads Network Passability
        impassable_roads_km = 0.0
        passable_roads_km = 0.0
        emergency_only_roads_km = 0.0
        road_statuses = []

        for r in assets["roads"]:
            sx, sy = r["start_x"], r["start_y"]
            ex, ey = r["end_x"], r["end_y"]
            max_r_depth = float(max(depths[sy, sx], depths[ey, ex]))
            
            seg_len_km = (abs(ex - sx) + abs(ey - sy)) * (self.cell_size_m / 1000.0)
            if max_r_depth < 0.15:
                passability = "Fully Passable"
                passable_roads_km += seg_len_km
            elif max_r_depth < 0.30:
                passability = "Emergency / High-Clearance 4WD Only"
                emergency_only_roads_km += seg_len_km
            else:
                passability = "Impassable / Severed"
                impassable_roads_km += seg_len_km

            road_statuses.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "max_depth_m": round(max_r_depth, 2),
                "passability": passability,
                "is_severed": max_r_depth >= 0.30
            })

        # 4. Population exposure estimation
        # Estimated 2.8 occupants per residential structure
        exposed_population = int(count_by_type["Residential"] * 2.8)
        displaced_population = int(sum(1 for b in damaged_buildings if b["depth_m"] > 0.4 and b["type"] == "Residential") * 2.8)

        return {
            "total_economic_loss_usd": round(total_economic_loss_usd, 2),
            "total_damaged_buildings": len(damaged_buildings),
            "loss_by_building_type": {k: round(v, 2) for k, v in loss_by_type.items()},
            "damaged_count_by_type": count_by_type,
            "damaged_buildings_list": damaged_buildings,
            "critical_facilities_status": critical_status,
            "road_network": {
                "impassable_roads_km": round(impassable_roads_km, 2),
                "emergency_only_roads_km": round(emergency_only_roads_km, 2),
                "passable_roads_km": round(passable_roads_km, 2),
                "total_network_km": round(impassable_roads_km + emergency_only_roads_km + passable_roads_km, 2)
            },
            "population_metrics": {
                "exposed_population": exposed_population,
                "displaced_population": displaced_population
            }
        }
