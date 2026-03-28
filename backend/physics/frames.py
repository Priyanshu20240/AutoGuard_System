"""
Coordinate frame transformations: ECI ↔ RTN, ECI → Geodetic (lat/lon/alt).
"""

import math
import numpy as np
from .constants import RE, EARTH_ROTATION_RATE


def eci_to_rtn_matrix(r: np.ndarray, v: np.ndarray) -> np.ndarray:

    r_hat = r / np.linalg.norm(r)                    # Radial unit vector
    h = np.cross(r, v)                                # Angular momentum
    n_hat = h / np.linalg.norm(h)                     # Normal unit vector
    t_hat = np.cross(n_hat, r_hat)                    # Transverse unit vector
    
    # Rotation matrix: rows are the RTN basis vectors in ECI coords
    return np.array([r_hat, t_hat, n_hat])


def rtn_to_eci(dv_rtn: np.ndarray, r: np.ndarray, v: np.ndarray) -> np.ndarray:
    M = eci_to_rtn_matrix(r, v)
    # M transforms ECI→RTN, so M^T transforms RTN→ECI
    return M.T @ dv_rtn


def eci_to_rtn(dv_eci: np.ndarray, r: np.ndarray, v: np.ndarray) -> np.ndarray:

    M = eci_to_rtn_matrix(r, v)
    return M @ dv_eci


def eci_to_geodetic(r_eci: np.ndarray, gmst: float) -> tuple:

    x, y, z = r_eci
    
    # Rotate from ECI to ECEF using GMST
    x_ecef = x * math.cos(gmst) + y * math.sin(gmst)
    y_ecef = -x * math.sin(gmst) + y * math.cos(gmst)
    z_ecef = z
    
    # Longitude
    lon = math.atan2(y_ecef, x_ecef)
    
    # Iterative latitude calculation (Bowring's method simplified)
    f = 1.0 / 298.257223563  # WGS84 flattening
    e2 = 2 * f - f * f  # Eccentricity squared
    
    p = math.sqrt(x_ecef**2 + y_ecef**2)
    lat = math.atan2(z_ecef, p * (1.0 - e2))  # Initial guess
    
    for _ in range(5):  # Converges in 2-3 iterations
        sin_lat = math.sin(lat)
        N = RE / math.sqrt(1.0 - e2 * sin_lat**2)
        lat = math.atan2(z_ecef + e2 * N * sin_lat, p)
    
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    N = RE / math.sqrt(1.0 - e2 * sin_lat**2)
    
    if abs(cos_lat) > 1e-10:
        alt = p / cos_lat - N
    else:
        alt = abs(z_ecef) - N * (1.0 - e2)
    
    return (math.degrees(lat), math.degrees(lon), alt)


def geodetic_to_eci(lat_deg: float, lon_deg: float, alt_km: float, 
                     gmst: float) -> np.ndarray:

    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    
    f = 1.0 / 298.257223563
    e2 = 2 * f - f * f
    
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    N = RE / math.sqrt(1.0 - e2 * sin_lat**2)
    
    # ECEF coordinates
    x_ecef = (N + alt_km) * cos_lat * math.cos(lon)
    y_ecef = (N + alt_km) * cos_lat * math.sin(lon)
    z_ecef = (N * (1.0 - e2) + alt_km) * sin_lat
    
    # Rotate from ECEF to ECI
    x_eci = x_ecef * math.cos(gmst) - y_ecef * math.sin(gmst)
    y_eci = x_ecef * math.sin(gmst) + y_ecef * math.cos(gmst)
    z_eci = z_ecef
    
    return np.array([x_eci, y_eci, z_eci])


def compute_gmst(timestamp) -> float:

    from datetime import datetime, timezone
    
    # Julian Date from Unix timestamp
    if hasattr(timestamp, 'timestamp'):
        unix_ts = timestamp.timestamp()
    else:
        unix_ts = timestamp
    
    # J2000.0 epoch: 2000-01-01T12:00:00 UTC
    j2000_unix = 946728000.0  # Unix timestamp of J2000
    
    # Julian centuries since J2000
    T = (unix_ts - j2000_unix) / (86400.0 * 36525.0)
    
    # GMST in seconds (IAU 1982 model)
    gmst_sec = (67310.54841 + 
                (876600.0 * 3600.0 + 8640184.812866) * T + 
                0.093104 * T**2 - 
                6.2e-6 * T**3)
    
    # Convert to radians
    gmst_rad = (gmst_sec % 86400.0) / 86400.0 * 2.0 * math.pi
    
    return gmst_rad


def batch_eci_to_geodetic(positions: np.ndarray, gmst: float) -> np.ndarray:

    results = np.zeros((positions.shape[0], 3))
    for i in range(positions.shape[0]):
        lat, lon, alt = eci_to_geodetic(positions[i], gmst)
        results[i] = [lat, lon, alt]
    return results
