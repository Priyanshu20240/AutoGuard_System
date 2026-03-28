"""
Fuel management using the Tsiolkovsky rocket equation.
Tracks propellant mass, computes fuel consumption, and handles EOL detection.
"""

import math
import numpy as np
from .constants import ISP, G0, DRY_MASS, INITIAL_FUEL, MAX_DV_PER_BURN, EOL_FUEL_FRACTION, VE


def compute_fuel_consumed(dv_magnitude_ms: float, current_mass_kg: float) -> float:

    exponent = -dv_magnitude_ms / VE
    delta_m = current_mass_kg * (1.0 - math.exp(exponent))
    return delta_m


def compute_max_dv(current_fuel_kg: float) -> float:

    m_wet = DRY_MASS + current_fuel_kg
    if current_fuel_kg <= 0:
        return 0.0
    return VE * math.log(m_wet / DRY_MASS)


def validate_burn(dv_magnitude_ms: float, current_fuel_kg: float) -> dict:

    current_mass = DRY_MASS + current_fuel_kg
    fuel_needed = compute_fuel_consumed(dv_magnitude_ms, current_mass)
    
    result = {
        "feasible": True,
        "fuel_needed_kg": fuel_needed,
        "fuel_remaining_after_kg": current_fuel_kg - fuel_needed,
        "mass_after_kg": current_mass - fuel_needed,
        "dv_exceeds_limit": dv_magnitude_ms > MAX_DV_PER_BURN,
        "triggers_eol": False
    }
    
    # Check max thrust limit (15 m/s per burn)
    if dv_magnitude_ms > MAX_DV_PER_BURN:
        result["feasible"] = False
        result["dv_exceeds_limit"] = True
    
    # Check fuel sufficiency
    if fuel_needed > current_fuel_kg:
        result["feasible"] = False
        result["fuel_remaining_after_kg"] = 0
    
    # Check EOL threshold
    remaining_fraction = (current_fuel_kg - fuel_needed) / INITIAL_FUEL
    if remaining_fraction <= EOL_FUEL_FRACTION:
        result["triggers_eol"] = True
    
    return result


def apply_burn(dv_magnitude_ms: float, current_fuel_kg: float) -> tuple:

    if current_fuel_kg <= 0:
        return (0.0, 0.0, DRY_MASS)

    current_mass = DRY_MASS + current_fuel_kg
    requested_fuel = compute_fuel_consumed(dv_magnitude_ms, current_mass)
    # Safety clamp: never report or remove more propellant than remains onboard.
    fuel_consumed = min(requested_fuel, current_fuel_kg)
    
    new_fuel = max(0.0, current_fuel_kg - fuel_consumed)
    new_mass = DRY_MASS + new_fuel
    
    return (new_fuel, fuel_consumed, new_mass)


def is_eol(current_fuel_kg: float) -> bool:
    """Check if satellite has reached end-of-life fuel threshold."""
    return (current_fuel_kg / INITIAL_FUEL) <= EOL_FUEL_FRACTION


def fuel_fraction(current_fuel_kg: float) -> float:
    """Get current fuel as fraction of initial fuel."""
    return current_fuel_kg / INITIAL_FUEL
