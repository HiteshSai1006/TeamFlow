import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Calendar, User, Eye, History, ShieldAlert, AlertCircle } from 'lucide-react';

export default function TasksTab({ project, role }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // Modal / Drawer State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Create Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newStatus, setNewStatus] = useState('TODO');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Edit Task Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editStatus, setEditStatus] = useState('TODO');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editError, setEditError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const isArchived = project.status === 'ARCHIVED';
  const isManager = role === 'MANAGER';
  const isReviewer = role === 'REVIEWER';
  const isMember = role === 'MEMBER';

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus) queryParams.append('status', filterStatus);
      if (filterPriority) queryParams.append('priority', filterPriority);
      if (filterAssignee) queryParams.append('assigneeId', filterAssignee);

      const res = await fetch(`/api/projects/${project.id}/tasks?${queryParams.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load project tasks.');
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to load project members:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [project.id, filterStatus, filterPriority, filterAssignee]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreateError(null);

    if (!newTitle.trim()) {
      setCreateError('Task title is required.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        status: newStatus,
        dueDate: newDueDate || null
      };

      if (isManager && newAssigneeId) {
        payload.assigneeId = parseInt(newAssigneeId, 10);
      }

      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create task.');
      }

      setTasks((prev) => [data.task, ...prev]);
      setShowCreateModal(false);
      // Reset Form
      setNewTitle('');
      setNewDesc('');
      setNewPriority('MEDIUM');
      setNewStatus('TODO');
      setNewAssigneeId('');
      setNewDueDate('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const selectTaskForDetails = async (task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditAssigneeId(task.assigneeId ? task.assigneeId.toString() : '');
    setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setEditError(null);

    // Fetch complete details and logs
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${task.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedTaskLogs(data.task.activityLogs || []);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setEditError(null);
    setUpdating(true);

    try {
      const payload = {};
      
      // Determine what to send based on role capabilities
      if (isManager) {
        payload.title = editTitle;
        payload.description = editDesc;
        payload.priority = editPriority;
        payload.assigneeId = editAssigneeId ? parseInt(editAssigneeId, 10) : null;
        payload.status = editStatus;
        payload.dueDate = editDueDate || null;
      } else if (isMember) {
        // Members can edit status if assigned, or fields if they created/are assigned to it
        const isAssignee = selectedTask.assigneeId === selectedTask.createdById; // Let's check from current logged user, wait, we can just send whatever we want and let the API validate it
        payload.title = editTitle;
        payload.description = editDesc;
        payload.priority = editPriority;
        payload.status = editStatus;
        payload.dueDate = editDueDate || null;
      }

      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update task.');
      }

      // Update tasks array
      setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? data.task : t)));
      
      // Reload logs and refresh selected task details
      await selectTaskForDetails(data.task);
      alert('Task updated successfully!');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Only managers and members (not reviewers) can mutate
  const canMutate = !isReviewer && !isArchived;

  // Filter assignable members (exclude reviewers)
  const assignableMembers = members.filter((m) => m.role !== 'REVIEWER');

  // Allowed transitions logic helper for UI dropdown
  const getAllowedStatusOptions = (currentStatus) => {
    const allowedMap = {
      TODO: ['TODO', 'IN_PROGRESS'],
      IN_PROGRESS: ['IN_PROGRESS', 'TODO', 'BLOCKED', 'DONE'],
      BLOCKED: ['BLOCKED', 'IN_PROGRESS', 'TODO'],
      DONE: ['DONE', 'IN_PROGRESS']
    };
    return allowedMap[currentStatus] || ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  };

  // Format activity logs text
  const formatLogText = (log) => {
    const actorName = log.actor?.name || 'Unknown User';
    const dateStr = new Date(log.createdAt).toLocaleString();
    
    switch (log.eventType) {
      case 'TASK_CREATE':
        return `[${dateStr}] Task was created by ${actorName} with initial title "${log.metadata.title}".`;
      case 'TASK_UPDATE':
        const updates = [];
        if (log.metadata.title) updates.push(`title changed to "${log.metadata.title.after}"`);
        if (log.metadata.description) updates.push(`description changed`);
        if (log.metadata.priority) updates.push(`priority changed to ${log.metadata.priority.after}`);
        return `[${dateStr}] General settings updated by ${actorName}: ${updates.join(', ')}.`;
      case 'TASK_ASSIGN':
        const assigneeEmail = log.metadata.after?.email || 'Unassigned';
        return `[${dateStr}] Task assignment changed by ${actorName} to ${assigneeEmail}.`;
      case 'TASK_STATUS_CHANGE':
        return `[${dateStr}] Status transitioned by ${actorName} from ${log.metadata.before} to ${log.metadata.after}.`;
      case 'TASK_DUE_DATE_CHANGE':
        const newDue = log.metadata.after ? new Date(log.metadata.after).toLocaleDateString() : 'None';
        return `[${dateStr}] Due date updated by ${actorName} to ${newDue}.`;
      default:
        return `[${dateStr}] Operations update logged by ${actorName}.`;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedTask ? '1fr 450px' : '1fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Task List Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        
        {/* Controls Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="">All Statuses</option>
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="DONE">DONE</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="">All Assignees</option>
              {assignableMembers.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>

          {/* Create Button */}
          {canMutate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
            >
              <Plus size={14} />
              Add Task
            </button>
          )}

        </div>

        {/* Task List Grid */}
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Querying project tasks...</div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            No tasks match the active filters or scope.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.map((t) => {
              const isSelected = selectedTask?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => selectTaskForDetails(t)}
                  style={{
                    padding: '16px 20px',
                    background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-color)',
                    borderColor: isSelected ? 'var(--color-accent)' : 'var(--border-color)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'transform 0.15s, border-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckSquare size={14} style={{ color: 'var(--color-accent)' }} />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{t.title}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {/* Priority Badge */}
                      <span style={{
                        color: t.priority === 'CRITICAL' ? 'var(--color-danger)' : t.priority === 'HIGH' ? '#f59e0b' : t.priority === 'MEDIUM' ? '#3b82f6' : '#9ca3af'
                      }}>
                        {t.priority}
                      </span>
                      <span>•</span>
                      {/* Assignee */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={10} />
                        {t.assignee?.name || 'Unassigned'}
                      </span>
                      {t.dueDate && (
                        <>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={10} />
                            {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    background: t.status === 'DONE' ? 'rgba(16, 185, 129, 0.08)' : t.status === 'BLOCKED' ? 'rgba(239, 68, 68, 0.08)' : t.status === 'IN_PROGRESS' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(156, 163, 175, 0.08)',
                    color: t.status === 'DONE' ? 'var(--color-success)' : t.status === 'BLOCKED' ? 'var(--color-danger)' : t.status === 'IN_PROGRESS' ? '#3b82f6' : '#9ca3af',
                    border: `1px solid ${t.status === 'DONE' ? 'rgba(16, 185, 129, 0.15)' : t.status === 'BLOCKED' ? 'rgba(239, 68, 68, 0.15)' : t.status === 'IN_PROGRESS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.15)'}`
                  }}>
                    {t.status.replace('_', ' ')}
                  </span>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Task Details Panel / Edit View (Manager & Member context sensitive) */}
      {selectedTask && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '20px' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} style={{ color: 'var(--color-accent)' }} />
              Task Details
            </h3>
            <button
              onClick={() => setSelectedTask(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
            >
              Close
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {editError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertCircle size={14} />
                <span>{editError}</span>
              </div>
            )}

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={!canMutate}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                disabled={!canMutate}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  height: '60px',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

            {/* Priority & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              {/* Priority */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  disabled={!canMutate}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              {/* Status (Transition Scoped) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={!canMutate}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  {getAllowedStatusOptions(selectedTask.status).map((opt) => (
                    <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Assignee & Due Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              {/* Assignee (Managers Only can reassign) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assignee</label>
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  disabled={!isManager || isArchived}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="">Unassigned</option>
                  {assignableMembers.map((m) => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  disabled={!canMutate}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

            </div>

            {/* Save Button */}
            {canMutate && (
              <button
                type="submit"
                disabled={updating}
                className="btn-primary"
                style={{ padding: '10px', justifyContent: 'center', fontSize: '13px', marginTop: '10px' }}
              >
                {updating ? 'Saving changes...' : 'Save Changes'}
              </button>
            )}

          </form>

          {/* Activity Logs (Audit Trail) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              <History size={14} />
              Operations Log History
            </h4>

            {loadingLogs ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading audit trail...</div>
            ) : selectedTaskLogs.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No audit logs recorded.</div>
            ) : (
              <div style={{
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px'
              }}>
                {selectedTaskLogs.map((log) => (
                  <div key={log.id} style={{
                    fontSize: '11px',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.4'
                  }}>
                    {formatLogText(log)}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Task Creation Modal */}
      {showCreateModal && (
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
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={20} style={{ color: 'var(--color-accent)' }} />
                New Operations Task
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {createError && (
                <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => { setNewTitle(e.target.value); setCreateError(null); }}
                  placeholder="e.g. Inspect firewalls"
                  required
                  disabled={creating}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detailed task steps..."
                  disabled={creating}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    height: '80px',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    disabled={creating}
                    style={{
                      padding: '10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Initial Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={creating}
                    style={{
                      padding: '10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="DONE">DONE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {/* Assignee dropdown - hidden for MEMBERS */}
                {isManager ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assignee</label>
                    <select
                      value={newAssigneeId}
                      onChange={(e) => setNewAssigneeId(e.target.value)}
                      disabled={creating}
                      style={{
                        padding: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Unassigned</option>
                      {assignableMembers.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Tasks created by members are initially unassigned.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    disabled={creating}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  style={{ padding: '12px 20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                  style={{ padding: '12px 24px', opacity: creating ? 0.7 : 1 }}
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
