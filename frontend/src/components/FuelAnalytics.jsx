import { useMemo } from 'react';

// Tsiolkovsky Rocket Equation
const DRY_MASS = 500; // kg, matches backend physics constants
const ISP = 300; // specific impulse (s)
const G0 = 9.80665; // m/s^2
const AVG_BURN_DV = 15; // m/s average evasion burn

export default function FuelAnalytics({ satellites, maneuverLog }) {
  const analytics = useMemo(() => {
    return satellites.map(sat => {
      // Calculate Collisions Avoided from log summary (we'll count EVASION burns)
      const evasions = maneuverLog.filter(m => m.satellite_id === sat.id && m.type === 'EVASION').length;
      
      const currentFuelKg = Math.max(0, sat.fuel_kg || 0);
      const m0 = sat.mass_kg || (DRY_MASS + currentFuelKg);
      const mf = Math.max(DRY_MASS, m0 - currentFuelKg);
      let dv_remaining = 0;
      let maneuvers_left = 0;
      
      if (m0 > mf && currentFuelKg > 0) {
        dv_remaining = ISP * G0 * Math.log(m0 / mf);
        maneuvers_left = Math.floor(dv_remaining / AVG_BURN_DV);
      }
      
      return {
        ...sat,
        evasions,
        dv_remaining,
        maneuvers_left,
        // Evasion efficiency (fuel burned vs collisions avoided). Lower ratio is better.
        // We add 1 to evasions to avoid infinity/division-by-zero bias for satellites with few tasks.
        efficiency_score: (sat.fuel_kg) / (evasions + 1)
      };
    }).sort((a, b) => a.efficiency_score - b.efficiency_score);
  }, [satellites, maneuverLog]);

  const topEfficient = [...analytics].slice(0, 3);
  const leastEfficient = [...analytics].reverse().slice(0, 3);

  const maxFuel = Math.max(...analytics.map(a => a.fuel_kg), 1);
  const maxEvasions = Math.max(...analytics.map(a => a.evasions), 1);

  return (
    <div className="fuel-analytics" style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%', overflowY: 'auto', padding: '10px' }}>
      
      {/* Tsiolkovsky Estimator */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>🚀 Tsiolkovsky Δv Budget</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontFamily: 'var(--font-mono)' }}>
          <span>Avg Δv Range: {(analytics.reduce((s, a) => s + a.dv_remaining, 0) / (analytics.length || 1)).toFixed(1)} m/s</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{Math.floor(analytics.reduce((s, a) => s + a.maneuvers_left, 0) / (analytics.length || 1))} fleet evasions left</span>
        </div>
      </div>

      {/* Line Plot */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px', color: 'var(--text-secondary)' }}>Trend: Fuel Remaining vs Collisions Avoided</div>
        <div style={{ position: 'relative', flex: 1, borderLeft: '2px solid rgba(255,255,255,0.1)', borderBottom: '2px solid rgba(255,255,255,0.1)', margin: '5px 5px 20px 25px' }}>
          {/* Axis Labels */}
          <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>Avoided (Count)</div>
          <div style={{ position: 'absolute', top: '50%', left: '-30px', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '12px', color: 'var(--text-muted)' }}>Fuel (kg)</div>
          
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}>
            <polyline 
              fill="none" 
              stroke="rgba(56, 189, 248, 0.4)" 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
              points={
                [...analytics].sort((a,b) => (a.evasions - b.evasions) || (b.fuel_kg - a.fuel_kg)).map(sat => {
                  const x = (sat.evasions / (maxEvasions || 1)) * 95;
                  const y = 100 - ((sat.fuel_kg / maxFuel) * 95);
                  return `${x},${y}`;
                }).join(' ')
              }
            />
          </svg>

          {/* Points */}
          {[...analytics].map(sat => {
            const left = `${(sat.evasions / (maxEvasions || 1)) * 95}%`;
            const bottom = `${(sat.fuel_kg / maxFuel) * 95}%`;
            const color = sat.fuel_fraction < 0.2 ? '#ef4444' : '#38bdf8';
            return (
              <div 
                key={sat.id} 
                style={{
                  position: 'absolute', left, bottom, width: '10px', height: '10px', borderRadius: '50%',
                  background: color, transform: 'translate(-50%, 50%)',
                  boxShadow: `0 0 8px ${color}`, cursor: 'pointer', transition: 'all 0.2s', zIndex: 1
                }} 
                title={`${sat.id}\nFuel: ${sat.fuel_kg.toFixed(1)}kg\nAvoids: ${sat.evasions}\nΔv: ${sat.dv_remaining.toFixed(1)}m/s`}
              />
            );
          })}
        </div>
      </div>

      {/* Leaderboard grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div style={{ background: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '16px', color: '#4ade80', marginBottom: '8px', fontWeight: 'bold' }}>🏆 Most Efficient</div>
          {topEfficient.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
              <span>{i+1}. {s.id.split('-').pop()}</span>
              <span>{s.evasions} av | {s.fuel_kg.toFixed(1)}kg</span>
            </div>
          ))}
        </div>
        
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '16px', color: '#ef4444', marginBottom: '8px', fontWeight: 'bold' }}>⚠️ Least Efficient</div>
          {leastEfficient.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
              <span>{i+1}. {s.id.split('-').pop()}</span>
              <span>{s.evasions} av | {s.fuel_kg.toFixed(1)}kg</span>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  )
}
