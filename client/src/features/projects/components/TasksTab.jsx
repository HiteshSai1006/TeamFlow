import React, { useState, useEffect, useRef } from 'react';
import { Plus, CheckSquare, Calendar, User, Eye, History, AlertTriangle, X, MessageSquare, Paperclip, Download } from 'lucide-react';
import TaskViewSwitcher from './TaskViewSwitcher.jsx';
import KanbanTaskView from './KanbanTaskView.jsx';
import CalendarTaskView from './CalendarTaskView.jsx';
import ListTaskView from './ListTaskView.jsx';

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
  const [newParentId, setNewParentId] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Edit Task Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editStatus, setEditStatus] = useState('TODO');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [editError, setEditError] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Unfiltered Tasks for Parent Selector
  const [unfilteredTasks, setUnfilteredTasks] = useState([]);

  // Dependencies State
  const [selectedPrereqId, setSelectedPrereqId] = useState('');
  const [selectedDownstreamId, setSelectedDownstreamId] = useState('');
  const [depError, setDepError] = useState(null);

  // Comments State
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [mentionSearch, setMentionSearch] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [currentUser, setCurrentUser] = useState(null);

  // Attachments State
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // CSV Export State
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Task Visualisation & Preferences State
  const [viewMode, setViewMode] = useState('KANBAN');
  const [sortBy, setSortBy] = useState('dueDate_asc');
  const [loadingPreference, setLoadingPreference] = useState(true);
  const [prefError, setPrefError] = useState(null);

  const latestViewModeRef = useRef('KANBAN');

  const fetchPreference = async () => {
    setLoadingPreference(true);
    setPrefError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/view-preference`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const serverMode = data.viewMode || 'KANBAN';
        setViewMode(serverMode);
        latestViewModeRef.current = serverMode;
      }
    } catch (err) {
      console.error('Failed to load view preference:', err);
    } finally {
      setLoadingPreference(false);
    }
  };

  const handleViewModeChange = async (newMode) => {
    const oldMode = viewMode;
    setViewMode(newMode);
    latestViewModeRef.current = newMode;
    setPrefError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/view-preference`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewMode: newMode }),
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save view preference.');
      }
    } catch (err) {
      console.error('Failed to save view preference:', err);
      if (latestViewModeRef.current === newMode) {
        setViewMode(oldMode);
        latestViewModeRef.current = oldMode;
      }
      setPrefError(err.message);
    }
  };

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

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Failed to load current user context:', err);
    }
  };

  const fetchUnfilteredTasks = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUnfilteredTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load unfiltered project tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUnfilteredTasks();
    fetchMembers();
    fetchCurrentUser();
  }, [project.id, filterStatus, filterPriority, filterAssignee]);

  useEffect(() => {
    fetchPreference();
  }, [project.id]);

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

      if (newParentId) {
        payload.parentId = parseInt(newParentId, 10);
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
      fetchUnfilteredTasks();
      setShowCreateModal(false);
      // Reset Form
      setNewTitle('');
      setNewDesc('');
      setNewPriority('MEDIUM');
      setNewStatus('TODO');
      setNewAssigneeId('');
      setNewDueDate('');
      setNewParentId('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const fetchComments = async (taskId) => {
    setLoadingComments(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${taskId}/comments`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load comments.');
      }
      setComments(data.comments || []);
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchAttachments = async (taskId) => {
    setLoadingAttachments(true);
    setAttachmentError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${taskId}/attachments`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load attachments.');
      }
      setAttachments(data.attachments || []);
    } catch (err) {
      setAttachmentError(err.message);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setAttachmentError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Upload failed.');
      }
      setAttachments((prev) => [data.attachment, ...prev]);
      e.target.value = null; // reset file input
    } catch (err) {
      setAttachmentError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete attachment.');
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const deriveMentionedUserIds = (text) => {
      const regex = /@\[[^\]]+\]\(user:(\d+)\)/g;
      const ids = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        ids.push(parseInt(match[1], 10));
      }
      return Array.from(new Set(ids));
    };

    const mentionedUserIds = deriveMentionedUserIds(newCommentText);

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentText, mentionedUserIds }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to post comment.');
      }
      setComments((prev) => [...prev, data.comment]);
      setNewCommentText('');
      setMentionSearch(null);
      setMentionIndex(-1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTextareaChange = (e) => {
    const val = e.target.value;
    setNewCommentText(val);

    const selectionEnd = e.target.selectionEnd;
    const textBeforeCursor = val.slice(0, selectionEnd);

    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setMentionIndex(lastAt);
        return;
      }
    }

    setMentionSearch(null);
    setMentionIndex(-1);
  };

  const handleSelectMention = (member) => {
    if (mentionIndex === -1) return;
    const textBeforeAt = newCommentText.slice(0, mentionIndex);
    const textAfterCursor = newCommentText.slice(mentionIndex + 1 + mentionSearch.length);

    const token = `@[${member.user.name}](user:${member.userId}) `;
    const newText = textBeforeAt + token + textAfterCursor;

    setNewCommentText(newText);
    setMentionSearch(null);
    setMentionIndex(-1);
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentText.trim()) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingCommentText }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update comment.');
      }
      setComments((prev) => prev.map((c) => (c.id === commentId ? data.comment : c)));
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${selectedTask.id}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete comment.');
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      alert(err.message);
    }
  };

  const selectTaskForDetails = async (task) => {
    // Reset dependency selectors and warnings
    setSelectedPrereqId('');
    setSelectedDownstreamId('');
    setDepError(null);
    
    // Comments state resets
    setComments([]);
    setCommentError(null);
    setNewCommentText('');
    setEditingCommentId(null);

    // Attachments state resets
    setAttachments([]);
    setAttachmentError(null);
    setUploading(false);

    // Fetch complete details, relations, logs, and warnings
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${task.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const fullTask = data.task;
        setSelectedTask(fullTask);
        setEditTitle(fullTask.title);
        setEditDesc(fullTask.description || '');
        setEditPriority(fullTask.priority);
        setEditStatus(fullTask.status);
        setEditAssigneeId(fullTask.assigneeId ? fullTask.assigneeId.toString() : '');
        setEditDueDate(fullTask.dueDate ? new Date(fullTask.dueDate).toISOString().split('T')[0] : '');
        setEditParentId(fullTask.parentId ? fullTask.parentId.toString() : '');
        setSelectedTaskLogs(fullTask.activityLogs || []);

        await fetchComments(task.id);
        await fetchAttachments(task.id);
      } else {
        throw new Error('Failed to load task details.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching task details.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setEditError(null);
    setUpdating(true);

    try {
      const payload = {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        status: editStatus,
        dueDate: editDueDate || null,
        parentId: editParentId ? parseInt(editParentId, 10) : null
      };
      
      if (isManager) {
        payload.assigneeId = editAssigneeId ? parseInt(editAssigneeId, 10) : null;
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

      // Update task in main lists
      setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? data.task : t)));
      fetchUnfilteredTasks();
      
      // Reload details
      await selectTaskForDetails(data.task);
      alert('Task updated successfully!');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Add a Dependency (Relation)
  const handleAddDependency = async (direction, taskId) => {
    setDepError(null);
    if (!taskId) return;

    let sourceId, targetId;
    if (direction === 'PREREQUISITE') {
      // taskId blocks selectedTask.id
      sourceId = parseInt(taskId, 10);
      targetId = selectedTask.id;
    } else {
      // selectedTask.id blocks taskId
      sourceId = selectedTask.id;
      targetId = parseInt(taskId, 10);
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${sourceId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTaskId: targetId }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add dependency.');
      }

      // Refresh task details to load updated relations & warnings
      await selectTaskForDetails(selectedTask);
      fetchTasks(); // refresh task list warnings
      
      if (direction === 'PREREQUISITE') setSelectedPrereqId('');
      else setSelectedDownstreamId('');
    } catch (err) {
      setDepError(err.message);
    }
  };

  // Remove a Dependency (Relation)
  const handleRemoveDependency = async (targetTaskId, relationId) => {
    setDepError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/${targetTaskId}/relations/${relationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to remove dependency.');
      }

      await selectTaskForDetails(selectedTask);
      fetchTasks();
    } catch (err) {
      setDepError(err.message);
    }
  };

  const canMutate = !isReviewer && !isArchived;

  // Filter assignable members (exclude reviewers)
  const assignableMembers = members.filter((m) => m.role !== 'REVIEWER');

  // Allowed transitions dropdown options helper
  const getAllowedStatusOptions = (currentStatus) => {
    const allowedMap = {
      TODO: ['TODO', 'IN_PROGRESS'],
      IN_PROGRESS: ['IN_PROGRESS', 'TODO', 'BLOCKED', 'DONE'],
      BLOCKED: ['BLOCKED', 'IN_PROGRESS', 'TODO'],
      DONE: ['DONE', 'IN_PROGRESS']
    };
    return allowedMap[currentStatus] || ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  };

  // Formatter for logs
  const formatLogText = (log) => {
    const actorName = log.actor?.name || 'Unknown User';
    const dateStr = new Date(log.createdAt).toLocaleString();
    
    switch (log.eventType) {
      case 'TASK_CREATE':
        return `[${dateStr}] Task created by ${actorName} with initial title "${log.metadata.title}".`;
      case 'TASK_UPDATE':
        const updates = [];
        if (log.metadata.title) updates.push(`title changed to "${log.metadata.title.after}"`);
        if (log.metadata.description) updates.push(`description changed`);
        if (log.metadata.priority) updates.push(`priority changed to ${log.metadata.priority.after}`);
        return `[${dateStr}] Task settings updated by ${actorName}: ${updates.join(', ')}.`;
      case 'TASK_ASSIGN':
        const assigneeEmail = log.metadata.after?.email || 'Unassigned';
        return `[${dateStr}] Task assignment changed by ${actorName} to ${assigneeEmail}.`;
      case 'TASK_STATUS_CHANGE':
        return `[${dateStr}] Status transitioned by ${actorName} from ${log.metadata.before} to ${log.metadata.after}.`;
      case 'TASK_DUE_DATE_CHANGE':
        const newDue = log.metadata.after ? new Date(log.metadata.after).toLocaleDateString() : 'None';
        return `[${dateStr}] Due date updated by ${actorName} to ${newDue}.`;
      case 'TASK_DEPENDENCY_ADDED':
        return `[${dateStr}] Dependency added by ${actorName}: "${log.metadata.sourceTaskTitle}" blocks "${log.metadata.targetTaskTitle}".`;
      case 'TASK_DEPENDENCY_REMOVED':
        return `[${dateStr}] Dependency removed by ${actorName}: "${log.metadata.sourceTaskTitle}" no longer blocks "${log.metadata.targetTaskTitle}".`;
      default:
        return `[${dateStr}] Activity logged by ${actorName}.`;
    }
  };

  // Helper to determine if a task has active blockers in the list
  const hasBlockers = (task) => task.warnings?.some((w) => w.code === 'UNFINISHED_BLOCKERS');

  const handleExportCSV = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterAssignee) params.append('assigneeId', filterAssignee);

      const qs = params.toString();
      const url = `/api/projects/${project.id}/tasks/export${qs ? '?' + qs : ''}`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Export failed.');
      }

      const disposition = res.headers.get('content-disposition');
      let filename = `project-${project.id}-tasks-${new Date().toISOString().replace(/[:.]/g, '')}.csv`;
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

  return (
    <div className={`tasks-layout-grid ${selectedTask ? 'has-selected' : ''}`}>
      
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

          <TaskViewSwitcher
            viewMode={viewMode}
            onChange={handleViewModeChange}
            loading={loadingPreference}
          />

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
            {canMutate && (
              <button
                onClick={() => { setNewParentId(''); setShowCreateModal(true); }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
              >
                <Plus size={14} />
                Add Task
              </button>
            )}
          </div>

        </div>

        {prefError && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={14} />
            <span>{prefError}</span>
          </div>
        )}

        {exportError && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={14} />
            <span>{exportError}</span>
          </div>
        )}

        {/* Task Grid Views */}
        {loading || loadingPreference ? (
          <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>
            {loadingPreference ? 'Loading view preference...' : 'Querying project tasks...'}
          </div>
        ) : (
          <div>
            {viewMode === 'KANBAN' && (
              <KanbanTaskView
                tasks={tasks}
                onTaskClick={selectTaskForDetails}
              />
            )}
            {viewMode === 'CALENDAR' && (
              <CalendarTaskView
                tasks={tasks}
                onTaskClick={selectTaskForDetails}
              />
            )}
            {viewMode === 'LIST' && (
              <ListTaskView
                tasks={tasks}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onTaskClick={selectTaskForDetails}
                selectedTask={selectedTask}
              />
            )}
          </div>
        )}

      </div>

      {/* Task Details Panel */}
      {selectedTask && (
        <div className="glass-panel" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'sticky',
          top: '20px',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          
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

          {/* Structured Warning Banner */}
          {hasBlockers(selectedTask) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#f59e0b',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <AlertTriangle size={16} />
                <span>Unresolved Prerequisites (UNFINISHED_BLOCKERS)</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
                This task depends on the following unfinished tasks:
              </p>
              <ul style={{ margin: '5px 0 0 16px', padding: 0, fontSize: '12px', opacity: 0.9 }}>
                {selectedTask.warnings
                  .find((w) => w.code === 'UNFINISHED_BLOCKERS')
                  ?.details.map((d) => (
                    <li key={d.id}>
                      <strong>{d.title}</strong> ({d.status.replace('_', ' ')})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleUpdateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {editError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={14} />
                <span>{editError}</span>
              </div>
            )}

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Parent Task</label>
              <select
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
                disabled={!canMutate}
                className="form-input"
                style={{
                  padding: '8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%'
                }}
              >
                <option value="">No parent / Root task</option>
                {unfilteredTasks.filter(t => t.id !== selectedTask.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

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

          {/* Task Hierarchy Section */}
          {(selectedTask.parent || (selectedTask.subtasks && selectedTask.subtasks.length > 0)) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Task Hierarchy
              </h4>

              {selectedTask.parent && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Parent Task:</span>
                  <div
                    onClick={() => selectTaskForDetails(selectedTask.parent)}
                    className="interactive-card"
                    tabIndex={0}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      marginTop: '4px',
                      cursor: 'pointer',
                      display: 'inline-block'
                    }}
                  >
                    {selectedTask.parent.title}
                  </div>
                </div>
              )}

              {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Direct Subtasks ({selectedTask.subtasks.length}):</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                    {selectedTask.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => selectTaskForDetails(sub)}
                        className="interactive-card"
                        tabIndex={0}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{sub.title}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8, padding: '2px 6px', borderRadius: '4px', background: 'var(--border-color)' }}>
                          {sub.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dependencies Relations Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Prerequisites & Downstream Dependencies
            </h4>

            {depError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={12} />
                <span>{depError}</span>
              </div>
            )}

            {/* List and add prerequisite */}
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Blocked By (Prerequisites)
              </h5>
              
              {/* List */}
              {selectedTask.incomingRelations?.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>No prerequisites defined.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {selectedTask.incomingRelations?.map((rel) => (
                    <div key={rel.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}>
                      <span style={{ fontSize: '12px', color: rel.sourceTask.status !== 'DONE' ? '#f59e0b' : 'var(--text-muted)' }}>
                        {rel.sourceTask.title} ({rel.sourceTask.status.replace('_', ' ')})
                      </span>
                      {canMutate && (
                        <button
                          onClick={() => handleRemoveDependency(selectedTask.id, rel.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete relation"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              {canMutate && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedPrereqId}
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select prerequisite task...</option>
                    {tasks
                      .filter((t) => t.id !== selectedTask.id && !selectedTask.incomingRelations?.some((r) => r.sourceTaskId === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddDependency('PREREQUISITE', selectedPrereqId)}
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* List and add downstream */}
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Blocks (Downstream)
              </h5>

              {/* List */}
              {selectedTask.outgoingRelations?.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>No downstream tasks.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {selectedTask.outgoingRelations?.map((rel) => (
                    <div key={rel.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {rel.targetTask.title} ({rel.targetTask.status.replace('_', ' ')})
                      </span>
                      {canMutate && (
                        <button
                          onClick={() => handleRemoveDependency(rel.targetTaskId, rel.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete relation"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              {canMutate && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedDownstreamId}
                    onChange={(e) => setSelectedDownstreamId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select dependent task...</option>
                    {tasks
                      .filter((t) => t.id !== selectedTask.id && !selectedTask.outgoingRelations?.some((r) => r.targetTaskId === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddDependency('DOWNSTREAM', selectedDownstreamId)}
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Comments Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
              <MessageSquare size={14} />
              Discussion Comments
            </h4>

            {/* Comment Thread List */}
            {loadingComments ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>Loading discussion comments...</div>
            ) : commentError ? (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '15px' }}>{commentError}</div>
            ) : comments.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '15px' }}>No comments posted yet.</div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '20px',
                maxHeight: '350px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {comments.map((c) => {
                  const isAuthor = currentUser?.id === c.authorId;
                  const canDeleteComment = canMutate && (isAuthor || isManager);
                  const isEditing = editingCommentId === c.id;

                  return (
                    <div key={c.id} style={{
                      padding: '10px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {c.author?.name || 'Unknown'} ({c.author?.email})
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {new Date(c.createdAt).toLocaleString()}
                          {c.editedAt && ' (edited)'}
                        </span>
                      </div>

                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              resize: 'none',
                              outline: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}
                              style={{ fontSize: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateComment(c.id)}
                              className="btn-primary"
                              style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4', margin: 0 }}>
                          {renderCommentContent(c.content)}
                        </p>
                      )}

                      {!isEditing && canMutate && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', fontSize: '10px' }}>
                          {isAuthor && (
                            <button
                              type="button"
                              onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.content); }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteComment && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Post Comment Input */}
            {canMutate && (
              <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                <textarea
                  value={newCommentText}
                  onChange={handleTextareaChange}
                  placeholder="Post comment... Use @ to mention members"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    height: '60px',
                    resize: 'none',
                    outline: 'none'
                  }}
                />

                {mentionSearch !== null && members.filter(m => {
                  const name = m.user?.name || '';
                  const email = m.user?.email || '';
                  return name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
                         email.toLowerCase().includes(mentionSearch.toLowerCase());
                }).length > 0 && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    marginTop: '-4px',
                    padding: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 10
                  }}>
                    {members.filter(m => {
                      const name = m.user?.name || '';
                      const email = m.user?.email || '';
                      return name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
                             email.toLowerCase().includes(mentionSearch.toLowerCase());
                    }).map(m => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => handleSelectMention(m)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          cursor: 'pointer',
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                        className="mention-item"
                      >
                        <span style={{ fontWeight: 600 }}>{m.user?.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.user?.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '12px', alignSelf: 'flex-end', opacity: newCommentText.trim() ? 1 : 0.6 }}
                >
                  Comment
                </button>
              </form>
            )}
          </div>

          {/* Attachments Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
              <Paperclip size={14} />
              Attachments
            </h4>

            {/* Error display */}
            {attachmentError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '15px' }}>{attachmentError}</div>
            )}

            {/* Empty state & list */}
            {loadingAttachments ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>Loading attachments...</div>
            ) : attachments.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '15px' }}>No attachments uploaded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                {attachments.map((a) => {
                  const isUploader = currentUser?.id === a.uploadedById;
                  const canDeleteAttachment = canMutate && (isUploader || isManager);
                  
                  // Helper to format bytes
                  const kbSize = (a.size / 1024).toFixed(1);
                  const formattedSize = kbSize > 1000 ? `${(kbSize / 1024).toFixed(1)} MB` : `${kbSize} KB`;

                  return (
                    <div key={a.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
                        <a
                          href={`/api/projects/${project.id}/tasks/${selectedTask.id}/attachments/${a.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-accent)',
                            textDecoration: 'none',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={12} />
                          {a.originalName}
                        </a>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Size: {formattedSize} • By: {a.uploadedBy?.name || 'Unknown'} • {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {canDeleteAttachment && (
                        <button
                          onClick={() => handleDeleteAttachment(a.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                          title="Delete attachment"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload Control */}
            {canMutate && !isReviewer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="file"
                  id="task-file-upload-11b"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="task-file-upload-11b"
                  className="btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '8px 16px',
                    justifyContent: 'center',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    opacity: uploading ? 0.6 : 1
                  }}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  {uploading ? 'Uploading...' : 'Choose File to Upload (Max 5MB)'}
                </label>
              </div>
            )}
          </div>

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Parent Task</label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  disabled={creating}
                  className="form-input"
                  style={{
                    padding: '10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    width: '100%'
                  }}
                >
                  <option value="">No parent / Root task</option>
                  {unfilteredTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
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

function renderCommentContent(content) {
  if (!content) return '';
  const regex = /(@\[[^\]]+\]\(user:\d+\))/g;
  const parts = content.split(regex);
  return parts.map((part, index) => {
    const match = part.match(/@\[([^\]]+)\]\(user:(\d+)\)/);
    if (match) {
      const displayName = match[1];
      return (
        <span
          key={index}
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 500,
            display: 'inline',
            margin: '0 2px'
          }}
        >
          @{displayName}
        </span>
      );
    }
    return part;
  });
}
