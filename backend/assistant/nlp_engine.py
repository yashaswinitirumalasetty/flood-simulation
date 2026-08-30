import re
from typing import Dict, Any, Tuple

class NaturalLanguageAssistant:
    """
    Natural Language Conversational Co-Pilot for flood scenario parameterization,
    what-if inquiries, and automated hazard summarization.
    """
    def __init__(self):
        pass

    def parse_and_respond(self, user_prompt: str, current_params: Dict[str, Any], simulation_results: Dict[str, Any] = None, impact_data: Dict[str, Any] = None) -> Dict[str, Any]:
        prompt_lower = user_prompt.lower()
        actions = []
        new_params = dict(current_params)
        response_text = ""

        # 1. Rainfall adjustments
        rain_match = re.search(r'(?:increase|decrease|change|set)\s+rainfall\s+(?:to|by)?\s*([+-]?\d+)\s*(%|mm|mm/hr)?', prompt_lower)
        if rain_match:
            val = float(rain_match.group(1))
            unit = rain_match.group(2)
            if "%" in prompt_lower or unit == "%":
                if "decrease" in prompt_lower or "-" in prompt_lower:
                    new_params["rainfall_intensity_mmhr"] = max(5.0, round(current_params["rainfall_intensity_mmhr"] * (1 - abs(val)/100.0), 1))
                else:
                    new_params["rainfall_intensity_mmhr"] = min(150.0, round(current_params["rainfall_intensity_mmhr"] * (1 + abs(val)/100.0), 1))
            else:
                new_params["rainfall_intensity_mmhr"] = min(150.0, max(5.0, val))
            actions.append(f"Updated rainfall intensity to {new_params['rainfall_intensity_mmhr']} mm/hr")

        # 2. Return Period Presets
        if "10-year" in prompt_lower or "10 yr" in prompt_lower or "10 year" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 28.0
            new_params["river_discharge_m3s"] = 45.0
            new_params["return_period_years"] = 10
            actions.append("Configured 10-Year Return Period Storm (28 mm/hr, 45 m3/s inflow)")
        elif "50-year" in prompt_lower or "50 yr" in prompt_lower or "50 year" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 52.0
            new_params["river_discharge_m3s"] = 95.0
            new_params["return_period_years"] = 50
            actions.append("Configured 50-Year Return Period Storm (52 mm/hr, 95 m3/s inflow)")
        elif "100-year" in prompt_lower or "100 yr" in prompt_lower or "100 year" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 75.0
            new_params["river_discharge_m3s"] = 140.0
            new_params["return_period_years"] = 100
            actions.append("Configured 100-Year Design Flood (75 mm/hr, 140 m3/s inflow)")
        elif "500-year" in prompt_lower or "500 yr" in prompt_lower or "500 year" in prompt_lower:
            new_params["rainfall_intensity_mmhr"] = 110.0
            new_params["river_discharge_m3s"] = 220.0
            new_params["return_period_years"] = 500
            actions.append("Configured Extreme 500-Year Catastrophe Scenario (110 mm/hr, 220 m3/s inflow)")

        # 3. Inquiries about Hospitals & Infrastructure
        if "hospital" in prompt_lower or "health" in prompt_lower:
            if impact_data and "critical_facilities_status" in impact_data:
                hosp = next((f for f in impact_data["critical_facilities_status"] if f["type"] == "Hospital"), None)
                if hosp:
                    if hosp["is_flooded"]:
                        response_text = f"🚨 **Critical Alert**: {hosp['name']} is projected to experience inundation of {hosp['depth_m']}m. Access roads are cutoff starting around T+{hosp['cutoff_time_hr']} hours. Status: {hosp['status']}."
                    else:
                        response_text = f"✅ **Operational**: {hosp['name']} remains safe above flood stage (perimeter depth: {hosp['depth_m']}m). Primary emergency access route is passable."
            else:
                response_text = "St. Jude Metropolitan Hospital is located in the central valley zone. Under severe rainfall (>60 mm/hr), the Hospital Emergency Access Way experiences critical inundation by T+02:00."

        # 4. Inquiries about Roads & Evacuation
        elif "road" in prompt_lower or "evacuation" in prompt_lower or "route" in prompt_lower:
            if impact_data and "road_network" in impact_data:
                rn = impact_data["road_network"]
                response_text = f"🛣️ **Road Passability Status**: {rn['impassable_roads_km']} km of roads are currently impassable / severed. {rn['emergency_only_roads_km']} km require high-clearance 4WD vehicles. {rn['passable_roads_km']} km of arterial corridors remain fully open."
            else:
                response_text = "The Interstate Route 90 Express corridor and Riverside Grand Boulevard serve as the primary evacuation arteries. When river inflow exceeds 100 m3/s, the low-lying underpasses flood first."

        # 5. Inquiries about Total Damage or Loss
        elif "damage" in prompt_lower or "loss" in prompt_lower or "economic" in prompt_lower or "cost" in prompt_lower:
            if impact_data:
                loss_m = round(impact_data["total_economic_loss_usd"] / 1e6, 2)
                bld_count = impact_data["total_damaged_buildings"]
                disp_pop = impact_data["population_metrics"]["displaced_population"]
                response_text = f"📊 **Economic Damage Summary**: Estimated total direct structural loss is **${loss_m}M USD** across **{bld_count} damaged structures**. An estimated **{disp_pop} residents** will require emergency shelter."
            else:
                response_text = "Total economic loss is calculated in real time based on USACE HAZUS depth-damage functions intersecting building typologies with maximum peak water depths."

        # Default synthesis
        if not response_text:
            if actions:
                response_text = f"✅ **Parameters Updated**: {', '.join(actions)}. You can run the Fast AI or 2D Physics simulation now to view updated flood propagation."
            else:
                response_text = f"I am your HydroForge AI Co-Pilot. I can configure storm scenarios (e.g. *'Set 100-year storm'*, *'Increase rainfall by 25%'*), query hospital access cutoffs, analyze road passability, or compute structural damage estimates."

        return {
            "response_text": response_text,
            "applied_actions": actions,
            "updated_params": new_params,
            "should_rerun_simulation": len(actions) > 0
        }
