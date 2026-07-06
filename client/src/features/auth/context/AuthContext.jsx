import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch the current user profile on startup
  const fetchMe = useCallback(async () => {
    setInitializing(true);
    setError(null);
    try {
      // Must include credentials to pass HttpOnly session cookies
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);

        // Fetch theme preference in sequence while blocking UI
        try {
          const prefRes = await fetch('/api/users/me/preferences', { credentials: 'include' });
          if (prefRes.ok) {
            const prefData = await prefRes.json();
            const theme = prefData.preference?.theme || 'LIGHT';
            document.documentElement.setAttribute('data-theme', theme.toLowerCase());
          } else {
            document.documentElement.setAttribute('data-theme', 'light');
          }
        } catch (prefErr) {
          console.error('[AuthContext] Failed to fetch theme:', prefErr);
          document.documentElement.setAttribute('data-theme', 'light');
        }
      } else {
        setUser(null);
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (err) {
      console.error('[AuthContext] Failed to fetch current user:', err);
      setUser(null);
      document.documentElement.setAttribute('data-theme', 'light');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  /**
   * Submits credentials to login endpoint
   */
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials.');
      }

      // Fetch theme preference after login
      try {
        const prefRes = await fetch('/api/users/me/preferences', { credentials: 'include' });
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          const theme = prefData.preference?.theme || 'LIGHT';
          document.documentElement.setAttribute('data-theme', theme.toLowerCase());
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      } catch (prefErr) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submits details to registration endpoint
   */
  const register = async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      // Apply default LIGHT theme for new registers
      document.documentElement.setAttribute('data-theme', 'light');

      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Invokes logout endpoint to clear HttpOnly cookie
   */
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('[AuthContext] Logout endpoint error:', err);
    } finally {
      document.documentElement.setAttribute('data-theme', 'light');
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, initializing, loading, error, login, register, logout, checkAuth: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
