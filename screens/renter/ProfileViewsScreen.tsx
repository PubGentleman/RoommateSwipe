import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { StorageService } from '@/utils/storage';
import { Typography, Spacing } from '@/constants/theme';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';

interface LikeItem {
  likerId: string;
  likerName: string;
  likerPhoto?: string;
  likedAt: Date;
  isSuperLike: boolean;
}

export const ProfileViewsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userPlan = user?.subscription?.plan || 'basic';
  const canSeeLikes = userPlan === 'plus' || userPlan === 'elite';

  useEffect(() => {
    loadLikes();
  }, []);

  const loadLikes = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const allUsers = await StorageService.getUsers();
      const currentUser = allUsers.find(u => u.id === user.id);
      const receivedLikes = currentUser?.receivedLikes || [];

      const mapped: LikeItem[] = receivedLikes.map((l: any) => ({
        likerId: l.likerId,
        likerName: l.likerName || 'Unknown',
        likerPhoto: l.likerPhoto,
        likedAt: new Date(l.likedAt),
        isSuperLike: l.isSuperLike || false,
      }));

      mapped.sort((a, b) => b.likedAt.getTime() - a.likedAt.getTime());
      setLikes(mapped);
    } catch (error) {
      console.error('[ProfileViewsScreen] Error loading likes:', error);
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
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const renderLikeItem = ({ item }: { item: LikeItem }) => (
    <View
      style={[styles.viewItem, { backgroundColor: '#1a1a1a', borderColor: item.isSuperLike ? '#FFD700' : '#333333' }]}
    >
      {canSeeLikes && item.likerPhoto ? (
        <Image source={{ uri: item.likerPhoto }} style={styles.avatar} />
      ) : canSeeLikes ? (
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: '#222222' }]}>
          <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>
            {item.likerName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: '#222222' }]}>
          <Feather name="lock" size={24} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.viewInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
            {canSeeLikes ? item.likerName : '??????'}
          </ThemedText>
          {item.isSuperLike ? (
            <View style={styles.superLikeBadge}>
              <Feather name="star" size={10} color="#FFD700" />
              <ThemedText style={styles.superLikeText}>Super</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
          {item.isSuperLike ? 'Super liked you' : 'Liked you'} {formatTimeAgo(item.likedAt)}
        </ThemedText>
      </View>
      {item.isSuperLike ? (
        <Feather name="star" size={20} color="#FFD700" />
      ) : (
        <Feather name="heart" size={20} color="#ff6b5b" />
      )}
    </View>
  );

  const renderUpgradePrompt = () => (
    <View style={[styles.upgradeContainer, { backgroundColor: '#1a1a1a' }]}>
      <View style={[styles.upgradeIcon, { backgroundColor: '#ff6b5b' }]}>
        <Feather name="heart" size={32} color="#FFFFFF" />
      </View>
      <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
        See Who Likes You
      </ThemedText>
      <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
        Upgrade to Plus to see who liked and super liked your profile.
      </ThemedText>
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color="#22c55e" />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            See everyone who liked your profile
          </ThemedText>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color="#22c55e" />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            Spot super likes instantly
          </ThemedText>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={20} color="#22c55e" />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
            Match faster with people interested in you
          </ThemedText>
        </View>
      </View>
      {likes.length > 0 ? (
        <ThemedText style={[Typography.body, { color: '#ff6b5b', fontWeight: '700', marginBottom: Spacing.md }]}>
          {likes.length} {likes.length === 1 ? 'person has' : 'people have'} liked you!
        </ThemedText>
      ) : null}
      <Pressable
        style={[styles.upgradeButton, { backgroundColor: '#ff6b5b' }]}
        onPress={() => navigation.navigate('Plans' as never)}
      >
        <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
          Upgrade to Plus
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="heart" size={64} color={theme.textSecondary} style={{ marginBottom: Spacing.lg }} />
      <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
        No Likes Yet
      </ThemedText>
      <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary }]}>
        When other users like or super like your profile, they'll appear here.
      </ThemedText>
    </View>
  );

  if (!canSeeLikes) {
    return (
      <ScreenScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ backgroundColor: '#111111' }}>
        {renderUpgradePrompt()}
      </ScreenScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#111111' }]}>
      <FlatList
        data={likes}
        renderItem={renderLikeItem}
        keyExtractor={(item) => item.likerId}
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
  superLikeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
    marginBottom: 4,
  },
  superLikeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
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
