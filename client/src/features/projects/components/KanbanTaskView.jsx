import React from 'react';
import { Calendar, User, AlertTriangle } from 'lucide-react';

export default function KanbanTaskView({ tasks, onTaskClick }) {
  const columns = [
    { key: 'TODO', label: 'To Do', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.05)', border: 'rgba(156, 163, 175, 0.2)' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.2)' },
    { key: 'BLOCKED', label: 'Blocked', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.2)' },
    { key: 'DONE', label: 'Done', color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.2)' }
  ];

  // Helper to determine if task has active blockers
  const hasBlockers = (task) => task.warnings?.some((w) => w.code === 'UNFINISHED_BLOCKERS');

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      overflowX: 'auto',
      paddingBottom: '15px',
      alignItems: 'stretch',
      minHeight: '450px'
    }}>
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);

        return (
          <div
            key={col.key}
            style={{
              flex: 1,
              minWidth: '280px',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {/* Column Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '10px',
              borderBottom: `2px solid ${col.border}`
            }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: col.color }}>{col.label}</span>
              <span style={{
                background: col.bg,
                color: col.color,
                border: `1px solid ${col.border}`,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                {colTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              overflowY: 'auto',
              flex: 1
            }}>
              {colTasks.length === 0 ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.005)'
                }}>
                  No tasks
                </div>
              ) : (
                colTasks.map((t) => {
                  const blocked = hasBlockers(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t)}
                      style={{
                        padding: '14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'border-color 0.15s, transform 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Card title and Blocker badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {t.title}
                          </span>
                        </div>
                        {blocked && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                            borderRadius: '4px',
                            padding: '1px 5px',
                            fontSize: '9px',
                            fontWeight: 600,
                            width: 'fit-content'
                          }}>
                            <AlertTriangle size={8} />
                            blocked
                          </span>
                        )}
                      </div>

                      {/* Card Metadata */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        paddingTop: '6px'
                      }}>
                        <span style={{
                          color: t.priority === 'CRITICAL' ? 'var(--color-danger)' : t.priority === 'HIGH' ? '#f59e0b' : t.priority === 'MEDIUM' ? '#3b82f6' : '#9ca3af',
                          fontWeight: 600
                        }}>
                          {t.priority}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={10} />
                          <span>{t.assignee?.name || 'Unassigned'}</span>
                        </div>
                      </div>

                      {t.dueDate && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          color: 'var(--text-secondary)'
                        }}>
                          <Calendar size={10} />
                          <span>{new Date(t.dueDate).toISOString().split('T')[0]}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
