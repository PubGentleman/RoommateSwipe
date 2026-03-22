import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useProfileReminder } from '../contexts/ProfileReminderContext';
import { RhomeAISheet } from './RhomeAISheet';

export const ProfileReminderOverlay = () => {
  const { showReminder, reminderStage, dismissReminder } = useProfileReminder();
  const navigation = useNavigation();

  const headingByStage = {
    waiting: "Quick tip to get more matches",
    first_shown: "Your profile is still incomplete",
    second_shown: "Last reminder \u2014 finish your profile!",
    completed: "",
  };

  return (
    <RhomeAISheet
      visible={showReminder}
      onDismiss={dismissReminder}
      screenContext="profile_reminder"
      contextData={{
        profileReminder: {
          heading: headingByStage[reminderStage] || headingByStage.waiting,
          subtext: reminderStage === 'second_shown'
            ? "Complete your profile to unlock better matches. We won't remind you again after this."
            : undefined,
        },
      }}
      onNavigate={(screen, params) => {
        if (screen === 'ProfileQuestionnaire') {
          (navigation as any).navigate('Profile', { screen: 'ProfileQuestionnaire', params });
        } else {
          (navigation as any).navigate(screen, params);
        }
      }}
    />
  );
};
