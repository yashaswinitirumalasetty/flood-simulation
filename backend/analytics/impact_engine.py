import numpy as np
from typing import Dict, Any, List, Optional

class ImpactDamageEngine:
    """
    Impact, Vulnerability, and Damage Assessment Engine implementing
    USACE / HAZUS-MH depth-damage functions, road passability classification,
    North vs South River Bank impact partitioning, and Satellite-derived flood validation (IoU).
    """
    def __init__(self, cell_size_m: float = 12.5):
        self.cell_size_m = cell_size_m

    def compute_damage_percentage(self, depth_m: float, building_type: str) -> float:
        """
        USACE / HAZUS-MH Depth-Damage empirical stage curves.
        Returns percentage damage to building structure (0.0 to 1.0).
        """
        if depth_m <= 0.05:
            return 0.0
        
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
        else:
            return min(0.80, (depth_m / 2.0) * 0.60)

    def assess_impacts(
        self,
        peak_depth_grid: List[List[float]],
        arrival_time_grid: List[List[float]],
        assets: Dict[str, Any],
        observed_satellite_mask: Optional[List[List[float]]] = None
    ) -> Dict[str, Any]:
        """
        Calculates asset damage, road passability, bank-specific impacts, and satellite validation metrics.
        """
        depths = np.array(peak_depth_grid, dtype=np.float32)
        arrivals = np.array(arrival_time_grid, dtype=np.float32)
        ny, nx = depths.shape

        # 1. Building Assessments & Bank Separation
        total_economic_loss_usd = 0.0
        damaged_buildings = []
        loss_by_type = {"Residential": 0.0, "Commercial": 0.0, "Industrial": 0.0, "Public": 0.0}
        count_by_type = {"Residential": 0, "Commercial": 0, "Industrial": 0, "Public": 0}

        # River Bank Impact Buckets
        north_bank_loss = 0.0
        south_bank_loss = 0.0
        north_bank_damaged_bld = 0
        south_bank_damaged_bld = 0
        north_bank_total_bld = 0
        south_bank_total_bld = 0

        for b in assets.get("buildings", []):
            gx, gy = b["grid_x"], b["grid_y"]
            depth = float(depths[gy, gx])
            arr_time = float(arrivals[gy, gx])
            is_north = "North Bank" in b.get("bank", "North Bank")

            if is_north:
                north_bank_total_bld += 1
            else:
                south_bank_total_bld += 1
            
            damage_pct = self.compute_damage_percentage(depth, b["type"])
            loss_usd = b["asset_value_usd"] * damage_pct
            
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
                
                if is_north:
                    north_bank_loss += loss_usd
                    north_bank_damaged_bld += 1
                else:
                    south_bank_loss += loss_usd
                    south_bank_damaged_bld += 1

                damaged_buildings.append({
                    "id": b["id"],
                    "name": b["name"],
                    "locality": b.get("locality", "Vijayawada"),
                    "type": b["type"],
                    "bank": b.get("bank", "North Bank"),
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
        for fac in assets.get("critical_facilities", []):
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
                "bank": fac.get("bank", "North Bank"),
                "lat": fac["lat"],
                "lon": fac["lon"],
                "depth_m": round(depth, 2),
                "is_flooded": is_flooded,
                "cutoff_time_hr": cutoff_hr,
                "status": status,
                "recommendation": "Deploy mobile sandbag levees & stage medical evacuation" if is_flooded else "Standard flood watch standby"
            })

        # 3. Roads Network Passability & Bank Separation
        impassable_roads_km = 0.0
        passable_roads_km = 0.0
        emergency_only_roads_km = 0.0
        north_road_cut_km = 0.0
        south_road_cut_km = 0.0
        road_statuses = []

        for r in assets.get("roads", []):
            sx, sy = r["start_x"], r["start_y"]
            ex, ey = r["end_x"], r["end_y"]
            max_r_depth = float(max(depths[sy, sx], depths[ey, ex]))
            
            seg_len_km = (abs(ex - sx) + abs(ey - sy)) * (self.cell_size_m / 1000.0)
            is_north = "North" in r.get("bank", "North")

            if max_r_depth < 0.15:
                passability = "Fully Passable"
                passable_roads_km += seg_len_km
            elif max_r_depth < 0.30:
                passability = "Emergency / High-Clearance 4WD Only"
                emergency_only_roads_km += seg_len_km
            else:
                passability = "Impassable / Severed"
                impassable_roads_km += seg_len_km
                if is_north:
                    north_road_cut_km += seg_len_km
                else:
                    south_road_cut_km += seg_len_km

            road_statuses.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "bank": r.get("bank", "North Bank"),
                "max_depth_m": round(max_r_depth, 2),
                "passability": passability,
                "is_severed": max_r_depth >= 0.30
            })

        # 4. Bank-Specific Inundated Area Calculation
        # North half is gy < ny/2, South half is gy >= ny/2
        cell_area_km2 = (self.cell_size_m * self.cell_size_m) / 1e6
        north_wet_cells = np.sum(depths[:ny//2, :] > 0.05)
        south_wet_cells = np.sum(depths[ny//2:, :] > 0.05)
        north_bank_inundated_area_km2 = float(round(north_wet_cells * cell_area_km2, 3))
        south_bank_inundated_area_km2 = float(round(south_wet_cells * cell_area_km2, 3))

        # 5. Satellite Comparison Metrics (Observed vs Simulated)
        satellite_comparison = None
        if observed_satellite_mask is not None:
            obs = np.array(observed_satellite_mask, dtype=np.float32)
            sim_binary = (depths > 0.05).astype(np.float32)
            obs_binary = (obs > 0.5).astype(np.float32)

            intersection = np.sum((sim_binary == 1.0) & (obs_binary == 1.0))
            union = np.sum((sim_binary == 1.0) | (obs_binary == 1.0))
            iou_score = float(intersection / max(union, 1))

            tp = float(intersection)
            fp = float(np.sum((sim_binary == 1.0) & (obs_binary == 0.0)))
            fn = float(np.sum((sim_binary == 0.0) & (obs_binary == 1.0)))

            precision = float(tp / max(tp + fp, 1.0))
            recall = float(tp / max(tp + fn, 1.0))
            f1_score = float(2 * (precision * recall) / max(precision + recall, 1e-5))

            sim_area_km2 = float(round(np.sum(sim_binary) * cell_area_km2, 3))
            obs_area_km2 = float(round(np.sum(obs_binary) * cell_area_km2, 3))

            # Confusion Matrix Grid: 0 = Dry, 1 = True Positive (Matched Flood), 2 = False Positive (Over-prediction), 3 = False Negative (Under-prediction)
            diff_grid = np.zeros((ny, nx), dtype=int)
            diff_grid[(sim_binary == 1.0) & (obs_binary == 1.0)] = 1 # TP
            diff_grid[(sim_binary == 1.0) & (obs_binary == 0.0)] = 2 # FP
            diff_grid[(sim_binary == 0.0) & (obs_binary == 1.0)] = 3 # FN

            satellite_comparison = {
                "dataset_source": "ISRO / NRSC & Sentinel-1 SAR (September 2024 Event)",
                "iou_critical_success_index": round(iou_score, 3),
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1_score": round(f1_score, 3),
                "simulated_flooded_area_km2": sim_area_km2,
                "observed_flooded_area_km2": obs_area_km2,
                "area_delta_km2": round(sim_area_km2 - obs_area_km2, 3),
                "difference_matrix": diff_grid.tolist()
            }

        # Population
        exposed_population = int(count_by_type["Residential"] * 3.4)
        displaced_population = int(sum(1 for b in damaged_buildings if b["depth_m"] > 0.4 and b["type"] == "Residential") * 3.4)

        return {
            "total_economic_loss_usd": round(total_economic_loss_usd, 2),
            "total_damaged_buildings": len(damaged_buildings),
            "total_buildings_in_domain": len(assets.get("buildings", [])),
            "pct_buildings_damaged": round((len(damaged_buildings) / max(len(assets.get("buildings", [])), 1)) * 100.0, 1),
            "loss_by_building_type": {k: round(v, 2) for k, v in loss_by_type.items()},
            "damaged_count_by_type": count_by_type,
            "damaged_buildings_list": damaged_buildings,
            "critical_facilities_status": critical_status,
            "bank_impacts": {
                "north_bank": {
                    "name": "North Bank (Vijayawada Urban / Krishna Lanka / Bhavanipuram)",
                    "inundated_area_km2": north_bank_inundated_area_km2,
                    "damaged_buildings": north_bank_damaged_bld,
                    "total_buildings": north_bank_total_bld,
                    "loss_usd": round(north_bank_loss, 2),
                    "severed_roads_km": round(north_road_cut_km, 2)
                },
                "south_bank": {
                    "name": "South Bank (Tadepalli / Undavalli / Amaravati Capital)",
                    "inundated_area_km2": south_bank_inundated_area_km2,
                    "damaged_buildings": south_bank_damaged_bld,
                    "total_buildings": south_bank_total_bld,
                    "loss_usd": round(south_bank_loss, 2),
                    "severed_roads_km": round(south_road_cut_km, 2)
                }
            },
            "road_network": {
                "impassable_roads_km": round(impassable_roads_km, 2),
                "emergency_only_roads_km": round(emergency_only_roads_km, 2),
                "passable_roads_km": round(passable_roads_km, 2),
                "total_network_km": round(impassable_roads_km + emergency_only_roads_km + passable_roads_km, 2)
            },
            "population_metrics": {
                "exposed_population": exposed_population,
                "displaced_population": displaced_population
            },
            "satellite_validation": satellite_comparison
        }
