import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StorageService } from '../utils/storage';
import { useAuth } from './AuthContext';
import { Notification } from '../types/models';
import { NotificationToast, ToastNotification } from '../components/NotificationToast';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  showToast: (toast: ToastNotification) => void;
  lastNotificationId: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  showToast: () => {},
  lastNotificationId: null,
});

export const useNotificationContext = () => useContext(NotificationContext);

const POLL_INTERVAL = 5000;

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastNotification[]>([]);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const lastSeenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== user?.id) {
      setUnreadCount(0);
      setCurrentToast(null);
      setToastQueue([]);
      setLastNotificationId(null);
      lastSeenIdsRef.current = new Set();
      initialLoadRef.current = true;
    }
    prevUserIdRef.current = user?.id || null;
  }, [user?.id]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await StorageService.getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      // silently fail
    }
  }, [user?.id]);

  const enqueueToast = useCallback((toast: ToastNotification) => {
    setCurrentToast(prev => {
      if (prev === null) {
        return toast;
      }
      setToastQueue(q => [...q, toast]);
      return prev;
    });
  }, []);

  const checkForNewNotifications = useCallback(async () => {
    if (!user?.id || user.onboardingStep !== 'complete') return;
    try {
      const notifications = await StorageService.getNotifications(user.id);
      const count = notifications.filter(n => !n.isRead).length;
      setUnreadCount(count);

      if (initialLoadRef.current) {
        notifications.forEach(n => lastSeenIdsRef.current.add(n.id));
        initialLoadRef.current = false;
        return;
      }

      const blockedIds = user.blockedUsers || [];
      const newNotifications = notifications
        .filter(
          n => !lastSeenIdsRef.current.has(n.id) &&
               (!n.data?.fromUserId || !blockedIds.includes(n.data.fromUserId))
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (newNotifications.length > 0) {
        newNotifications.forEach(n => lastSeenIdsRef.current.add(n.id));
        setLastNotificationId(newNotifications[newNotifications.length - 1].id);

        for (const notif of newNotifications) {
          enqueueToast({
            id: notif.id,
            title: notif.title,
            body: notif.body,
            type: notif.type,
          });
        }
      }
    } catch (error) {
      // silently fail
    }
  }, [user?.id, user?.onboardingStep, user?.blockedUsers, enqueueToast]);

  const showToast = useCallback((toast: ToastNotification) => {
    enqueueToast(toast);
  }, [enqueueToast]);

  const handleDismissToast = useCallback(() => {
    setCurrentToast(null);
    setTimeout(() => {
      setToastQueue(prev => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          setCurrentToast(next);
          return rest;
        }
        return prev;
      });
    }, 300);
  }, []);

  useEffect(() => {
    if (!user?.id || user.onboardingStep !== 'complete') {
      setUnreadCount(0);
      return;
    }

    initialLoadRef.current = true;
    lastSeenIdsRef.current = new Set();
    checkForNewNotifications();

    intervalRef.current = setInterval(checkForNewNotifications, POLL_INTERVAL);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkForNewNotifications();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [user?.id, user?.onboardingStep]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, showToast, lastNotificationId }}>
      {children}
      <NotificationToast notification={currentToast} onDismiss={handleDismissToast} />
    </NotificationContext.Provider>
  );
};
