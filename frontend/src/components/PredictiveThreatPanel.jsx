const RISK_COLORS = {
  CRITICAL: '#ef4444',
  RED: '#f97316',
  YELLOW: '#facc15',
  GREEN: '#4ade80',
}

const RISK_PRIORITY = {
  CRITICAL: 0,
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
}

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatMissDistance(km) {
  if (typeof km !== 'number') return '--'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(2)} km`
}

function formatUtcShort(timestamp) {
  if (!timestamp) return 'Pending'

  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }) + ' UTC'
}

function formatRelativeAge(timestamp, fallbackTimestamp) {
  const reference = timestamp || fallbackTimestamp
  if (!reference) return 'Pending'

  const ageMs = Date.now() - new Date(reference).getTime()
  if (!Number.isFinite(ageMs)) return 'Pending'

  const minutes = Math.max(0, Math.round(ageMs / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`
}

function sortWarnings(warnings) {
  return [...warnings].sort((a, b) => {
    const riskDelta = (RISK_PRIORITY[a.risk_level] ?? 99) - (RISK_PRIORITY[b.risk_level] ?? 99)
    if (riskDelta !== 0) return riskDelta
    return (a.tca_seconds ?? Number.MAX_SAFE_INTEGER) - (b.tca_seconds ?? Number.MAX_SAFE_INTEGER)
  })
}

function buildSummaryMetrics(warnings, predictiveMeta, fallbackTimestamp) {
  const horizonHours = Math.max(1, Math.round((predictiveMeta?.horizon_seconds || 0) / 3600) || 24)
  const nextThreat = warnings[0]
  const status = predictiveMeta?.status || (warnings.length > 0 ? 'ACTIVE' : 'READY')

  return [
    {
      label: 'Lookahead',
      value: `${horizonHours}h`,
      tone: 'blue',
      hint: 'Cached future scan',
    },
    {
      label: 'Cache',
      value: status,
      tone: warnings.length > 0 ? 'amber' : 'green',
      hint: formatRelativeAge(predictiveMeta?.updated_at, fallbackTimestamp),
    },
    {
      label: 'Compute',
      value: `${predictiveMeta?.compute_ms ?? 0} ms`,
      tone: 'blue',
      hint: 'Prediction refresh time',
    },
    {
      label: 'Next TCA',
      value: nextThreat ? formatSeconds(nextThreat.tca_seconds) : 'Clear',
      tone: nextThreat ? 'red' : 'green',
      hint: nextThreat ? `${nextThreat.satellite_id}` : 'No forecasted conjunctions',
    },
  ]
}

export default function PredictiveThreatPanel({
  warnings = [],
  predictiveMeta = {},
  timestamp,
}) {
  const sortedWarnings = sortWarnings(warnings)
  const primaryThreat = sortedWarnings[0]
  const additionalThreats = sortedWarnings.slice(1, 7)
  const metrics = buildSummaryMetrics(sortedWarnings, predictiveMeta, timestamp)

  return (
    <div className="predictive-threat-panel">
      <div className="predictive-threat-panel__summary">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`predictive-threat-panel__metric predictive-threat-panel__metric--${metric.tone}`}
          >
            <span className="predictive-threat-panel__metric-label">{metric.label}</span>
            <strong className="predictive-threat-panel__metric-value">{metric.value}</strong>
            <span className="predictive-threat-panel__metric-hint">{metric.hint}</span>
          </div>
        ))}
      </div>

      {primaryThreat ? (
        <div className="predictive-threat-panel__hero">
          <div className="predictive-threat-panel__hero-header">
            <div>
              <div className="predictive-threat-panel__eyebrow">Primary forecasted conjunction</div>
              <div className="predictive-threat-panel__hero-title">
                {primaryThreat.satellite_id} vs {primaryThreat.debris_id}
              </div>
            </div>
            <span
              className="predictive-threat-panel__risk"
              style={{
                color: RISK_COLORS[primaryThreat.risk_level] || 'var(--accent-blue)',
                borderColor: `${RISK_COLORS[primaryThreat.risk_level] || '#38bdf8'}66`,
                background: `${RISK_COLORS[primaryThreat.risk_level] || '#38bdf8'}18`,
              }}
            >
              {primaryThreat.risk_level}
            </span>
          </div>

          <div className="predictive-threat-panel__hero-grid">
            <div>
              <span className="predictive-threat-panel__label">Time to closest approach</span>
              <strong>{formatSeconds(primaryThreat.tca_seconds)}</strong>
            </div>
            <div>
              <span className="predictive-threat-panel__label">Predicted miss distance</span>
              <strong>{formatMissDistance(primaryThreat.miss_distance_km)}</strong>
            </div>
            <div>
              <span className="predictive-threat-panel__label">Recommended burn window</span>
              <strong>{formatSeconds(primaryThreat.optimal_maneuver_in_seconds)}</strong>
            </div>
            <div>
              <span className="predictive-threat-panel__label">Relative velocity</span>
              <strong>{primaryThreat.relative_velocity_kms?.toFixed(2) || '--'} km/s</strong>
            </div>
          </div>

          <div className="predictive-threat-panel__hero-footer">
            <span>Updated {formatUtcShort(predictiveMeta?.updated_at || timestamp)}</span>
            <span>
              Burn lead {formatSeconds(primaryThreat.recommended_lead_seconds || primaryThreat.optimal_maneuver_in_seconds)}
            </span>
          </div>
        </div>
      ) : (
        <div className="predictive-threat-panel__empty">
          <div className="predictive-threat-panel__empty-title">No conjunctions predicted in the active lookahead window.</div>
          <div className="predictive-threat-panel__empty-text">
            The forecast cache is ready and will surface the earliest maneuver window as soon as a future threat enters the 24 hour horizon.
          </div>
        </div>
      )}

      {additionalThreats.length > 0 && (
        <div className="predictive-threat-panel__queue">
          <div className="predictive-threat-panel__queue-label">Additional queued threats</div>
          <div className="predictive-threat-panel__queue-list">
            {additionalThreats.map((warning) => {
              const riskColor = RISK_COLORS[warning.risk_level] || '#38bdf8'

              return (
                <div
                  key={`${warning.satellite_id}-${warning.debris_id}`}
                  className="predictive-threat-panel__queue-item"
                >
                  <div className="predictive-threat-panel__queue-topline">
                    <span className="predictive-threat-panel__queue-sat">{warning.satellite_id}</span>
                    <span
                      className="predictive-threat-panel__queue-risk"
                      style={{ color: riskColor }}
                    >
                      {warning.risk_level}
                    </span>
                  </div>
                  <div className="predictive-threat-panel__queue-meta">
                    TCA {formatSeconds(warning.tca_seconds)}
                  </div>
                  <div className="predictive-threat-panel__queue-meta">
                    Miss {formatMissDistance(warning.miss_distance_km)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
