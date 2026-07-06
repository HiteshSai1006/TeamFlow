import React from 'react';
import { CheckSquare, User, Calendar, AlertTriangle } from 'lucide-react';

export default function ListTaskView({
  tasks,
  sortBy,
  onSortChange,
  onTaskClick,
  selectedTask
}) {
  // Deterministic client-side sorting algorithm
  const getSortedTasks = () => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'title_desc') {
        return b.title.localeCompare(a.title, undefined, { sensitivity: 'base' });
      }

      if (sortBy === 'status_asc' || sortBy === 'status_desc') {
        const weight = { TODO: 1, IN_PROGRESS: 2, BLOCKED: 3, DONE: 4 };
        const wA = weight[a.status] || 0;
        const wB = weight[b.status] || 0;
        return sortBy === 'status_asc' ? wA - wB : wB - wA;
      }

      if (sortBy === 'priority_asc' || sortBy === 'priority_desc') {
        const weight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        const wA = weight[a.priority] || 0;
        const wB = weight[b.priority] || 0;
        return sortBy === 'priority_asc' ? wA - wB : wB - wA;
      }

      if (sortBy === 'assignee_asc' || sortBy === 'assignee_desc') {
        const nameA = a.assignee?.name;
        const nameB = b.assignee?.name;
        // Null assignees remain last in both ascending and descending
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        
        const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        return sortBy === 'assignee_asc' ? cmp : -cmp;
      }

      if (sortBy === 'dueDate_asc' || sortBy === 'dueDate_desc') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : null;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : null;
        // Null due dates remain last in both ascending and descending
        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return 1;
        if (dateB === null) return -1;

        return sortBy === 'dueDate_asc' ? dateA - dateB : dateB - dateA;
      }

      return 0;
    });
    return sorted;
  };

  const sortedTasks = getSortedTasks();

  // Helper to determine if task has active blockers
  const hasBlockers = (task) => task.warnings?.some((w) => w.code === 'UNFINISHED_BLOCKERS');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* Sorting Control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        alignSelf: 'flex-end',
        fontSize: '12px'
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>Sort By:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="title_asc">Title (A-Z)</option>
          <option value="title_desc">Title (Z-A)</option>
          <option value="status_asc">Status (Todo to Done)</option>
          <option value="status_desc">Status (Done to Todo)</option>
          <option value="priority_asc">Priority (Low to Critical)</option>
          <option value="priority_desc">Priority (Critical to Low)</option>
          <option value="assignee_asc">Assignee (A-Z)</option>
          <option value="assignee_desc">Assignee (Z-A)</option>
          <option value="dueDate_asc">Due Date (Soonest)</option>
          <option value="dueDate_desc">Due Date (Furthest)</option>
        </select>
      </div>

      {/* Task List Grid */}
      {sortedTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          No tasks match the active filters or scope.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedTasks.map((t) => {
            const isSelected = selectedTask?.id === t.id;
            const blocked = hasBlockers(t);
            return (
              <div
                key={t.id}
                onClick={() => onTaskClick(t)}
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

                    {blocked && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        <AlertTriangle size={10} />
                        blocked
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span style={{
                      color: t.priority === 'CRITICAL' ? 'var(--color-danger)' : t.priority === 'HIGH' ? '#f59e0b' : t.priority === 'MEDIUM' ? '#3b82f6' : '#9ca3af'
                    }}>
                      {t.priority}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={10} />
                      {t.assignee?.name || 'Unassigned'}
                    </span>
                    {t.dueDate && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={10} />
                          {new Date(t.dueDate).toISOString().split('T')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>

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
  );
}
