import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, TextInput,
  Share, ActivityIndicator, Switch, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Typography, Spacing } from '../../constants/theme';
import { Image } from 'expo-image';
import {
  getInvitableMates, sendGroupInvite,
  getInviteCode, regenerateInviteCode,
  getRentersInterestedInListing,
  getJoinRequests, respondToJoinRequest,
  setGroupDiscoverable,
} from '../../services/groupService';
import { supabase } from '../../lib/supabase';

type Tab = 'matches' | 'code' | 'listing' | 'requests';

export function GroupInviteScreen({ navigation, route }: any) {
  const { groupId, groupName, listingId } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const isHost = user?.role === 'host';

  const [tab, setTab] = useState<Tab>('matches');
  const [mates, setMates] = useState<any[]>([]);
  const [interestedRenters, setInterestedRenters] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [discoverable, setDiscoverable] = useState(false);
  const [discoverableLoaded, setDiscoverableLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteCode, setPasteCode] = useState('');

  useEffect(() => {
    loadData();
  }, [tab]);

  useEffect(() => {
    if (!discoverableLoaded) {
      supabase.from('groups').select('discoverable').eq('id', groupId).maybeSingle()
        .then(({ data }) => {
          setDiscoverable(data?.discoverable === true);
          setDiscoverableLoaded(true);
        });
    }
  }, []);

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
      } else if (tab === 'requests') {
        const data = await getJoinRequests(groupId);
        setJoinRequests(data);
      }
    } catch (err: any) {
      console.warn('[GroupInviteScreen] Load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToJoinRequest = async (requestId: string, response: 'approved' | 'declined') => {
    setRespondingTo(requestId);
    try {
      await respondToJoinRequest(requestId, groupId, response);
      const updated = await getJoinRequests(groupId);
      setJoinRequests(updated);
    } catch (err: any) {
      await alert({ title: 'Error', message: err.message, variant: 'warning' });
    } finally {
      setRespondingTo(null);
    }
  };

  const handleToggleDiscoverable = async (val: boolean) => {
    setDiscoverable(val);
    try {
      await setGroupDiscoverable(groupId, val);
    } catch (err: any) {
      setDiscoverable(!val);
      await alert({ title: 'Error', message: err.message, variant: 'warning' });
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
      await alert({ title: 'Error', message: err.message, variant: 'warning' });
    } finally {
      setSendingTo(null);
    }
  };

  const getDeepLink = () => {
    return Linking.createURL('join-group', { queryParams: { code: inviteCode, group: groupName } });
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(inviteCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }
    }
  };

  const handleShareCode = async () => {
    const deepLink = getDeepLink();
    try {
      await Share.share({
        message: `Join my group "${groupName}" on Rhome!\n\nTap the link to join instantly:\n${deepLink}\n\nOr enter invite code: ${inviteCode}`,
        url: deepLink,
      });
    } catch {}
  };

  const handlePasteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setPasteCode(text.trim().toUpperCase());
      }
    } catch {}
  };

  const handleRegenerateCode = async () => {
    const confirmed = await confirm({
      title: 'Regenerate Code?',
      message: 'The old code will stop working immediately.',
      confirmText: 'Regenerate',
      variant: 'warning',
    });
    if (confirmed) {
      const newCode = await regenerateInviteCode(groupId);
      setInviteCode(newCode);
    }
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
    { key: 'requests', label: 'Requests', icon: 'inbox' },
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
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.lg }]}>
                Share this code or link with anyone you want to invite.
              </ThemedText>

              <Pressable
                onPress={handleCopyCode}
                style={[styles.codeBox, {
                  backgroundColor: copied ? theme.primary + '15' : theme.card,
                  borderColor: copied ? theme.primary : theme.border,
                }]}
              >
                <ThemedText style={[styles.codeText, { color: theme.text, letterSpacing: 8 }]}>
                  {inviteCode || '------'}
                </ThemedText>
                <View style={styles.copyHint}>
                  <Feather
                    name={copied ? 'check' : 'copy'}
                    size={13}
                    color={copied ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText style={[Typography.small, {
                    color: copied ? theme.primary : theme.textSecondary,
                    marginLeft: 4, fontWeight: '600',
                  }]}>
                    {copied ? 'Copied!' : 'Tap to copy'}
                  </ThemedText>
                </View>
              </Pressable>

              <View style={styles.codeActions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={handleShareCode}
                >
                  <Feather name="share-2" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '600' }]}>
                    Share Link
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
                  onPress={handleCopyCode}
                >
                  <Feather name="copy" size={16} color={theme.text} style={{ marginRight: 6 }} />
                  <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                    Copy
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable style={styles.regenBtn} onPress={handleRegenerateCode}>
                <Feather name="refresh-cw" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Regenerate code
                </ThemedText>
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.sm }]}>
                HAVE A CODE? PASTE IT HERE
              </ThemedText>
              <View style={[styles.pasteRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <TextInput
                  style={[styles.pasteInput, { color: theme.text }]}
                  placeholder="Enter invite code..."
                  placeholderTextColor={theme.textSecondary}
                  value={pasteCode}
                  onChangeText={(t) => setPasteCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <Pressable onPress={handlePasteCode} hitSlop={8} style={{ marginRight: 6 }}>
                  <Feather name="clipboard" size={18} color={theme.primary} />
                </Pressable>
              </View>
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

          {tab === 'requests' && (
            <>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
                borderBottomWidth: 1, borderBottomColor: theme.border,
              }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                    Group Discovery
                  </ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                    Let others find and request to join this group
                  </ThemedText>
                </View>
                <Switch
                  value={discoverable}
                  onValueChange={handleToggleDiscoverable}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={discoverable ? theme.primary : theme.textSecondary}
                />
              </View>

              {joinRequests.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="inbox" size={36} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                    No pending join requests.
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={joinRequests}
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
                          Requested {new Date(item.requestedAt).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable
                          style={[styles.inviteBtn, { backgroundColor: theme.primary, opacity: respondingTo === item.id ? 0.6 : 1 }]}
                          onPress={() => handleRespondToJoinRequest(item.id, 'approved')}
                          disabled={respondingTo === item.id}
                        >
                          <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '600' }]}>Accept</ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.inviteBtn, { backgroundColor: theme.border, opacity: respondingTo === item.id ? 0.6 : 1 }]}
                          onPress={() => handleRespondToJoinRequest(item.id, 'declined')}
                          disabled={respondingTo === item.id}
                        >
                          <ThemedText style={[Typography.small, { color: theme.textSecondary, fontWeight: '600' }]}>Decline</ThemedText>
                        </Pressable>
                      </View>
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
    flex: 1, alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xl,
  },
  codeBox: {
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl * 2,
    borderRadius: 20, borderWidth: 2, marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  codeText: { fontSize: 32, fontWeight: '800' },
  copyHint: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing.sm,
  },
  codeActions: {
    flexDirection: 'row', gap: 10,
    width: '100%', marginBottom: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: Spacing.lg,
    borderRadius: 14,
  },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm,
  },
  divider: {
    height: 1, width: '80%',
    marginVertical: Spacing.xl,
  },
  pasteRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 48,
    width: '100%',
  },
  pasteInput: {
    flex: 1, fontSize: 16, fontWeight: '600', letterSpacing: 3,
  },
  infoBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    padding: Spacing.sm, borderRadius: 10, borderWidth: 1,
  },
});
