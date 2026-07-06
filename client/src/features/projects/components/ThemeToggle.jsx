import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../auth/context/ThemeContext.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme, error } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'LIGHT' ? 'dark' : 'light'} theme`}
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'var(--transition-smooth)'
        }}
      >
        {theme === 'LIGHT' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      {error && (
        <span style={{
          position: 'absolute',
          top: '40px',
          right: 0,
          whiteSpace: 'nowrap',
          background: 'var(--color-danger)',
          color: '#fff',
          fontSize: '10px',
          padding: '4px 8px',
          borderRadius: '4px',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
