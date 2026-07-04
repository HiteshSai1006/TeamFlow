import React from 'react';
import HealthStatus from './features/health/components/HealthStatus.jsx';

export default function App() {
  return (
    <main style={{ minHeight: '100vh', padding: '20px 0' }}>
      <HealthStatus />
    </main>
  );
}
