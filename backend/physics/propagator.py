"""
Orbital propagator using Runga Kutta integration with J2 perturbation.
Implements the equations of motion from the NSH problem statement.
"""

import math
import numpy as np
from .constants import MU, RE, J2, DEFAULT_PROPAGATION_STEP


def j2_acceleration(r: np.ndarray) -> np.ndarray:
    """
    Compute J2 perturbation acceleration vector.
    
    The J2 acceleration accounts for Earth's equatorial bulge causing
    nodal regression and apsidal precession.
    
    Args:
        r: Position vector [x, y, z] in km (ECI frame)
    
    Returns:
        J2 acceleration vector [ax, ay, az] in km/s^2
    """
    x, y, z = r
    r_mag = np.linalg.norm(r)
    r_mag_sq = r_mag * r_mag
    r_mag_5 = r_mag ** 5
    
    z_ratio_sq = (z * z) / r_mag_sq
    
    coeff = 1.5 * J2 * MU * RE * RE / r_mag_5
    
    ax = coeff * x * (5.0 * z_ratio_sq - 1.0)
    ay = coeff * y * (5.0 * z_ratio_sq - 1.0)
    az = coeff * z * (5.0 * z_ratio_sq - 3.0)
    
    return np.array([ax, ay, az])


def equations_of_motion(state: np.ndarray) -> np.ndarray:
    """
    Compute derivatives of the state vector [r, v] → [v, a].
    
    Includes two-body gravity + J2 perturbation.
    
    Args:
        state: 6D state vector [x, y, z, vx, vy, vz]
    
    Returns:
        derivatives: [vx, vy, vz, ax, ay, az]
    """
    r = state[:3]
    v = state[3:]
    
    r_mag = np.linalg.norm(r)
    
    # Two-body gravitational acceleration
    a_gravity = -(MU / (r_mag ** 3)) * r
    
    # J2 perturbation
    a_j2 = j2_acceleration(r)
    
    # Total acceleration
    a_total = a_gravity + a_j2
    
    return np.concatenate([v, a_total])


def rk4_step(state: np.ndarray, dt: float) -> np.ndarray:
    """
    Single RK4 integration step.
    
    Args:
        state: 6D state vector [x, y, z, vx, vy, vz]
        dt: Time step in seconds
    
    Returns:
        New state vector after dt seconds
    """
    k1 = equations_of_motion(state)
    k2 = equations_of_motion(state + 0.5 * dt * k1)
    k3 = equations_of_motion(state + 0.5 * dt * k2)
    k4 = equations_of_motion(state + dt * k3)
    
    return state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def propagate(state: np.ndarray, total_time: float, 
              dt: float = DEFAULT_PROPAGATION_STEP) -> np.ndarray:
    """
    Propagate a state vector forward in time using RK4 with J2.
    
    Args:
        state: Initial 6D state vector [x, y, z, vx, vy, vz]
               Position in km, velocity in km/s
        total_time: Total propagation time in seconds
        dt: Integration step size in seconds
    
    Returns:
        Final state vector after total_time seconds
    """
    current = state.copy()
    time_elapsed = 0.0
    
    if total_time >= 0:
        while time_elapsed < total_time:
            step = min(dt, total_time - time_elapsed)
            current = rk4_step(current, step)
            time_elapsed += step
    else:
        # Backward propagation: step with negative dt
        while time_elapsed > total_time:
            step = max(-dt, total_time - time_elapsed)
            current = rk4_step(current, step)
            time_elapsed += step
    
    return current


def propagate_with_history(state: np.ndarray, total_time: float,
                           dt: float = DEFAULT_PROPAGATION_STEP,
                           record_interval: float = 60.0) -> list:
    """
    Propagate state and record trajectory history at regular intervals.
    
    Args:
        state: Initial 6D state vector
        total_time: Total propagation time in seconds
        dt: Integration step size in seconds
        record_interval: Time between recorded points in seconds
    
    Returns:
        List of (time_offset, state_vector) tuples
    """
    history = [(0.0, state.copy())]
    current = state.copy()
    time_elapsed = 0.0
    last_record = 0.0
    
    while time_elapsed < total_time:
        step = min(dt, total_time - time_elapsed)
        current = rk4_step(current, step)
        time_elapsed += step
        
        if time_elapsed - last_record >= record_interval:
            history.append((time_elapsed, current.copy()))
            last_record = time_elapsed
    
    # Always include the final state
    if time_elapsed - last_record > 1e-6:
        history.append((time_elapsed, current.copy()))
    
    return history


def batch_propagate(states: np.ndarray, total_time: float, 
                    dt: float = DEFAULT_PROPAGATION_STEP) -> np.ndarray:
    """
    Propagate multiple state vectors simultaneously using vectorized operations.
    
    Args:
        states: Array of shape (N, 6) with N state vectors
        total_time: Total propagation time in seconds
        dt: Integration step size in seconds
    
    Returns:
        Array of shape (N, 6) with propagated states
    """
    N = states.shape[0]
    current = states.copy()
    time_elapsed = 0.0
    
    while time_elapsed < total_time:
        step = min(dt, total_time - time_elapsed)
        
        # Vectorized RK4
        k1 = _batch_eom(current)
        k2 = _batch_eom(current + 0.5 * step * k1)
        k3 = _batch_eom(current + 0.5 * step * k2)
        k4 = _batch_eom(current + step * k3)
        
        current = current + (step / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        time_elapsed += step
    
    return current


def _batch_eom(states: np.ndarray) -> np.ndarray:
    """Vectorized equations of motion for batch propagation."""
    N = states.shape[0]
    derivs = np.zeros_like(states)
    
    r = states[:, :3]  # (N, 3)
    v = states[:, 3:]  # (N, 3)
    
    r_mag = np.linalg.norm(r, axis=1, keepdims=True)  # (N, 1)
    
    # Two-body gravity
    a_grav = -(MU / (r_mag ** 3)) * r  # (N, 3)
    
    # J2 perturbation (vectorized)
    x = r[:, 0:1]
    y = r[:, 1:2]
    z = r[:, 2:3]
    r_mag_sq = r_mag ** 2
    r_mag_5 = r_mag ** 5
    z_ratio_sq = (z ** 2) / r_mag_sq
    
    coeff = 1.5 * J2 * MU * RE * RE / r_mag_5
    
    a_j2_x = coeff * x * (5.0 * z_ratio_sq - 1.0)
    a_j2_y = coeff * y * (5.0 * z_ratio_sq - 1.0)
    a_j2_z = coeff * z * (5.0 * z_ratio_sq - 3.0)
    a_j2 = np.hstack([a_j2_x, a_j2_y, a_j2_z])
    
    derivs[:, :3] = v
    derivs[:, 3:] = a_grav + a_j2
    
    return derivs
