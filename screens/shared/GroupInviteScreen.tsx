import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, TextInput,
  Alert, Share, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Typography, Spacing } from '../../constants/theme';
import { Image } from 'expo-image';
import {
  getInvitableMates, sendGroupInvite,
  getInviteCode, regenerateInviteCode,
  getRentersInterestedInListing,
} from '../../services/groupService';

type Tab = 'matches' | 'code' | 'listing';

export function GroupInviteScreen({ navigation, route }: any) {
  const { groupId, groupName, listingId } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const isHost = user?.role === 'host';

  const [tab, setTab] = useState<Tab>('matches');
  const [mates, setMates] = useState<any[]>([]);
  const [interestedRenters, setInterestedRenters] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'matches') {
        const data = await getInvitableMates(groupId);
        setMates(data);
      } else if (tab === 'code') {
        const code = await getInviteCode(groupId);
        setInviteCode(code);
      } else if (tab === 'listing' && listingId) {
        const data = await getRentersInterestedInListing(listingId);
        setInterestedRenters(data);
      }
    } catch (err: any) {
      console.warn('[GroupInviteScreen] Load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId: string) => {
    setSendingTo(userId);
    try {
      await sendGroupInvite(groupId, userId);
      if (tab === 'matches') {
        const updated = await getInvitableMates(groupId);
        setMates(updated);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSendingTo(null);
    }
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my group "${groupName}" on Roomdr!\n\nUse invite code: ${inviteCode}\n\nDownload the app at roomdr.com`,
      });
    } catch {}
  };

  const handleRegenerateCode = async () => {
    Alert.alert(
      'Regenerate Code?',
      'The old code will stop working immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            const newCode = await regenerateInviteCode(groupId);
            setInviteCode(newCode);
          },
        },
      ]
    );
  };

  const filteredMates = mates.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRenters = interestedRenters.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'matches', label: 'Matches', icon: 'users' },
    { key: 'code', label: 'Link', icon: 'link' },
    ...(isHost && listingId
      ? [{ key: 'listing' as Tab, label: 'Interested', icon: 'home' }]
      : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>
          Invite to Group
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomWidth: 2, borderBottomColor: theme.primary }]}
            onPress={() => { setTab(t.key); setSearch(''); }}
          >
            <Feather name={t.icon as any} size={16} color={tab === t.key ? theme.primary : theme.textSecondary} />
            <ThemedText style={[
              Typography.small,
              { marginLeft: 4, fontWeight: '600',
                color: tab === t.key ? theme.primary : theme.textSecondary }
            ]}>
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {tab === 'matches' && (
            <>
              <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="search" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search your matches..."
                  placeholderTextColor={theme.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              {filteredMates.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="users" size={36} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                    {mates.length === 0
                      ? 'You have no matches yet.\nStart swiping to connect with people!'
                      : 'No matches found for that name.'}
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={filteredMates}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: Spacing.md }}
                  renderItem={({ item }) => (
                    <View style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {item.photo ? (
                        <Image source={{ uri: item.photo }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '30' }]}>
                          <Feather name="user" size={20} color={theme.primary} />
                        </View>
                      )}
                      <ThemedText style={[Typography.body, { flex: 1, marginLeft: Spacing.sm, fontWeight: '600' }]}>
                        {item.name}
                      </ThemedText>
                      {item.alreadyInGroup ? (
                        <View style={[styles.badge, { backgroundColor: theme.border }]}>
                          <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>In Group</ThemedText>
                        </View>
                      ) : item.alreadyInvited ? (
                        <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                          <ThemedText style={[Typography.small, { color: theme.primary }]}>Invited</ThemedText>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.inviteBtn, { backgroundColor: theme.primary, opacity: sendingTo === item.id ? 0.6 : 1 }]}
                          onPress={() => handleInvite(item.id)}
                          disabled={sendingTo === item.id}
                        >
                          {sendingTo === item.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '600' }]}>Invite</ThemedText>
                          }
                        </Pressable>
                      )}
                    </View>
                  )}
                />
              )}
            </>
          )}

          {tab === 'code' && (
            <View style={styles.codeContainer}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
                Share this code with anyone you want to invite. They can enter it from the Groups screen.
              </ThemedText>

              <View style={[styles.codeBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText style={[styles.codeText, { color: theme.text, letterSpacing: 8 }]}>
                  {inviteCode || '------'}
                </ThemedText>
              </View>

              <Pressable
                style={[styles.shareBtn, { backgroundColor: theme.primary }]}
                onPress={handleShareCode}
              >
                <Feather name="share-2" size={18} color="#fff" style={{ marginRight: Spacing.sm }} />
                <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '600' }]}>
                  Share Code
                </ThemedText>
              </Pressable>

              <Pressable style={styles.regenBtn} onPress={handleRegenerateCode}>
                <Feather name="refresh-cw" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Regenerate code
                </ThemedText>
              </Pressable>
            </View>
          )}

          {tab === 'listing' && (
            <>
              <View style={[styles.infoBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="info" size={14} color={theme.textSecondary} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 6, flex: 1 }]}>
                  These renters expressed interest in your linked listing.
                </ThemedText>
              </View>
              <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="search" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search renters..."
                  placeholderTextColor={theme.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              {filteredRenters.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="home" size={36} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                    No renters have expressed interest in this listing yet.
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={filteredRenters}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: Spacing.md }}
                  renderItem={({ item }) => (
                    <View style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {item.photo ? (
                        <Image source={{ uri: item.photo }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '30' }]}>
                          <Feather name="user" size={20} color={theme.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{item.name}</ThemedText>
                        <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                          Interested {new Date(item.interestedAt).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      <Pressable
                        style={[styles.inviteBtn, { backgroundColor: theme.primary, opacity: sendingTo === item.id ? 0.6 : 1 }]}
                        onPress={() => handleInvite(item.id)}
                        disabled={sendingTo === item.id}
                      >
                        {sendingTo === item.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '600' }]}>Invite</ThemedText>
                        }
                      </Pressable>
                    </View>
                  )}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderRadius: 12, borderWidth: 1, height: 44,
  },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 15 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 14, borderWidth: 1, marginBottom: Spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  inviteBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, minWidth: 60, alignItems: 'center',
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  codeContainer: {
    flex: 1, alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xl * 2,
  },
  codeBox: {
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xl * 2,
    borderRadius: 20, borderWidth: 2, marginBottom: Spacing.xl,
  },
  codeText: { fontSize: 32, fontWeight: '800' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.xl,
    borderRadius: 14, marginBottom: Spacing.md,
  },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md,
  },
  infoBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    padding: Spacing.sm, borderRadius: 10, borderWidth: 1,
  },
});
