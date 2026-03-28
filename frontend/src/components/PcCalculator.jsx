

// Simplified Pc calculation based on miss distance
// P_c = exp( - (miss_distance^2) / (2 * sigma^2) )
// Assumed combined covariance positional error: 5 km
function computePc(missDistanceKm) {
  const sigma = 5.0;
  return Math.exp(-Math.pow(missDistanceKm, 2) / (2 * Math.pow(sigma, 2)));
}

export default function PcCalculator({ warnings, timestamp }) {
  if (!warnings || warnings.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--status-nominal)', fontSize: '16px', fontWeight: 'bold' }}>
        ✓ No active conjunctions in fleet.
      </div>
    );
  }

  // Sort warnings by Pc (descending) so most critical are at top
  const sortedWarnings = [...warnings].sort((a, b) => computePc(b.miss_distance_km) - computePc(a.miss_distance_km));

  return (
    <div className="pc-calculator" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px', overflowY: 'auto', height: '100%' }}>
      {sortedWarnings.map((w, idx) => {
        const pc = computePc(w.miss_distance_km);
        const remainingSeconds = w.tca_seconds || 0;
        
        let tcaText = "TCA <= 0s";
        if (remainingSeconds > 0) {
           const h = Math.floor(remainingSeconds / 3600);
           const m = Math.floor((remainingSeconds % 3600) / 60);
           const s = Math.floor(remainingSeconds % 60);
           tcaText = `TCA IN ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        
        let pcColor = '#4ade80';
        let pcBg = 'rgba(74, 222, 128, 0.05)';
        if (pc > 0.01) { pcColor = '#facc15'; pcBg = 'rgba(250, 204, 21, 0.08)'; }
        if (pc > 0.1) { pcColor = '#f97316'; pcBg = 'rgba(249, 115, 22, 0.1)'; }
        if (pc > 0.5) { pcColor = '#ef4444'; pcBg = 'rgba(239, 68, 68, 0.15)'; }

        // Pulse if < 5 mins and high Pc
        const isUrgent = remainingSeconds < 300 && remainingSeconds > 0 && pc > 0.01;

        return (
          <div key={`${w.satellite_id}-${w.debris_id}-${idx}`} style={{
            background: pcBg, 
            border: `1px solid ${pcColor}`,
            borderLeft: `4px solid ${pcColor}`,
            borderRadius: '6px',
            padding: '12px',
            animation: isUrgent ? 'pulse 1s infinite' : 'none',
            boxShadow: isUrgent ? `0 0 15px ${pcColor}66` : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
                {w.satellite_id.split('-').pop()} ⚡ {w.debris_id}
              </span>
              <span style={{ 
                color: isUrgent ? '#ef4444' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                fontSize: '15px',
                background: isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>{tcaText}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
              <span>Miss: <strong style={{ color: pcColor }}>{w.miss_distance_km.toFixed(3)} km</strong></span>
              <span>Pc: <strong style={{ color: pcColor }}>{(pc * 100).toFixed(2)}%</strong></span>
            </div>
            
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
               <div style={{ width: `${Math.min(pc * 100, 100)}%`, background: pcColor, height: '100%', transition: 'width 0.3s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
