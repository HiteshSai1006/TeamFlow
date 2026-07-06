import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext.jsx';
import { ThemeProvider } from './features/auth/context/ThemeContext.jsx';
import Login from './features/auth/components/Login.jsx';
import Register from './features/auth/components/Register.jsx';
import MyProjects from './features/projects/components/MyProjects.jsx';
import ProjectWorkspace from './features/projects/components/ProjectWorkspace.jsx';
import { NotificationProvider } from './features/projects/components/NotificationProvider.jsx';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, initializing } = useAuth();
  const [view, setView] = useState('login'); // 'login' or 'register'
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [restoredProjectUserId, setRestoredProjectUserId] = useState(null);

  // Restore active project ID once the authenticated user context is known
  useEffect(() => {
    if (!initializing) {
      if (user) {
        const saved = localStorage.getItem(`teamflow:activeProject:${user.id}`);
        if (saved) {
          setActiveProjectId(saved);
        } else {
          setActiveProjectId(null);
        }
        setRestoredProjectUserId(user.id);
      } else {
        setActiveProjectId(null);
        setRestoredProjectUserId(null);
      }
    }
  }, [user, initializing]);

  // Persist project updates after initial restoration finishes
  useEffect(() => {
    if (user && restoredProjectUserId === user.id) {
      if (activeProjectId) {
        localStorage.setItem(`teamflow:activeProject:${user.id}`, activeProjectId);
      } else {
        localStorage.removeItem(`teamflow:activeProject:${user.id}`);
      }
    }
  }, [activeProjectId, restoredProjectUserId, user]);

  if (initializing) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '15px',
      }}>
        <Loader2 className="spinner" size={40} style={{ color: 'var(--color-accent)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading TeamFlow secure session...</p>
      </div>
    );
  }

  if (!user) {
    if (view === 'register') {
      return <Register onSwitchToLogin={() => setView('login')} />;
    }
    return <Login onSwitchToRegister={() => setView('register')} />;
  }

  if (activeProjectId) {
    return (
      <ProjectWorkspace
        projectId={activeProjectId}
        userId={user.id}
        onBack={() => setActiveProjectId(null)}
      />
    );
  }

  return <MyProjects onSelectProject={setActiveProjectId} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
