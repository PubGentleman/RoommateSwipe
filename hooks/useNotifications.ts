import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StorageService } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

const POLL_INTERVAL = 10000;

export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await StorageService.getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('[useNotifications] Error fetching unread count:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshUnreadCount();

    intervalRef.current = setInterval(refreshUnreadCount, POLL_INTERVAL);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshUnreadCount();
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [refreshUnreadCount]);

  return {
    unreadCount,
    refreshUnreadCount,
  };
}
