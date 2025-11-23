import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { StorageService } from '@/utils/storage';
import { Typography, Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface ProfileView {
  viewerId: string;
  viewerName: string;
  viewerPhoto?: string;
  viewedAt: Date;
}

export const ProfileViewsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [profileViews, setProfileViews] = useState<ProfileView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const userPlan = user?.subscription?.plan || 'basic';
  const canSeeProfileViews = userPlan === 'plus' || userPlan === 'elite';

  useEffect(() => {
    loadProfileViews();
  }, []);

  const loadProfileViews = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const views = await StorageService.getProfileViews(user.id);
      setProfileViews(views);
    } catch (error) {
      console.error('[ProfileViewsScreen] Error loading profile views:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderViewItem = ({ item }: { item: ProfileView }) => (
    <Pressable
      style={[styles.viewItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
      onPress={() => {
        // TODO: Navigate to viewer's profile
        console.log('[ProfileViewsScreen] View profile:', item.viewerId);
      }}
    >
      {item.viewerPhoto ? (
        <Image
          source={{ uri: item.viewerPhoto }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
          <Feather name="user" size={32} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.viewInfo}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
          {item.viewerName}
        </ThemedText>
        <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
          {formatTimeAgo(item.viewedAt)}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={24} color={theme.textSecondary} />
    </Pressable>
  );

  const renderUpgradePrompt = () => (
    <View style={[styles.upgradeContainer, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.upgradeIcon, { backgroundColor: theme.primary }]}>
        <Feather name="eye" size={32} color="#FFFFFF" />
      </View>
      <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
        See Who Viewed You
      </ThemedText>
      <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
        Upgrade to Plus to see who's checking out your profile and make better connections.
      </ThemedText>
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            See everyone who viewed your profile
          </ThemedText>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            Get notified of new profile views
          </ThemedText>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            View profiles anytime, no limits
          </ThemedText>
        </View>
      </View>
      <Pressable
        style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
        onPress={() => {
          setShowUpgradeModal(false);
          navigation.navigate('Settings' as never);
        }}
      >
        <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
          Upgrade to Plus
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="eye-off" size={64} color={theme.textSecondary} style={{ marginBottom: Spacing.lg }} />
      <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
        No Profile Views Yet
      </ThemedText>
      <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary }]}>
        When other users view your profile, they'll appear here.
      </ThemedText>
    </View>
  );

  if (!canSeeProfileViews) {
    return (
      <ScreenScrollView>
        {renderUpgradePrompt()}
      </ScreenScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <FlatList
        data={profileViews}
        renderItem={renderViewItem}
        keyExtractor={(item) => item.viewerId}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={isLoading ? null : renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  viewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewInfo: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  upgradeContainer: {
    padding: Spacing.xl,
    borderRadius: 24,
    margin: Spacing.lg,
    alignItems: 'center',
  },
  upgradeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  featuresList: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  upgradeButton: {
    width: '100%',
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
});
