import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, User, Activity, Shield, Database } from 'lucide-react';

export default function AppShell() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({
        status: 'OFFLINE',
        services: {
          api: { status: 'DOWN' },
          database: { status: 'DOWN', error: err.message },
        },
      });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      
      {/* Navigation Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        padding: '16px 24px',
        borderRadius: '16px',
        marginBottom: '30px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '6px',
            fontWeight: 800,
          }}>TF</span>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>TeamFlow Shell</span>
        </div>

        <button onClick={logout} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '10px' }}>
          <LogOut size={14} />
          Sign Out
        </button>
      </header>

      {/* Main Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* User profile pane */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.1)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)' }}>{user?.name}</h2>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: 'var(--color-accent)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}>
                  {user?.systemRole}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                {user?.email}
              </p>
            </div>
          </div>
        </section>

        {/* Minimal Diagnostic Pane */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ color: 'var(--color-accent)' }} />
              System Diagnostics
            </h3>
            <button 
              onClick={checkHealth} 
              disabled={healthLoading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {healthLoading ? 'Checking...' : 'Run Diagnostics'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* API Health */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} style={{ color: 'var(--text-muted)' }} />
                API Server status
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: health?.services?.api?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {health?.services?.api?.status || 'UNKNOWN'}
              </span>
            </div>

            {/* DB Health */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={14} style={{ color: 'var(--text-muted)' }} />
                PostgreSQL status
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: health?.services?.database?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {health?.services?.database?.status || 'UNKNOWN'}
                {health?.services?.database?.status === 'UP' && ` (${health.services.database.durationMs}ms)`}
              </span>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
