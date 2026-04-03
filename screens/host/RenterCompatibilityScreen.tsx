import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentRenter, AgentGroup, calculatePairMatrix, analyzeGroupDynamics, createAgentGroup, sendAgentInvites } from '../../services/agentMatchmakerService';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

function scoreBg(score: number) {
  if (score >= 80) return 'rgba(34,197,94,0.12)';
  if (score >= 65) return 'rgba(245,158,11,0.10)';
  if (score >= 50) return 'rgba(249,115,22,0.10)';
  return 'rgba(239,68,68,0.10)';
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Low';
}

interface FactorResult {
  key: string;
  label: string;
  icon: string;
  weight: number;
  score: number;
  detail: string;
}

const FACTORS: { key: string; label: string; icon: string; weight: number }[] = [
  { key: 'sleep', label: 'Sleep', icon: 'moon', weight: 15 },
  { key: 'clean', label: 'Clean', icon: 'star', weight: 15 },
  { key: 'smoking', label: 'Smoke', icon: 'wind', weight: 12 },
  { key: 'pets', label: 'Pets', icon: 'heart', weight: 8 },
  { key: 'guests', label: 'Guests', icon: 'home', weight: 10 },
  { key: 'noise', label: 'Noise', icon: 'volume-2', weight: 8 },
  { key: 'budget', label: 'Budget', icon: 'dollar-sign', weight: 10 },
  { key: 'moveIn', label: 'Move-in', icon: 'calendar', weight: 8 },
];

function guestRank(g: string | undefined): number {
  const map: Record<string, number> = { never: 0, rarely: 1, sometimes: 2, often: 3, anytime: 4 };
  return map[g ?? 'sometimes'] ?? 2;
}

function calcFactorScore(a: AgentRenter, b: AgentRenter, key: string): { score: number; detail: string } {
  switch (key) {
    case 'sleep': {
      const sa = a.sleepSchedule ?? 'flexible';
      const sb = b.sleepSchedule ?? 'flexible';
      if (sa === sb) return { score: 100, detail: `Both ${sa}` };
      if (sa === 'flexible' || sb === 'flexible') return { score: 70, detail: `${sa} / ${sb}` };
      return { score: 15, detail: `${sa} vs ${sb}` };
    }
    case 'clean': {
      const ca = a.cleanliness ?? 5;
      const cb = b.cleanliness ?? 5;
      const diff = Math.abs(ca - cb);
      const detail = `${ca}/10 vs ${cb}/10`;
      if (diff <= 1) return { score: 100, detail };
      if (diff <= 2) return { score: 80, detail };
      if (diff <= 3) return { score: 55, detail };
      return { score: 20, detail };
    }
    case 'smoking': {
      const sa = typeof a.smoking === 'string' ? a.smoking : (a.smoking ? 'yes' : 'no');
      const sb = typeof b.smoking === 'string' ? b.smoking : (b.smoking ? 'yes' : 'no');
      if (sa === sb) return { score: 100, detail: sa === 'no' || sa === 'never' ? 'Both non-smokers' : `Both: ${sa}` };
      if (sa === 'outside_only' || sb === 'outside_only' || sa === 'outside' || sb === 'outside')
        return { score: 50, detail: 'One smokes outside' };
      return { score: 0, detail: 'Smoker + Non-smoker' };
    }
    case 'pets': {
      const pa = a.hasPets ?? a.pets ?? false;
      const pb = b.hasPets ?? b.pets ?? false;
      if (pa === pb) return { score: 100, detail: pa ? 'Both have pets' : 'Neither has pets' };
      if ((pa && b.noPetsAllergy === true) || (pb && a.noPetsAllergy === true))
        return { score: 0, detail: 'Pet + Allergy conflict' };
      return { score: 60, detail: 'One has pets' };
    }
    case 'guests': {
      const ga = a.guestPolicy;
      const gb = b.guestPolicy;
      const diff = Math.abs(guestRank(ga) - guestRank(gb));
      const da = ga ?? 'sometimes';
      const db = gb ?? 'sometimes';
      if (diff === 0) return { score: 100, detail: `Both: ${da}` };
      if (diff <= 1) return { score: 70, detail: `${da} / ${db}` };
      return { score: 30, detail: `${da} vs ${db}` };
    }
    case 'noise': {
      const na = a.noiseTolerance ?? 5;
      const nb = b.noiseTolerance ?? 5;
      const diff = Math.abs(na - nb);
      if (diff <= 1) return { score: 100, detail: `${na}/10 vs ${nb}/10` };
      if (diff <= 2) return { score: 65, detail: `${na}/10 vs ${nb}/10` };
      return { score: 25, detail: `${na}/10 vs ${nb}/10` };
    }
    case 'budget': {
      const aMax = a.budgetMax ?? a.budgetMin ?? 1500;
      const bMax = b.budgetMax ?? b.budgetMin ?? 1500;
      const ratio = Math.min(aMax, bMax) / Math.max(aMax, bMax);
      const detail = `$${aMax} / $${bMax}`;
      if (ratio >= 0.85) return { score: 100, detail };
      if (ratio >= 0.65) return { score: 60, detail };
      return { score: 25, detail };
    }
    case 'moveIn': {
      const da = a.moveInDate ? new Date(a.moveInDate).getTime() : Date.now();
      const db = b.moveInDate ? new Date(b.moveInDate).getTime() : Date.now();
      const days = Math.abs(da - db) / 86400000;
      const detail = `${Math.round(days)}d apart`;
      if (days <= 14) return { score: 100, detail };
      if (days <= 30) return { score: 60, detail };
      return { score: 20, detail };
    }
    default:
      return { score: 50, detail: '' };
  }
}

function calcPairBreakdown(a: AgentRenter, b: AgentRenter): FactorResult[] {
  return FACTORS.map(f => {
    const { score, detail } = calcFactorScore(a, b, f.key);
    return { ...f, score, detail };
  });
}

interface PairData {
  a: AgentRenter;
  b: AgentRenter;
  score: number;
  breakdown: FactorResult[];
}

const Avatar = ({ renter, size = 36, borderColor }: { renter: AgentRenter; size?: number; borderColor?: string }) => {
  const photo = renter.photos?.[0];
  const borderStyle = borderColor ? { borderWidth: 2, borderColor } : {};
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, borderStyle]}
      />
    );
  }
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center',
    }, borderStyle]}>
      <Text style={{ color: '#999', fontSize: size * 0.4, fontWeight: '700' }}>
        {renter.name?.charAt(0) ?? '?'}
      </Text>
    </View>
  );
};

const FactorBar = ({ factor }: { factor: FactorResult }) => (
  <View style={s.factorRow}>
    <Feather name={factor.icon as any} size={14} color="#888" />
    <Text style={s.factorLabel}>{factor.label}</Text>
    <View style={s.factorBarBg}>
      <View style={[s.factorBarFill, { width: `${factor.score}%` as any, backgroundColor: scoreColor(factor.score) }]} />
    </View>
    <Text style={[s.factorPct, { color: scoreColor(factor.score) }]}>{factor.score}%</Text>
    <Text style={s.factorDetail} numberOfLines={1}>{factor.detail}</Text>
  </View>
);

const isEntireSeeker = (r: AgentRenter) =>
  r.roomType === 'entire_apartment' || r.roomType === 'entire' || r.roomType === 'apartment';

export const RenterCompatibilityScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const allRenters: AgentRenter[] = route.params?.renters ?? [];
  const renters = useMemo(() => allRenters.filter(r => !isEntireSeeker(r)), [allRenters]);
  const listingId: string | undefined = route.params?.listingId;
  const listing: any | undefined = route.params?.listing;

  const [view, setView] = useState<'grid' | 'pairs'>('grid');
  const [selectedPair, setSelectedPair] = useState<PairData | null>(null);
  const [expandedPairKey, setExpandedPairKey] = useState<string | null>(null);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [invitedPairs, setInvitedPairs] = useState<Set<string>>(new Set());
  const [sendingInvite, setSendingInvite] = useState(false);

  const matrix = useMemo(() => calculatePairMatrix(renters), [renters]);

  const pairDataList = useMemo<PairData[]>(() => {
    const list: PairData[] = [];
    for (let i = 0; i < renters.length; i++) {
      for (let j = i + 1; j < renters.length; j++) {
        const m = matrix.find(p =>
          (p.a === renters[i].id && p.b === renters[j].id) ||
          (p.a === renters[j].id && p.b === renters[i].id)
        );
        const breakdown = calcPairBreakdown(renters[i], renters[j]);
        list.push({ a: renters[i], b: renters[j], score: m?.score ?? 50, breakdown });
      }
    }
    return list.sort((x, y) => y.score - x.score);
  }, [renters, matrix]);

  const gridScores = useMemo(() => {
    const map: Record<string, PairData> = {};
    for (const p of pairDataList) {
      map[`${p.a.id}-${p.b.id}`] = p;
      map[`${p.b.id}-${p.a.id}`] = p;
    }
    return map;
  }, [pairDataList]);

  const groupAnalysis = useMemo(() => {
    const members = renters.filter(r => selectedForGroup.has(r.id));
    if (members.length < 2) return null;
    const analysis = analyzeGroupDynamics(members);
    const budgetTotal = members.reduce((sum, m) => sum + (m.budgetMax ?? m.budgetMin ?? 0), 0);
    return { ...analysis, members, budgetTotal };
  }, [selectedForGroup, renters]);

  const toggleGroup = useCallback((id: string) => {
    setSelectedForGroup(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateGroup = useCallback((ids: string[]) => {
    const preselectedRenters = allRenters.filter(r => ids.includes(r.id));
    navigation.push('AgentGroupBuilder', {
      preselectedIds: ids,
      preselectedRenters,
      listingId,
      preselectedListing: listing,
    });
  }, [allRenters, navigation, listingId, listing]);

  const handleSendInvite = useCallback(async (aId: string, bId: string) => {
    const key = `${aId}-${bId}`;
    if (invitedPairs.has(key) || sendingInvite) return;
    const renterA = renters.find(r => r.id === aId);
    const renterB = renters.find(r => r.id === bId);
    if (!renterA || !renterB || !user?.id) return;

    setSendingInvite(true);
    try {
      const groupName = listing
        ? `${listing.title} - ${renterA.name?.split(' ')[0]} & ${renterB.name?.split(' ')[0]}`
        : `${renterA.name?.split(' ')[0]} & ${renterB.name?.split(' ')[0]} Group`;
      const group: AgentGroup = {
        id: `ag_${Date.now()}`,
        name: groupName,
        agentId: user.id,
        targetListingId: listingId || undefined,
        targetListing: listing || undefined,
        members: [renterA, renterB],
        memberIds: [aId, bId],
        groupStatus: 'invited',
        avgCompatibility: pairDataList.find(p =>
          (p.a.id === aId && p.b.id === bId) || (p.a.id === bId && p.b.id === aId)
        )?.score ?? 0,
        combinedBudgetMin: (renterA.budgetMin ?? 0) + (renterB.budgetMin ?? 0),
        combinedBudgetMax: (renterA.budgetMax ?? 0) + (renterB.budgetMax ?? 0),
        coversRent: listing ? ((renterA.budgetMax ?? 0) + (renterB.budgetMax ?? 0)) >= (listing.price ?? listing.rent ?? 0) : false,
        invites: [],
        createdAt: new Date().toISOString(),
      };
      const created = await createAgentGroup(group);
      await sendAgentInvites(
        user.id, user.name ?? '', created.id,
        [aId, bId], listing || null, '',
        [renterA, renterB].map(r => ({ id: r.id, name: r.name, photo: r.photos?.[0] }))
      );
      setInvitedPairs(prev => new Set([...prev, key]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to send invite. Please try again.');
    }
    setSendingInvite(false);
  }, [invitedPairs, sendingInvite, renters, user, listing, listingId, pairDataList]);

  const firstName = (r: AgentRenter) => r.name?.split(' ')[0] ?? '?';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Compatibility Matrix</Text>
          <Text style={s.headerSub}>{renters.length} renters &middot; {pairDataList.length} pairs analyzed</Text>
        </View>
      </View>

      {renters.length < 2 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 }}>
          <Feather name="users" size={48} color="#444" />
          <Text style={{ color: '#999', fontSize: 16, marginTop: 16, textAlign: 'center', lineHeight: 24 }}>
            {allRenters.length >= 2
              ? 'Not enough room-seeking renters to compare.\nEntire-apartment seekers are excluded.'
              : 'Shortlist at least 2 renters to see compatibility.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={s.tabs}>
            {(['grid', 'pairs'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => { setView(t); setSelectedPair(null); setExpandedPairKey(null); }}
                style={[s.tab, view === t ? s.tabActive : null]}
              >
                <Text style={[s.tabText, view === t ? s.tabTextActive : null]}>
                  {t === 'grid' ? 'Grid View' : 'Top Pairs'}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedForGroup.size > 0 ? (
            <GroupBuilderBar
              renters={renters}
              selectedIds={selectedForGroup}
              analysis={groupAnalysis}
              onToggle={toggleGroup}
              onClear={() => setSelectedForGroup(new Set())}
              onCreateGroup={() => handleCreateGroup(Array.from(selectedForGroup))}
            />
          ) : null}

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            {listing ? (
              <View style={s.listingBanner}>
                <Feather name="home" size={14} color={ACCENT} />
                <Text style={s.listingBannerText}>
                  Showing {renters.length} renters for{' '}
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{listing.title}</Text>
                </Text>
              </View>
            ) : null}

            {view === 'grid' ? (
              <GridView
                renters={renters}
                gridScores={gridScores}
                selectedForGroup={selectedForGroup}
                selectedPair={selectedPair}
                onToggleGroup={toggleGroup}
                onSelectPair={setSelectedPair}
                onSendInvite={handleSendInvite}
                onAddToGroup={(aId, bId) => {
                  const next = new Set(selectedForGroup);
                  next.add(aId);
                  next.add(bId);
                  setSelectedForGroup(next);
                  setSelectedPair(null);
                }}
                invitedPairs={invitedPairs}
              />
            ) : (
              <PairsView
                pairs={pairDataList}
                expandedKey={expandedPairKey}
                onToggleExpand={(key) => setExpandedPairKey(expandedPairKey === key ? null : key)}
                onAddPairToGroup={(aId, bId) => {
                  setSelectedForGroup(prev => {
                    const next = new Set(prev);
                    next.add(aId);
                    next.add(bId);
                    return next;
                  });
                }}
                onSendInvite={handleSendInvite}
                invitedPairs={invitedPairs}
              />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const GroupBuilderBar = ({
  renters, selectedIds, analysis, onToggle, onClear, onCreateGroup,
}: {
  renters: AgentRenter[];
  selectedIds: Set<string>;
  analysis: ReturnType<typeof analyzeGroupDynamics> & { members: AgentRenter[]; budgetTotal: number } | null;
  onToggle: (id: string) => void;
  onClear: () => void;
  onCreateGroup: () => void;
}) => {
  const members = renters.filter(r => selectedIds.has(r.id));
  return (
    <View style={s.groupBar}>
      <View style={s.groupBarHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="users" size={16} color={ACCENT} />
          <Text style={s.groupBarTitle}>Building Group ({selectedIds.size} selected)</Text>
        </View>
        <Pressable onPress={onClear}>
          <Text style={{ color: '#888', fontSize: 12 }}>Clear</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: analysis ? 10 : 0 }}>
        {members.map(r => (
          <Pressable key={r.id} onPress={() => onToggle(r.id)} style={{ alignItems: 'center' }}>
            <Avatar renter={r} size={36} borderColor={ACCENT} />
            <Text style={{ fontSize: 10, color: '#ccc', marginTop: 2 }}>{r.name?.split(' ')[0]}</Text>
          </Pressable>
        ))}
      </View>

      {analysis ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={s.groupStat}>
              <Text style={[s.groupStatNum, { color: scoreColor(analysis.avgScore) }]}>{analysis.avgScore}%</Text>
              <Text style={s.groupStatLabel}>Avg Score</Text>
            </View>
            <View style={s.groupStat}>
              <Text style={[s.groupStatNum, { color: scoreColor(analysis.minPairScore) }]}>{analysis.minPairScore}%</Text>
              <Text style={s.groupStatLabel}>Weakest</Text>
            </View>
            <View style={s.groupStat}>
              <Text style={[s.groupStatNum, { color: ACCENT }]}>${analysis.budgetTotal.toLocaleString()}</Text>
              <Text style={s.groupStatLabel}>Combined</Text>
            </View>
          </View>

          {analysis.conflicts.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {analysis.conflicts.map((c, i) => (
                <View key={i} style={s.conflictChip}>
                  <Feather name="alert-triangle" size={12} color="#ef4444" />
                  <Text style={s.conflictText}>{c}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Feather name="check-circle" size={12} color="#22c55e" />
              <Text style={{ fontSize: 11, color: '#22c55e' }}>No conflicts detected</Text>
            </View>
          )}

          <Pressable style={s.createGroupBtn} onPress={onCreateGroup}>
            <Feather name="users" size={14} color="#000" />
            <Text style={s.createGroupBtnText}>Create Group ({selectedIds.size} renters)</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const GridView = ({
  renters, gridScores, selectedForGroup, selectedPair, onToggleGroup,
  onSelectPair, onSendInvite, onAddToGroup, invitedPairs,
}: {
  renters: AgentRenter[];
  gridScores: Record<string, PairData>;
  selectedForGroup: Set<string>;
  selectedPair: PairData | null;
  onToggleGroup: (id: string) => void;
  onSelectPair: (p: PairData | null) => void;
  onSendInvite: (a: string, b: string) => void;
  onAddToGroup: (a: string, b: string) => void;
  invitedPairs: Set<string>;
}) => {
  const firstName = (r: AgentRenter) => r.name?.split(' ')[0] ?? '?';
  return (
    <View style={{ paddingHorizontal: 12 }}>
      <View style={s.chipRow}>
        <Text style={{ fontSize: 11, color: '#666', marginRight: 4 }}>Tap to add:</Text>
        {renters.map(r => (
          <Pressable
            key={r.id}
            onPress={() => onToggleGroup(r.id)}
            style={[s.chip, selectedForGroup.has(r.id) ? s.chipActive : null]}
          >
            <Avatar renter={r} size={18} />
            <Text style={[s.chipText, selectedForGroup.has(r.id) ? s.chipTextActive : null]}>
              {firstName(r)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.gridContainer}>
          <View style={s.gridRow}>
            <View style={[s.gridCell, s.gridHeaderCell]} />
            {renters.map(r => (
              <View key={r.id} style={[s.gridCell, s.gridHeaderCell]}>
                <Avatar renter={r} size={24} />
                <Text style={s.gridHeaderText} numberOfLines={1}>{firstName(r)}</Text>
              </View>
            ))}
          </View>

          {renters.map(row => (
            <View key={row.id} style={s.gridRow}>
              <View style={[s.gridCell, s.gridHeaderCell, s.gridRowHeader]}>
                <Avatar renter={row} size={18} />
                <Text style={s.gridHeaderText} numberOfLines={1}>{firstName(row)}</Text>
              </View>
              {renters.map(col => {
                if (row.id === col.id) {
                  return (
                    <View key={col.id} style={[s.gridCell, { backgroundColor: BG }]}>
                      <View style={s.gridSelfCell}>
                        <Text style={{ color: '#444', fontSize: 10 }}>--</Text>
                      </View>
                    </View>
                  );
                }
                const pair = gridScores[`${row.id}-${col.id}`];
                if (!pair) return <View key={col.id} style={s.gridCell} />;
                const isSelected = selectedPair?.a.id === pair.a.id && selectedPair?.b.id === pair.b.id;
                return (
                  <Pressable
                    key={col.id}
                    style={s.gridCell}
                    onPress={() => onSelectPair(isSelected ? null : pair)}
                  >
                    <View style={[
                      s.gridScoreCell,
                      { backgroundColor: scoreBg(pair.score) },
                      isSelected ? { borderWidth: 2, borderColor: scoreColor(pair.score) } : { borderWidth: 2, borderColor: 'transparent' },
                    ]}>
                      <Text style={[s.gridScoreText, { color: scoreColor(pair.score) }]}>{pair.score}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={s.gridHint}>Tap any score to see the full breakdown</Text>

      {selectedPair ? (
        <DetailPanel
          pair={selectedPair}
          onClose={() => onSelectPair(null)}
          onSendInvite={onSendInvite}
          onAddToGroup={onAddToGroup}
          invitedPairs={invitedPairs}
        />
      ) : null}
    </View>
  );
};

const DetailPanel = ({
  pair, onClose, onSendInvite, onAddToGroup, invitedPairs,
}: {
  pair: PairData;
  onClose: () => void;
  onSendInvite: (a: string, b: string) => void;
  onAddToGroup: (a: string, b: string) => void;
  invitedPairs: Set<string>;
}) => {
  const pairKey = `${pair.a.id}-${pair.b.id}`;
  const alreadySent = invitedPairs.has(pairKey);
  const shared = pair.a.interests?.filter(i => pair.b.interests?.includes(i)) ?? [];
  const firstName = (r: AgentRenter) => r.name?.split(' ')[0] ?? '?';

  return (
    <View style={[s.detailPanel, { borderColor: scoreColor(pair.score) + '30' }]}>
      <View style={s.detailHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Avatar renter={pair.a} size={32} />
          <View style={{ marginLeft: -8 }}>
            <Avatar renter={pair.b} size={32} />
          </View>
        </View>
        <View style={{ marginLeft: 10 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: '#fff' }}>
            {firstName(pair.a)} + {firstName(pair.b)}
          </Text>
          <Text style={{ fontSize: 12, color: scoreColor(pair.score), fontWeight: '600' }}>
            {pair.score}% -- {scoreLabel(pair.score)} Match
          </Text>
        </View>
        <Pressable onPress={onClose} style={{ marginLeft: 'auto' }}>
          <Feather name="x" size={18} color="#666" />
        </Pressable>
      </View>

      {pair.breakdown.map(f => <FactorBar key={f.key} factor={f} />)}

      {shared.length > 0 ? (
        <View style={s.sharedRow}>
          <Text style={{ fontSize: 11, color: '#666' }}>Shared:</Text>
          {shared.slice(0, 5).map(i => (
            <View key={i} style={s.sharedTag}>
              <Text style={{ fontSize: 11, color: '#aaa' }}>{i}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable
          style={[s.inviteBtn, alreadySent ? s.inviteBtnSent : null]}
          onPress={() => onSendInvite(pair.a.id, pair.b.id)}
          disabled={alreadySent}
        >
          <Feather name={alreadySent ? 'check-circle' : 'users'} size={16} color={alreadySent ? '#22c55e' : '#000'} />
          <Text style={[s.inviteBtnText, alreadySent ? { color: '#22c55e' } : null]}>
            {alreadySent ? 'Invite Sent' : 'Send Group Invite'}
          </Text>
        </Pressable>
        {!alreadySent ? (
          <Pressable
            style={s.addGroupBtn}
            onPress={() => onAddToGroup(pair.a.id, pair.b.id)}
          >
            <Feather name="plus" size={16} color="#ccc" />
            <Text style={{ color: '#ccc', fontWeight: '600', fontSize: 14 }}>Add to Group</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const PairsView = ({
  pairs, expandedKey, onToggleExpand, onAddPairToGroup, onSendInvite, invitedPairs,
}: {
  pairs: PairData[];
  expandedKey: string | null;
  onToggleExpand: (key: string) => void;
  onAddPairToGroup: (a: string, b: string) => void;
  onSendInvite: (a: string, b: string) => void;
  invitedPairs: Set<string>;
}) => {
  const firstName = (r: AgentRenter) => r.name?.split(' ')[0] ?? '?';

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {pairs.map((pair) => {
        const key = `${pair.a.id}-${pair.b.id}`;
        const isExpanded = expandedKey === key;
        const pairKey = key;
        const alreadySent = invitedPairs.has(pairKey);
        const shared = pair.a.interests?.filter(i => pair.b.interests?.includes(i)) ?? [];

        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Pressable
              onPress={() => onToggleExpand(key)}
              style={[
                s.pairCard,
                isExpanded ? s.pairCardExpanded : null,
                isExpanded ? { borderColor: scoreColor(pair.score) + '40' } : null,
              ]}
            >
              <View style={[s.pairScoreBadge, { backgroundColor: scoreBg(pair.score) }]}>
                <Text style={[s.pairScoreNum, { color: scoreColor(pair.score) }]}>{pair.score}</Text>
                <Text style={[s.pairScoreLabel, { color: scoreColor(pair.score) }]}>{scoreLabel(pair.score)}</Text>
              </View>

              <View style={s.pairAvatars}>
                <Avatar renter={pair.a} size={34} />
                <View style={{ marginLeft: -10 }}>
                  <Avatar renter={pair.b} size={34} />
                </View>
                <View style={{ marginLeft: 4, flex: 1 }}>
                  <Text style={s.pairNames}>{firstName(pair.a)} + {firstName(pair.b)}</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                    {pair.breakdown.filter(f => f.score >= 80).slice(0, 3).map(f => (
                      <Feather key={f.key} name={f.icon as any} size={11} color="#22c55e" />
                    ))}
                    {pair.breakdown.filter(f => f.score < 40).map(f => (
                      <Feather key={f.key} name={f.icon as any} size={11} color="#ef4444" />
                    ))}
                  </View>
                </View>
              </View>

              <Pressable
                style={s.pairGroupBtn}
                onPress={() => onAddPairToGroup(pair.a.id, pair.b.id)}
              >
                <Feather name="plus" size={12} color={ACCENT} />
                <Text style={s.pairGroupBtnText}>Group</Text>
              </Pressable>

              <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
            </Pressable>

            {isExpanded ? (
              <View style={[s.expandedPanel, { borderColor: scoreColor(pair.score) + '40' }]}>
                {pair.breakdown.map(f => <FactorBar key={f.key} factor={f} />)}

                {shared.length > 0 ? (
                  <View style={s.sharedRow}>
                    <Text style={{ fontSize: 11, color: '#666' }}>Shared:</Text>
                    {shared.slice(0, 5).map(i => (
                      <View key={i} style={s.sharedTag}>
                        <Text style={{ fontSize: 11, color: '#aaa' }}>{i}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable
                  style={[s.expandedInviteBtn, alreadySent ? s.inviteBtnSent : null]}
                  onPress={() => onSendInvite(pair.a.id, pair.b.id)}
                  disabled={alreadySent}
                >
                  <Feather name={alreadySent ? 'check-circle' : 'users'} size={14} color={alreadySent ? '#22c55e' : '#000'} />
                  <Text style={[s.inviteBtnText, alreadySent ? { color: '#22c55e' } : null]}>
                    {alreadySent ? 'Invite Sent' : 'Send Group Invite'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center' },
  tabActive: { backgroundColor: ACCENT },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#000' },

  listingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SURFACE, borderRadius: 10, padding: 10,
    marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: ACCENT + '30',
  },
  listingBannerText: { color: '#ccc', fontSize: 12, flex: 1 },

  groupBar: {
    marginHorizontal: 20, marginVertical: 8, padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: ACCENT + '40',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  groupBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  groupBarTitle: { fontSize: 13, fontWeight: '600', color: ACCENT },
  groupStat: { flex: 1, backgroundColor: SURFACE, borderRadius: 10, padding: 8, alignItems: 'center' },
  groupStatNum: { fontSize: 20, fontWeight: '700' },
  groupStatLabel: { fontSize: 10, color: '#888', marginTop: 1 },

  conflictChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  conflictText: { fontSize: 11, color: '#ef4444' },

  createGroupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12,
  },
  createGroupBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, paddingBottom: 12, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#333', backgroundColor: SURFACE,
  },
  chipActive: { borderColor: ACCENT, backgroundColor: 'rgba(245,158,11,0.15)' },
  chipText: { fontSize: 12, color: '#ccc' },
  chipTextActive: { color: ACCENT, fontWeight: '600' },

  gridContainer: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  gridRow: { flexDirection: 'row' },
  gridCell: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#1a1a1a' },
  gridHeaderCell: { backgroundColor: CARD_BG, gap: 2 },
  gridRowHeader: { borderRightWidth: 1, borderRightColor: '#222' },
  gridHeaderText: { color: '#999', fontSize: 10, fontWeight: '600' },
  gridSelfCell: { width: 44, height: 44, borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  gridScoreCell: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gridScoreText: { fontSize: 14, fontWeight: '700' },
  gridHint: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8 },

  detailPanel: {
    marginTop: 16, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, padding: 16,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  factorLabel: { width: 48, fontSize: 12, color: '#aaa' },
  factorBarBg: { flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  factorBarFill: { height: '100%', borderRadius: 3 },
  factorPct: { width: 32, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  factorDetail: { width: 90, fontSize: 10, color: '#777', textAlign: 'right' },

  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  sharedTag: { backgroundColor: SURFACE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },

  inviteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12,
  },
  inviteBtnSent: { backgroundColor: '#1a3a1a' },
  inviteBtnText: { fontWeight: '600', fontSize: 14, color: '#000' },

  addGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#333', backgroundColor: SURFACE,
  },

  pairCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#222', gap: 10,
  },
  pairCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  pairScoreBadge: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pairScoreNum: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  pairScoreLabel: { fontSize: 8 },
  pairAvatars: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pairNames: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pairGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: ACCENT + '40', backgroundColor: 'rgba(245,158,11,0.1)',
  },
  pairGroupBtnText: { fontSize: 11, fontWeight: '600', color: ACCENT },

  expandedPanel: {
    backgroundColor: '#131313', borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    borderWidth: 1, borderTopWidth: 1, borderTopColor: '#222', padding: 12,
  },
  expandedInviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, marginTop: 12,
  },
});
