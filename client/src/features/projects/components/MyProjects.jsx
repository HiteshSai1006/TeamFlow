import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { LogOut, Folder, Plus, Activity, Archive, Server, Database } from 'lucide-react';
import CreateProjectModal from './CreateProjectModal.jsx';

export default function MyProjects({ onSelectProject }) {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [health, setHealth] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error('Failed to load health status:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchHealth();
    // Poll health status
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleProjectCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev]);
    setShowModal(false);
    onSelectProject(newProject.id);
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Operations Control
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Logged in as <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{user?.name}</span> ({user?.email})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            Create Project
          </button>
          <button
            onClick={logout}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main dashboard content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px' }}>
        
        {/* Left Side: Projects List */}
        <div>
          <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '20px' }}>
            My Projects ({projects.length})
          </h2>

          {loading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading project registry...</div>
          ) : projects.length === 0 ? (
            <div className="glass-panel" style={{
              padding: '60px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '15px'
            }}>
              <Folder size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '16px' }}>No Projects Active</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '350px' }}>
                You are not associated with any active projects. Start a project to manage operations.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
                style={{ marginTop: '10px' }}
              >
                Create Project
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="glass-panel"
                  style={{
                    padding: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'transform 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Folder size={18} style={{ color: 'var(--color-accent)' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{project.name}</h3>
                    </div>
                    {project.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {project.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: project.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 114, 128, 0.1)',
                      color: project.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--text-secondary)',
                      border: `1px solid ${project.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)'}`
                    }}>
                      {project.status === 'ACTIVE' ? (
                        <>
                          <Activity size={12} />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <Archive size={12} />
                          <span>Archived</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Environment Health Panel (Telemetry check) */}
        <div>
          <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '20px' }}>
            System Integrity
          </h2>
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* API Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Server size={18} style={{ color: health?.services?.api?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                <span style={{ fontSize: '14px' }}>API Server</span>
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: health?.services?.api?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {health?.services?.api?.status === 'UP' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* DB Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={18} style={{ color: health?.services?.database?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                <span style={{ fontSize: '14px' }}>Database</span>
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: health?.services?.database?.status === 'UP' ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {health?.services?.database?.status === 'UP' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {health?.uptime && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Uptime: {Math.floor(health.uptime)} seconds
              </div>
            )}
          </div>
        </div>

      </div>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
