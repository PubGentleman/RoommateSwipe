import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet, Platform, Image } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import {
  getGroupLikers as getGroupLikersSupabase,
  adminLikeBack as adminLikeBackSupabase,
  dismissGroupLiker as dismissGroupLikerSupabase,
} from '../../services/groupService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Liker {
  likeId: string;
  userId: string;
  name: string;
  age: number;
  bio: string;
  avatarUrl: string | null;
  zodiacSign: string;
  gender: string;
  verified: boolean;
  occupation: string;
  likedAt: string;
  adminLikedBack: boolean;
}

export const InterestedUsersScreen = ({ route }: any) => {
  const { groupId, groupName } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    loadLikers();
  }, [groupId]);

  const loadLikers = async () => {
    setLoading(true);
    try {
      const data = await getGroupLikersSupabase(groupId);
      setLikers(data);
    } catch {
      const localData = await StorageService.getGroupLikersForGroup(groupId);
      setLikers(localData);
    }
    setLoading(false);
  };

  const handleLikeBack = useCallback(async (userId: string, userName: string) => {
    setActingOn(userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await adminLikeBackSupabase(groupId, userId);
    } catch {
      await StorageService.adminLikeBackLocal(groupId, userId);
    }
    setLikers(prev =>
      prev.map(l => l.userId === userId ? { ...l, adminLikedBack: true } : l)
    );
    setActingOn(null);
    const msg = `${userName} will be notified they can now request to join.`;
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Mutual Interest!', msg);
    }
  }, [groupId]);

  const handleDismiss = useCallback(async (userId: string, userName: string) => {
    const doDismiss = async () => {
      setActingOn(userId);
      try {
        await dismissGroupLikerSupabase(groupId, userId);
      } catch {
        await StorageService.dismissGroupLikerLocal(groupId, userId);
      }
      setLikers(prev => prev.filter(l => l.userId !== userId));
      setActingOn(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Dismiss ${userName}? They will be removed from your interested list.`)) {
        await doDismiss();
      }
    } else {
      Alert.alert(
        `Dismiss ${userName}?`,
        'They will be removed from your interested list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Dismiss', style: 'destructive', onPress: doDismiss },
        ]
      );
    }
  }, [groupId]);

  const GRADIENTS: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d']];

  const renderLiker = ({ item, index }: { item: Liker; index: number }) => (
    <View style={[styles.likerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <LinearGradient colors={GRADIENTS[index % 3]} style={styles.avatar}>
          <ThemedText style={styles.avatarLetter}>{item.name.charAt(0)}</ThemedText>
        </LinearGradient>
      )}

      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>
            {item.name}{item.age ? `, ${item.age}` : ''}
          </ThemedText>
          {item.verified ? (
            <Feather name="check-circle" size={13} color="#2563EB" />
          ) : null}
          {item.adminLikedBack ? (
            <View style={styles.mutualBadge}>
              <ThemedText style={styles.mutualBadgeText}>Mutual</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 1 }}>
          {[item.occupation, item.zodiacSign, item.gender].filter(Boolean).join(' \u00B7 ')}
        </ThemedText>
        {item.bio ? (
          <ThemedText
            style={{ color: theme.textSecondary, fontSize: 12, marginTop: 3 }}
            numberOfLines={2}
          >
            {item.bio}
          </ThemedText>
        ) : null}
      </View>

      {!item.adminLikedBack ? (
        <View style={{ gap: 8 }}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#ff6b5b' }]}
            onPress={() => handleLikeBack(item.userId, item.name)}
            disabled={actingOn === item.userId}
          >
            {actingOn === item.userId ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="heart" size={16} color="#fff" />
            )}
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.border }]}
            onPress={() => handleDismiss(item.userId, item.name)}
            disabled={actingOn === item.userId}
          >
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.mutualCheck}>
          <Feather name="check" size={16} color="#22C55E" />
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color="#ff6b5b" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Interested in {groupName}</ThemedText>
        <ThemedText style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
          Like them back to unlock their join request
        </ThemedText>
      </View>

      {likers.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.border + '40' }]}>
            <Feather name="heart" size={32} color={theme.border} />
          </View>
          <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, fontSize: 15 }}>
            No one has liked your group yet
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary, marginTop: 4, fontSize: 12 }}>
            When someone shows interest, they'll appear here
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={item => item.likeId}
          contentContainerStyle={{ padding: Spacing.md }}
          renderItem={renderLiker}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  mutualBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  mutualBadgeText: {
    fontSize: 10,
    color: '#22C55E',
    fontWeight: '700',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutualCheck: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
});
