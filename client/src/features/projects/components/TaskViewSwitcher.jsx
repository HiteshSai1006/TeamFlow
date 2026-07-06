import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';

export default function TaskViewSwitcher({ viewMode, onChange, loading }) {
  const modes = [
    {
      key: 'KANBAN',
      label: 'Kanban Board',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      )
    },
    {
      key: 'CALENDAR',
      label: 'Calendar View',
      icon: <Calendar size={14} />
    },
    {
      key: 'LIST',
      label: 'List View',
      icon: <CheckSquare size={14} />
    }
  ];

  return (
    <div style={{
      display: 'flex',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '4px',
      gap: '4px',
      width: 'fit-content',
      alignItems: 'center',
      opacity: loading ? 0.6 : 1,
      pointerEvents: loading ? 'none' : 'auto',
      transition: 'opacity 0.2s'
    }}>
      {modes.map((mode) => {
        const isActive = viewMode === mode.key;
        return (
          <button
            key={mode.key}
            onClick={() => onChange(mode.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {mode.icon}
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
