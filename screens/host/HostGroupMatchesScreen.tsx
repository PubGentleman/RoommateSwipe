import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

interface GroupMatch {
  id: string;
  group_id: string;
  listing_id: string;
  match_score: number;
  score_breakdown: { transitScore: number; budgetScore: number };
  unlock_status: 'locked' | 'unlocked' | 'expired';
  unlock_fee_cents: number;
  expires_at: string;
  memberCount: number;
  budgetMin: number;
  budgetMax: number;
  moveInWindow: string;
  trainLines: string[];
  bedrooms: number;
  members?: any[];
}

function daysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const HostGroupMatchesScreen = () => {
  const { user, getHostPlan } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const listingId = route.params?.listingId;
  const hostPlan = getHostPlan();

  const [matches, setMatches] = useState<GroupMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [listingId])
  );

  const loadMatches = async () => {
    setLoading(true);
    try {
      const allGroups = await StorageService.getGroups();
      const listings = await StorageService.getListings();
      const listing = listings.find((l: any) => l.id === listingId);
      if (!listing) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const profiles = await StorageService.getRoommateProfiles();
      const mockMatches: GroupMatch[] = [];

      for (const group of allGroups) {
        const rawMembers = group.members || [];
        const memberIds: string[] = rawMembers.map((m: any) =>
          typeof m === 'string' ? m : m.id || m.user_id
        ).filter(Boolean);
        if (memberIds.length < 2) continue;

        const memberProfiles = memberIds
          .map(id => profiles.find((p: any) => p.id === id))
          .filter(Boolean);

        const budgets = memberProfiles.map((p: any) => p.budget || p.apartmentPrefs?.budgetPerPersonMax || 0);
        const budgetMin = budgets.reduce((a: number, b: number) => a + b, 0);
        const budgetMax = Math.round(budgetMin * 1.2);
        const trains = [...new Set(memberProfiles.flatMap((p: any) =>
          p.apartmentPrefs?.preferredTrains || []
        ))];

        const score = 65 + Math.floor(Math.random() * 30);

        mockMatches.push({
          id: `match-${group.id}-${listingId}`,
          group_id: group.id,
          listing_id: listingId,
          match_score: score,
          score_breakdown: { transitScore: 50 + Math.floor(Math.random() * 40), budgetScore: 50 + Math.floor(Math.random() * 40) },
          unlock_status: 'locked',
          unlock_fee_cents: hostPlan === 'business' ? 0 : hostPlan === 'pro' ? 1900 : 2900,
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          memberCount: memberIds.length,
          budgetMin,
          budgetMax,
          moveInWindow: 'Next 1-2 months',
          trainLines: trains.length > 0 ? trains.slice(0, 4) : ['Flexible'],
          bedrooms: (listing as any).bedrooms || 2,
          members: memberProfiles,
        });
      }

      mockMatches.sort((a, b) => b.match_score - a.match_score);
      setMatches(mockMatches.slice(0, 10));
    } catch (err) {
      console.warn('[HostGroupMatches] Error:', err);
      setMatches([]);
    }
    setLoading(false);
  };

  const handleUnlock = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (hostPlan === 'free' || hostPlan === 'none') {
      showAlert({ title: 'Upgrade Required', message: 'Upgrade to a Starter, Pro, or Business plan to unlock group details.' });
      return;
    }

    const feeLabel = match.unlock_fee_cents === 0
      ? 'free (included in your plan)'
      : `$${(match.unlock_fee_cents / 100).toFixed(0)}`;

    const proceed = await confirm({
      title: 'Unlock Group Details',
      message: `Unlock this group of ${match.memberCount} renters for ${feeLabel}? You'll see their full profiles and can message them directly.`,
    });
    if (!proceed) return;

    setUnlocking(matchId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await new Promise(r => setTimeout(r, 1200));

    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, unlock_status: 'unlocked' as const } : m
    ));
    setUnlocking(null);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderMatch = ({ item }: { item: GroupMatch }) => {
    const isUnlocked = item.unlock_status === 'unlocked';
    const daysLeft = daysUntilExpiry(item.expires_at);

    return (
      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.match_score}% match</Text>
          </View>
          {!isUnlocked ? (
            <Text style={styles.expiresText}>
              Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>

        {isUnlocked ? (
          <View>
            <Text style={styles.groupSizeUnlocked}>
              Group of {item.memberCount} renters
            </Text>
            {(item.members || []).map((member: any, idx: number) => (
              <View key={idx} style={styles.memberRow}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.memberAvatar}
                >
                  <Text style={styles.memberInitial}>
                    {(member.name || 'R').charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.name || 'Renter'}</Text>
                  <Text style={styles.memberOccupation}>{member.occupation || member.bio || ''}</Text>
                </View>
              </View>
            ))}
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>Score Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transit</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${item.score_breakdown.transitScore}%`, backgroundColor: '#3498db' }]} />
                </View>
                <Text style={styles.breakdownValue}>{item.score_breakdown.transitScore}%</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Budget</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${item.score_breakdown.budgetScore}%`, backgroundColor: '#2ecc71' }]} />
                </View>
                <Text style={styles.breakdownValue}>{item.score_breakdown.budgetScore}%</Text>
              </View>
            </View>
            <View style={styles.unlockedActions}>
              <Pressable style={styles.messageGroupBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={styles.messageGroupText}>Message Group</Text>
              </Pressable>
              <Pressable style={styles.inviteBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <Feather name="send" size={16} color={ACCENT} />
                <Text style={styles.inviteText}>Invite to Apply</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.groupSize}>
              Group of {item.memberCount} renters
            </Text>

            <View style={styles.teaserRow}>
              <Feather name="dollar-sign" size={13} color="#888" />
              <Text style={styles.teaserText}>
                Combined budget: ${item.budgetMin.toLocaleString()}-${item.budgetMax.toLocaleString()}/mo
              </Text>
            </View>
            <View style={styles.teaserRow}>
              <Feather name="calendar" size={13} color="#888" />
              <Text style={styles.teaserText}>Move-in: {item.moveInWindow}</Text>
            </View>
            <View style={styles.teaserRow}>
              <Feather name="map-pin" size={13} color="#888" />
              <Text style={styles.teaserText}>
                Trains: {item.trainLines.join(', ')}
              </Text>
            </View>
            <View style={styles.teaserRow}>
              <Feather name="grid" size={13} color="#888" />
              <Text style={styles.teaserText}>Looking for: {item.bedrooms}BR</Text>
            </View>

            <View style={styles.blurredProfiles}>
              {Array.from({ length: Math.min(item.memberCount, 3) }).map((_, i) => (
                <View key={i} style={styles.blurredAvatar}>
                  <Feather name="user" size={18} color="#555" />
                </View>
              ))}
              <Text style={styles.blurredLabel}>Profiles hidden until unlocked</Text>
            </View>

            <Pressable
              style={[
                styles.unlockButton,
                (hostPlan === 'free' || hostPlan === 'none') && { opacity: 0.5 },
              ]}
              onPress={() => handleUnlock(item.id)}
              disabled={unlocking === item.id}
            >
              {unlocking === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="unlock" size={16} color="#fff" />
                  <Text style={styles.unlockButtonText}>
                    {hostPlan === 'free' || hostPlan === 'none'
                      ? 'Upgrade to Unlock'
                      : item.unlock_fee_cents === 0
                        ? 'Unlock Group \u2014 Free'
                        : `Unlock Group \u2014 $${(item.unlock_fee_cents / 100).toFixed(0)}`}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Group Matches</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Finding matching groups...</Text>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="users" size={48} color="#333" />
          <Text style={styles.emptyTitle}>No group matches yet</Text>
          <Text style={styles.emptySubtext}>
            When renter groups match your listing, they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  matchCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
    backgroundColor: ACCENT + '22',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  scoreText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  expiresText: {
    color: '#888',
    fontSize: 12,
  },
  groupSize: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  groupSizeUnlocked: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  teaserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  teaserText: {
    color: '#aaa',
    fontSize: 13,
  },
  blurredProfiles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  blurredAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurredLabel: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberOccupation: {
    color: '#888',
    fontSize: 12,
  },
  breakdownSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    marginBottom: 16,
  },
  breakdownTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  breakdownLabel: {
    color: '#888',
    fontSize: 12,
    width: 50,
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    color: '#aaa',
    fontSize: 12,
    width: 32,
    textAlign: 'right',
  },
  unlockedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  messageGroupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
  },
  messageGroupText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT + '15',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: ACCENT + '33',
  },
  inviteText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '700',
  },
});
