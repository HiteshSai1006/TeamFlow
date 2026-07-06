import React from 'react';
import { useNotifications } from './NotificationProvider.jsx';
import { Mail, Check, BellOff, Loader2 } from 'lucide-react';

export default function NotificationPanel({ onClose }) {
  const {
    notifications,
    emailOptOut,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    toggleEmailPreference
  } = useNotifications();

  return (
    <div className="notification-dropdown">
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Notifications</h3>
        <button
          onClick={markAllAsRead}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Mark all as read
        </button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: '200px',
        maxHeight: '340px'
      }}>
        {loading && notifications.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px' }}>
            <Loader2 className="spinner" size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
        )}

        {error && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '180px',
            color: 'var(--text-secondary)',
            gap: '8px'
          }}>
            <BellOff size={28} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '13px' }}>No notifications yet</span>
          </div>
        )}

        {notifications.map(notif => (
          <div
            key={notif.id}
            onClick={() => { if (!notif.read) markAsRead(notif.id); }}
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              cursor: notif.read ? 'default' : 'pointer',
              background: notif.read ? 'transparent' : 'rgba(255,255,255,0.02)',
              transition: 'background 0.2s',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            {/* Unread Indicator Dot */}
            <div style={{ marginTop: '5px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: notif.read ? 'transparent' : 'var(--color-accent)',
                border: notif.read ? 'none' : '1px solid rgba(255,255,255,0.1)'
              }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: notif.read ? 500 : 600,
                color: notif.read ? 'var(--text-secondary)' : 'var(--text-primary)'
              }}>
                {notif.title}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginTop: '4px',
                lineHeight: '1.4'
              }}>
                {notif.message}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.3)',
                marginTop: '6px'
              }}>
                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Action Checkmark (Only shown if unread) */}
            {!notif.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(notif.id);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Mark as read"
              >
                <Check size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer Preference Panel */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Mail size={14} />
          <span style={{ fontSize: '12px' }}>Email Notifications</span>
        </div>
        <label className="switch" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!emailOptOut}
            onChange={(e) => toggleEmailPreference(!e.target.checked)}
            style={{ marginRight: '6px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '11px', fontWeight: 500, color: !emailOptOut ? 'var(--color-accent)' : 'var(--text-secondary)' }}>
            {!emailOptOut ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>
    </div>
  );
}
