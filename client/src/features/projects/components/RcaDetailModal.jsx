import React, { useState, useEffect } from 'react';
import { X, Save, Check, RotateCcw, AlertTriangle, User, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext.jsx';

export default function RcaDetailModal({ projectId, rcaId, role, onClose, onRcaUpdated, projectArchived }) {
  const { user: currentUser } = useAuth();
  const [rca, setRca] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);

  // Form states for sections
  const [sectionTimeline, setSectionTimeline] = useState('');
  const [sectionFactors, setSectionFactors] = useState('');
  const [sectionCorrective, setSectionCorrective] = useState('');
  const [sectionPreventive, setSectionPreventive] = useState('');

  // Form states for metadata (DRAFT editing)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [metaEditMode, setMetaEditMode] = useState(false);

  // Decision state
  const [decision, setDecision] = useState('APPROVED');
  const [decisionComment, setDecisionComment] = useState('');

  const fetchRcaDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch RCA details.');
      }
      setRca(data.rca);
      setTitle(data.rca.title);
      setDescription(data.rca.description || '');
      setSeverity(data.rca.severity);

      // Map sections
      const timelineSec = data.rca.sections.find(s => s.type === 'TIMELINE');
      const factorsSec = data.rca.sections.find(s => s.type === 'CONTRIBUTING_FACTORS');
      const correctiveSec = data.rca.sections.find(s => s.type === 'CORRECTIVE_ACTIONS');
      const preventiveSec = data.rca.sections.find(s => s.type === 'PREVENTIVE_MEASURES');

      setSectionTimeline(timelineSec ? timelineSec.content : '');
      setSectionFactors(factorsSec ? factorsSec.content : '');
      setSectionCorrective(correctiveSec ? correctiveSec.content : '');
      setSectionPreventive(preventiveSec ? preventiveSec.content : '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setProjectMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to load project members:', err);
    }
  };

  useEffect(() => {
    fetchRcaDetails();
    fetchProjectMembers();
  }, [projectId, rcaId]);

  const handlePatchMetadata = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, severity }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update metadata.');
      setRca(data.rca);
      setMetaEditMode(false);
      if (onRcaUpdated) onRcaUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveSection = async (type, content) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}/sections/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save section.');
      alert('Section updated successfully.');
      fetchRcaDetails();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitForReview = async () => {
    if (selectedReviewers.length === 0) {
      alert('At least one reviewer is required.');
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerIds: selectedReviewers.map(Number) }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit RCA.');
      setRca(data.rca);
      setSelectedReviewers([]);
      if (onRcaUpdated) onRcaUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDecision = async (reviewId) => {
    if (!decisionComment || !decisionComment.trim()) {
      alert('Comment is mandatory for decision submission.');
      return;
    }
    try {
      const res = await fetch(`/api/reviews/${reviewId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: decisionComment }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit decision.');
      setDecisionComment('');
      fetchRcaDetails();
      if (onRcaUpdated) onRcaUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReopen = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}/reopen`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reopen RCA.');
      setRca(data.rca);
      if (onRcaUpdated) onRcaUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClose = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/rcas/${rcaId}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to close RCA.');
      setRca(data.rca);
      if (onRcaUpdated) onRcaUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  // Check mutation access (allowed only in DRAFT, and must be creator or MANAGER)
  const isCreator = rca?.createdById === currentUser?.id;
  const isManager = role === 'MANAGER';
  const canMutate = rca?.status === 'DRAFT' && (isCreator || isManager) && !projectArchived;

  // Filter reviewers from members
  const reviewerMembers = projectMembers.filter(m => m.role === 'REVIEWER');

  // Find active reviewer's pending review record for current round
  const myPendingReview = rca?.reviews.find(
    r => r.reviewerId === currentUser?.id && r.decision === 'PENDING' && r.round === rca.reviewRound
  );

  if (loading) {
    return (
      <div className="modal-backdrop">
        <p style={{ color: '#fff' }}>Loading RCA details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-backdrop">
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-card)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button onClick={onClose} style={{ marginTop: '15px', padding: '8px 16px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '30px', position: 'relative' }}>
        
        {/* Close Button */}
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        {/* Header Section */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              background: rca.status === 'CLOSED' ? 'rgba(255,255,255,0.1)' :
                          rca.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' :
                          rca.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: rca.status === 'CLOSED' ? 'var(--text-muted)' :
                     rca.status === 'APPROVED' ? '#10b981' :
                     rca.status === 'REJECTED' ? '#ef4444' : '#3b82f6',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {rca.status}
            </span>

            <span style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              Severity: {rca.severity}
            </span>

            <span style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              Round: {rca.reviewRound}
            </span>
          </div>

          {metaEditMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>RCA Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Brief Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handlePatchMetadata} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  <Save size={14} style={{ marginRight: '6px' }} /> Save Changes
                </button>
                <button onClick={() => setMetaEditMode(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '10px 0 5px 0' }}>{rca.title}</h2>
              {rca.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '15px' }}>
                  {rca.description}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Created by {rca.createdBy.name} on {new Date(rca.createdAt).toLocaleDateString()}
                </span>

                {canMutate && (
                  <button onClick={() => setMetaEditMode(true)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Edit Details
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RCA Sections Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
          
          {/* Section: Timeline */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileText size={16} style={{ color: 'var(--color-accent)' }} /> Timeline of Event
            </h3>
            {canMutate ? (
              <div>
                <textarea
                  value={sectionTimeline}
                  onChange={(e) => setSectionTimeline(e.target.value)}
                  className="form-input"
                  rows={4}
                  placeholder="Detail the timeline leading up to, during, and after the event..."
                  style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
                />
                <button onClick={() => handleSaveSection('TIMELINE', sectionTimeline)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Save size={12} style={{ marginRight: '6px' }} /> Save Timeline
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {sectionTimeline || 'No content provided yet.'}
              </p>
            )}
          </div>

          {/* Section: Contributing Factors */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileText size={16} style={{ color: 'var(--color-accent)' }} /> Contributing Factors
            </h3>
            {canMutate ? (
              <div>
                <textarea
                  value={sectionFactors}
                  onChange={(e) => setSectionFactors(e.target.value)}
                  className="form-input"
                  rows={4}
                  placeholder="Detail the underlying reasons and root causes of this event..."
                  style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
                />
                <button onClick={() => handleSaveSection('CONTRIBUTING_FACTORS', sectionFactors)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Save size={12} style={{ marginRight: '6px' }} /> Save Factors
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {sectionFactors || 'No content provided yet.'}
              </p>
            )}
          </div>

          {/* Section: Corrective Actions */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileText size={16} style={{ color: 'var(--color-accent)' }} /> Corrective Actions (Immediate)
            </h3>
            {canMutate ? (
              <div>
                <textarea
                  value={sectionCorrective}
                  onChange={(e) => setSectionCorrective(e.target.value)}
                  className="form-input"
                  rows={4}
                  placeholder="Detail immediate mitigation steps taken to resolve the incident..."
                  style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
                />
                <button onClick={() => handleSaveSection('CORRECTIVE_ACTIONS', sectionCorrective)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Save size={12} style={{ marginRight: '6px' }} /> Save Corrective Actions
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {sectionCorrective || 'No content provided yet.'}
              </p>
            )}
          </div>

          {/* Section: Preventive Measures */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileText size={16} style={{ color: 'var(--color-accent)' }} /> Preventive Measures (Long-term)
            </h3>
            {canMutate ? (
              <div>
                <textarea
                  value={sectionPreventive}
                  onChange={(e) => setSectionPreventive(e.target.value)}
                  className="form-input"
                  rows={4}
                  placeholder="Detail long-term strategies to ensure this failure does not repeat..."
                  style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
                />
                <button onClick={() => handleSaveSection('PREVENTIVE_MEASURES', sectionPreventive)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Save size={12} style={{ marginRight: '6px' }} /> Save Preventive Measures
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {sectionPreventive || 'No content provided yet.'}
              </p>
            )}
          </div>
        </div>

        {/* Submit workflow module (DRAFT status only) */}
        {rca.status === 'DRAFT' && (isCreator || isManager) && !projectArchived && (
          <div className="glass-panel" style={{ padding: '20px', border: '1px dashed var(--color-accent)', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Submit RCA for Review</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Select REVIEWER members to examine and vote on this RCA. All four sections must contain non-whitespace text.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              {reviewerMembers.map(m => (
                <label key={m.user.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={selectedReviewers.includes(m.user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReviewers([...selectedReviewers, m.user.id]);
                      } else {
                        setSelectedReviewers(selectedReviewers.filter(id => id !== m.user.id));
                      }
                    }}
                  />
                  {m.user.name} ({m.user.email})
                </label>
              ))}

              {reviewerMembers.length === 0 && (
                <span style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                  Warning: No members have the REVIEWER role in this project.
                </span>
              )}
            </div>

            <button onClick={handleSubmitForReview} className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
              Submit for Review
            </button>
          </div>
        )}

        {/* Active pending review decision block */}
        {myPendingReview && !projectArchived && (
          <div className="glass-panel" style={{ padding: '20px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#3b82f6', marginBottom: '10px' }}>Your Assigned Review Decision</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Submit your vote on this Root Cause Analysis. Comment explanation is mandatory.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Decision</label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Mandatory Comment</label>
                <textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  className="form-input"
                  rows={3}
                  placeholder="Explain your decision..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <button onClick={() => handleDecision(myPendingReview.id)} className="btn btn-primary" style={{ padding: '10px' }}>
                Submit Decision
              </button>
            </div>
          </div>
        )}

        {/* Reopen Action (REJECTED status only) */}
        {rca.status === 'REJECTED' && (isCreator || isManager) && !projectArchived && (
          <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--color-danger)', background: 'rgba(239, 68, 68, 0.03)', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '5px' }}>RCA Rejected</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Reviewers have rejected this analysis. You can reopen it as DRAFT to correct details and submit again. Historic review rounds are retained.
            </p>
            <button onClick={handleReopen} className="btn btn-primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              <RotateCcw size={14} style={{ marginRight: '6px' }} /> Reopen as DRAFT
            </button>
          </div>
        )}

        {/* Close Action (APPROVED status only) */}
        {rca.status === 'APPROVED' && isManager && !projectArchived && (
          <div className="glass-panel" style={{ padding: '20px', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.03)', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#10b981', marginBottom: '5px' }}>RCA Approved</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              All current round reviewers have approved this analysis. As a MANAGER, you can permanently Close this workflow.
            </p>
            <button onClick={handleClose} className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}>
              <Check size={14} style={{ marginRight: '6px' }} /> Close Workflow
            </button>
          </div>
        )}

        {/* Review Log Panel */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersIcon size={18} style={{ color: 'var(--color-accent)' }} /> Review and Decision Logs
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {rca.reviews.map(r => (
              <div key={r.id} className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} style={{ color: 'var(--text-muted)' }} /> {r.reviewer.name}
                  </span>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Round {r.round} • {r.decidedAt ? new Date(r.decidedAt).toLocaleDateString() : 'Pending'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{
                    background: r.decision === 'PENDING' ? 'rgba(255, 255, 255, 0.05)' :
                                r.decision === 'APPROVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: r.decision === 'PENDING' ? 'var(--text-muted)' :
                           r.decision === 'APPROVED' ? '#10b981' : '#ef4444',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {r.decision}
                  </span>
                </div>

                {r.comment && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderLeft: '2px solid var(--border-color)' }}>
                    {r.comment}
                  </p>
                )}
              </div>
            ))}

            {rca.reviews.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                No review records associated with this RCA yet.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Clean UI icons
function UsersIcon({ size = 18, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
