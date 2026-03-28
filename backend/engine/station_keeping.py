"""
Station-keeping logic: nominal slot tracking, drift detection, and uptime scoring.
"""

import math
import numpy as np
from ..physics.constants import DRIFT_TOLERANCE, MU, DEFAULT_PROPAGATION_STEP
from ..physics.propagator import batch_propagate


class StationKeeper:
    """Manages nominal orbital slots and uptime tracking for the constellation."""
    
    def __init__(self):
        self.nominal_states = {}   
        self.uptime_log = {}       
        self.service_outages = []  
    def set_nominal_slot(self, sat_id: str, state: np.ndarray):
        """Set the nominal (ideal) orbital slot for a satellite."""
        self.nominal_states[sat_id] = state.copy()
        if sat_id not in self.uptime_log:
            self.uptime_log[sat_id] = {"in_slot_seconds": 0.0, "out_seconds": 0.0}
    
    def propagate_nominal_slots(self, dt: float, integration_dt: float = DEFAULT_PROPAGATION_STEP):
        """
        Propagate all nominal slots forward in time.
        The nominal slot follows the ideal unperturbed (but J2-perturbed) orbit.
        """
        if not self.nominal_states:
            return

        sat_ids = list(self.nominal_states.keys())
        state_array = np.array([self.nominal_states[sat_id] for sat_id in sat_ids])
        propagated = batch_propagate(state_array, dt, dt=integration_dt)

        for idx, sat_id in enumerate(sat_ids):
            self.nominal_states[sat_id] = propagated[idx]
    
    def check_drift(self, sat_id: str, actual_state: np.ndarray) -> dict:
        if sat_id not in self.nominal_states:
            return {"drift_km": 0.0, "in_slot": True, "direction": [0, 0, 0]}
        
        nominal_r = self.nominal_states[sat_id][:3]
        actual_r = actual_state[:3]
        
        drift_vector = actual_r - nominal_r
        drift_km = np.linalg.norm(drift_vector)
        
        in_slot = drift_km <= DRIFT_TOLERANCE
        
        direction = drift_vector / max(drift_km, 1e-10)
        
        return {
            "drift_km": float(drift_km),
            "in_slot": in_slot,
            "direction": direction.tolist()
        }
    
    def update_uptime(self, sat_id: str, actual_state: np.ndarray, dt: float):

        drift_info = self.check_drift(sat_id, actual_state)
        
        if sat_id not in self.uptime_log:
            self.uptime_log[sat_id] = {"in_slot_seconds": 0.0, "out_seconds": 0.0}
        
        if drift_info["in_slot"]:
            self.uptime_log[sat_id]["in_slot_seconds"] += dt
        else:
            self.uptime_log[sat_id]["out_seconds"] += dt
            self.service_outages.append({
                "satellite_id": sat_id,
                "drift_km": drift_info["drift_km"],
                "duration_s": dt
            })
    
    def get_uptime_score(self, sat_id: str) -> float:
        """
        Compute uptime score for a satellite (0.0 to 1.0).
        
        Score = in_slot_time / total_time, with exponential penalty for out-of-slot time.
        """
        if sat_id not in self.uptime_log:
            return 1.0
        
        log = self.uptime_log[sat_id]
        total = log["in_slot_seconds"] + log["out_seconds"]
        
        if total == 0:
            return 1.0
        
        base_score = log["in_slot_seconds"] / total
        penalty = math.exp(-0.001 * log["out_seconds"])
        
        return base_score * penalty
    
    def get_fleet_uptime(self) -> float:
        """Compute average uptime score across the constellation."""
        if not self.uptime_log:
            return 1.0
        
        scores = [self.get_uptime_score(sid) for sid in self.uptime_log]
        return sum(scores) / len(scores)
    
    def needs_recovery(self, sat_id: str, actual_state: np.ndarray) -> bool:
        """Check if a satellite needs a recovery burn to return to its slot."""
        drift_info = self.check_drift(sat_id, actual_state)
        return not drift_info["in_slot"]
    
    def get_nominal_state(self, sat_id: str) -> np.ndarray:
        """Get the nominal state for a satellite."""
        return self.nominal_states.get(sat_id)
