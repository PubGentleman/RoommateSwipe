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

export const MatchesListScreen = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const allMatches = await StorageService.getMatches();
      const profiles = await StorageService.getRoommateProfiles();
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const userMatches = allMatches
        .filter(m => m.userId1 === user.id || m.userId2 === user.id)
        .map(m => {
          const otherId = m.userId1 === user.id ? m.userId2 : m.userId1;
          const profile = profileMap.get(otherId);
          return {
            matchId: m.id,
            conversationId: `conv_${m.id}`,
            profile,
            matchedAt: m.matchedAt,
            matchType: m.matchType,
          };
        })
        .filter(m => m.profile)
        .sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());

      setMatches(userMatches);
    } catch (e) {
      console.error('Failed to load matches:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChat = (item: any) => {
    const tabNav = (navigation as any).getParent()?.getParent?.() || (navigation as any).getParent();
    if (tabNav) {
      tabNav.navigate('Messages', { screen: 'MessagesList' });
      setTimeout(() => {
        tabNav.navigate('Messages', {
          screen: 'Chat',
          params: {
            conversationId: item.conversationId,
            otherUser: item.profile,
          },
        });
      }, 50);
    }
  };

  const formatDate = (date: any) => {
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h2, { flex: 1, textAlign: 'center' }]}>
          Matches
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ThemedText style={{ color: theme.textSecondary }}>Loading...</ThemedText>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.md }} />
          <ThemedText style={[Typography.h3, { textAlign: 'center', marginBottom: Spacing.sm }]}>No Matches Yet</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Keep swiping to find your perfect roommate match.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.matchId}
          contentContainerStyle={{ padding: Spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.matchItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}
              onPress={() => handleOpenChat(item)}
            >
              {item.profile?.photos?.[0] ? (
                <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: '#222' }]}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>
                    {item.profile?.name?.charAt(0) || '?'}
                  </ThemedText>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.h3, { marginBottom: 2 }]}>
                  {item.profile?.name || 'Unknown'}
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Matched {formatDate(item.matchedAt)}
                </ThemedText>
              </View>
              <View style={[styles.msgBtn, { backgroundColor: '#ff6b5b22' }]}>
                <Feather name="message-circle" size={18} color="#ff6b5b" />
              </View>
            </Pressable>
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
  matchItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  msgBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
