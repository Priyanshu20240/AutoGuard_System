export default function PerformanceHUD({ performance, apiLatency }) {
  if (!performance) return null;

  return (
    <div className="performance-hud" style={{
      display: 'flex', gap: '20px', alignItems: 'center',
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      padding: '6px 20px', borderRadius: '20px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)', fontSize: '12px',
      marginLeft: 'auto', marginRight: '20px'
    }}>
      <span style={{ color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>⚡</span> WebGL+Canvas2D
      </span>
      <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
        Index: <span style={{ color: '#4ade80' }}>{performance.spatial_index}</span>
      </span>
      <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
        Engine: <span style={{ color: '#facc15' }}>{(performance.checks_per_sec).toLocaleString()} chk/s</span>
      </span>
      <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
        API Latency: <span style={{ color: apiLatency < 100 ? '#4ade80' : apiLatency < 300 ? '#facc15' : '#ef4444' }}>{apiLatency}ms</span>
      </span>
    </div>
  );
}
