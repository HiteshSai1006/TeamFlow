import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu, 
  Terminal, 
  Clock, 
  HardDrive 
} from 'lucide-react';

export default function HealthStatus() {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The API proxy routes this to http://localhost:5000/api/health
      const response = await fetch('/api/health');
      
      // Even if response is not ok (e.g. 503), try to parse the status payload
      const data = await response.json().catch(() => null);

      if (data) {
        setHealthData(data);
      } else {
        // Fallback for non-JSON or missing bodies
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Fetch health failed:', err);
      setError(err.message || 'API Server connection refused');
      setHealthData({
        status: 'OFFLINE',
        timestamp: new Date().toISOString(),
        uptime: 0,
        services: {
          api: { status: 'DOWN', version: 'unknown', uptime: 0 },
          database: { status: 'DOWN', durationMs: 0, error: err.message || 'Server Unreachable' }
        }
      });
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  // Fetch immediately on mount
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchHealth();
    }, 10000); // refresh every 10 seconds

    return () => clearInterval(timer);
  }, [autoRefresh, fetchHealth]);

  // Helper formatting values
  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
  };

  const getSystemStatusStyles = () => {
    if (!healthData) return { card: '', dot: 'danger', label: 'Offline', text: '#ef4444' };
    switch (healthData.status) {
      case 'UP':
        return { card: 'status-card-up', dot: 'success', label: 'Healthy', text: 'var(--color-success)' };
      case 'DEGRADED':
        return { card: 'status-card-degraded', dot: 'warning', label: 'Degraded', text: 'var(--color-warning)' };
      default:
        return { card: 'status-card-down', dot: 'danger', label: 'Offline', text: 'var(--color-danger)' };
    }
  };

  const statusMeta = getSystemStatusStyles();

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      
      {/* Header operations bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              fontSize: '18px'
            }}>TF</div>
            <h1 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>TeamFlow</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
            Operations & Environment Control Center
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '13px', 
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }} 
            />
            Auto-refresh (10s)
          </label>
          
          <button 
            onClick={fetchHealth} 
            disabled={loading}
            className="btn-primary"
          >
            <RefreshCw className={loading ? 'spinner' : ''} size={16} />
            Refresh Status
          </button>
        </div>
      </header>

      {/* Main Health Monitor Card */}
      <section className={`glass-panel ${statusMeta.card}`} style={{
        padding: '30px',
        marginBottom: '30px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow effect matching status */}
        <div style={{
          position: 'absolute',
          top: '-150px',
          right: '-150px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${healthData?.status === 'UP' ? '16,185,129' : healthData?.status === 'DEGRADED' ? '245,158,11' : '239,68,68'}, 0.08) 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ 
              textTransform: 'uppercase', 
              fontSize: '11px', 
              fontWeight: 700, 
              color: 'var(--text-muted)',
              letterSpacing: '0.1em'
            }}>Global Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
              <div className="status-indicator">
                <span className={`pulse-dot ${statusMeta.dot}`} />
              </div>
              <h2 style={{ fontSize: '36px', color: statusMeta.text, fontFamily: 'var(--font-display)' }}>
                System {statusMeta.label}
              </h2>
            </div>
          </div>
          
          <div style={{ textAlign: 'right', minWidth: '150px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last telemetry check</span>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
            </p>
          </div>
        </div>

        {healthData && healthData.status !== 'UP' && (
          <div style={{ 
            marginTop: '25px', 
            background: 'rgba(239, 68, 68, 0.06)', 
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--color-danger)',
            fontSize: '14px'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>System Degraded:</strong> {healthData.services.database.error || 'The backend API or database services are currently unresponsive. Check service connection status below.'}
            </span>
          </div>
        )}
      </section>

      {/* Services breakdown grids */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px',
        marginBottom: '40px'
      }}>
        
        {/* API Server status card */}
        <article className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                background: 'rgba(139, 92, 246, 0.1)', 
                color: 'var(--color-accent)', 
                padding: '8px', 
                borderRadius: '10px' 
              }}>
                <Cpu size={20} />
              </div>
              <h3 style={{ fontSize: '18px' }}>API Server</h3>
            </div>
            
            <div className="status-indicator">
              <span className={`pulse-dot ${healthData?.services.api.status === 'UP' ? 'success' : 'danger'}`} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {healthData?.services.api.status === 'UP' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} /> Path
              </span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>GET /api/health</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Uptime
              </span>
              <span style={{ color: 'var(--text-primary)' }}>
                {healthData ? formatUptime(healthData.services.api.uptime) : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} /> Version
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {healthData?.services.api.version || 'unknown'}
              </span>
            </div>
          </div>
        </article>

        {/* Database status card */}
        <article className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                color: 'var(--color-success)', 
                padding: '8px', 
                borderRadius: '10px' 
              }}>
                <Database size={20} />
              </div>
              <h3 style={{ fontSize: '18px' }}>PostgreSQL</h3>
            </div>
            
            <div className="status-indicator">
              <span className={`pulse-dot ${healthData?.services.database.status === 'UP' ? 'success' : 'danger'}`} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {healthData?.services.database.status === 'UP' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={14} /> Engine
              </span>
              <span style={{ color: 'var(--text-primary)' }}>Prisma Client</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} /> Latency
              </span>
              <span style={{ color: 'var(--text-primary)' }}>
                {healthData?.services.database.status === 'UP' 
                  ? `${healthData.services.database.durationMs}ms` 
                  : 'unreachable'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> Diagnostics
              </span>
              <span 
                title={healthData?.services.database.error || 'Handshake valid'} 
                style={{ 
                  color: healthData?.services.database.status === 'UP' ? 'var(--text-muted)' : 'var(--color-danger)',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: healthData?.services.database.status === 'UP' ? 'inherit' : 'monospace',
                  fontSize: healthData?.services.database.status === 'UP' ? '14px' : '11px'
                }}
              >
                {healthData?.services.database.status === 'UP' ? 'Handshake valid' : healthData?.services.database.error || 'Connection Timeout'}
              </span>
            </div>
          </div>
        </article>

      </section>

      {/* Raw Payload Section */}
      <section className="glass-panel" style={{ padding: '20px' }}>
        <button 
          onClick={() => setShowRaw(!showRaw)}
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
            Show Raw JSON Telemetry Response
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {showRaw ? 'COLLAPSE' : 'EXPAND'}
          </span>
        </button>

        {showRaw && (
          <pre style={{
            marginTop: '15px',
            background: 'rgba(0,0,0,0.4)',
            padding: '16px',
            borderRadius: '10px',
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            border: '1px solid rgba(255,255,255,0.02)',
            lineHeight: 1.5
          }}>
            {JSON.stringify(healthData || { error: 'No data retrieved' }, null, 2)}
          </pre>
        )}
      </section>

    </div>
  );
}
