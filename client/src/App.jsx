import React, { useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext.jsx';
import Login from './features/auth/components/Login.jsx';
import Register from './features/auth/components/Register.jsx';
import AppShell from './features/auth/components/AppShell.jsx';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, initializing } = useAuth();
  const [view, setView] = useState('login'); // 'login' or 'register'

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

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
