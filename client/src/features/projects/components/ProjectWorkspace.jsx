import React, { useState, useEffect } from 'react';
import { ChevronLeft, Folder, Users, Archive, LayoutGrid, CheckSquare, FileText, BarChart2 } from 'lucide-react';
import ProjectOverview from './ProjectOverview.jsx';
import ProjectMembers from './ProjectMembers.jsx';
import TasksTab from './TasksTab.jsx';
import RcasTab from './RcasTab.jsx';
import ReportsTab from './ReportsTab.jsx';
import NavbarNotificationBell from './NavbarNotificationBell.jsx';

export default function ProjectWorkspace({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [role, setRole] = useState('MEMBER'); // MANAGER, MEMBER, REVIEWER
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, members, tasks

  const fetchProjectDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load project details.');
      }
      setProject(data.project);
      setRole(data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const handleProjectUpdated = (updatedProject) => {
    setProject(updatedProject);
  };

  const handleArchiveToggle = (updatedProject) => {
    setProject(updatedProject);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading project workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-danger)', fontSize: '20px', marginBottom: '15px' }}>Access Blocked</h2>
        <div className="glass-panel" style={{ padding: '30px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{error}</p>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Return to Registry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      
      {/* Back button & Project Title Header */}
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: 0,
            fontSize: '13px',
            marginBottom: '15px'
          }}
        >
          <ChevronLeft size={16} />
          Back to Projects
        </button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Folder size={24} style={{ color: 'var(--color-accent)' }} />
              <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {project?.name}
              </h1>
              <span style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                Your Role: {role}
              </span>
            </div>
            {project?.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                {project.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {project?.status === 'ARCHIVED' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'var(--color-danger)',
                fontSize: '13px',
                fontWeight: 600
              }}>
                <Archive size={16} />
                <span>Project Archived (Read-Only)</span>
              </div>
            )}
            <NavbarNotificationBell />
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '30px',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <LayoutGrid size={16} />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckSquare size={16} />
          Tasks
        </button>

        <button
          onClick={() => setActiveTab('rcas')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'rcas' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'rcas' ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          RCAs
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'reports' ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BarChart2 size={16} />
          Reports
        </button>

        <button
          onClick={() => setActiveTab('members')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'members' ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          Members
        </button>
      </div>

      {/* Tab components */}
      <div>
        {activeTab === 'overview' && (
          <ProjectOverview
            project={project}
            role={role}
            onProjectUpdated={handleProjectUpdated}
            onArchiveToggle={handleArchiveToggle}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab
            project={project}
            role={role}
          />
        )}
        {activeTab === 'rcas' && (
          <RcasTab
            project={project}
            role={role}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab
            projectId={projectId}
          />
        )}
        {activeTab === 'members' && (
          <ProjectMembers
            project={project}
            role={role}
          />
        )}
      </div>

    </div>
  );
}
