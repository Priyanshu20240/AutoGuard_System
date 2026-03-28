import { useRef, useEffect, useCallback } from 'react'

/**
 * Conjunction "Bullseye" Plot — Polar chart showing debris approaching a selected satellite.
 * Center = selected satellite, radial distance = TCA, angle = approach vector.
 * Color-coded by risk: Green (safe), Yellow (<5km), Red (<1km), Critical pulsing.
 */

export default function BullseyePlot({ satellite, warnings, allWarnings }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) / 2 - 30

    // Background
    ctx.fillStyle = '#070b14'
    ctx.fillRect(0, 0, w, h)

    // Concentric rings (risk zones)
    const rings = [
      { radius: 0.15, label: '100m', color: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' },
      { radius: 0.3, label: '1 km', color: 'rgba(249, 115, 22, 0.08)', borderColor: 'rgba(249, 115, 22, 0.3)' },
      { radius: 0.6, label: '5 km', color: 'rgba(250, 204, 21, 0.05)', borderColor: 'rgba(250, 204, 21, 0.2)' },
      { radius: 1.0, label: '10 km', color: 'rgba(74, 222, 128, 0.03)', borderColor: 'rgba(74, 222, 128, 0.15)' },
    ]

    // Fill zones from outside in
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      ctx.fillStyle = r.color
      ctx.beginPath()
      ctx.arc(cx, cy, maxR * r.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw ring borders and labels
    for (const r of rings) {
      const rad = maxR * r.radius
      ctx.strokeStyle = r.borderColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2)
      ctx.stroke()

      // Label
      ctx.fillStyle = r.borderColor.replace(/0\.\d+\)/, '1.0)') // bright text
      ctx.font = 'bold 12px JetBrains Mono'
      ctx.textAlign = 'center'
      ctx.fillText(r.label, cx, cy - rad + 14)
    }

    // Crosshair lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)'
    ctx.lineWidth = 0.5
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle * Math.PI) / 180
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad))
      ctx.stroke()
    }

    // Direction labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.font = '8px Inter'
    ctx.textAlign = 'center'
    ctx.fillText('Prograde', cx, cy - maxR - 5)
    ctx.fillText('Retrograde', cx, cy + maxR + 12)
    ctx.textAlign = 'left'
    ctx.fillText('Normal', cx + maxR + 5, cy + 4)
    ctx.textAlign = 'right'
    ctx.fillText('Anti-N', cx - maxR - 5, cy + 4)

    // Center point (satellite)
    if (satellite) {
      // Glow
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15)
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)')
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()

      // Satellite label
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)'
      ctx.font = 'bold 10px JetBrains Mono'
      ctx.textAlign = 'center'
      ctx.fillText(satellite.id, cx, cy + 22)
    }

    // Plot debris threats
    const now = Date.now()
    if (warnings && warnings.length > 0) {
      for (const warn of warnings) {
        // Map miss distance to radial position (closer = inner ring)
        let normDist = Math.min(warn.miss_distance_km / 10.0, 1.0)
        const r = normDist * maxR

        // Angle: use a hash of debris ID for consistent placement
        let hash = 0
        for (let i = 0; i < warn.debris_id.length; i++) {
          hash = ((hash << 5) - hash + warn.debris_id.charCodeAt(i)) | 0
        }
        const angle = (Math.abs(hash) % 360) * Math.PI / 180

        const dx = cx + r * Math.cos(angle)
        const dy = cy + r * Math.sin(angle)

        // Color by risk
        let color, glowColor, size
        switch (warn.risk_level) {
          case 'CRITICAL':
            color = '#ef4444'
            glowColor = 'rgba(239, 68, 68, 0.6)'
            size = 6 + 2 * Math.sin(now / 200)  // Pulsing
            break
          case 'RED':
            color = '#f97316'
            glowColor = 'rgba(249, 115, 22, 0.4)'
            size = 5
            break
          case 'YELLOW':
            color = '#facc15'
            glowColor = 'rgba(250, 204, 21, 0.3)'
            size = 4
            break
          default:
            color = '#4ade80'
            glowColor = 'rgba(74, 222, 128, 0.2)'
            size = 3
        }

        // Glow effect
        ctx.shadowColor = glowColor
        ctx.shadowBlur = 10

        // Draw debris marker
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(dx, dy, Math.abs(size), 0, Math.PI * 2)
        ctx.fill()

        // Approach line
        ctx.strokeStyle = color
        ctx.lineWidth = 0.5
        ctx.globalAlpha = 0.3
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(dx, dy)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1.0
        ctx.shadowBlur = 0

        // Detailed Label Block
        ctx.textAlign = 'left';
        
        // Debris ID
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 13px JetBrains Mono';
        ctx.fillText(`[${warn.debris_id}]`, dx + 12, dy - 6);
        
        // Miss Distance
        ctx.font = '11px Inter';
        ctx.fillStyle = color;
        ctx.fillText(`Miss: ${warn.miss_distance_km.toFixed(2)} km`, dx + 12, dy + 8);
        
        // TCA
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        if (warn.tca_seconds !== undefined) {
           const tcaVal = Math.max(0, warn.tca_seconds);
           const mins = Math.floor(tcaVal / 60);
           const secs = Math.floor(tcaVal % 60);
           ctx.fillText(`TCA: ${mins}m ${secs}s`, dx + 12, dy + 20);
        }
        
        // Rel Vel
        if (warn.relative_velocity_kms !== undefined) {
           ctx.fillText(`Rel.V: ${warn.relative_velocity_kms.toFixed(1)} km/s`, dx + 12, dy + 32);
        }
      }
    }

    // No warnings message
    if (!warnings || warnings.length === 0) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.4)'
      ctx.font = '16px Inter'
      ctx.textAlign = 'center'
      ctx.fillText('No active threats for selected satellite', cx, cy + maxR + 25)
    }

    // Global CDM summary in corner
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = 'bold 14px Inter'
    ctx.textAlign = 'left'
    const critCount = (allWarnings || []).filter(w => w.risk_level === 'CRITICAL').length
    const redCount = (allWarnings || []).filter(w => w.risk_level === 'RED').length
    const yelCount = (allWarnings || []).filter(w => w.risk_level === 'YELLOW').length
    ctx.fillText(`Fleet Summary: 🔴 ${critCount} CRIT  |  🟠 ${redCount} HIGH  |  🟡 ${yelCount} WARN`, 15, h - 15)
  }, [satellite, warnings, allWarnings])

  useEffect(() => {
    draw()
    // Animate pulsing for critical threats
    let animFrame
    const animate = () => {
      draw()
      animFrame = requestAnimationFrame(animate)
    }
    if (warnings?.some(w => w.risk_level === 'CRITICAL')) {
      animFrame = requestAnimationFrame(animate)
    }
    const observer = new ResizeObserver(draw)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame)
      observer.disconnect()
    }
  }, [draw, warnings])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} className="bullseye-canvas" />
    </div>
  )
}
