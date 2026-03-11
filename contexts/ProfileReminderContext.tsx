import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { getCompletionPercentage } from '../utils/profileReminderUtils';

type ReminderStage = 'waiting' | 'first_shown' | 'second_shown' | 'completed';

const STORAGE_PREFIX = 'profileReminder_';
const FIRST_DELAY_MS = 5 * 60 * 1000;
const SECOND_DELAY_MS = 30 * 60 * 1000;
const NEXT_DAY_CHECK_INTERVAL = 60 * 1000;

interface ProfileReminderContextType {
  showReminder: boolean;
  reminderStage: ReminderStage;
  dismissReminder: () => void;
}

const ProfileReminderContext = createContext<ProfileReminderContextType>({
  showReminder: false,
  reminderStage: 'waiting',
  dismissReminder: () => {},
});

export const useProfileReminder = () => useContext(ProfileReminderContext);

export const ProfileReminderProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [reminderStage, setReminderStage] = useState<ReminderStage>('waiting');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextDayCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fireAtRef = useRef<number | null>(null);
  const dismissingRef = useRef(false);

  const userId = user?.id;
  const isOnboarded = user?.onboardingStep === 'complete' || (!user?.onboardingStep && !!user);

  const storageKey = useCallback((suffix: string) => `${STORAGE_PREFIX}${userId}_${suffix}`, [userId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    fireAtRef.current = null;
  }, []);

  const clearNextDayCheck = useCallback(() => {
    if (nextDayCheckRef.current) {
      clearInterval(nextDayCheckRef.current);
      nextDayCheckRef.current = null;
    }
  }, []);

  const profileComplete = useCallback(() => {
    if (!user) return false;
    return getCompletionPercentage(user) >= 100;
  }, [user]);

  const scheduleReminder = useCallback((delayMs: number) => {
    clearTimer();
    fireAtRef.current = Date.now() + delayMs;
    timerRef.current = setTimeout(() => {
      fireAtRef.current = null;
      setShowReminder(true);
    }, delayMs);
  }, [clearTimer]);

  const startNextDayPolling = useCallback((targetDate: string) => {
    clearNextDayCheck();
    const check = () => {
      const today = new Date().toISOString().split('T')[0];
      if (today >= targetDate) {
        clearNextDayCheck();
        setShowReminder(true);
        sendReminderEmailFn();
      }
    };
    check();
    nextDayCheckRef.current = setInterval(check, NEXT_DAY_CHECK_INTERVAL);
  }, [clearNextDayCheck]);

  const sendReminderEmailFn = useCallback(() => {
    if (!user?.email) return;
    try {
      supabase.functions.invoke('send-profile-reminder-email', {
        body: {
          userId: user.id,
          email: user.email,
          name: user.name || 'there',
        },
      }).catch(() => {});
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!userId || !isOnboarded) return;
    if (profileComplete()) {
      setReminderStage('completed');
      return;
    }

    const loadStage = async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey('stage'));

        if (saved === 'completed') {
          setReminderStage('completed');
          return;
        }

        if (saved === 'second_shown') {
          setReminderStage('second_shown');
          const nextDayStr = await AsyncStorage.getItem(storageKey('nextDayDate'));
          if (nextDayStr) {
            startNextDayPolling(nextDayStr);
          }
          return;
        }

        if (saved === 'first_shown') {
          setReminderStage('first_shown');
          const dismissedAt = await AsyncStorage.getItem(storageKey('firstDismissedAt'));
          if (dismissedAt) {
            const elapsed = Date.now() - parseInt(dismissedAt, 10);
            const remaining = Math.max(SECOND_DELAY_MS - elapsed, 0);
            scheduleReminder(remaining);
          } else {
            scheduleReminder(SECOND_DELAY_MS);
          }
          return;
        }

        setReminderStage('waiting');
        scheduleReminder(FIRST_DELAY_MS);
      } catch {
        scheduleReminder(FIRST_DELAY_MS);
      }
    };

    loadStage();

    return () => {
      clearTimer();
      clearNextDayCheck();
    };
  }, [userId, isOnboarded]);

  useEffect(() => {
    if (profileComplete() && reminderStage !== 'completed') {
      clearTimer();
      clearNextDayCheck();
      setShowReminder(false);
      setReminderStage('completed');
      if (userId) {
        AsyncStorage.setItem(storageKey('stage'), 'completed').catch(() => {});
      }
    }
  }, [user?.profileData, user?.photos, profileComplete, reminderStage, clearTimer, clearNextDayCheck, userId, storageKey]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (fireAtRef.current !== null && timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else if (nextState === 'active') {
        if (fireAtRef.current !== null && !timerRef.current) {
          const remaining = Math.max(fireAtRef.current - Date.now(), 0);
          timerRef.current = setTimeout(() => {
            fireAtRef.current = null;
            setShowReminder(true);
          }, remaining);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  const dismissReminder = useCallback(async () => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setShowReminder(false);

    if (!userId) {
      dismissingRef.current = false;
      return;
    }

    try {
      if (reminderStage === 'waiting') {
        setReminderStage('first_shown');
        await AsyncStorage.setItem(storageKey('stage'), 'first_shown');
        await AsyncStorage.setItem(storageKey('firstDismissedAt'), Date.now().toString());
        scheduleReminder(SECOND_DELAY_MS);
      } else if (reminderStage === 'first_shown') {
        setReminderStage('second_shown');
        await AsyncStorage.setItem(storageKey('stage'), 'second_shown');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        await AsyncStorage.setItem(storageKey('nextDayDate'), tomorrowStr);
        startNextDayPolling(tomorrowStr);
      } else if (reminderStage === 'second_shown') {
        setReminderStage('completed');
        await AsyncStorage.setItem(storageKey('stage'), 'completed');
      }
    } finally {
      dismissingRef.current = false;
    }
  }, [userId, reminderStage, scheduleReminder, storageKey, startNextDayPolling]);

  return (
    <ProfileReminderContext.Provider value={{ showReminder, reminderStage, dismissReminder }}>
      {children}
    </ProfileReminderContext.Provider>
  );
};
