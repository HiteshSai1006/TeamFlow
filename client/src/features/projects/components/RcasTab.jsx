import React, { useState, useEffect } from 'react';
import { Plus, Eye, User, FileText, CheckCircle, ShieldAlert, Download, AlertTriangle } from 'lucide-react';
import RcaDetailModal from './RcaDetailModal.jsx';

export default function RcasTab({ project, role }) {
  const [rcas, setRcas] = useState([]);
  const [myPendingReviews, setMyPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal states
  const [activeRcaId, setActiveRcaId] = useState(null);

  // CSV Export State
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Create Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState('MEDIUM');

  const projectArchived = project?.status === 'ARCHIVED';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch RCAs
      const rcaRes = await fetch(`/api/projects/${project.id}/rcas`, { credentials: 'include' });
      const rcaData = await rcaRes.json();
      if (!rcaRes.ok) throw new Error(rcaData.message || 'Failed to fetch RCAs.');
      setRcas(rcaData.rcas || []);

      // 2. Fetch My Pending Reviews
      const reviewRes = await fetch(`/api/reviews/my-pending`, { credentials: 'include' });
      const reviewData = await reviewRes.json();
      if (reviewRes.ok) {
        setMyPendingReviews(reviewData.reviews || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [project.id]);

  const handleCreateRca = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Title is required.');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/rcas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, severity: newSeverity }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create RCA.');

      setNewTitle('');
      setNewSeverity('MEDIUM');
      setShowCreateForm(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const url = `/api/projects/${project.id}/rcas/export`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Export failed.');
      }

      const disposition = res.headers.get('content-disposition');
      let filename = `project-${project.id}-rcas-${new Date().toISOString().replace(/[:.]/g, '')}.csv`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f59e0b';
      case 'MEDIUM': return '#3b82f6';
      default: return '#10b981';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CLOSED': return 'var(--text-muted)';
      case 'APPROVED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      case 'UNDER_REVIEW': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const canCreate = (role === 'MANAGER' || role === 'MEMBER') && !projectArchived;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: 'var(--color-accent)' }} /> Root Cause Analyses (RCAs)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Document, review, and finalize incident investigations and preventive actions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '8px 16px',
              cursor: exporting ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          {canCreate && !showCreateForm && (
            <button onClick={() => setShowCreateForm(true)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Create RCA
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          color: 'var(--color-danger)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={14} />
          <span>{exportError}</span>
        </div>
      )}

      {/* Pending Reviews Section */}
      {myPendingReviews.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.03)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <CheckCircle size={16} /> Your Pending Reviews ({myPendingReviews.length})
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {myPendingReviews.map(r => (
              <div
                key={r.id}
                onClick={() => setActiveRcaId(r.rcaId)}
                className="glass-panel"
                style={{
                  padding: '15px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.01)',
                  transition: 'transform 0.2s, background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{r.rca.title}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Project: {r.rca.project.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Round {r.round}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 600 }}>Review Now &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create RCA Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateRca} className="glass-panel" style={{ padding: '25px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px' }}>New Investigation Request</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>RCA Title</label>
              <input
                type="text"
                placeholder="e.g. Memory Leak Outage"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Severity</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Create Draft
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* RCA Listing table / layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {rcas.map(rca => (
          <div
            key={rca.id}
            className="glass-panel"
            style={{
              padding: '20px',
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  background: getStatusColor(rca.status) + '20',
                  color: getStatusColor(rca.status),
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {rca.status}
                </span>

                <span style={{
                  background: getSeverityColor(rca.severity) + '20',
                  color: getSeverityColor(rca.severity),
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {rca.severity}
                </span>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Round {rca.reviewRound}
                </span>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{rca.title}</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span>Created by {rca.createdBy.name}</span>
                <span>•</span>
                <span>{new Date(rca.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <button onClick={() => setActiveRcaId(rca.id)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={14} /> View Details
            </button>
          </div>
        ))}

        {rcas.length === 0 && !loading && (
          <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
            <ShieldAlert size={24} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No investigations recorded for this project.</p>
          </div>
        )}
      </div>

      {/* RcaDetailModal Render */}
      {activeRcaId && (
        <RcaDetailModal
          projectId={project.id}
          rcaId={activeRcaId}
          role={role}
          projectArchived={projectArchived}
          onClose={() => {
            setActiveRcaId(null);
            fetchData();
          }}
          onRcaUpdated={() => {
            fetchData();
          }}
        />
      )}

    </div>
  );
}
