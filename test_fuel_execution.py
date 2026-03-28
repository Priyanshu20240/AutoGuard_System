import numpy as np
from datetime import datetime, timezone

from backend.engine.maneuver import ManeuverPlanner
from backend.physics.constants import DRY_MASS
from backend.physics.fuel import apply_burn
from backend.engine.simulation import SimulationEngine


def test_apply_burn_never_consumes_more_than_remaining_fuel():
    new_fuel, consumed, new_mass = apply_burn(15.0, 1.0)

    assert consumed == 1.0
    assert new_fuel == 0.0
    assert new_mass == DRY_MASS


def test_execute_scheduled_burn_rejects_when_fuel_is_insufficient():
    planner = ManeuverPlanner()
    sat_id = "SAT-TEST-01"
    satellites = {
        sat_id: np.array([7000.0, 0.0, 0.0, 0.0, 7.5, 0.0], dtype=float)
    }
    sat_fuel = {sat_id: 1.0}
    sat_mass = {sat_id: DRY_MASS + 1.0}
    original_state = satellites[sat_id].copy()

    planner.schedule_burn({
        "burn_id": "TEST_INFEASIBLE_BURN",
        "satellite_id": sat_id,
        "burn_time": 0.0,
        "deltaV_eci": [0.0, 0.015, 0.0],
        "deltaV_rtn": [0.0, 0.015, 0.0],
        "deltaV_magnitude_ms": 15.0,
        "fuel_consumed_kg": 0.0,
        "fuel_remaining_kg": 0.0,
        "type": "EVASION",
        "status": "SCHEDULED",
    })

    executed = planner.execute_scheduled_burns(
        0.0, satellites, sat_fuel, sat_mass
    )

    assert executed == []
    assert sat_fuel[sat_id] == 1.0
    assert sat_mass[sat_id] == DRY_MASS + 1.0
    assert np.allclose(satellites[sat_id], original_state)
    assert planner.burn_history[-1]["status"] == "REJECTED_INSUFFICIENT_FUEL"


def test_execute_scheduled_burn_updates_mass_after_success():
    planner = ManeuverPlanner()
    sat_id = "SAT-TEST-02"
    satellites = {
        sat_id: np.array([7000.0, 0.0, 0.0, 0.0, 7.5, 0.0], dtype=float)
    }
    sat_fuel = {sat_id: 50.0}
    sat_mass = {sat_id: DRY_MASS + 50.0}

    planner.schedule_burn({
        "burn_id": "TEST_FEASIBLE_BURN",
        "satellite_id": sat_id,
        "burn_time": 0.0,
        "deltaV_eci": [0.0, 0.005, 0.0],
        "deltaV_rtn": [0.0, 0.005, 0.0],
        "deltaV_magnitude_ms": 5.0,
        "fuel_consumed_kg": 0.0,
        "fuel_remaining_kg": 0.0,
        "type": "EVASION",
        "status": "SCHEDULED",
    })

    executed = planner.execute_scheduled_burns(
        0.0, satellites, sat_fuel, sat_mass
    )

    assert len(executed) == 1
    assert sat_fuel[sat_id] < 50.0
    assert sat_mass[sat_id] == DRY_MASS + sat_fuel[sat_id]
    assert satellites[sat_id][4] > 7.5


def test_schedule_validation_uses_canonical_tsiolkovsky_mass_baseline():
    engine = SimulationEngine()
    sat_id = "SAT-Alpha-03"

    # Emulate a satellite that already burned fuel earlier in the scenario.
    engine.sat_fuel[sat_id] = 47.202917
    engine.sat_mass[sat_id] = DRY_MASS + engine.sat_fuel[sat_id]

    response = engine.schedule_maneuver(
        sat_id,
        [{
            "burn_id": "TEST_FUEL_MATH",
            "burnTime": datetime.fromtimestamp(
                engine.unix_time + 601, tz=timezone.utc
            ).isoformat().replace("+00:00", "Z"),
            "deltaV_vector": {"x": 0.005, "y": 0.0, "z": 0.0},
        }],
    )

    assert response["status"] == "SCHEDULED"
    assert response["validation"]["sufficient_fuel"] is True
    assert response["validation"]["projected_mass_remaining_kg"] == 549.07
