"""
Communication line-of-sight calculations and ground station management.
"""

import math
import csv
import os
import numpy as np
from ..physics.constants import RE, SIGNAL_DELAY, EARTH_ROTATION_RATE
from ..physics.frames import geodetic_to_eci, eci_to_geodetic, compute_gmst


class GroundStation:
    """Represents a ground station with position and elevation mask."""
    
    def __init__(self, station_id: str, name: str, lat: float, lon: float,
                 elevation_m: float, min_elevation_deg: float):
        self.station_id = station_id
        self.name = name
        self.lat = lat
        self.lon = lon
        self.elevation_m = elevation_m
        self.elevation_km = elevation_m / 1000.0
        self.min_elevation_deg = min_elevation_deg
        self.min_elevation_rad = math.radians(min_elevation_deg)


def load_ground_stations() -> list:
    """Load ground stations from CSV file."""
    stations = []
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'ground_stations.csv')
    csv_path = os.path.normpath(csv_path)
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            station = GroundStation(
                station_id=row['Station_ID'],
                name=row['Station_Name'],
                lat=float(row['Latitude']),
                lon=float(row['Longitude']),
                elevation_m=float(row['Elevation_m']),
                min_elevation_deg=float(row['Min_Elevation_Angle_deg'])
            )
            stations.append(station)
    
    return stations


def compute_elevation_angle(sat_pos_eci: np.ndarray, station: GroundStation, 
                             gmst: float) -> float:

    # Ground station ECI position
    gs_eci = geodetic_to_eci(station.lat, station.lon, station.elevation_km, gmst)
    
    rho = sat_pos_eci - gs_eci
    rho_mag = np.linalg.norm(rho)
    
    if rho_mag < 1e-10:
        return math.pi / 2.0  

    gs_mag = np.linalg.norm(gs_eci)
    local_up = gs_eci / gs_mag

    sin_elev = np.dot(rho, local_up) / rho_mag
    
    return math.asin(max(-1.0, min(1.0, sin_elev)))


def has_line_of_sight(sat_pos_eci: np.ndarray, station: GroundStation, 
                       gmst: float) -> bool:

    elev = compute_elevation_angle(sat_pos_eci, station, gmst)
    return elev >= station.min_elevation_rad


def check_any_los(sat_pos_eci: np.ndarray, stations: list, gmst: float) -> tuple:

    visible = []
    for station in stations:
        if has_line_of_sight(sat_pos_eci, station, gmst):
            visible.append(station.station_id)
    
    return (len(visible) > 0, visible)


def find_next_los_window(sat_state: np.ndarray, stations: list, 
                          gmst: float, timestamp_unix: float,
                          max_search_seconds: float = 7200.0,
                          step_seconds: float = 30.0) -> dict:
    from ..physics.propagator import propagate
    
    current_state = sat_state.copy()
    in_window = False
    window_start = None
    
    for t in range(0, int(max_search_seconds), int(step_seconds)):
        if t > 0:
            current_state = propagate(sat_state, float(t))
        
        current_gmst = gmst + EARTH_ROTATION_RATE * t
        has_los, visible = check_any_los(current_state[:3], stations, current_gmst)
        
        if has_los and not in_window:
            window_start = t
            in_window = True
        elif not has_los and in_window:
            return {
                "start_offset_s": window_start,
                "end_offset_s": t,
                "duration_s": t - window_start
            }
    
    if in_window:
        return {
            "start_offset_s": window_start,
            "end_offset_s": int(max_search_seconds),
            "duration_s": int(max_search_seconds) - window_start
        }
    
    return None
