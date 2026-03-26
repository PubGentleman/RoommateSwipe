import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getCompletionPercentage } from '../utils/profileReminderUtils';

type ReminderStage = 'waiting' | 'first_shown' | 'second_shown' | 'completed';

interface ProfileReminderContextType {
  showReminder: boolean;
  reminderStage: ReminderStage;
  dismissReminder: () => void;
}

const ProfileReminderContext = createContext<ProfileReminderContextType>({
  showReminder: false,
  reminderStage: 'completed',
  dismissReminder: () => {},
});

export const useProfileReminder = () => useContext(ProfileReminderContext);

export const ProfileReminderProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [showReminder] = useState(false);

  const reminderStage: ReminderStage = user && getCompletionPercentage(user) >= 100 ? 'completed' : 'waiting';

  const dismissReminder = useCallback(() => {}, []);

  return (
    <ProfileReminderContext.Provider value={{ showReminder, reminderStage, dismissReminder }}>
      {children}
    </ProfileReminderContext.Provider>
  );
};
