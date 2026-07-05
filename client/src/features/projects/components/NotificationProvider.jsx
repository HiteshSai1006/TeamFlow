import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/context/AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailOptOut, setEmailOptOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch notifications.');
      setNotifications(data.notifications || []);
      const unread = (data.notifications || []).filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.preference) {
        setEmailOptOut(data.preference.emailOptOut);
      }
    } catch (err) {
      console.error('Failed to fetch user email preferences:', err);
    }
  }, [user]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const toggleEmailPreference = async (optOutVal) => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOptOut: optOutVal }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.preference) {
        setEmailOptOut(data.preference.emailOptOut);
      }
    } catch (err) {
      console.error('Failed to toggle email preference:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();
      // Poll notifications every 8 seconds for real-time update
      const interval = setInterval(fetchNotifications, 8000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setEmailOptOut(false);
    }
  }, [user, fetchNotifications, fetchPreferences]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      emailOptOut,
      loading,
      error,
      refresh: fetchNotifications,
      markAsRead,
      markAllAsRead,
      toggleEmailPreference
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
