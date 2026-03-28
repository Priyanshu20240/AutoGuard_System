"""
FastAPI application for the Autonomous Constellation Manager.
Exposes all required API endpoints on port 8000.
"""

import os
import sys
import json
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager

# Fix imports for running as module
sys.path.insert(0, str(Path(__file__).parent.parent))

# Force UTF-8 encoding to prevent Windows console crashing on emojis
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def sanitize(obj):
    """Recursively convert numpy types to Python natives for JSON."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

from backend.engine.simulation import SimulationEngine
from backend.models.schemas import (
    TelemetryRequest, TelemetryResponse,
    ManeuverRequest, ManeuverResponse, ManeuverValidation,
    SimulateStepRequest, SimulateStepResponse,
)

# Global simulation instance
sim: SimulationEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the simulation engine on startup."""
    global sim
    print("Initializing Autonomous Constellation Manager...")
    sim = SimulationEngine()
    print(f"Constellation: {len(sim.satellites)} satellites")
    print(f"Debris field:  {len(sim.debris)} objects")
    print(f"Ground stations: {len(sim.ground_stations)}")
    print(f"Simulation time: {sim.timestamp.isoformat()}")
    print("ACM ready on port 8000")
    sim.schedule_predictive_cache_refresh()
    yield
    print("ACM shutting down")


app = FastAPI(
    title="Autonomous Constellation Manager",
    description="NSH 2026 — Orbital Debris Avoidance & Constellation Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log validation errors for debugging"""
    print(f"❌ VALIDATION ERROR on {request.url.path}:")
    for error in exc.errors():
        print(f"   {error['loc']}: {error['msg']}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# ─── API Endpoints ──────────────────────────────────────────────────────────

@app.post("/api/telemetry")
async def ingest_telemetry(request: Request):
    """
    POST /api/telemetry
    Ingest high-frequency state vector updates for satellites and debris.
    """
    try:
        payload = json.loads(await request.body())
        timestamp = payload["timestamp"]
        objects = payload["objects"]
        if not isinstance(timestamp, str) or not isinstance(objects, list):
            raise ValueError("Invalid telemetry payload structure")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid telemetry payload: {exc}")

    result = await run_in_threadpool(sim.ingest_telemetry, timestamp, objects)
    return result


@app.post("/api/maneuver/schedule")
async def schedule_maneuver(data: ManeuverRequest):
    """
    POST /api/maneuver/schedule
    Submit a maneuver sequence (evasion + recovery burns).
    Validates LOS, fuel, cooldowns.
    """
    print(f"✅ Maneuver request received for {data.satelliteId} with {len(data.maneuver_sequence)} burns")
    sequence = [
        {
            "burn_id": burn.burn_id,
            "burnTime": burn.burnTime,
            "deltaV_vector": {
                "x": burn.deltaV_vector.x,
                "y": burn.deltaV_vector.y,
                "z": burn.deltaV_vector.z,
            },
        }
        for burn in data.maneuver_sequence
    ]
    result = await run_in_threadpool(sim.schedule_maneuver, data.satelliteId, sequence)
    if result.get("status") == "REJECTED":
        print(f"❌ MANEUVER REJECTED: {result.get('reason')}")
        return JSONResponse(content=sanitize(result), status_code=400)
    return JSONResponse(content=sanitize(result), status_code=202)


@app.post("/api/simulate/step")
async def simulate_step(data: SimulateStepRequest):
    """
    POST /api/simulate/step
    Advance the simulation by step_seconds.
    Integrates physics, executes burns, detects conjunctions.
    """
    if data.step_seconds > 86400:
        raise HTTPException(
            status_code=400, 
            detail=f"Time jump of {data.step_seconds}s exceeds maximum physical simulation limit of 86400s (1 day) to preserve collision detection integrity."
        )
        
    result = await run_in_threadpool(sim.step, data.step_seconds)
    return JSONResponse(content=sanitize(result))


@app.get("/api/visualization/snapshot")
async def visualization_snapshot():
    """
    GET /api/visualization/snapshot
    Returns complete simulation state for the frontend dashboard.
    Compressed debris array format for efficient transfer.
    """
    snapshot = await run_in_threadpool(sim.get_visualization_snapshot)
    return JSONResponse(content=sanitize(snapshot))


@app.get("/api/conjunctions/predict")
async def predictive_conjunctions():
    """Return cached 24-hour predictive conjunction warnings."""
    snapshot = await run_in_threadpool(sim.get_predictive_conjunction_snapshot)
    return JSONResponse(content=sanitize(snapshot))


@app.get("/api/status")
async def system_status():
    """Health check and basic system stats."""
    return sim.get_status_snapshot()


@app.get("/api/health")
async def health_check():
    """Alias for automated health checks."""
    return sim.get_status_snapshot()


# ─── Serve Frontend ─────────────────────────────────────────────────────────

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the frontend SPA."""
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
