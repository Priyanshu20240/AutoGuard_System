/**
 * Maneuver Timeline — Gantt-style scheduler showing evasion burns, recovery burns,
 * thruster cooldowns, and scheduled events.
 */

export default function ManeuverTimeline({ maneuverLog, scheduledBurns, satellites, timestamp }) {
  const allEvents = [
    ...maneuverLog.map(m => ({ ...m, source: 'log' })),
    ...scheduledBurns.map(b => ({ ...b, source: 'scheduled' })),
  ]

  // Group by satellite
  const bySat = {}
  for (const evt of allEvents) {
    const sid = evt.satellite_id || evt.satelliteId
    if (!sid) continue
    if (!bySat[sid]) bySat[sid] = []
    bySat[sid].push(evt)
  }

  const satIds = Object.keys(bySat).sort()
  const currentTime = timestamp ? new Date(timestamp).getTime() : Date.now()

  // CDM warnings from recent collisions
  const recentCollisions = maneuverLog.filter(m =>
    m.type === 'EVASION' && m.status === 'EXECUTED'
  ).slice(-5)

  return (
    <div className="timeline-body">
      {/* CDM Alert Banner */}
      {recentCollisions.length > 0 && (
        <div className="cdm-list">
          {recentCollisions.map((evt, i) => (
            <div key={i} className="cdm-item evasion" style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
            }}>
              <div className="cdm-item__risk CRITICAL" />
              <span style={{ color: '#f87171', fontWeight: 600 }}>EVASION</span>
              <span>{evt.satellite_id}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Δv {evt.deltaV_magnitude_ms?.toFixed(2)} m/s
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                ⛽ -{evt.actual_fuel_consumed_kg?.toFixed(3) || evt.fuel_consumed_kg?.toFixed(3)} kg
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline rows */}
      {satIds.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          No maneuvers executed yet — step the simulation to see burns
        </div>
      ) : (
        satIds.map(sid => {
          const events = bySat[sid]
          const sat = satellites.find(s => s.id === sid)
          return (
            <div key={sid} className="timeline-row">
              <div className="timeline-row__id">
                {sid.replace('SAT-Alpha-', '⬡ ')}
              </div>
              <div className="timeline-row__bar-container">
                {events.map((evt, idx) => {
                  const type = evt.type || (evt.burn_id?.includes('EVASION') ? 'EVASION' : 'RECOVERY')
                  const isEvasion = type === 'EVASION'
                  const isScheduled = evt.source === 'scheduled'

                  // Position along timeline (simple linear for now)
                  const left = `${(idx / Math.max(events.length, 1)) * 85}%`
                  const width = `${Math.max(60 / Math.max(events.length, 1), 8)}%`

                  return (
                    <div
                      key={idx}
                      className={`timeline-block ${isEvasion ? 'evasion' : 'recovery'}`}
                      style={{
                        left,
                        width,
                        opacity: isScheduled ? 0.6 : 1,
                        border: isScheduled ? '1px dashed rgba(255,255,255,0.3)' : 'none',
                      }}
                      title={[
                        `${evt.burn_id || 'Burn'}`,
                        `Type: ${type}`,
                        `Δv: ${evt.deltaV_magnitude_ms?.toFixed(2) || '?'} m/s`,
                        `Fuel: ${(evt.actual_fuel_consumed_kg || evt.fuel_consumed_kg || 0).toFixed(3)} kg`,
                        `Status: ${evt.status}`,
                      ].join('\n')}
                    >
                      {isEvasion ? '🔥' : '🔄'}
                    </div>
                  )
                })}

                {/* Cooldown block */}
                {sat?.cooldown_remaining > 0 && (
                  <div
                    className="timeline-block cooldown"
                    style={{ right: 0, width: '15%' }}
                    title={`Thruster cooldown: ${sat.cooldown_remaining.toFixed(0)}s remaining`}
                  >
                    🧊 {sat.cooldown_remaining.toFixed(0)}s
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '8px', color: 'var(--text-muted)', minWidth: '30px',
                fontFamily: 'var(--font-mono)', textAlign: 'right'
              }}>
                {events.length}
              </div>
            </div>
          )
        })
      )}

      {/* Scheduled burns summary */}
      {scheduledBurns.length > 0 && (
        <div style={{
          marginTop: '10px', padding: '8px', background: 'rgba(56, 189, 248, 0.05)',
          borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.1)',
        }}>
          <div style={{ fontSize: '9px', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '4px' }}>
            ⏳ SCHEDULED BURNS ({scheduledBurns.length})
          </div>
          {scheduledBurns.slice(0, 5).map((b, i) => (
            <div key={i} style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              padding: '2px 0',
            }}>
              {b.satellite_id} → {b.type} | Δv {b.deltaV_magnitude_ms?.toFixed(2)} m/s |{' '}
              {new Date(b.burn_time).toUTCString().slice(17, 25)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
