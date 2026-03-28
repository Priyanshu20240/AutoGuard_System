"""
Pydantic data models for the ACM simulation.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime


class ObjectType(str, Enum):
    SATELLITE = "SATELLITE"
    DEBRIS = "DEBRIS"


class SatelliteStatus(str, Enum):
    NOMINAL = "NOMINAL"
    MANEUVERING = "MANEUVERING"
    DRIFTING = "DRIFTING"
    EOL = "EOL"
    DEORBITED = "DEORBITED"


class Vec3(BaseModel):
    x: float
    y: float
    z: float


class TelemetryObject(BaseModel):
    id: str
    type: ObjectType
    r: Vec3
    v: Vec3


class TelemetryRequest(BaseModel):
    timestamp: str
    objects: List[TelemetryObject]


class TelemetryResponse(BaseModel):
    status: str = "ACK"
    processed_count: int
    active_cdm_warnings: int


class DeltaVVector(BaseModel):
    x: float
    y: float
    z: float


class BurnCommand(BaseModel):
    burn_id: str
    burnTime: str
    deltaV_vector: DeltaVVector


class ManeuverRequest(BaseModel):
    satelliteId: str
    maneuver_sequence: List[BurnCommand]


class ManeuverValidation(BaseModel):
    ground_station_los: bool
    sufficient_fuel: bool
    projected_mass_remaining_kg: float


class ManeuverResponse(BaseModel):
    status: str = "SCHEDULED"
    validation: ManeuverValidation


class SimulateStepRequest(BaseModel):
    step_seconds: int


class SimulateStepResponse(BaseModel):
    status: str = "STEP_COMPLETE"
    new_timestamp: str
    collisions_detected: int
    maneuvers_executed: int


class SatelliteSnapshot(BaseModel):
    id: str
    lat: float
    lon: float
    alt: float = 0.0
    fuel_kg: float
    status: str
    nominal_lat: Optional[float] = None
    nominal_lon: Optional[float] = None
    drift_km: float = 0.0
    last_burn_id: Optional[str] = None


class CDMWarning(BaseModel):
    satellite_id: str
    debris_id: str
    tca: str
    miss_distance_km: float
    risk_level: str  # GREEN, YELLOW, RED, CRITICAL


class VisualizationSnapshot(BaseModel):
    timestamp: str
    satellites: List[SatelliteSnapshot]
    debris_cloud: List[list]  # [id, lat, lon, alt]
    cdm_warnings: List[CDMWarning] = []
    maneuver_log: List[dict] = []
    stats: dict = {}
