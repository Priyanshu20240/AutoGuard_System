import { useState, useEffect, useCallback, useRef } from 'react'
import GroundTrackMap from './components/GroundTrackMap'
import BullseyePlot from './components/BullseyePlot'
import TelemetryHeatmap from './components/TelemetryHeatmap'
import ManeuverTimeline from './components/ManeuverTimeline'
import PcCalculator from './components/PcCalculator'
import FuelAnalytics from './components/FuelAnalytics'
import GlobeView from './components/GlobeView'
import PerformanceHUD from './components/PerformanceHUD'
import AuditLogSidebar from './components/AuditLogSidebar'
import PredictiveThreatPanel from './components/PredictiveThreatPanel'

const API = '/api'

export default function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSat, setSelectedSat] = useState(null)
  const [autoStep, setAutoStep] = useState(false)
  const [stepSize, setStepSize] = useState(60)
  const [toasts, setToasts] = useState([])
  const [is3D, setIs3D] = useState(false)
  const [apiLatency, setApiLatency] = useState(0)
  const [isAuditOpen, setIsAuditOpen] = useState(false)
  const autoRef = useRef(false)
  const prevManeuverCount = useRef(0)
  const prevCollisionCount = useRef(0)

  // Fetch visualization snapshot
  const fetchSnapshot = useCallback(async () => {
    try {
      const start = performance.now()
      const res = await fetch(`${API}/visualization/snapshot`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSnapshot(data)
      setApiLatency(Math.round(performance.now() - start))
      setError(null)
      if (loading) setLoading(false)
      if (!selectedSat && data.satellites?.length > 0) {
        setSelectedSat(data.satellites[0].id)
      }

      // Detect new events for toasts
      const stats = data.stats || {}
      if (stats.total_maneuvers > prevManeuverCount.current) {
        const diff = stats.total_maneuvers - prevManeuverCount.current
        addToast(`🚀 ${diff} maneuver(s) executed — collision avoided!`, 'evasion')
      }
      if (stats.total_collisions > prevCollisionCount.current) {
        addToast(`⚠️ COLLISION DETECTED!`, 'collision')
      }
      prevManeuverCount.current = stats.total_maneuvers || 0
      prevCollisionCount.current = stats.total_collisions || 0

      return data
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [loading, selectedSat])

  // Step simulation forward
  const stepSimulation = useCallback(async (seconds) => {
    try {
      const res = await fetch(`${API}/simulate/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_seconds: seconds })
      })
      const data = await res.json()

      if (data.maneuvers_executed > 0) {
        addToast(`🔥 ${data.maneuvers_executed} burn(s) executed — satellite evading debris!`, 'evasion')
      }
      if (data.collisions_detected > 0) {
        addToast(`💥 ${data.collisions_detected} collision(s) detected!`, 'collision')
      }

      await fetchSnapshot()
      return data
    } catch (e) {
      console.error('Step failed:', e)
    }
  }, [fetchSnapshot])

  // Toast management
  const addToast = (message, type = 'warning') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  // Auto-step loop
  useEffect(() => {
    autoRef.current = autoStep
  }, [autoStep])

  useEffect(() => {
    if (!autoStep) return
    const interval = setInterval(async () => {
      if (autoRef.current) {
        await stepSimulation(stepSize)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [autoStep, stepSize, stepSimulation])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setAutoStep(v => !v);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepSimulation(stepSize);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepSimulation, stepSize]);

  // Initial fetch
  useEffect(() => {
    fetchSnapshot()
  }, [])

  if (loading && !snapshot) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <div className="loading-text">Initializing Autonomous Constellation Manager...</div>
      </div>
    )
  }

  const stats = snapshot?.stats || {}
  const sats = snapshot?.satellites || []
  const selectedSatData = sats.find(s => s.id === selectedSat)
  const warnings = snapshot?.cdm_warnings || []
  const predictedWarnings = snapshot?.predicted_cdm_warnings || []
  const predictiveMeta = snapshot?.predictive_meta || {}

  // Global Safety Score Logic (25% Weight)
  const collisionPenalty = (stats.total_collisions || 0) * 10
  const warningPenalty = warnings.length * 2
  const safeSats = sats.filter(s => s.status === 'NOMINAL').length
  const fleetBonus = sats.length > 0 ? (safeSats / sats.length) * 20 : 0
  const safetyScore = Math.max(0, Math.min(100, (80 - collisionPenalty - warningPenalty + fleetBonus))).toFixed(1)

  return (
    <div className="dashboard" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)' }}>
      {/* ─── Status Bar ──────────────────────────────────── */}
      <div className="status-bar">
        <div className="status-bar__brand">
          <div className="status-bar__title">
            <div className="logo">◉</div>
            ACM — Orbital Insight
          </div>
          
          <button className="btn status-bar__audit" onClick={() => setIsAuditOpen(true)}>
            📜 Audit Log
          </button>
        </div>

        <PerformanceHUD performance={snapshot?.stats?.performance} apiLatency={apiLatency} />

        <div className="status-bar__stats">
          <div className="stat-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'var(--accent-blue)', borderWidth: 1, borderStyle: 'solid' }}>
            <span style={{ fontSize: '18px', marginRight: '4px' }}>🛡</span>
            <strong style={{ color: 'var(--accent-blue)' }}>Safety: {safetyScore}/100</strong>
          </div>
          <div className="stat-chip">
            <span className="dot green" />
            {stats.total_satellites || 0} Satellites
          </div>
          <div className="stat-chip">
            <span className="dot blue" />
            {stats.total_debris || 0} Debris
          </div>
          <div className="stat-chip">
            <span className="dot yellow" />
            {stats.active_warnings || 0} CDMs
          </div>
          <div className="stat-chip">
            <span className="dot blue" />
            {stats.predicted_active_warnings || predictedWarnings.length} Predicted
          </div>
          <div className="stat-chip">
            <span className="dot red" />
            {stats.total_collisions || 0} Collisions
          </div>
          <div className="stat-chip">
            <span className="dot green" />
            {stats.total_maneuvers || 0} Burns
          </div>
          <div className="stat-chip">
            ⛽ {stats.total_fuel_consumed_kg?.toFixed(2) || '0.00'} kg used
          </div>
          <div className="stat-chip">
            📊 Uptime {((stats.fleet_uptime || 1) * 100).toFixed(1)}%
          </div>
        </div>

        <div className="status-bar__time">
          ⏱ {snapshot?.timestamp ? new Date(snapshot.timestamp).toUTCString() : '---'}
        </div>

        <div className="status-bar__controls">
          <select
            value={stepSize}
            onChange={e => setStepSize(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
            }}
          >
            <option value={10}>10s step</option>
            <option value={30}>30s step</option>
            <option value={60}>1 min step</option>
            <option value={300}>5 min step</option>
            <option value={600}>10 min step</option>
            <option value={3600}>1 hour step</option>
          </select>
          <button className="btn" onClick={() => stepSimulation(stepSize)}>
            ▶ Step
          </button>
          <button
            className={`btn ${autoStep ? 'active' : ''}`}
            onClick={() => setAutoStep(v => !v)}
          >
            {autoStep ? '⏸ Pause' : '⏩ Auto'}
          </button>
          <button className="btn" onClick={fetchSnapshot}>
            🔄
          </button>
        </div>
      </div>

      {/* ─── Ground Track Map ────────────────────────────── */}
      <div className="panel" style={{ gridColumn: '1 / 2' }}>
        <div className="panel__header">
          <div className="panel__title">
            <span className="icon">{is3D ? '🌍' : '🗺️'}</span> {is3D ? '3D Orbital Globe' : '2D Ground Track'}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn" style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)' }} onClick={() => setIs3D(!is3D)}>
              {is3D ? 'Switch to 2D Map' : 'Switch to 3D Globe'}
            </button>
            <div className="sat-selector">
              <select
                value={selectedSat || ''}
                onChange={e => setSelectedSat(e.target.value)}
              >
                {sats.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} [{s.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="panel__body" style={{ position: 'relative' }}>
          {is3D ? (
            <GlobeView
              satellites={sats}
              debrisCloud={snapshot?.debris_cloud || []}
              groundStations={snapshot?.ground_stations || []}
              selectedSat={selectedSat}
              onSelectSat={setSelectedSat}
              warnings={warnings}
            />
          ) : (
            <GroundTrackMap
              satellites={sats}
              debrisCloud={snapshot?.debris_cloud || []}
              groundStations={snapshot?.ground_stations || []}
              selectedSat={selectedSat}
              onSelectSat={setSelectedSat}
              warnings={warnings}
            />
          )}
          {selectedSatData && !selectedSatData.has_los && (
            <div className="blackout-warning" style={{ 
              position: 'absolute', top: 15, right: 15, background: 'rgba(239, 68, 68, 0.2)', 
              border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', 
              borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', animation: 'pulse 1s infinite',
              backdropFilter: 'blur(4px)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)', pointerEvents: 'none'
            }}>
              ⚠️ LOS BLACKOUT
            </div>
          )}
        </div>
      </div>

      {/* ─── Conjunction Bullseye Plot ─────────────────── */}
      <div className="panel" style={{ gridColumn: '2 / 3' }}>
        <div className="panel__header">
          <div className="panel__title">
            <span className="icon">🎯</span> Conjunction Bullseye
          </div>
          {warnings.length > 0 && (
            <span className="panel__badge red">{warnings.length} threats</span>
          )}
        </div>
        <div className="panel__body">
          <BullseyePlot
            satellite={selectedSatData}
            warnings={warnings.filter(w => w.satellite_id === selectedSat)}
            allWarnings={warnings}
          />
        </div>
      </div>

      <div className="panel" style={{ gridColumn: '1 / 2' }}>
        <div className="panel__header">
          <div className="panel__title">
            <span className="icon">📊</span> Fleet Telemetry
          </div>
          <span className="panel__badge green">{sats.filter(s => s.status === 'NOMINAL').length} nominal</span>
        </div>
        <div className="panel__body">
          <TelemetryHeatmap
            satellites={sats}
            selectedSat={selectedSat}
            onSelectSat={setSelectedSat}
            stats={stats}
          />
        </div>
      </div>

      {/* ─── Fuel Analytics (NEW) ───────────────────────── */}
      <div className="panel" style={{ gridColumn: '2 / 3' }}>
        <div className="panel__header">
          <div className="panel__title">
            <span className="icon">⛽</span> Fuel Efficiency Leaderboard
          </div>
        </div>
        <div className="panel__body">
          <FuelAnalytics 
            satellites={sats} 
            maneuverLog={snapshot?.maneuver_log || []} 
          />
        </div>
      </div>

      {/* ─── Live Pc Calculator (NEW) ──────────────────── */}
      <div className="dashboard__right-stack" style={{ gridColumn: '3 / 4', gridRow: '2 / 3' }}>
        <div className="panel panel--predictive">
          <div className="panel__header">
            <div className="panel__title">
              <span className="icon predictive-panel__icon">FC</span> Predictive CDM
            </div>
            <span className="panel__badge blue">{predictedWarnings.length} future threats</span>
          </div>
          <div className="panel__body panel__body--padded">
            <PredictiveThreatPanel
              warnings={predictedWarnings}
              predictiveMeta={predictiveMeta}
              timestamp={snapshot?.timestamp}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
          <div className="panel__title">
            <span className="icon">⚡</span> Live Pc Calculator
          </div>
        </div>
        <div className="panel__body">
          <PcCalculator 
            warnings={warnings} 
            timestamp={snapshot?.timestamp} 
          />
        </div>
        </div>
      </div>

      {/* ─── Maneuver Timeline ────────────────────────── */}
      <div className="panel" style={{ gridColumn: '3 / 4', gridRow: '3 / 4' }}>
        <div className="panel__header">
          <div className="panel__title">
            <span className="icon">📅</span> Maneuver Timeline
          </div>
          <span className="panel__badge blue">{stats.total_maneuvers || 0} total</span>
        </div>
        <div className="panel__body">
          <ManeuverTimeline
            maneuverLog={snapshot?.maneuver_log || []}
            scheduledBurns={snapshot?.scheduled_burns || []}
            satellites={sats}
            timestamp={snapshot?.timestamp}
          />
        </div>
      </div>

      {/* ─── Event Toasts ──────────────────────────────── */}
      <div className="event-toast">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
      
      {/* ─── HUD & Sidebars ───────────────────────────── */}
      <AuditLogSidebar isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} maneuverLog={snapshot?.maneuver_log} />
      
    </div>
  )
}

