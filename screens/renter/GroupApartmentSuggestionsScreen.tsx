import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, Typography } from '../../constants/theme';
import { Property, RoommateProfile } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { scoreListing, ListingSuggestion, detectGroupConflicts } from '../../utils/transitMatching';
import { NEIGHBORHOOD_TRAINS } from '../../constants/transitData';

const CORAL = '#ff6b5b';
const BG = '#111';
const CARD_BG = '#1a1a1a';

export default function GroupApartmentSuggestionsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const groupId = route.params?.groupId ?? '';
  const isNewlyComplete = route.params?.isNewlyComplete ?? false;
  const [suggestions, setSuggestions] = useState<ListingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<RoommateProfile[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [sharedNeighborhoods, setSharedNeighborhoods] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    loadSuggestions();
  }, [groupId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const groups = await StorageService.getGroups();
      const group = groups.find((g: any) => g.id === groupId);
      if (!group) { setLoading(false); return; }

      const profiles = await StorageService.getRoommateProfiles();
      const memberIds: string[] = (group.members ?? []).map((m: any) =>
        typeof m === 'string' ? m : (m.userId ?? m.id)
      );
      const memberProfiles = profiles.filter((p: RoommateProfile) =>
        memberIds.includes(p.id)
      );
      setMembers(memberProfiles);

      if (memberProfiles.length >= 2) {
        const conflictResult = detectGroupConflicts(memberProfiles);
        setConflicts(conflictResult.conflicts);
        setSharedNeighborhoods(conflictResult.sharedNeighborhoods);
      }

      const allListings = await StorageService.getProperties();
      const scored = allListings
        .filter((l: Property) => l.available)
        .map((l: Property) => scoreListing(l, memberProfiles))
        .filter((s): s is ListingSuggestion => s !== null && s.totalScore > 20)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5);

      setSuggestions(scored);

      const existingVotes = await StorageService.getGroupApartmentVotes(groupId);
      const voteMap: Record<string, Record<string, string>> = {};
      for (const v of existingVotes) {
        if (!voteMap[v.listingId]) voteMap[v.listingId] = {};
        voteMap[v.listingId][v.userId] = v.vote;
      }
      setVotes(voteMap);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
    setLoading(false);
  };

  const handleVote = async (listingId: string, vote: 'yes' | 'no' | 'maybe') => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await StorageService.submitGroupApartmentVote(groupId, listingId, user.id, vote);
    setVotes(prev => ({
      ...prev,
      [listingId]: { ...(prev[listingId] ?? {}), [user.id]: vote },
    }));
  };

  const getVoteCount = (listingId: string, vote: string) => {
    const listingVotes = votes[listingId] ?? {};
    return Object.values(listingVotes).filter(v => v === vote).length;
  };

  const renderConflictBanner = () => {
    if (conflicts.length === 0) return null;
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.conflictBanner}>
        <View style={styles.conflictHeader}>
          <Feather name="alert-triangle" size={18} color="#FFB800" />
          <ThemedText style={styles.conflictTitle}>
            Potential Conflicts
          </ThemedText>
        </View>
        {conflicts.map((c, i) => (
          <ThemedText key={i} style={styles.conflictText}>
            {c}
          </ThemedText>
        ))}
      </Animated.View>
    );
  };

  const renderSharedAreas = () => {
    if (sharedNeighborhoods.length === 0) return null;
    return (
      <View style={styles.sharedSection}>
        <ThemedText style={styles.sharedTitle}>
          Neighborhoods that work for everyone
        </ThemedText>
        <View style={styles.sharedChips}>
          {sharedNeighborhoods.slice(0, 6).map(n => {
            const trains = NEIGHBORHOOD_TRAINS[n] ?? [];
            return (
              <View key={n} style={styles.sharedChip}>
                <ThemedText style={styles.sharedChipName}>{n}</ThemedText>
                <ThemedText style={styles.sharedChipTrains}>
                  {trains.slice(0, 4).join('/')}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSuggestion = ({ item, index }: { item: ListingSuggestion; index: number }) => {
    const myVote = votes[item.listing.id]?.[user?.id ?? ''];
    const yesCount = getVoteCount(item.listing.id, 'yes');
    const noCount = getVoteCount(item.listing.id, 'no');

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardTitle}>
                {item.listing.bedrooms}BR{item.listing.rooms_available ? ` · ${item.listing.rooms_available} open` : ''} in {item.listing.neighborhood ?? item.listing.city}
              </ThemedText>
              <ThemedText style={styles.cardPrice}>
                ${item.listing.price?.toLocaleString()}/mo
              </ThemedText>
            </View>
            <View style={styles.scoreBadge}>
              <ThemedText style={styles.scoreText}>{item.totalScore}%</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.perPerson}>
            ${item.perPersonRent.toLocaleString()}/person
          </ThemedText>

          {item.trainsNearby.length > 0 ? (
            <View style={styles.trainRow}>
              <Feather name="navigation" size={14} color={CORAL} />
              <ThemedText style={styles.trainText}>
                {item.trainsNearby.slice(0, 5).join(', ')} train{item.trainsNearby.length > 1 ? 's' : ''} nearby
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <ThemedText style={styles.breakdownLabel}>Transit</ThemedText>
              <ThemedText style={styles.breakdownValue}>{item.breakdown.trainScore}%</ThemedText>
            </View>
            <View style={styles.breakdownItem}>
              <ThemedText style={styles.breakdownLabel}>Budget</ThemedText>
              <ThemedText style={styles.breakdownValue}>{item.breakdown.budgetScore}%</ThemedText>
            </View>
            <View style={styles.breakdownItem}>
              <ThemedText style={styles.breakdownLabel}>Amenities</ThemedText>
              <ThemedText style={styles.breakdownValue}>{item.breakdown.amenityScore}%</ThemedText>
            </View>
          </View>

          <View style={styles.aiReasonBox}>
            <Feather name="cpu" size={14} color={CORAL} />
            <ThemedText style={styles.aiReasonText}>{item.aiReason}</ThemedText>
          </View>

          <View style={styles.voteRow}>
            <Pressable
              style={[styles.voteBtn, myVote === 'yes' && styles.voteBtnYes]}
              onPress={() => handleVote(item.listing.id, 'yes')}
            >
              <Feather name="thumbs-up" size={16} color={myVote === 'yes' ? '#fff' : '#888'} />
              <ThemedText style={[styles.voteLabel, myVote === 'yes' && { color: '#fff' }]}>
                {yesCount > 0 ? yesCount.toString() : 'Love it'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.voteBtn, myVote === 'maybe' && styles.voteBtnMaybe]}
              onPress={() => handleVote(item.listing.id, 'maybe')}
            >
              <Feather name="minus" size={16} color={myVote === 'maybe' ? '#fff' : '#888'} />
              <ThemedText style={[styles.voteLabel, myVote === 'maybe' && { color: '#fff' }]}>
                Maybe
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.voteBtn, myVote === 'no' && styles.voteBtnNo]}
              onPress={() => handleVote(item.listing.id, 'no')}
            >
              <Feather name="thumbs-down" size={16} color={myVote === 'no' ? '#fff' : '#888'} />
              <ThemedText style={[styles.voteLabel, myVote === 'no' && { color: '#fff' }]}>
                {noCount > 0 ? noCount.toString() : 'Not for us'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={CORAL} />
        <ThemedText style={{ color: '#888', marginTop: 12 }}>
          Finding apartments for your group...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Apartment Suggestions</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={item => item.listing.id}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 20 }}
        ListHeaderComponent={
          <>
            {isNewlyComplete ? (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.newGroupBanner}>
                <Feather name="zap" size={16} color={CORAL} />
                <ThemedText style={styles.newGroupText}>
                  Your group just formed! Here are apartments AI found for you.
                </ThemedText>
              </Animated.View>
            ) : null}
            {renderConflictBanner()}
            {renderSharedAreas()}
            {suggestions.length > 0 ? (
              <ThemedText style={styles.resultsLabel}>
                Top {suggestions.length} matches for your group
              </ThemedText>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color="#444" />
            <ThemedText style={styles.emptyText}>
              No matching apartments found. Try adjusting your preferences.
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1c1c1c', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  conflictBanner: {
    backgroundColor: 'rgba(255,184,0,0.1)', borderRadius: 14,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,184,0,0.3)',
  },
  conflictHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  conflictTitle: { fontSize: 15, fontWeight: '700', color: '#FFB800' },
  conflictText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  sharedSection: { marginBottom: Spacing.lg },
  sharedTitle: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.sm,
  },
  sharedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sharedChip: {
    backgroundColor: '#1c1c1c', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  sharedChipName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  sharedChipTrains: { fontSize: 11, color: CORAL, marginTop: 2 },
  resultsLabel: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cardPrice: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  scoreBadge: {
    backgroundColor: 'rgba(255,107,91,0.15)', borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  scoreText: { fontSize: 16, fontWeight: '700', color: CORAL },
  perPerson: {
    fontSize: 15, fontWeight: '600', color: '#4CAF50',
    marginTop: 8,
  },
  trainRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
  },
  trainText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  breakdownRow: {
    flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  breakdownItem: { alignItems: 'center' },
  breakdownLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 2 },
  aiReasonBox: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    backgroundColor: 'rgba(255,107,91,0.08)', borderRadius: 10, padding: 12,
  },
  aiReasonText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },
  voteRow: {
    flexDirection: 'row', gap: 8, marginTop: 14,
  },
  voteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    backgroundColor: '#222', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#333',
  },
  voteBtnYes: { backgroundColor: 'rgba(76,175,80,0.3)', borderColor: '#4CAF50' },
  voteBtnMaybe: { backgroundColor: 'rgba(255,184,0,0.2)', borderColor: '#FFB800' },
  voteBtnNo: { backgroundColor: 'rgba(244,67,54,0.2)', borderColor: '#F44336' },
  voteLabel: { fontSize: 13, color: '#888' },
  newGroupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,107,91,0.1)', borderRadius: 14,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,107,91,0.3)',
  },
  newGroupText: {
    fontSize: 14, fontWeight: '600', color: CORAL, flex: 1,
  },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: {
    fontSize: 15, color: '#666', textAlign: 'center',
    marginTop: 16, paddingHorizontal: 20,
  },
});
