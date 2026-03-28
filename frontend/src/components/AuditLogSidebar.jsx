export default function AuditLogSidebar({ isOpen, onClose, maneuverLog }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px',
      background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
      zIndex: 2000, display: 'flex', flexDirection: 'column',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.8)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
        <div>
          <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            📜 Autonomous Audit Trail
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Immutable ledger of AI decisions</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', outline: 'none' }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {maneuverLog && maneuverLog.length > 0 ? maneuverLog.slice().reverse().map((log, idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px',
            borderLeft: `4px solid ${log.type === 'EVASION' ? '#ef4444' : '#38bdf8'}`,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>{log.executed_at ? log.executed_at.split('T')[1].substring(0, 8) : 'AUTO-ACT'}</span>
              <span style={{ color: log.type === 'EVASION' ? '#ef4444' : '#38bdf8', fontWeight: 'bold' }}>[{log.type}]</span>
            </div>
            
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>{log.satellite_id}</div>
            
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
              <strong>Reasoning:</strong> {log.reason}
            </div>
            
            <div style={{ display: 'inline-block', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', color: '#facc15', fontFamily: 'var(--font-mono)' }}>
              Cost: -{parseFloat(log.fuel_consumed_kg || 0).toFixed(2)} kg fuel (Δv)
            </div>
          </div>
        )) : (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '50px', fontSize: '15px' }}>No autonomous decisions logged yet.</div>
        )}
      </div>
    </div>
  );
}
