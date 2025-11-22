import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export const ProfileScreen = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const getRoleBadgeColor = () => {
    if (!user) return theme.primary;
    switch (user.role) {
      case 'renter':
        return theme.renterBadge;
      case 'host':
        return theme.hostBadge;
      case 'agent':
        return theme.agentBadge;
      default:
        return theme.primary;
    }
  };

  const getRoleLabel = () => {
    if (!user) return 'User';
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const MenuItem = ({ icon, label, onPress, danger }: any) => (
    <Pressable
      style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      onPress={onPress}
    >
      <Feather name={icon} size={20} color={danger ? theme.error : theme.text} />
      <ThemedText style={[Typography.body, { flex: 1, marginLeft: Spacing.lg, color: danger ? theme.error : theme.text }]}>
        {label}
      </ThemedText>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user" size={48} color={theme.textSecondary} />
            </View>
            <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor() }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                {getRoleLabel()}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[Typography.h1, styles.name]}>{user?.name || 'User'}</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            {user?.email}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Subscription</ThemedText>
          <View style={[styles.subscriptionCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <ThemedText style={[Typography.h3, { textTransform: 'capitalize' }]}>
                  {user?.subscription?.plan || 'Free'} Plan
                </ThemedText>
                {user?.subscription?.plan === 'premium' ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <Feather name="star" size={12} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: 4, fontWeight: '600' }]}>
                      Premium
                    </ThemedText>
                  </View>
                ) : user?.subscription?.plan === 'vip' ? (
                  <View style={[styles.badge, { backgroundColor: '#7C3AED' }]}>
                    <Feather name="award" size={12} color="#FFD700" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: 4, fontWeight: '600' }]}>
                      VIP
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {user?.subscription?.plan === 'free' ? (
                <Pressable
                  style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
                  onPress={() => navigation.navigate('Payment')}
                >
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Upgrade
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            
            {user?.subscription?.plan === 'free' ? (
              <View style={styles.benefitsList}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
                  Free plan limitations:
                </ThemedText>
                <View style={styles.benefitItem}>
                  <Feather name="x" size={16} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.sm }]}>
                    Create 1 group only
                  </ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="x" size={16} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.sm }]}>
                    Join 1 group only
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={theme.primary} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.sm }]}>
                    Unlimited group creation
                  </ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={theme.primary} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.sm }]}>
                    Unlimited group joining
                  </ThemedText>
                </View>
                {user?.subscription?.expiresAt ? (
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                    Renews on {new Date(user.subscription.expiresAt).toLocaleDateString()}
                  </ThemedText>
                ) : null}
              </View>
            )}
          </View>
          
          <MenuItem 
            icon="credit-card" 
            label="Payment Methods" 
            onPress={() => navigation.navigate('Payment')} 
          />
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
  subscriptionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  upgradeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
  },
  benefitsList: {
    gap: Spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
