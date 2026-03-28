"""
Physical constants for orbital mechanics simulation.
All values match the NSH 2026 problem statement specifications.
"""

import math

# Earth parameters
MU = 398600.4418          # Earth gravitational parameter [km^3/s^2]
RE = 6378.137             # Earth equatorial radius [km]
J2 = 1.08263e-3           # J2 oblateness coefficient
G0 = 9.80665              # Standard gravity [m/s^2]
EARTH_ROTATION_RATE = 7.2921159e-5  # Earth rotation rate [rad/s]

# Satellite specifications (identical for all satellites)
DRY_MASS = 500.0          # Dry mass [kg]
INITIAL_FUEL = 50.0       # Initial propellant mass [kg]
TOTAL_WET_MASS = DRY_MASS + INITIAL_FUEL  # 550 kg
ISP = 300.0               # Specific impulse [s]
MAX_DV_PER_BURN = 15.0    # Maximum delta-v per burn [m/s]
THRUSTER_COOLDOWN = 600.0 # Cooldown between burns [seconds]

# Conjunction thresholds [km]
COLLISION_THRESHOLD = 0.100   # 100 meters
WARNING_THRESHOLD = 5.0       # 5 km - yellow zone
SAFE_THRESHOLD = 10.0         # 10 km - green zone

# Station-keeping
DRIFT_TOLERANCE = 10.0        # km - nominal slot radius

# Communication
SIGNAL_DELAY = 10.0           # seconds - hardcoded latency
PREDICTION_HORIZON = 86400.0  # 24 hours in seconds

# Fuel thresholds
EOL_FUEL_FRACTION = 0.05      # 5% fuel → end-of-life

# Simulation defaults
DEFAULT_PROPAGATION_STEP = 10.0  # seconds for RK4 integration
TRAIL_DURATION = 5400.0          # 90 minutes in seconds

# Derived constants
VE = ISP * G0  # Effective exhaust velocity [m/s]
