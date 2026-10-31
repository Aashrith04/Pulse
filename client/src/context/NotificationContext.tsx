import React, { createContext, useContext, useState, useEffect } from 'react';
import { NotificationRecord } from '../types';
import { api } from '../utils/api';

interface NotificationContextType {
  notifications: NotificationRecord[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  rollingCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      // Quiet fallback
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await api.markNotificationRead(id).catch(() => {});
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, readAt: now })));
    setUnreadCount(0);
    await api.markAllNotificationsRead().catch(() => {});
  };

  // Count notifications in the last 3 hours to communicate quiet limit adherence
  const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
  const rollingCount = notifications.filter(n => new Date(n.deliveredAt).getTime() >= threeHoursAgo && n.priority !== 'critical').length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        markAsRead,
        markAllRead,
        refresh,
        rollingCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
