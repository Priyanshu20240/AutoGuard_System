"""
Conjunction detection and assessment using spatial indexing.
Current-epoch checks use a lightweight spatial hash for lower Python overhead.
Predictive checks keep the existing octree + golden-section approach.
"""
import math
import numpy as np
from ..physics.constants import (
    COLLISION_THRESHOLD, WARNING_THRESHOLD, SAFE_THRESHOLD,
    PREDICTION_HORIZON, DEFAULT_PROPAGATION_STEP, SIGNAL_DELAY
)
from ..physics.propagator import propagate


class OctreeNode:

    __slots__ = ("center", "half_size", "depth", "max_depth",
                 "children", "objects", "max_objects")

    def __init__(self, center: np.ndarray, half_size: float,
                 depth: int = 0, max_depth: int = 10):
        self.center = center
        self.half_size = half_size
        self.depth = depth
        self.max_depth = max_depth
        self.children = [None] * 8
        self.objects = []          # list of (object_id, position_array)
        self.max_objects = 16      # split threshold

    def insert(self, obj_id: str, pos: np.ndarray):
        if self.depth >= self.max_depth or len(self.objects) < self.max_objects:
            self.objects.append((obj_id, pos))
            return

        if all(child is None for child in self.children):
            self._subdivide()
            old = self.objects
            self.objects = []
            for oid, opos in old:
                self.children[self._octant(opos)].insert(oid, opos)

        self.children[self._octant(pos)].insert(obj_id, pos)

    def query_radius(self, point: np.ndarray, radius: float) -> list:
        results = []
        dx = max(0.0, abs(point[0] - self.center[0]) - self.half_size)
        dy = max(0.0, abs(point[1] - self.center[1]) - self.half_size)
        dz = max(0.0, abs(point[2] - self.center[2]) - self.half_size)
        if dx * dx + dy * dy + dz * dz > radius * radius:
            return results

        for obj_id, pos in self.objects:
            d = np.linalg.norm(point - pos)
            if d <= radius:
                results.append((obj_id, pos, d))

        for child in self.children:
            if child is not None:
                results.extend(child.query_radius(point, radius))
        return results

    def _octant(self, pos: np.ndarray) -> int:
        octant = 0
        if pos[0] >= self.center[0]:
            octant |= 1
        if pos[1] >= self.center[1]:
            octant |= 2
        if pos[2] >= self.center[2]:
            octant |= 4
        return octant

    def _subdivide(self):
        hs = self.half_size / 2.0
        for i in range(8):
            offset = np.array([
                hs if (i & 1) else -hs,
                hs if (i & 2) else -hs,
                hs if (i & 4) else -hs,
            ])
            self.children[i] = OctreeNode(
                self.center + offset, hs,
                self.depth + 1, self.max_depth
            )


def linear_tca_estimate(dr: np.ndarray, dv: np.ndarray) -> float:
    dv_sq = np.dot(dv, dv)
    if dv_sq < 1e-20:
        return 0.0
    return max(0.0, -np.dot(dr, dv) / dv_sq)


def linear_miss_distance(dr: np.ndarray, dv: np.ndarray, t: float) -> float:
    return float(np.linalg.norm(dr + dv * t))


def _propagated_distance(sat_state: np.ndarray, deb_state: np.ndarray,
                         t: float) -> float:

    if t <= 0:
        return float(np.linalg.norm(sat_state[:3] - deb_state[:3]))
    sat = propagate(sat_state, t, dt=30.0)
    deb = propagate(deb_state, t, dt=30.0)
    return float(np.linalg.norm(sat[:3] - deb[:3]))


def find_tca_golden_section(sat_state: np.ndarray, deb_state: np.ndarray,
                            horizon: float = PREDICTION_HORIZON,
                            coarse_step: float = 60.0,
                            tol: float = 0.1) -> tuple:
    phi = 0.6180339887

    best_t = 0.0
    best_dist = float(np.linalg.norm(sat_state[:3] - deb_state[:3]))
    t_lo, t_hi = 0.0, 0.0

    for t in np.arange(coarse_step, horizon + coarse_step, coarse_step):
        dist = _propagated_distance(sat_state, deb_state, t)
        if dist < best_dist:
            best_dist = dist
            best_t = t
            t_lo = t - coarse_step
            t_hi = t + coarse_step

    t_lo = max(0.0, t_lo)
    t_hi = min(horizon, t_hi)

    if t_hi - t_lo < tol:
        return (best_t, best_dist)

    a, b = t_lo, t_hi
    c = b - phi * (b - a)
    d_val = a + phi * (b - a)
    fc = _propagated_distance(sat_state, deb_state, c)
    fd = _propagated_distance(sat_state, deb_state, d_val)

    for _ in range(30):
        if b - a < tol:
            break
        if fc < fd:
            b = d_val
            d_val = c
            fd = fc
            c = b - phi * (b - a)
            fc = _propagated_distance(sat_state, deb_state, c)
        else:
            a = c
            c = d_val
            fc = fd
            d_val = a + phi * (b - a)
            fd = _propagated_distance(sat_state, deb_state, d_val)

    tca = (a + b) / 2.0
    miss = _propagated_distance(sat_state, deb_state, tca)
    return (tca, miss)


def refine_tca_window(sat_state: np.ndarray, deb_state: np.ndarray,
                      t_guess: float, horizon: float,
                      window_seconds: float = 900.0,
                      coarse_step: float = 180.0,
                      tol: float = 2.0) -> tuple:
    """Refine TCA around a linear estimate using a narrow search window."""
    t_lo = max(0.0, t_guess - window_seconds)
    t_hi = min(horizon, t_guess + window_seconds)
    if t_hi <= t_lo:
        dist = _propagated_distance(sat_state, deb_state, t_lo)
        return (t_lo, dist)

    best_t = t_lo
    best_dist = _propagated_distance(sat_state, deb_state, t_lo)
    sample_times = np.arange(t_lo + coarse_step, t_hi + coarse_step, coarse_step)

    for t in sample_times:
        sample_t = min(t, t_hi)
        dist = _propagated_distance(sat_state, deb_state, sample_t)
        if dist < best_dist:
            best_dist = dist
            best_t = sample_t

    a = max(t_lo, best_t - coarse_step)
    b = min(t_hi, best_t + coarse_step)
    if b - a <= tol:
        return (best_t, best_dist)

    phi = 0.6180339887
    c = b - phi * (b - a)
    d_val = a + phi * (b - a)
    fc = _propagated_distance(sat_state, deb_state, c)
    fd = _propagated_distance(sat_state, deb_state, d_val)

    for _ in range(20):
        if b - a < tol:
            break
        if fc < fd:
            b = d_val
            d_val = c
            fd = fc
            c = b - phi * (b - a)
            fc = _propagated_distance(sat_state, deb_state, c)
        else:
            a = c
            c = d_val
            fc = fd
            d_val = a + phi * (b - a)
            fd = _propagated_distance(sat_state, deb_state, d_val)

    tca = (a + b) / 2.0
    miss = _propagated_distance(sat_state, deb_state, tca)
    return (tca, miss)


class ConjunctionDetector:
    """
    Current-epoch checks use a spatial hash.
    Predictive checks use the original octree + refinement pipeline.
    """

    def __init__(self):
        self.cdm_warnings = []
        self.collision_count = 0

    @staticmethod
    def _grid_key(pos: np.ndarray, cell_size: float) -> tuple:
        return (
            int(math.floor(pos[0] / cell_size)),
            int(math.floor(pos[1] / cell_size)),
            int(math.floor(pos[2] / cell_size)),
        )

    def _build_spatial_hash(self, debris_states: dict, cell_size: float) -> dict:
        grid = {}
        for debris_id, state in debris_states.items():
            key = self._grid_key(state[:3], cell_size)
            grid.setdefault(key, []).append((debris_id, state))
        return grid

    def build_debris_index(self, debris_positions: dict) -> OctreeNode:
        root = OctreeNode(
            center=np.array([0.0, 0.0, 0.0]),
            half_size=15000.0,
            max_depth=10,
        )
        for obj_id, pos in debris_positions.items():
            root.insert(obj_id, pos)
        return root

    def detect_conjunctions(self, satellites: dict, debris_states: dict,
                            search_radius: float = 50.0) -> list:
        """Current-epoch conjunction check — fully vectorized numpy for speed."""
        if not satellites or not debris_states:
            self.cdm_warnings = []
            return []

        # Pre-build debris arrays once
        deb_ids = list(debris_states.keys())
        deb_array = np.array([debris_states[d] for d in deb_ids])  # (D, 6)
        deb_pos = deb_array[:, :3]   # (D, 3)
        deb_vel = deb_array[:, 3:]   # (D, 3)

        warnings = []
        for sat_id, sat_state in satellites.items():
            sat_pos = sat_state[:3]   
            sat_vel = sat_state[3:]   

            # Vectorized distance: (D,)
            diff = deb_pos - sat_pos  
            dists = np.linalg.norm(diff, axis=1)  

            # Filter: only debris within search_radius
            mask = dists <= search_radius
            if not np.any(mask):
                continue

            close_idx = np.flatnonzero(mask)
            close_dists = dists[close_idx]

            for j, idx in enumerate(close_idx):
                dist = float(close_dists[j])

                if dist < SAFE_THRESHOLD:
                    risk = self._classify_risk(dist)
                    rel_v = float(np.linalg.norm(sat_vel - deb_vel[idx]))

                    # Linear TCA estimate
                    dr = sat_pos - deb_pos[idx]
                    dv = sat_vel - deb_vel[idx]
                    dv_sq = float(np.dot(dv, dv))
                    t_lin = max(0.0, -float(np.dot(dr, dv)) / dv_sq) if dv_sq > 1e-20 else 0.0

                    warnings.append({
                        "satellite_id": sat_id,
                        "debris_id": deb_ids[idx],
                        "miss_distance_km": round(dist, 6),
                        "risk_level": risk,
                        "tca_seconds": round(t_lin, 2),
                        "relative_velocity_kms": rel_v,
                    })

                if dist < COLLISION_THRESHOLD:
                    self.collision_count += 1

        self.cdm_warnings = warnings
        return warnings

    def predict_conjunctions(self, satellites: dict, debris_states: dict,
                             horizon_seconds: float = PREDICTION_HORIZON,
                             linear_threshold_km: float = 20.0,
                             max_candidates_per_sat: int = 8,
                             refine_top_n: int = 16) -> list:

        if not satellites or not debris_states:
            return []

        debris_ids = list(debris_states.keys())
        debris_array = np.array([debris_states[debris_id] for debris_id in debris_ids])
        debris_r = debris_array[:, :3]
        debris_v = debris_array[:, 3:]

        preliminary = []

        for sat_id, sat_state in satellites.items():
            sat_r = sat_state[:3]
            sat_v = sat_state[3:]

            dr = sat_r - debris_r
            dv = sat_v - debris_v
            dv_sq = np.einsum("ij,ij->i", dv, dv)
            dr_dot_dv = np.einsum("ij,ij->i", dr, dv)

            valid = dv_sq > 1e-20
            t_lin = np.zeros(len(debris_ids), dtype=float)
            t_lin[valid] = -dr_dot_dv[valid] / dv_sq[valid]
            t_lin = np.clip(t_lin, 0.0, horizon_seconds)

            miss_vectors = dr + dv * t_lin[:, None]
            miss_lin = np.linalg.norm(miss_vectors, axis=1)

            candidate_idx = np.flatnonzero(
                valid
                & (t_lin > 0.0)
                & (t_lin < horizon_seconds)
                & (miss_lin <= linear_threshold_km)
            )

            if candidate_idx.size == 0:
                continue

            if candidate_idx.size > max_candidates_per_sat:
                order = np.argsort(miss_lin[candidate_idx])
                candidate_idx = candidate_idx[order[:max_candidates_per_sat]]

            for idx in candidate_idx:
                debris_id = debris_ids[idx]
                preliminary.append({
                    "satellite_id": sat_id,
                    "debris_id": debris_id,
                    "linear_miss_km": float(miss_lin[idx]),
                    "tca_guess_seconds": float(t_lin[idx]),
                    "relative_velocity_kms": float(np.linalg.norm(sat_v - debris_array[idx][3:])),
                })

        best = {}
        for warning in preliminary:
            key = (warning["satellite_id"], warning["debris_id"])
            if key not in best or warning["linear_miss_km"] < best[key]["linear_miss_km"]:
                best[key] = warning

        shortlisted = sorted(
            best.values(),
            key=lambda warning: (
                warning["linear_miss_km"],
                warning["tca_guess_seconds"],
            ),
        )[:refine_top_n]

        refined = []
        debris_lookup = {debris_id: debris_states[debris_id] for debris_id in debris_ids}
        for warning in shortlisted:
            sat_state = satellites[warning["satellite_id"]]
            deb_state = debris_lookup[warning["debris_id"]]
            tca, miss = refine_tca_window(
                sat_state,
                deb_state,
                warning["tca_guess_seconds"],
                horizon_seconds,
            )

            if miss >= SAFE_THRESHOLD:
                continue

            recommended_lead_s = min(7200.0, max(600.0, tca * 0.5))
            optimal_maneuver_in_s = max(SIGNAL_DELAY, tca - recommended_lead_s)
            risk = self._classify_risk(miss)

            refined.append({
                "satellite_id": warning["satellite_id"],
                "debris_id": warning["debris_id"],
                "miss_distance_km": round(miss, 6),
                "risk_level": risk,
                "tca_seconds": round(tca, 2),
                "relative_velocity_kms": warning["relative_velocity_kms"],
                "optimal_maneuver_in_seconds": round(optimal_maneuver_in_s, 2),
                "recommended_lead_seconds": round(recommended_lead_s, 2),
            })

        risk_order = {"CRITICAL": 0, "RED": 1, "YELLOW": 2, "GREEN": 3}
        return sorted(
            refined,
            key=lambda warning: (
                risk_order.get(warning["risk_level"], 99),
                warning["tca_seconds"],
                warning["miss_distance_km"],
            ),
        )

    @staticmethod
    def _classify_risk(distance_km: float) -> str:
        if distance_km < COLLISION_THRESHOLD:
            return "CRITICAL"
        if distance_km < 1.0:
            return "RED"
        if distance_km < WARNING_THRESHOLD:
            return "YELLOW"
        return "GREEN"
