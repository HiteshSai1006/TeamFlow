import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('LIGHT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const latestThemeRef = useRef('LIGHT');

  // Sync state with HTML attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme.toLowerCase());
  }, [theme]);

  // Sync theme state if user context changes
  useEffect(() => {
    if (user) {
      const getPref = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/users/me/preferences', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const serverTheme = data.preference?.theme || 'LIGHT';
            setTheme(serverTheme);
            latestThemeRef.current = serverTheme;
          }
        } catch (err) {
          console.error('[ThemeProvider] Error getting user preference:', err);
        } finally {
          setLoading(false);
        }
      };
      getPref();
    } else {
      setTheme('LIGHT');
      latestThemeRef.current = 'LIGHT';
    }
  }, [user]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'LIGHT' ? 'DARK' : 'LIGHT';
    const previousTheme = theme;

    // Optimistic UI state update
    setTheme(nextTheme);
    latestThemeRef.current = nextTheme;
    setError(null);

    if (user) {
      try {
        const res = await fetch('/api/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: nextTheme }),
          credentials: 'include'
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to persist theme preference.');
        }
      } catch (err) {
        console.error('[ThemeProvider] Save failed:', err);
        // Rollback only when the failed request still corresponds to the latest requested theme
        if (latestThemeRef.current === nextTheme) {
          setTheme(previousTheme);
          latestThemeRef.current = previousTheme;
        }
        setError(err.message || 'Failed to save theme preference.');
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, loading, error }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
