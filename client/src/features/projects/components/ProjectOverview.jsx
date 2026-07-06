import React, { useState } from 'react';
import { Settings, Archive, RotateCcw, AlertTriangle } from 'lucide-react';

export default function ProjectOverview({ project, role, onProjectUpdated, onArchiveToggle }) {
  const isManager = role === 'MANAGER';
  const isArchived = project.status === 'ARCHIVED';

  // Form State
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Lifecycle state
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);

    if (!name.trim()) {
      setUpdateError('Project name is required.');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update project settings.');
      }

      onProjectUpdated(data.project);
      setUpdateSuccess(true);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleArchive = async () => {
    setLifecycleError(null);
    setLoadingLifecycle(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/archive`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to archive project.');
      }

      onArchiveToggle(data.project);
    } catch (err) {
      setLifecycleError(err.message);
    } finally {
      setLoadingLifecycle(false);
    }
  };

  const handleRestore = async () => {
    setLifecycleError(null);
    setLoadingLifecycle(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/restore`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to restore project.');
      }

      onArchiveToggle(data.project);
    } catch (err) {
      setLifecycleError(err.message);
    } finally {
      setLoadingLifecycle(false);
    }
  };

  return (
    <div className="overview-layout-grid">
      
      {/* Settings & Info Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Project Meta Info */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Project Specifications</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status</span>
              <span style={{
                fontWeight: 600,
                color: isArchived ? 'var(--color-danger)' : 'var(--color-success)'
              }}>
                {project.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Registered On</span>
              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Update Settings Form (MANAGER only) */}
        {isManager && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--color-accent)' }} />
              Settings
            </h3>

            {isArchived && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f59e0b',
                fontSize: '13px',
                marginBottom: '20px'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Form changes are locked while project is archived.</span>
              </div>
            )}

            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {updateError && (
                <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                  {updateError}
                </div>
              )}
              {updateSuccess && (
                <div style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                  Settings updated successfully!
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setUpdateError(null); setUpdateSuccess(false); }}
                  disabled={updating || isArchived}
                  style={{
                    padding: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setUpdateError(null); setUpdateSuccess(false); }}
                  disabled={updating || isArchived}
                  style={{
                    padding: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    height: '80px',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={updating || isArchived}
                className="btn-primary"
                style={{
                  padding: '10px',
                  justifyContent: 'center',
                  opacity: (updating || isArchived) ? 0.7 : 1,
                  cursor: (updating || isArchived) ? 'not-allowed' : 'pointer'
                }}
              >
                {updating ? 'Saving changes...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Lifecycle / Archiving Card */}
      {isManager && (
        <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '15px' }}>Danger Zone</h3>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Archiving locks all project details, membership mutations, and operation files. The project can be restored back to active state at any time.
          </p>

          {lifecycleError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '15px' }}>
              {lifecycleError}
            </div>
          )}

          {isArchived ? (
            <button
              onClick={handleRestore}
              disabled={loadingLifecycle}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                color: 'var(--color-success)',
                cursor: loadingLifecycle ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <RotateCcw size={16} />
              {loadingLifecycle ? 'Restoring...' : 'Restore Operations'}
            </button>
          ) : (
            <button
              onClick={handleArchive}
              disabled={loadingLifecycle}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: 'var(--color-danger)',
                cursor: loadingLifecycle ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <Archive size={16} />
              {loadingLifecycle ? 'Archiving...' : 'Archive Project'}
            </button>
          )}
        </div>
      )}

    </div>
  );
}
