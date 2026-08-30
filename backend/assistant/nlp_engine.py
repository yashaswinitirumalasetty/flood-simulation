import re
from typing import Dict, Any, Tuple

class NaturalLanguageAssistant:
    """
    Natural Language Conversational Co-Pilot for location-based flood scenarios,
    Krishna River & Vijayawada hydrology, what-if inquiries, and automated hazard summarization.
    """
    def __init__(self):
        pass

    def parse_and_respond(self, user_prompt: str, current_params: Dict[str, Any], simulation_results: Dict[str, Any] = None, impact_data: Dict[str, Any] = None) -> Dict[str, Any]:
        prompt_lower = user_prompt.lower()
        actions = []
        new_params = dict(current_params)
        response_text = ""

        # 1. Location or River Switching
        if "krishna" in prompt_lower or "vijayawada" in prompt_lower:
            new_params["river"] = "Krishna River"
            new_params["location"] = "Vijayawada"
            actions.append("Selected Krishna River → Vijayawada (Detailed DEM & GIS)")
        elif "amaravati" in prompt_lower:
            new_params["river"] = "Krishna River"
            new_params["location"] = "Amaravati"
            actions.append("Selected Krishna River → Amaravati")
        elif "godavari" in prompt_lower or "rajahmundry" in prompt_lower:
            new_params["river"] = "Godavari River"
            new_params["location"] = "Rajahmundry"
            actions.append("Selected Godavari River → Rajahmundry (Schematic)")
        elif "ganga" in prompt_lower or "patna" in prompt_lower:
            new_params["river"] = "Ganga River"
            new_params["location"] = "Patna"
            actions.append("Selected Ganga River → Patna (Schematic)")

        # 2. Rainfall adjustments (20 to 300 mm/hr)
        rain_match = re.search(r'(?:increase|decrease|change|set)\s+rainfall\s+(?:to|by)?\s*([+-]?\d+)\s*(%|mm|mm/hr)?', prompt_lower)
        if rain_match:
            val = float(rain_match.group(1))
            unit = rain_match.group(2)
            cur_rain = current_params.get("rainfall_intensity_mmhr", 50.0)
            if "%" in prompt_lower or unit == "%":
                if "decrease" in prompt_lower or "-" in prompt_lower:
                    new_params["rainfall_intensity_mmhr"] = max(20.0, round(cur_rain * (1 - abs(val)/100.0), 1))
                else:
                    new_params["rainfall_intensity_mmhr"] = min(300.0, round(cur_rain * (1 + abs(val)/100.0), 1))
            else:
                new_params["rainfall_intensity_mmhr"] = min(300.0, max(20.0, val))
            actions.append(f"Updated rainfall intensity to {new_params['rainfall_intensity_mmhr']} mm/hr")

        # 3. River Discharge Adjustments (Cusecs / Lakh Cusecs)
        disch_match = re.search(r'(?:discharge|inflow|flow|cusecs)\s+(?:to|of)?\s*([+-]?\d+(?:\.\d+)?)\s*(lakh|k|thousand|cusecs|m3/s)?', prompt_lower)
        if disch_match:
            val = float(disch_match.group(1))
            unit = disch_match.group(2) or ""
            if "lakh" in prompt_lower or "lakh" in unit:
                cusecs = val * 100000.0
            elif "k" in unit or "thousand" in unit:
                cusecs = val * 1000.0
            else:
                cusecs = val if val > 1000 else val * 100000.0
            
            cusecs = min(1200000.0, max(25000.0, cusecs))
            new_params["river_discharge_cusecs"] = cusecs
            actions.append(f"Updated Prakasam Barrage discharge to {int(cusecs):,} Cusecs ({cusecs/100000:.1f} Lakh Cusecs)")

        # 4. Preset Storm Scenarios for Vijayawada
        if "moderate" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 50.0
            new_params["river_discharge_cusecs"] = 150000.0
            new_params["duration_hours"] = 4.0
            actions.append("Configured Moderate Monsoon Flood (50 mm/hr, 1.5 Lakh Cusecs)")
        elif "heavy" in prompt_lower or "100-year" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 150.0
            new_params["river_discharge_cusecs"] = 500000.0
            new_params["duration_hours"] = 6.0
            actions.append("Configured Severe Flood Scenario (150 mm/hr, 5.0 Lakh Cusecs)")
        elif "extreme" in prompt_lower or "2024" in prompt_lower or "historic" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 250.0
            new_params["river_discharge_cusecs"] = 850000.0
            new_params["duration_hours"] = 12.0
            actions.append("Configured Historic Sept 2024 Disaster Benchmark (250 mm/hr, 8.5 Lakh Cusecs)")

        # 5. Queries about Krishna River Hospitals & Infrastructure
        if "hospital" in prompt_lower or "health" in prompt_lower or "ggh" in prompt_lower:
            if impact_data and "critical_facilities_status" in impact_data:
                ggh = next((f for f in impact_data["critical_facilities_status"] if "GGH" in f["name"] or f["type"] == "Hospital"), None)
                if ggh:
                    if ggh["is_flooded"]:
                        response_text = f"🚨 **Hospital Inundation Alert**: {ggh['name']} is projected to experience water depth of **{ggh['depth_m']}m**. Access routes via MG Road and Eluru Road become restricted around T+{ggh['cutoff_time_hr']} hours. Status: **{ggh['status']}**."
                    else:
                        response_text = f"✅ **Operational**: {ggh['name']} remains safe above flood stage (perimeter depth: {ggh['depth_m']}m). Primary emergency access corridors remain open."
            else:
                response_text = "Government General Hospital (GGH) Vijayawada is situated on the North Bank. Under extreme river discharge (>6.0 Lakh Cusecs), drainage backflow from the Krishna River causes surrounding access streets to submerge."

        # 6. Queries about River Banks (North vs South Bank)
        elif "bank" in prompt_lower or "side" in prompt_lower or "tadepalli" in prompt_lower or "krishna lanka" in prompt_lower:
            if impact_data and "bank_impacts" in impact_data:
                nb = impact_data["bank_impacts"]["north_bank"]
                sb = impact_data["bank_impacts"]["south_bank"]
                response_text = f"🌊 **River Bank Inundation Breakdown**:\n• **North Bank (Vijayawada Urban / Krishna Lanka)**: {nb['inundated_area_km2']} km² flooded, {nb['damaged_buildings']} buildings affected (${round(nb['loss_usd']/1e6, 2)}M loss).\n• **South Bank (Tadepalli / Undavalli)**: {sb['inundated_area_km2']} km² flooded, {sb['damaged_buildings']} buildings affected (${round(sb['loss_usd']/1e6, 2)}M loss)."
            else:
                response_text = "During Krishna River floods, the North Bank (Krishna Lanka & Bhavanipuram) experiences pluvial backwater logging, while the South Bank (Tadepalli & Undavalli lowlands) experiences direct riverine overbank flooding."

        # 7. Queries about Satellite Observation (ISRO / Sentinel-1)
        elif "satellite" in prompt_lower or "observed" in prompt_lower or "isro" in prompt_lower or "sentinel" in prompt_lower:
            if impact_data and impact_data.get("satellite_validation"):
                sat = impact_data["satellite_validation"]
                response_text = f"🛰️ **Satellite Validation (ISRO / Sentinel-1 SAR)**:\n• **Event**: {sat['dataset_source']}\n• **Critical Success Index (IoU)**: **{sat['iou_critical_success_index']}**\n• **Precision**: {sat['precision']} | **Recall**: {sat['recall']}\n• **Observed Flooded Area**: {sat['observed_flooded_area_km2']} km² vs **Simulated**: {sat['simulated_flooded_area_km2']} km²."
            else:
                response_text = "The satellite comparison engine validates simulated flood extents against ISRO / NRSC & Sentinel-1 SAR observed inundation from the September 2024 Krishna River flood event."

        # Default synthesis
        if not response_text:
            if actions:
                response_text = f"✅ **Parameters Applied**: {', '.join(actions)}. Click 'Run Simulation' to visualize the updated flood wave across Vijayawada."
            else:
                response_text = f"I am your HydroForge AI Co-Pilot for the **Krishna River (Vijayawada)** basin. You can ask me to:\n• *'Set 150 mm/hr rainfall with 5 Lakh Cusecs discharge'*\n• *'Which hospitals lose road access?'*\n• *'Compare North Bank vs South Bank impacts'*\n• *'Show satellite observed flood validation (ISRO/Sentinel-1)'*."

        return {
            "response_text": response_text,
            "applied_actions": actions,
            "updated_params": new_params,
            "should_rerun_simulation": len(actions) > 0
        }
