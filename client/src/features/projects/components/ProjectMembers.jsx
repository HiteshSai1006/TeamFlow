import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, ShieldAlert } from 'lucide-react';

export default function ProjectMembers({ project, role }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const isArchived = project.status === 'ARCHIVED';
  const isManager = role === 'MANAGER';

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load project member list.');
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [project.id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);

    if (!inviteEmail.trim()) {
      setInviteError('Email address is required.');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invitation failed.');
      }

      setMembers((prev) => [...prev, data.member]);
      setInviteEmail('');
      setInviteSuccess(true);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update member role.');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      alert(err.message);
      fetchMembers(); // Reset view to database state in case of failure
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member from the project?')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to remove project member.');
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(err.message);
      fetchMembers(); // Reset view in case of failure
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading project team...</div>;
  }

  if (error) {
    return <div style={{ color: 'var(--color-danger)' }}>{error}</div>;
  }

  return (
    <div className="members-layout-grid">
      
      {/* Members Registry List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Project Roster</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {members.map((m) => {
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{m.user.name}</span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: m.role === 'MANAGER' ? 'rgba(59, 130, 246, 0.1)' : m.role === 'REVIEWER' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                      color: m.role === 'MANAGER' ? '#3b82f6' : m.role === 'REVIEWER' ? '#f59e0b' : '#9ca3af',
                      border: `1px solid ${m.role === 'MANAGER' ? 'rgba(59, 130, 246, 0.15)' : m.role === 'REVIEWER' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(156, 163, 175, 0.15)'}`
                    }}>
                      {m.role}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.user.email}</span>
                </div>

                {/* Operations */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  
                  {/* Role Selector (Managers only can edit) */}
                  {isManager && !isArchived ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      style={{
                        padding: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="REVIEWER">REVIEWER</option>
                    </select>
                  ) : null}

                  {/* Remove Button */}
                  {isManager && !isArchived && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        padding: '6px'
                      }}
                      title="Remove Member"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Member Card (MANAGER only) */}
      {isManager && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={18} style={{ color: 'var(--color-accent)' }} />
            Invite Operations Officer
          </h3>

          {isArchived ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
              borderRadius: '8px',
              padding: '12px',
              color: '#f59e0b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldAlert size={14} />
              <span>Invitations disabled while archived.</span>
            </div>
          ) : (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {inviteError && (
                <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                  Member added successfully!
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>User Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(false); }}
                  placeholder="name@domain.com"
                  required
                  disabled={inviting}
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
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={inviting}
                  style={{
                    padding: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="REVIEWER">REVIEWER</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="btn-primary"
                style={{
                  padding: '10px',
                  justifyContent: 'center',
                  opacity: inviting ? 0.7 : 1,
                  cursor: inviting ? 'not-allowed' : 'pointer'
                }}
              >
                {inviting ? 'Sending Invite...' : 'Invite Member'}
              </button>
            </form>
          )}
        </div>
      )}

    </div>
  );
}
