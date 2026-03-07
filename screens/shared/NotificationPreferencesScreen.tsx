import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';

interface PreferenceItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}

const PREFERENCE_SECTIONS: { title: string; items: PreferenceItem[] }[] = [
  {
    title: 'Matching',
    items: [
      {
        key: 'matches',
        label: 'New Matches',
        description: 'When someone you liked also likes you back',
        icon: 'heart',
      },
      {
        key: 'superLikes',
        label: 'Super Likes',
        description: 'When someone sends you a super like',
        icon: 'star',
      },
    ],
  },
  {
    title: 'Messaging',
    items: [
      {
        key: 'messages',
        label: 'New Messages',
        description: 'When you receive a new message',
        icon: 'message-circle',
      },
    ],
  },
  {
    title: 'Groups',
    items: [
      {
        key: 'groupInvites',
        label: 'Group Invitations',
        description: 'When you are invited to join a group',
        icon: 'user-plus',
      },
      {
        key: 'groupUpdates',
        label: 'Group Updates',
        description: 'When members join or leave your groups',
        icon: 'users',
      },
    ],
  },
  {
    title: 'Properties',
    items: [
      {
        key: 'propertyUpdates',
        label: 'Property Updates',
        description: 'When saved properties change status or price',
        icon: 'home',
      },
    ],
  },
  {
    title: 'Other',
    items: [
      {
        key: 'boostReminders',
        label: 'Boost Reminders',
        description: 'Reminders when your profile boost is available',
        icon: 'zap',
      },
      {
        key: 'systemAlerts',
        label: 'System Alerts',
        description: 'Important account and security updates',
        icon: 'shield',
      },
    ],
  },
];

const DEFAULT_PREFERENCES = {
  matches: true,
  superLikes: true,
  messages: true,
  groupInvites: true,
  groupUpdates: true,
  propertyUpdates: true,
  boostReminders: true,
  systemAlerts: true,
};

export const NotificationPreferencesScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();

  const [preferences, setPreferences] = useState(
    { ...DEFAULT_PREFERENCES, ...user?.notificationPreferences }
  );

  useEffect(() => {
    const merged = { ...DEFAULT_PREFERENCES, ...user?.notificationPreferences };
    setPreferences(merged);
    if (!user?.notificationPreferences) {
      updateUser({ notificationPreferences: merged });
    }
  }, [user?.notificationPreferences]);

  const handleToggle = async (key: string, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await updateUser({ notificationPreferences: updated });
  };

  const handleEnableAll = async () => {
    const allEnabled = { ...DEFAULT_PREFERENCES };
    setPreferences(allEnabled);
    await updateUser({ notificationPreferences: allEnabled });
  };

  const handleDisableAll = async () => {
    const allDisabled = Object.fromEntries(
      Object.keys(DEFAULT_PREFERENCES).map(k => [k, k === 'systemAlerts' ? true : false])
    ) as typeof DEFAULT_PREFERENCES;
    setPreferences(allDisabled);
    await updateUser({ notificationPreferences: allDisabled });
  };

  const allEnabled = Object.entries(preferences).every(([_, v]) => v);
  const allDisabledExceptSystem = Object.entries(preferences)
    .filter(([k]) => k !== 'systemAlerts')
    .every(([_, v]) => !v);

  return (
    <ScreenScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ backgroundColor: '#111111' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={theme.primary} />
          </Pressable>
          <ThemedText style={Typography.h2}>Notification Preferences</ThemedText>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickActionButton, { backgroundColor: '#1a1a1a' }]}
            onPress={handleEnableAll}
            disabled={allEnabled}
          >
            <Feather name="bell" size={16} color={allEnabled ? theme.textSecondary : theme.primary} />
            <ThemedText style={[Typography.caption, {
              color: allEnabled ? theme.textSecondary : theme.primary,
              fontWeight: '600',
              marginLeft: Spacing.xs,
            }]}>
              Enable All
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.quickActionButton, { backgroundColor: '#1a1a1a' }]}
            onPress={handleDisableAll}
            disabled={allDisabledExceptSystem}
          >
            <Feather name="bell-off" size={16} color={allDisabledExceptSystem ? theme.textSecondary : theme.error} />
            <ThemedText style={[Typography.caption, {
              color: allDisabledExceptSystem ? theme.textSecondary : theme.error,
              fontWeight: '600',
              marginLeft: Spacing.xs,
            }]}>
              Disable All
            </ThemedText>
          </Pressable>
        </View>

        {PREFERENCE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText style={[Typography.h3, styles.sectionTitle]}>
              {section.title}
            </ThemedText>
            <View style={[styles.sectionCard, { backgroundColor: '#1a1a1a' }]}>
              {section.items.map((item, index) => {
                const isEnabled = preferences[item.key as keyof typeof preferences];
                const isSystemAlert = item.key === 'systemAlerts';
                return (
                  <View key={item.key}>
                    <View style={styles.preferenceRow}>
                      <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                        <Feather name={item.icon} size={18} color={theme.primary} />
                      </View>
                      <View style={styles.textContainer}>
                        <ThemedText style={[Typography.body, { fontWeight: '500' }]}>
                          {item.label}
                        </ThemedText>
                        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                          {item.description}
                        </ThemedText>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={(value) => handleToggle(item.key, value)}
                        trackColor={{ false: theme.backgroundTertiary, true: theme.primary + '60' }}
                        thumbColor={isEnabled ? theme.primary : theme.textSecondary}
                        disabled={isSystemAlert}
                      />
                    </View>
                    {index < section.items.length - 1 ? (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Feather name="info" size={14} color={theme.textSecondary} />
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }]}>
            System alerts cannot be disabled as they contain important account and security information.
          </ThemedText>
        </View>
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 32,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  sectionCard: {
    borderRadius: BorderRadius.medium,
    overflow: 'hidden',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  divider: {
    height: 1,
    marginLeft: 36 + Spacing.lg + Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
