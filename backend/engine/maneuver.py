"""
Maneuver planning: evasion burns, recovery burns, and autonomous COLA.
"""

import math
import numpy as np
from ..physics.constants import (
    COLLISION_THRESHOLD, DRIFT_TOLERANCE, THRUSTER_COOLDOWN,
    MAX_DV_PER_BURN, SIGNAL_DELAY, MU
)
from ..physics.frames import eci_to_rtn_matrix, rtn_to_eci
from ..physics.fuel import validate_burn, apply_burn, is_eol


class ManeuverPlanner:

    
    def __init__(self):
        self.scheduled_burns = {}  # sat_id -> list of burn dicts
        self.last_burn_time = {}   # sat_id -> unix timestamp of last completed burn
        self.burn_history = []      # Completed burn log
    
    def plan_evasion(self, sat_id: str, sat_state: np.ndarray, 
                      deb_state: np.ndarray, tca_seconds: float,
                      current_fuel: float, current_time: float) -> dict:

        if is_eol(current_fuel):
            return None
        
        r = sat_state[:3]
        v = sat_state[3:]
        
        dr = sat_state[:3] - deb_state[:3]
        dv = sat_state[3:] - deb_state[3:]
        miss_distance = np.linalg.norm(dr)
        
        rtn_matrix = eci_to_rtn_matrix(r, v)
        
        desired_separation = max(0.15, COLLISION_THRESHOLD * 1.5)  
        
        r_mag = np.linalg.norm(r)
        orbital_period = 2.0 * math.pi * math.sqrt(r_mag**3 / MU)
        
        along_track_needed = desired_separation
        
        if tca_seconds > 0:
            dv_transverse = (along_track_needed * 2.0 * math.pi) / (orbital_period * max(tca_seconds / orbital_period, 0.5))
        else:
            dv_transverse = 0.005  
        
        dv_transverse = min(dv_transverse, MAX_DV_PER_BURN / 1000.0)  # Convert m/s to km/s
        h = np.cross(r, v)
        h_hat = h / np.linalg.norm(h)
        approach_side = np.dot(np.cross(dr, h_hat), v / np.linalg.norm(v))
        
        if approach_side >= 0:
            dv_sign = -1.0  
        else:
            dv_sign = 1.0  
        
        dv_rtn = np.array([0.0, dv_sign * dv_transverse, 0.0])
        
        dv_eci = rtn_to_eci(dv_rtn, r, v)
        
        dv_mag_ms = np.linalg.norm(dv_eci) * 1000.0  # km/s to m/s
        validation = validate_burn(dv_mag_ms, current_fuel)
        
        if not validation["feasible"]:
            dv_eci *= 0.5
            dv_mag_ms *= 0.5
            validation = validate_burn(dv_mag_ms, current_fuel)
            if not validation["feasible"]:
                return None
        

        burn_time = current_time + max(SIGNAL_DELAY, min(tca_seconds * 0.3, 300.0))
        
        if sat_id in self.last_burn_time:
            earliest = self.last_burn_time[sat_id] + THRUSTER_COOLDOWN
            burn_time = max(burn_time, earliest)
        
        burn = {
            "burn_id": f"EVASION_{sat_id}_{int(current_time)}",
            "satellite_id": sat_id,
            "burn_time": burn_time,
            "deltaV_eci": dv_eci.tolist(),
            "deltaV_rtn": dv_rtn.tolist(),
            "deltaV_magnitude_ms": dv_mag_ms,
            "fuel_consumed_kg": validation["fuel_needed_kg"],
            "fuel_remaining_kg": validation["fuel_remaining_after_kg"],
            "type": "EVASION",
            "target_debris": None,
            "status": "SCHEDULED"
        }
        
        return burn
    
    def plan_recovery(self, sat_id: str, sat_state: np.ndarray,
                       nominal_state: np.ndarray, current_fuel: float,
                       current_time: float) -> dict:

        if is_eol(current_fuel):
            return None
        
        r = sat_state[:3]
        v = sat_state[3:]
        
        drift = sat_state[:3] - nominal_state[:3]
        drift_distance = np.linalg.norm(drift)
        
        if drift_distance < DRIFT_TOLERANCE:
            return None 
        
        dv_needed_eci = nominal_state[3:] - sat_state[3:]
        
        dv_mag = np.linalg.norm(dv_needed_eci) * 1000.0 
        
        if dv_mag > MAX_DV_PER_BURN:
            dv_needed_eci = dv_needed_eci * (MAX_DV_PER_BURN / 1000.0) / np.linalg.norm(dv_needed_eci)
            dv_mag = MAX_DV_PER_BURN
        
        validation = validate_burn(dv_mag, current_fuel)
        if not validation["feasible"]:
            return None
        
        burn_time = current_time + SIGNAL_DELAY
        if sat_id in self.last_burn_time:
            earliest = self.last_burn_time[sat_id] + THRUSTER_COOLDOWN
            burn_time = max(burn_time, earliest)
        
        rtn_matrix = eci_to_rtn_matrix(r, v)
        dv_rtn = rtn_matrix @ dv_needed_eci
        
        burn = {
            "burn_id": f"RECOVERY_{sat_id}_{int(current_time)}",
            "satellite_id": sat_id,
            "burn_time": burn_time,
            "deltaV_eci": dv_needed_eci.tolist(),
            "deltaV_rtn": dv_rtn.tolist(),
            "deltaV_magnitude_ms": dv_mag,
            "fuel_consumed_kg": validation["fuel_needed_kg"],
            "fuel_remaining_kg": validation["fuel_remaining_after_kg"],
            "type": "RECOVERY",
            "status": "SCHEDULED"
        }
        
        return burn
    
    def schedule_burn(self, burn: dict):
        """Add a burn to the schedule."""
        sat_id = burn["satellite_id"]
        if sat_id not in self.scheduled_burns:
            self.scheduled_burns[sat_id] = []
        self.scheduled_burns[sat_id].append(burn)
    
    def execute_scheduled_burns(
        self,
        current_time: float,
        satellites: dict,
        sat_fuel: dict,
        sat_mass: dict = None,
        has_los_dict: dict = None,
    ) -> list:

        executed = []
        
        for sat_id, burns in list(self.scheduled_burns.items()):
            remaining = []
            for burn in burns:
                if burn["burn_time"] <= current_time and burn["status"] == "SCHEDULED":
                    
                    if sat_id in satellites:
                        if has_los_dict is not None and not has_los_dict.get(sat_id, True):
                            
                            burn["status"] = "REJECTED_NO_LOS"
                            burn["actual_fuel_consumed_kg"] = 0.0
                            burn["reason"] = f"{burn.get('reason', '')} (REJECTED: LOS BLACKOUT)"
                            self.burn_history.append(burn)
                            continue
                        
                        validation = validate_burn(
                            burn["deltaV_magnitude_ms"], sat_fuel[sat_id]
                        )
                        if not validation["feasible"]:
                            burn["status"] = "REJECTED_INSUFFICIENT_FUEL"
                            burn["actual_fuel_consumed_kg"] = 0.0
                            burn["reason"] = (
                                f"{burn.get('reason', '')} "
                                f"(REJECTED: requested {burn['deltaV_magnitude_ms']:.3f} m/s "
                                f"needs {validation['fuel_needed_kg']:.3f} kg, "
                                f"only {sat_fuel[sat_id]:.3f} kg remaining)"
                            ).strip()
                            self.burn_history.append(burn)
                            continue
                            
                        dv_eci = np.array(burn["deltaV_eci"])
                        satellites[sat_id][3:] += dv_eci
                        
                       
                        new_fuel, consumed, new_mass = apply_burn(
                            burn["deltaV_magnitude_ms"], sat_fuel[sat_id]
                        )
                        sat_fuel[sat_id] = new_fuel
                        if sat_mass is not None:
                            sat_mass[sat_id] = new_mass
                        
                        burn["status"] = "EXECUTED"
                        burn["actual_fuel_consumed_kg"] = consumed
                        burn["fuel_remaining_kg"] = new_fuel
                        self.last_burn_time[sat_id] = current_time
                        self.burn_history.append(burn)
                        executed.append(burn)
                else:
                    remaining.append(burn)
            
            self.scheduled_burns[sat_id] = remaining
        
        return executed
    
    def get_cooldown_remaining(self, sat_id: str, current_time: float) -> float:
        """Get remaining cooldown time for a satellite's thruster."""
        if sat_id not in self.last_burn_time:
            return 0.0
        elapsed = current_time - self.last_burn_time[sat_id]
        return max(0.0, THRUSTER_COOLDOWN - elapsed)
