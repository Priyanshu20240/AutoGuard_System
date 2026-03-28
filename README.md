# 🛰️ AutoGuard System
**Autonomous Constellation Manager for Orbital Debris Avoidance & Satellite Management**

**For:** National Space Hackathon 2026 | IIT Delhi

[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org/)
[![FastAPI 0.115+](https://img.shields.io/badge/fastapi-0.115%2B-green)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/react-19-%2361dafb)](https://react.dev/)
[![Docker](https://img.shields.io/badge/docker-ubuntu%3A22.04-blue)](https://www.docker.com/)

---

## 📋 Table of Contents

- [🎯 Problem Statement](#-problem-statement)
- [⚡ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📦 Prerequisites](#-prerequisites)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🔌 API Documentation](#-api-documentation)
- [⚙️ Technical Specifications](#️-technical-specifications)
- [🐳 Docker Deployment](#-docker-deployment)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [📧 Support](#-support)

---

## 🎯 Problem Statement

**Challenge:** LEO (Low Earth Orbit) has become increasingly congested due to commercial mega-constellations, creating a critical space debris problem. The current manual, ground-based collision avoidance process is unsustainable for managing thousands of satellites.

**Mission:** Develop an **Autonomous Constellation Manager (ACM)** that shifts from ground-reliant piloting to **onboard autonomy**, capable of:
- Predicting collisions **24 hours ahead**
- Executing autonomous evasion maneuvers
- Optimizing fuel consumption for a constellation of **50+ satellites**
- Navigating a debris field of **10,000+ objects**

**Key Metrics:**
- **Safety Score** (25%): Percentage of conjunctions successfully avoided
- **Fuel Efficiency** (20%): Total Δv consumed across constellation
- **Constellation Uptime** (15%): Time within 10 km of nominal orbital slots
- **Algorithm Speed** (15%): Performance of spatial indexing & integration
- **UI/UX & Visualization** (15%): Dashboard clarity & frame rate
- **Code Quality** (10%): Modularity, documentation, logging accuracy

---

## ⚡ Features

| Feature | NSH Requirement | Implementation |
|---------|-----------------|-----------------|
| 🔍 **Real-time Debris Detection** | Monitor 10,000+ debris in LEO | Efficient spatial indexing (non-O(N²)) |
| 🎯 **Predictive Conjunction Analysis** | 24-hour advance collision warnings | Time of Closest Approach (TCA) calculation |
| 🚀 **Autonomous Collision Avoidance** | Auto execute evasion maneuvers | RTN frame calculations with ECI conversion |
| 💫 **Station-Keeping Management** | Return satellites to 10 km bounding box | Post-maneuver orbital recovery |
| ⛽ **Propellant Budgeting** | Track fuel consumption (5% EOL threshold) | Tsiolkovsky rocket equation implementation |
| 🌍 **Interactive 3D Dashboard** | Render 50+ satellites + 10K+ debris @ 60 FPS | WebGL-based visualization (Three.js) |
| 🔄 **Ground Station Integration** | LOS-based command transmission | 10-second signal delay enforcement |
| ⚡ **High-Performance Physics** | Runge-Kutta 4th Order integration with J2 perturbations | Sub-millisecond propagation per object |
| 📊 **Multi-Objective Optimization** | Maximize uptime, minimize fuel | Global constellation-wide optimization |
| 📝 **Comprehensive Logging** | Audit trail for all maneuvers | Flight dynamics officer-ready logs |

---

## 🏗️ Architecture

### System Overview

AutoGuard is an **Autonomous Constellation Manager (ACM)** that provides satellite constellation management, debris detection, and collision avoidance through a modern web-based interface.

```
┌──────────────────────────────────────────────────────────────────┐
│                   🎨 FRONTEND (React + Vite)                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • 3D Globe Visualization (Three.js + react-globe.gl)     │  │
│  │  • Real-time Satellite & Debris Tracking                  │  │
│  │  • Maneuver Planning & Validation Interface               │  │
│  │  • Predictive Conjunction Warnings Dashboard              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                     ↕ HTTP/JSON (Dev: 5173, Docker: 8000)       │
├──────────────────────────────────────────────────────────────────┤
│                   ⚙️ BACKEND (FastAPI + Python)                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            🎛️ SimulationEngine (Orchestrator)             │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │  Physics Engine           Maneuver Planner          │ │  │
│  │  │  ├─ SGP4 Propagator       ├─ Burn Validation       │ │  │
│  │  │  ├─ Fuel Calculator       ├─ LOS Checking          │ │  │
│  │  │  └─ Frame Transform       └─ Schedule Optimizer    │ │  │
│  │  │                                                      │ │  │
│  │  │  Conjunction Detection    Ground Comms              │ │  │
│  │  │  ├─ 24hr Prediction       ├─ Station Coverage       │ │  │
│  │  │  ├─ Risk Scoring          ├─ Contact Windows       │ │  │
│  │  │  └─ Alert Caching         └─ Command Scheduling    │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                         ↑ Port 8000                              │
├──────────────────────────────────────────────────────────────────┤
│                   📊 API ENDPOINTS                                │
│  POST   /api/telemetry          → Ingest state vectors          │
│  POST   /api/maneuver/schedule  → Plan evasion burns            │
│  POST   /api/simulate/step      → Advance simulation            │
│  GET    /api/visualization/snapshot → Dashboard state           │
│  GET    /api/conjunctions/predict   → 24-hr warnings            │
│  GET    /api/status             → Health & statistics           │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Frontend** | React + Vite | 19.2.4 / 8.0.1 | Interactive dashboard UI |
| **3D Rendering** | Three.js + react-globe.gl | 0.183.2 / 2.37.0 | Real-time visualization (50+ sats, 10K+ debris @ 60 FPS) |
| **Backend** | FastAPI | 0.115.0 | High-performance async API |
| **Physics Engine** | NumPy | 1.26.4 | Vectorized orbital calculations |
| **Orbital Propagation** | SGP4 + RK4 Integration | Custom | J2 perturbation-inclusive propagation |
| **Server** | Uvicorn ASGI | 0.30.0 | Async request handling |
| **Container** | Docker | ubuntu:22.04 | Standardized NSH deployment |
| **IPC** | HTTP/JSON | REST API | Frontend-backend communication |

---

## 📦 Prerequisites

Before you start, ensure you have:

### For Local Development

- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 9+** - Comes with Node.js
- **Git** - For version control

### Verify Installation

```bash
# Check Python
python --version          # Should be 3.11 or higher

# Check Node.js
node --version            # Should be 18 or higher
npm --version             # Should be 9 or higher
```

### For Docker Deployment

- **Docker** - [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (optional)

---

## 🚀 Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/Priyanshu20240/AutoGuard_System.git
cd AutoGuard_System
```

### Step 2: Start Backend (Terminal 1)

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

✅ Backend running at: http://localhost:8000
📚 API Docs at: http://localhost:8000/docs

### Step 3: Start Frontend (Terminal 2)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

✅ Frontend running at: http://localhost:5173

### Step 4: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the interactive 3D constellation dashboard! 🌍

---

## 📁 Project Structure

```
AutoGuard_System/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt         # Python dependencies
│   │
│   ├── engine/                 # Core simulation & planning
│   │   ├── simulation.py        # Main orchestrator
│   │   ├── conjunction.py       # Debris detection & prediction
│   │   ├── maneuver.py          # Burn planning & validation
│   │   ├── comms.py             # Ground station comms
│   │   └── station_keeping.py   # Orbit maintenance
│   │
│   ├── physics/                # Physics calculations
│   │   ├── propagator.py        # SGP4 orbital propagation
│   │   ├── fuel.py              # Fuel & thrust calculations
│   │   ├── frames.py            # Coordinate transformations
│   │   └── constants.py         # Physical constants
│   │
│   ├── models/                 # Data structures
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── __init__.py
│   │
│   ├── api/                    # API route handlers
│   │   └── __init__.py
│   │
│   └── data/                   # Configuration & data files
│       └── ground_stations.csv
│
├── frontend/
│   ├── src/                    # React source files
│   │   ├── App.jsx              # Main app component
│   │   ├── main.jsx             # React DOM entry
│   │   ├── index.css            # Global styles
│   │   ├── assets/              # Images & static files
│   │   └── components/          # Reusable React components
│   │       ├── GlobeView.jsx
│   │       ├── ManeuverTimeline.jsx
│   │       ├── FuelAnalytics.jsx
│   │       ├── AuditLogSidebar.jsx
│   │       └── ...
│   │
│   ├── public/                 # Static assets
│   ├── dist/                   # Built production files
│   ├── vite.config.js          # Vite configuration
│   ├── eslint.config.js        # Linting rules
│   ├── package.json            # Node dependencies
│   ├── package-lock.json       # Dependency lock
│   ├── index.html              # HTML entry point
│   └── README.md
│
├── Dockerfile                  # Container configuration
├── README.md                   # This file
├── .gitignore                  # Git ignore rules
└── test_grader.py              # Test & grading script
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:8000
```

### Interactive API Docs
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

#### 1. Ingest Telemetry
```http
POST /api/telemetry
Content-Type: application/json

{
  "timestamp": "2026-03-28T12:00:00Z",
  "objects": [
    {
      "id": "SAT001",
      "position": {"x": 6378.0, "y": 0, "z": 0},
      "velocity": {"x": 0, "y": 7.5, "z": 0},
      "type": "satellite"
    }
  ]
}
```

#### 2. Schedule Maneuver
```http
POST /api/maneuver/schedule
Content-Type: application/json

{
  "satelliteId": "SAT001",
  "maneuver_sequence": [
    {
      "burn_id": "BURN_001",
      "burnTime": "2026-03-28T12:15:00Z",
      "deltaV_vector": {"x": 0.1, "y": 0.05, "z": 0}
    }
  ]
}
```

#### 3. Advance Simulation
```http
POST /api/simulate/step
Content-Type: application/json

{
  "step_seconds": 300
}
```

#### 4. Get Visualization Snapshot
```http
GET /api/visualization/snapshot
```

Response includes:
- Satellite positions & velocities
- Debris field (compressed)
- Ground station coverage
- Active warnings

#### 5. Predict Conjunctions (24-hour)
```http
GET /api/conjunctions/predict
```

Returns cached predictive conjunction warnings.

#### 6. Health Check
```http
GET /api/status
GET /api/health
```

---

## ⚙️ Technical Specifications

### Orbital Mechanics

| Parameter | Value | Unit |
|-----------|-------|------|
| **Reference Frame** | Earth-Centered Inertial (ECI, J2000) | - |
| **State Vector** | [x, y, z, vx, vy, vz] | km, km/s |
| **Earth's Gravitational Parameter (μ)** | 398,600.4418 | km³/s² |
| **Earth Radius** | 6,378.137 | km |
| **J2 Perturbation Constant** | 1.08263 × 10⁻³ | - |
| **Integration Method** | Runge-Kutta 4th Order (RK4) | - |
| **Collision Threshold** | < 0.100 | km (100 meters) |
| **Conjunction Prediction Window** | 24 hours | ahead |

### Spacecraft Parameters

| Parameter | Value | Unit |
|-----------|-------|------|
| **Dry Mass** | 500.0 | kg |
| **Initial Propellant Mass** | 50.0 | kg |
| **Specific Impulse (Isp)** | 300.0 | seconds |
| **Max Thrust Limit (ΔV)** | 15.0 | m/s per burn |
| **Thermal Cooldown** | 600 | seconds (between burns) |
| **Rocket Equation** | Tsiolkovsky | - |
| **Station-Keeping Box** | 10 | km radius (spherical) |
| **Signal Delay** | 10 | seconds minimum |
| **End-of-Life Threshold** | 5% | remaining fuel |

### Maneuver Constraints

- **Reference Frame**: RTN (Radial-Transverse-Normal) with ECI conversion
- **Line-of-Sight (LOS)**: Required for ground station communication
- **Burn Execution**: Current Time + 10 seconds (signal delay)
- **Fuel Tracking**: Strict propellant budgeting with Tsiolkovsky equation
- **Deorbiting**: Automatic transition to graveyard orbit at critical fuel level

### Frontend Performance

- **Satellite Render Count**: 50+ satellites in real-time
- **Debris Render Count**: 10,000+ objects
- **Target Frame Rate**: 60 FPS
- **Graphics Technology**: WebGL (Three.js, PixiJS, or Deck.gl)
- **Features**:
  - Ground Track Map (Mercator projection)
  - Conjunction Bullseye Plot (Polar coordinates)
  - Telemetry Heatmaps
  - Maneuver Timeline (Gantt chart)
  - Historical 90-minute trailing paths
  - Predicted 90-minute trajectory
  - Terminator Line visualization

---

## 🐳 Docker Deployment

### Build & Run with Docker

```bash
# Build Docker image (must use ubuntu:22.04 base)
docker build -t autoguard-system .

# Run container (must bind port 8000 to 0.0.0.0)
docker run -p 8000:8000 autoguard-system
```

The Dockerfile:
- Uses `ubuntu:22.04` base image
- Installs Python 3.11, Node.js 20, and dependencies
- Builds frontend (React + Vite) → static files
- Installs backend dependencies
- Exposes **port 8000** on `0.0.0.0` (not localhost)
- Serves **both frontend & backend** on port 8000

### Verification

```bash
# Test backend health
curl http://0.0.0.0:8000/api/status

# Test frontend
open http://0.0.0.0:8000
```

### Access via Docker
- **Frontend & Backend**: http://0.0.0.0:8000
- **API Documentation**: http://0.0.0.0:8000/docs
- **ReDoc**: http://0.0.0.0:8000/redoc

---

## 🛠️ Troubleshooting

### Backend Issues

#### Port 8000 Already in Use
```bash
# Kill process on port 8000 (Linux/Mac)
lsof -ti:8000 | xargs kill -9

# Kill process on port 8000 (Windows PowerShell)
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

#### Missing Python Dependencies
```bash
# Upgrade pip
pip install --upgrade pip

# Reinstall requirements
pip install -r requirements.txt --force-reinstall
```

#### ImportError or ModuleNotFoundError
```bash
# Ensure you're in the backend directory
cd backend

# Check Python path
echo $PYTHONPATH

# Run with explicit module path
python -m uvicorn main:app --reload
```

### Frontend Issues

#### Port 5173 Already in Use
```bash
# Use alternate port
npm run dev -- --port 5174
```

#### Module Not Found / npm Error
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Blank Dashboard / No Data
1. Check backend is running: http://localhost:8000/health
2. Check browser console for errors (F12)
3. Verify CORS is enabled in `backend/main.py`

### Connection Issues

#### Frontend Can't Reach Backend
**Solution**: Ensure `http://localhost:8000` is accessible from your browser
```bash
# Test from terminal
curl http://localhost:8000/api/status
```

#### CORS Error in Browser Console
**Solution**: Verify CORS middleware in `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📚 Development Guide

### Building for Production (Frontend)
```bash
cd frontend
npm run build
# Output: dist/
```

### Code Quality (Frontend)
```bash
cd frontend
npm run lint
```

---

## 🌟 Key Modules Explained

### SimulationEngine (`backend/engine/simulation.py`)
Central orchestrator that:
- Manages satellite & debris objects
- Schedules and executes maneuvers
- Detects conjunctions in real-time
- Provides visualization snapshots

### SGP4 Propagator (`backend/physics/propagator.py`)
Physics engine for:
- Orbital element propagation
- State vector calculation
- High-precision position/velocity updates

### Conjunction Detector (`backend/engine/conjunction.py`)
Predictive system for:
- 24-hour collision prediction
- Risk assessment & scoring
- Cached warnings (efficient for frontend)

---

## 📦 NSH 2026 Deliverables

Per National Space Hackathon 2026 requirements:

### ✅ Required Submissions

1. **GitHub Repository** - Public repository with complete application
   - Backend (FastAPI)
   - Frontend (React)
   - Dockerfile (ubuntu:22.04 base)
   - All source code & configuration

2. **Docker Environment** - Valid Dockerfile
   - Base image: `ubuntu:22.04`
   - Exports port 8000 on `0.0.0.0`
   - Complete build with dependencies
   - **Failure to meet = Disqualification**

3. **Technical Report** - PDF documentation
   - Numerical methods & algorithms
   - Spatial optimization techniques
   - System architecture
   - Physics integration strategy
   - Recommended: LaTeX format

4. **Video Demonstration** - MP4/WebM format
   - Maximum 5 minutes duration
   - Showcase Orbital Insight frontend
   - Demonstrate core functionalities
   - Show maneuver execution & conjunction avoidance

---

## 📧 Support

### Documentation
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Three.js Guide](https://threejs.org/docs/)

### Issues & Bug Reports
Report issues: [GitHub Issues](https://github.com/Priyanshu20240/AutoGuard_System/issues)

### Contact
- 📧 Email: support@autoguard.dev
- 🔗 GitHub: [@Priyanshu20240](https://github.com/Priyanshu20240)

---

## 📄 License

This project was developed for the **National Space Hackathon 2026**, hosted by IIT Delhi.
  

---

## 🙏 Acknowledgments

- **SGP4 Propagation**: Based on industry-standard orbital mechanics
- **3D Visualization**: Powered by Three.js & react-globe.gl
- **Backend Framework**: Built with FastAPI & async Python

---

<div align="center">

**Built with ❤️ for satellite constellation management**

*Last Updated: March 2026*

[⬆ Back to Top](#-autoguard-system)

</div>
