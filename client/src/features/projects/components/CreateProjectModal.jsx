import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

export default function CreateProjectModal({ onClose, onProjectCreated }) {
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [submittingProject, setSubmittingProject] = useState(false);
  const [projectError, setProjectError] = useState(null);

  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    setProjectError(null);

    if (!projectName.trim()) {
      setProjectError('Project name is required.');
      return;
    }

    setSubmittingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create project.');
      }

      onProjectCreated(data.project);
    } catch (err) {
      setProjectError(err.message);
    } finally {
      setSubmittingProject(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '30px',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{
            fontSize: '20px',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FolderPlus size={22} style={{ color: 'var(--color-accent)' }} />
            New Operations Project
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Project Form */}
        <form onSubmit={handleCreateProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {projectError && (
            <div style={{
              color: 'var(--color-danger)',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '12px'
            }}>
              {projectError}
            </div>
          )}

          {/* Project Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => { setProjectName(e.target.value); setProjectError(null); }}
              placeholder="e.g. Q3 Roadmap, Server Redesign"
              required
              disabled={submittingProject}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Project Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Description (Optional)
            </label>
            <textarea
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="Summarize project objectives..."
              disabled={submittingProject}
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '15px',
            marginTop: '10px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submittingProject}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingProject}
              className="btn-primary"
              style={{
                padding: '12px 24px',
                opacity: submittingProject ? 0.7 : 1,
                cursor: submittingProject ? 'not-allowed' : 'pointer'
              }}
            >
              {submittingProject ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
