import React, { useState, useEffect } from 'react';
import { View, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { ThemedText } from '../../components/ThemedText';
import { StorageService } from '../../utils/storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export const WhoLikedMeScreen = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [likers, setLikers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const plan = user?.subscription?.plan || 'basic';
  const canReveal = plan === 'plus' || plan === 'elite';

  useEffect(() => {
    loadLikers();
  }, []);

  const loadLikers = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const allUsers = await StorageService.getUsers();
      const currentUser = allUsers.find(u => u.id === user.id);
      const receivedLikes = currentUser?.receivedLikes || [];
      const superLikesOnly = receivedLikes.filter((l: any) => l.isSuperLike);
      const profiles = await StorageService.getRoommateProfiles();
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const received = superLikesOnly
        .map((l: any) => ({
          likerId: l.likerId,
          profile: profileMap.get(l.likerId),
          likedAt: l.likedAt,
        }))
        .filter((l: any) => l.profile)
        .sort((a: any, b: any) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime());

      setLikers(received);
    } catch (e) {
      console.error('Failed to load likers:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigation.navigate('Plans' as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h2, { flex: 1, textAlign: 'center' }]}>
          {likers.length} Super {likers.length === 1 ? 'Like' : 'Likes'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {!canReveal && likers.length > 0 ? (
        <Pressable onPress={handleUpgrade} style={styles.upgradeBanner}>
          <LinearGradient
            colors={['#ff6b5b', '#ff8e7f']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.upgradeBannerInner}
          >
            <Feather name="lock" size={16} color="#fff" />
            <ThemedText style={styles.upgradeBannerText}>
              Upgrade to Plus to see who super liked you
            </ThemedText>
            <Feather name="chevron-right" size={16} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ThemedText style={{ color: theme.textSecondary }}>Loading...</ThemedText>
        </View>
      ) : likers.length === 0 ? (
        <View style={styles.center}>
          <Feather name="star" size={48} color="#FFD700" style={{ marginBottom: Spacing.md }} />
          <ThemedText style={[Typography.h3, { textAlign: 'center', marginBottom: Spacing.sm }]}>No Super Likes Yet</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            When someone super likes your profile, they'll appear here.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={item => item.likerId}
          contentContainerStyle={{ padding: Spacing.md }}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <View style={[styles.likerCard, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
              <View style={styles.avatarWrap}>
                {item.profile?.photos?.[0] ? (
                  <Image
                    source={{ uri: item.profile.photos[0] }}
                    style={[styles.avatar, !canReveal && styles.blurred]}
                    blurRadius={canReveal ? 0 : 20}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: '#333' }]}>
                    <Feather name="user" size={32} color="#888" />
                  </View>
                )}
                {!canReveal ? (
                  <View style={styles.lockOverlay}>
                    <Feather name="lock" size={20} color="#fff" />
                  </View>
                ) : null}
              </View>
              <ThemedText style={[Typography.body, { fontWeight: '700', textAlign: 'center', marginTop: 8 }]} numberOfLines={1}>
                {canReveal ? (item.profile?.name || 'Unknown') : '??????'}
              </ThemedText>
              {canReveal && item.profile?.budget ? (
                <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'center' }]}>
                  ${item.profile.budget}/mo
                </ThemedText>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  upgradeBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  upgradeBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  upgradeBannerText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  likerCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', marginBottom: 10 },
  avatarWrap: { position: 'relative', width: 80, height: 80 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  blurred: { opacity: 0.4 },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)' },
});
