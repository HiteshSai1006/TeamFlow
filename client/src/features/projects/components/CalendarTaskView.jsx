import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, User, AlertTriangle } from 'lucide-react';

export default function CalendarTaskView({ tasks, onTaskClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Month metadata
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper to construct grid cells (42 cells: 6 weeks * 7 days)
  const getGridCells = () => {
    const cells = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDay.getDay(); // 0: Sun, 6: Sat
    const daysInMonth = lastDay.getDate();

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(year, month, d),
        isCurrentMonth: true
      });
    }

    // Next month padding days to fill 42 cells
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return cells;
  };

  // UTC Date matching to prevent timezone shifting
  const getTasksForDate = (dateObj) => {
    const cellYear = dateObj.getFullYear();
    const cellMonth = dateObj.getMonth();
    const cellDay = dateObj.getDate();

    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return (
        d.getUTCFullYear() === cellYear &&
        d.getUTCMonth() === cellMonth &&
        d.getUTCDate() === cellDay
      );
    });
  };

  const getUnscheduledTasks = () => {
    return tasks.filter((t) => !t.dueDate);
  };

  const cells = getGridCells();
  const unscheduled = getUnscheduledTasks();
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to determine if task has active blockers
  const hasBlockers = (task) => task.warnings?.some((w) => w.code === 'UNFINISHED_BLOCKERS');

  return (
    <div className="calendar-layout-grid">
      {/* Calendar Area */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {/* Navigation Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--color-accent)' }} />
            {monthNames[month]} {year}
          </h3>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handlePrevMonth}
              className="btn-secondary"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="btn-secondary"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          {daysOfWeek.map(day => (
            <div key={day} style={{ padding: '4px 0' }}>{day}</div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px'
        }}>
          {cells.map((cell, idx) => {
            const cellTasks = getTasksForDate(cell.date);
            const isToday = new Date().toDateString() === cell.date.toDateString();

            return (
              <div
                key={idx}
                style={{
                  minHeight: '85px',
                  padding: '8px',
                  background: cell.isCurrentMonth
                    ? 'var(--bg-input)'
                    : 'transparent',
                  border: isToday
                    ? '1px solid var(--color-accent)'
                    : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  opacity: cell.isCurrentMonth ? 1 : 0.4
                }}
              >
                {/* Day number */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--color-accent)' : 'var(--text-secondary)',
                  textAlign: 'right'
                }}>
                  {cell.date.getDate()}
                </div>

                {/* Day Tasks List */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  overflowY: 'auto',
                  maxHeight: '60px'
                }}>
                  {cellTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t)}
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '2px 4px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: t.priority === 'CRITICAL' ? 'var(--color-danger)' : t.priority === 'HIGH' ? '#f59e0b' : t.priority === 'MEDIUM' ? '#3b82f6' : 'var(--text-primary)'
                      }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled Tasks Panel */}
      <div className="glass-panel" style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Unscheduled Tasks ({unscheduled.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {unscheduled.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-secondary)',
              fontSize: '12px'
            }}>
              No unscheduled tasks
            </div>
          ) : (
            unscheduled.map((t) => {
              const blocked = hasBlockers(t);
              return (
                <div
                  key={t.id}
                  onClick={() => onTaskClick(t)}
                  className="interactive-card"
                  tabIndex={0}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--text-secondary)' }}>
                    <span style={{
                      color: t.priority === 'CRITICAL' ? 'var(--color-danger)' : t.priority === 'HIGH' ? '#f59e0b' : t.priority === 'MEDIUM' ? '#3b82f6' : '#9ca3af',
                      fontWeight: 600
                    }}>
                      {t.priority}
                    </span>
                    <span>{t.assignee?.name || 'Unassigned'}</span>
                  </div>

                  {blocked && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      color: '#f59e0b',
                      fontSize: '8px',
                      fontWeight: 600
                    }}>
                      <AlertTriangle size={8} /> blocked
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
