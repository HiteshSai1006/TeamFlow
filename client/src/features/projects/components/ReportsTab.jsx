import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertCircle, Calendar, TrendingUp, Sparkles, 
  Clock, UserCheck, BarChart2, ShieldAlert, CheckCircle2 
} from 'lucide-react';

export default function ReportsTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/reports/summary`, {
          credentials: 'include'
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to fetch project reports.');
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Compiling live analytics data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const {
    completion,
    taskStatus,
    taskPriority,
    overdue,
    workload,
    velocity,
    rcaVolume,
    rcaStatus,
    rcaSeverity,
    projectHealth
  } = data;

  const activeCount = taskStatus.TODO + taskStatus.IN_PROGRESS + taskStatus.BLOCKED;

  // Health Badge styles
  const getHealthColor = (label) => {
    if (label === 'HEALTHY') return 'var(--color-success)';
    if (label === 'AT_RISK') return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
      
      {/* Advantage & Tradeoff Notice Banner */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: '1.4'
      }}>
        💡 <strong>Live Processing Active:</strong> Dashboard figures reflect the live, transactional state of the database at the time of your request. Slower loading speeds may occur on very large projects.
      </div>

      {/* 1. TOP SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Completion Rate Card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '10px', color: 'var(--color-accent)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Completion Rate</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-display)' }}>
              {completion.completionRate}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {completion.completedTasks} of {completion.totalTasks} tasks done
            </div>
          </div>
        </div>

        {/* Active Tasks Card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', color: 'var(--text-primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Backlog</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-display)' }}>
              {activeCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Tasks currently in progress
            </div>
          </div>
        </div>

        {/* Overdue Tasks Card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ padding: '10px', background: overdue.count > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', color: overdue.count > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Overdue Tasks</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-display)', color: overdue.count > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
              {overdue.count}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Unfinished past due dates
            </div>
          </div>
        </div>

        {/* Project Health Card */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ padding: '10px', background: `${getHealthColor(projectHealth.label)}15`, borderRadius: '10px', color: getHealthColor(projectHealth.label) }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Project Health</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-display)', color: getHealthColor(projectHealth.label) }}>
              {projectHealth.score}/100
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {projectHealth.label}
            </div>
          </div>
        </div>

      </div>

      {/* Project Health Breakdown */}
      {projectHealth.factors.length > 0 && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={14} style={{ color: 'var(--color-warning)' }} />
            Health Score Deduction Factors
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {projectHealth.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. TASK DISTRIBUTIONS */}
      <div className="reports-grid">
        
        {/* Status Distribution */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <BarChart2 size={16} />
            Task Status Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(taskStatus).map(([status, count]) => {
              const pct = completion.totalTasks > 0 ? ((count / completion.totalTasks) * 100).toFixed(0) : 0;
              return (
                <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{status}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: status === 'DONE' ? 'var(--color-success)' :
                                 status === 'BLOCKED' ? 'var(--color-danger)' :
                                 status === 'IN_PROGRESS' ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <BarChart2 size={16} />
            Task Priority Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(taskPriority).map(([priority, count]) => {
              const pct = completion.totalTasks > 0 ? ((count / completion.totalTasks) * 100).toFixed(0) : 0;
              return (
                <div key={priority} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{priority}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: priority === 'CRITICAL' ? 'var(--color-danger)' :
                                 priority === 'HIGH' ? 'var(--color-warning)' :
                                 priority === 'MEDIUM' ? 'var(--color-accent)' : 'rgba(255,255,255,0.3)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. TRENDS SECTION */}
      <div className="reports-grid">
        
        {/* Velocity Trend */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <TrendingUp size={16} />
            Weekly Task Velocity (Last 6 Weeks)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {velocity.map(week => {
              const maxCompleted = Math.max(1, ...velocity.map(w => w.completedTasks));
              const heightPct = ((week.completedTasks / maxCompleted) * 100).toFixed(0);
              return (
                <div key={week.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '130px', flexShrink: 0 }}>{week.label}</span>
                  <div style={{ flex: 1, height: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${heightPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.4), var(--color-accent))',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, width: '24px', textAlign: 'right' }}>{week.completedTasks}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RCA Creation Volume */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <TrendingUp size={16} />
            RCA Volume Trend (Last 6 Weeks)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {rcaVolume.trend.map(week => {
              const maxRcas = Math.max(1, ...rcaVolume.trend.map(w => w.createdRcas));
              const heightPct = ((week.createdRcas / maxRcas) * 100).toFixed(0);
              return (
                <div key={week.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '130px', flexShrink: 0 }}>{week.label}</span>
                  <div style={{ flex: 1, height: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${heightPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.4), var(--color-danger))',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, width: '24px', textAlign: 'right' }}>{week.createdRcas}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. WORKLOAD PER ASSIGNEE */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', overflowX: 'auto' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
          <UserCheck size={16} />
          Workload by Assignee (Threshold: &gt;5 Active is High)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Assigned</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Active Tasks</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Completed Tasks</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Workload Status</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((user, idx) => {
              const isOverloaded = user.activeTasks > 5;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '13px', background: isOverloaded ? 'rgba(245, 158, 11, 0.03)' : 'transparent' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                    {user.name}
                    {user.email && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{user.email}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{user.role || 'N/A'}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{user.totalAssigned}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: isOverloaded ? 'var(--color-warning)' : 'var(--text-primary)' }}>{user.activeTasks}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--color-success)', fontWeight: 600 }}>{user.completedTasks}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {isOverloaded ? (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', fontWeight: 600 }}>
                        High Workload
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-success)', fontWeight: 600 }}>
                        Balanced
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5. RCA STATUS & SEVERITY */}
      <div className="reports-grid">
        
        {/* RCA Status Distribution */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <BarChart2 size={16} />
            RCA Status Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(rcaStatus).map(([status, count]) => {
              const pct = rcaVolume.total > 0 ? ((count / rcaVolume.total) * 100).toFixed(0) : 0;
              return (
                <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{status}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: status === 'CLOSED' ? 'var(--color-success)' :
                                 status === 'UNDER_REVIEW' ? 'var(--color-accent)' :
                                 status === 'REJECTED' ? 'var(--color-danger)' : 'rgba(255,255,255,0.3)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RCA Severity Distribution */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
            <BarChart2 size={16} />
            RCA Severity Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(rcaSeverity).map(([severity, count]) => {
              const pct = rcaVolume.total > 0 ? ((count / rcaVolume.total) * 100).toFixed(0) : 0;
              return (
                <div key={severity} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{severity}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: severity === 'CRITICAL' ? 'var(--color-danger)' :
                                 severity === 'HIGH' ? 'var(--color-warning)' :
                                 severity === 'MEDIUM' ? 'var(--color-accent)' : 'rgba(255,255,255,0.3)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 6. OVERDUE TASK LIST */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', color: overdue.count > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
          <AlertCircle size={16} />
          Overdue Tasks List ({overdue.count})
        </h3>
        {overdue.count === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-success)', fontSize: '13px', background: 'rgba(16, 185, 129, 0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle2 size={16} />
            <span>Excellent. No overdue tasks in this project!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {overdue.tasks.map(task => (
              <div key={task.id} style={{
                padding: '14px 16px',
                background: 'rgba(0,0,0,0.1)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{task.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Assignee: <strong style={{ color: 'var(--text-primary)' }}>{task.assignee ? task.assignee.name : 'Unassigned'}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                    color: task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'var(--color-danger)' : 'var(--text-secondary)'
                  }}>
                    {task.priority}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
