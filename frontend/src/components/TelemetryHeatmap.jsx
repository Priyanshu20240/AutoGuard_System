/**
 * Telemetry & Resource Heatmap — Fleet-wide fuel gauges, satellite status grid,
 * and ΔV cost analysis.
 */

export default function TelemetryHeatmap({ satellites, selectedSat, onSelectSat, stats }) {
  // Sort: selected first, then by status priority, then by ID
  const sorted = [...satellites].sort((a, b) => {
    if (a.id === selectedSat) return -1
    if (b.id === selectedSat) return 1
    const prio = { EOL: 0, MANEUVERING: 1, DRIFTING: 2, NOMINAL: 3 }
    return (prio[a.status] || 4) - (prio[b.status] || 4)
  })

  const getFuelColor = (fraction) => {
    if (fraction > 0.6) return 'linear-gradient(90deg, #4ade80, #22c55e)'
    if (fraction > 0.3) return 'linear-gradient(90deg, #facc15, #eab308)'
    if (fraction > 0.05) return 'linear-gradient(90deg, #fb923c, #f97316)'
    return 'linear-gradient(90deg, #f87171, #ef4444)'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'NOMINAL': return { bg: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }
      case 'MANEUVERING': return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
      case 'DRIFTING': return { bg: 'rgba(250, 204, 21, 0.15)', color: '#facc15' }
      case 'EOL': return { bg: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }
      default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b' }
    }
  }

  return (
    <div className="telemetry-body">
      {/* Fleet summary */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap',
        padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'
      }}>
        <MiniStat label="Avg Uptime" value={`${((stats.fleet_uptime || 1) * 100).toFixed(1)}%`} color="#4ade80" />
        <MiniStat label="Fuel Used" value={`${(stats.total_fuel_consumed_kg || 0).toFixed(2)} kg`} color="#38bdf8" />
        <MiniStat label="Burns" value={stats.total_maneuvers || 0} color="#a78bfa" />
        <MiniStat label="Collisions" value={stats.total_collisions || 0} color={stats.total_collisions > 0 ? '#ef4444' : '#4ade80'} />
        <MiniStat label="CDMs" value={stats.active_warnings || 0} color="#facc15" />
      </div>

      {/* Fuel gauge grid */}
      <div className="fuel-grid">
        {sorted.map(sat => {
          const fraction = sat.fuel_fraction || (sat.fuel_kg / 50)
          const stColor = getStatusColor(sat.status)
          return (
            <div
              key={sat.id}
              className={`fuel-card ${sat.id === selectedSat ? 'selected' : ''}`}
              onClick={() => onSelectSat(sat.id)}
            >
              <div className="fuel-card__id">
                {sat.id.replace('SAT-Alpha-', '⬡ ')}
              </div>
              <div className="fuel-card__bar">
                <div
                  className="fuel-card__fill"
                  style={{
                    width: `${Math.max(fraction * 100, 1)}%`,
                    background: getFuelColor(fraction),
                  }}
                />
              </div>
              <div className="fuel-card__stats">
                <span>{sat.fuel_kg.toFixed(0)}kg | {sat.uptime_score ? (sat.uptime_score * 100).toFixed(1) : '100'}% UP</span>
                <span className="fuel-card__status" style={{
                  background: stColor.bg,
                  color: stColor.color,
                }}>
                  {sat.status === 'NOMINAL' ? '●' : sat.status === 'MANEUVERING' ? '⚡' : sat.status === 'EOL' ? '⛔' : '⚠'}
                </span>
              </div>
              {sat.id === selectedSat && (
                <div style={{ marginTop: '4px', fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Drift: {sat.drift_km?.toFixed(2) || '0.00'} km
                  {sat.has_los ? ' 📡' : ' 🚫'}
                  {' '}▲{sat.uptime_score ? (sat.uptime_score * 100).toFixed(0) : '100'}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
      <span style={{ fontSize: '14px', fontWeight: '700', color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
      <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
    </div>
  )
}
