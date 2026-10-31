import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { Bell, CheckCheck, Clock, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const QuietNotificationCenter: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    isOpen, 
    setIsOpen, 
    markAsRead, 
    markAllRead,
    rollingCount 
  } = useNotifications();

  const { preferences } = usePreferences();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/20 backdrop-blur-xs animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-sm sm:max-w-md bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] mt-12 text-ink-primary dark:text-nightText-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-paper-border dark:border-night-border bg-paper-cream/50 dark:bg-night-surface/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-sage-600 dark:text-sage-400" />
            <h3 className="font-serif text-base font-semibold">
              Quiet Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-terracotta-500 text-white">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-sage-700 dark:text-sage-300 hover:underline flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>All read</span>
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-ink-muted hover:text-ink-primary dark:hover:text-nightText-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quiet System Policy Banner */}
        <div className="px-4 py-2.5 bg-sage-50/70 dark:bg-sage-950/20 border-b border-sage-200/50 dark:border-sage-900/30 text-xs text-ink-secondary dark:text-nightText-secondary">
          <div className="flex items-center justify-between font-medium text-sage-800 dark:text-sage-300 mb-0.5">
            <span>Quiet Rate Limits Respected</span>
            <span>{rollingCount} / 2 in 3h</span>
          </div>
          <p className="text-[11px] text-ink-muted dark:text-nightText-muted leading-tight">
            Maximum 2 notifications per rolling 3-hour window. Stories cooldown for 6h to eliminate headline fatigue.
          </p>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-paper-borderSubtle dark:divide-night-borderSubtle">
          {notifications.length > 0 ? (
            notifications.map(n => {
              const isUnread = !n.readAt;
              return (
                <div 
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-4 transition-colors cursor-pointer ${
                    isUnread
                      ? 'bg-paper-light dark:bg-night-surface/60'
                      : 'hover:bg-paper-cream/40 dark:hover:bg-night-surface/30 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      {n.priority === 'critical' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-terracotta-600 flex-shrink-0" />
                      ) : n.isDigest ? (
                        <Sparkles className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${isUnread ? 'bg-sage-600' : 'bg-transparent'}`} />
                      )}
                      <h4 className={`text-xs sm:text-sm ${isUnread ? 'font-bold text-ink-primary dark:text-nightText-primary' : 'font-medium text-ink-secondary dark:text-nightText-secondary'}`}>
                        {n.title}
                      </h4>
                    </div>

                    <span className="text-[10px] text-ink-muted whitespace-nowrap">
                      {new Date(n.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-ink-secondary dark:text-nightText-secondary line-clamp-2 pl-3.5">
                    {n.body}
                  </p>

                  {n.storyId && (
                    <div className="pl-3.5 mt-2">
                      <Link
                        to={`/stories/${n.storyId}`}
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-medium text-sage-700 dark:text-sage-300 hover:underline"
                      >
                        Read development →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-ink-muted">
              No notifications. Your feed is tranquil.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-paper-cream/30 dark:bg-night-surface/30 border-t border-paper-borderSubtle dark:border-night-borderSubtle flex items-center justify-between text-xs text-ink-muted">
          <span>Quiet Hours: {preferences.quietHoursStart} – {preferences.quietHoursEnd}</span>
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="text-sage-700 dark:text-sage-300 hover:underline"
          >
            Preferences
          </Link>
        </div>
      </div>
    </div>
  );
};
