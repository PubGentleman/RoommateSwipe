import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

export const ProfileScreen = () => {
  const theme = useTheme();
  const { user, logout } = useAuth();

  const getRoleBadgeColor = () => {
    if (!user) return Colors[theme].primary;
    switch (user.role) {
      case 'renter':
        return Colors[theme].renterBadge;
      case 'host':
        return Colors[theme].hostBadge;
      case 'agent':
        return Colors[theme].agentBadge;
      default:
        return Colors[theme].primary;
    }
  };

  const getRoleLabel = () => {
    if (!user) return 'User';
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const MenuItem = ({ icon, label, onPress, danger }: any) => (
    <Pressable
      style={[styles.menuItem, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={onPress}
    >
      <Feather name={icon} size={20} color={danger ? Colors[theme].error : Colors[theme].text} />
      <ThemedText style={[Typography.body, { flex: 1, marginLeft: Spacing.lg, color: danger ? Colors[theme].error : Colors[theme].text }]}>
        {label}
      </ThemedText>
      <Feather name="chevron-right" size={20} color={Colors[theme].textSecondary} />
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: Colors[theme].backgroundSecondary }]}>
              <Feather name="user" size={48} color={Colors[theme].textSecondary} />
            </View>
            <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor() }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                {getRoleLabel()}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[Typography.h1, styles.name]}>{user?.name || 'User'}</ThemedText>
          <ThemedText style={[Typography.body, { color: Colors[theme].textSecondary }]}>
            {user?.email}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Account</ThemedText>
          <MenuItem icon="edit-3" label="Edit Profile" onPress={() => {}} />
          <MenuItem icon="bell" label="Notifications" onPress={() => {}} />
          <MenuItem icon="shield" label="Privacy & Security" onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Support</ThemedText>
          <MenuItem icon="help-circle" label="Help Center" onPress={() => {}} />
          <MenuItem icon="file-text" label="Terms & Conditions" onPress={() => {}} />
          <MenuItem icon="info" label="About" onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <MenuItem icon="log-out" label="Log Out" onPress={logout} danger />
        </View>
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
});
