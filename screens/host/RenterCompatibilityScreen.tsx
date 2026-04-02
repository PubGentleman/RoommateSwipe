import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentRenter, calculatePairMatrix } from '../../services/agentMatchmakerService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const YELLOW = '#f39c12';
const RED = '#e74c3c';

const getScoreColor = (score: number) => {
  if (score >= 80) return GREEN;
  if (score >= 60) return YELLOW;
  return RED;
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return 'Great Match';
  if (score >= 60) return 'Decent Match';
  return 'Low Match';
};

interface PairBreakdown {
  label: string;
  icon: string;
  status: 'match' | 'mismatch' | 'neutral';
  detail: string;
}

function getPairBreakdown(a: AgentRenter, b: AgentRenter): PairBreakdown[] {
  const items: PairBreakdown[] = [];

  if (a.cleanliness !== undefined && b.cleanliness !== undefined) {
    const diff = Math.abs(a.cleanliness - b.cleanliness);
    items.push({
      label: 'Cleanliness',
      icon: 'home',
      status: diff <= 2 ? 'match' : diff <= 4 ? 'neutral' : 'mismatch',
      detail: diff <= 2
        ? `Both tidy (${a.cleanliness}/10 vs ${b.cleanliness}/10)`
        : `Different standards (${a.cleanliness}/10 vs ${b.cleanliness}/10)`,
    });
  }

  if (a.sleepSchedule && b.sleepSchedule) {
    const same = a.sleepSchedule === b.sleepSchedule;
    items.push({
      label: 'Sleep Schedule',
      icon: 'moon',
      status: same ? 'match' : 'mismatch',
      detail: same
        ? `Both ${a.sleepSchedule}`
        : `${a.sleepSchedule} vs ${b.sleepSchedule}`,
    });
  }

  if (a.smoking !== undefined && b.smoking !== undefined) {
    const same = a.smoking === b.smoking;
    items.push({
      label: 'Smoking',
      icon: 'wind',
      status: same ? 'match' : 'mismatch',
      detail: same
        ? (a.smoking ? 'Both smokers' : 'Both non-smokers')
        : 'One smokes, one does not',
    });
  }

  if (a.pets !== undefined && b.pets !== undefined) {
    const same = a.pets === b.pets;
    items.push({
      label: 'Pets',
      icon: 'heart',
      status: same ? 'match' : 'mismatch',
      detail: same
        ? (a.pets ? 'Both have/want pets' : 'Neither has pets')
        : 'Different pet preferences',
    });
  }

  if (a.budgetMin !== undefined && b.budgetMin !== undefined) {
    const aMax = a.budgetMax ?? a.budgetMin;
    const bMax = b.budgetMax ?? b.budgetMin;
    const overlap = Math.min(aMax, bMax) >= Math.max(a.budgetMin, b.budgetMin);
    items.push({
      label: 'Budget',
      icon: 'dollar-sign',
      status: overlap ? 'match' : 'neutral',
      detail: `$${a.budgetMin}-${aMax} vs $${b.budgetMin}-${bMax}`,
    });
  }

  if (a.interests?.length && b.interests?.length) {
    const shared = a.interests.filter(i => b.interests!.includes(i));
    items.push({
      label: 'Interests',
      icon: 'star',
      status: shared.length >= 2 ? 'match' : shared.length >= 1 ? 'neutral' : 'mismatch',
      detail: shared.length > 0
        ? `${shared.length} shared: ${shared.slice(0, 3).join(', ')}`
        : 'No shared interests',
    });
  }

  return items;
}

function getBestTrioGroup(
  renters: AgentRenter[],
  matrix: { a: string; b: string; score: number }[]
): { ids: string[]; avgScore: number } | null {
  if (renters.length < 3) return null;

  let best: { ids: string[]; avgScore: number } | null = null;

  for (let i = 0; i < renters.length; i++) {
    for (let j = i + 1; j < renters.length; j++) {
      for (let k = j + 1; k < renters.length; k++) {
        const ids = [renters[i].id, renters[j].id, renters[k].id];
        const pairs = matrix.filter(
          p => ids.includes(p.a) && ids.includes(p.b)
        );
        if (pairs.length === 3) {
          const avg = Math.round(pairs.reduce((s, p) => s + p.score, 0) / 3);
          if (!best || avg > best.avgScore) {
            best = { ids, avgScore: avg };
          }
        }
      }
    }
  }
  return best;
}

const Avatar = ({ renter, size = 36 }: { renter: AgentRenter; size?: number }) => {
  const photo = renter.photos?.[0];
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#333',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ color: '#999', fontSize: size * 0.4, fontWeight: '700' }}>
        {renter.name?.charAt(0) ?? '?'}
      </Text>
    </View>
  );
};

const isEntireSeeker = (r: AgentRenter) =>
  r.roomType === 'entire_apartment' || r.roomType === 'entire' || r.roomType === 'apartment';

export const RenterCompatibilityScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const allRenters: AgentRenter[] = route.params?.renters ?? [];
  const renters = useMemo(() => allRenters.filter(r => !isEntireSeeker(r)), [allRenters]);
  const listingId: string | undefined = route.params?.listingId;

  const [detailPair, setDetailPair] = useState<{ a: AgentRenter; b: AgentRenter; score: number } | null>(null);

  const matrix = useMemo(() => calculatePairMatrix(renters), [renters]);
  const sortedPairs = useMemo(() => [...matrix].sort((a, b) => b.score - a.score), [matrix]);

  const bestTrio = useMemo(() => getBestTrioGroup(renters, matrix), [renters, matrix]);

  const getScore = (aId: string, bId: string): number | null => {
    if (aId === bId) return null;
    const pair = matrix.find(p =>
      (p.a === aId && p.b === bId) || (p.a === bId && p.b === aId)
    );
    return pair?.score ?? null;
  };

  const getRenter = (id: string) => renters.find(r => r.id === id);
  const getFirstName = (id: string) => getRenter(id)?.name?.split(' ')[0] ?? '?';

  const handleCreateGroup = (ids: string[]) => {
    navigation.navigate('AgentGroupBuilder', {
      preselectedIds: ids,
      listingId,
    });
  };

  const openDetail = (aId: string, bId: string) => {
    const a = getRenter(aId);
    const b = getRenter(bId);
    const score = getScore(aId, bId);
    if (a && b && score !== null) {
      setDetailPair({ a, b, score });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Compatibility Matrix</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        {renters.length < 2 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Feather name="users" size={48} color="#444" />
            <Text style={{ color: '#999', fontSize: 16, marginTop: 16, textAlign: 'center', lineHeight: 24 }}>
              {allRenters.length >= 2
                ? 'Not enough room-seeking renters to compare.\nEntire-apartment seekers are excluded from grouping.'
                : 'Shortlist at least 2 renters to see compatibility.'}
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.subtitle}>
              Tap a pair to create a group. Tap the grid below for details.
            </Text>

            <Text style={styles.sectionTitle}>Top Pairs</Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {sortedPairs.map(pair => {
                const a = getRenter(pair.a);
                const b = getRenter(pair.b);
                if (!a || !b) return null;
                const color = getScoreColor(pair.score);
                return (
                  <Pressable
                    key={`${pair.a}-${pair.b}`}
                    style={styles.pairCard}
                    onPress={() => handleCreateGroup([pair.a, pair.b])}
                  >
                    <View style={styles.pairAvatars}>
                      <Avatar renter={a} size={40} />
                      <View style={styles.pairConnector}>
                        <View style={[styles.connectorLine, { backgroundColor: color + '60' }]} />
                        <View style={[styles.scoreBadge, { backgroundColor: color + '25', borderColor: color }]}>
                          <Text style={[styles.scoreBadgeText, { color }]}>{pair.score}%</Text>
                        </View>
                        <View style={[styles.connectorLine, { backgroundColor: color + '60' }]} />
                      </View>
                      <Avatar renter={b} size={40} />
                    </View>
                    <View style={styles.pairInfo}>
                      <Text style={styles.pairNames}>{a.name.split(' ')[0]} + {b.name.split(' ')[0]}</Text>
                      <Text style={[styles.pairLabel, { color }]}>{getScoreLabel(pair.score)}</Text>
                    </View>
                    <View style={[styles.groupBtn, { borderColor: color }]}>
                      <Feather name="plus" size={14} color={color} />
                      <Text style={[styles.groupBtnText, { color }]}>Group</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {bestTrio ? (
              <>
                <Text style={styles.sectionTitle}>Best Trio</Text>
                <Pressable
                  style={[styles.trioCard, { borderColor: getScoreColor(bestTrio.avgScore) + '50' }]}
                  onPress={() => handleCreateGroup(bestTrio.ids)}
                >
                  <View style={styles.trioAvatars}>
                    {bestTrio.ids.map(id => {
                      const r = getRenter(id);
                      return r ? (
                        <View key={id} style={styles.trioAvatarWrap}>
                          <Avatar renter={r} size={36} />
                          <Text style={styles.trioName}>{getFirstName(id)}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                  <View style={styles.trioBottom}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.trioScore, { color: getScoreColor(bestTrio.avgScore) }]}>
                        {bestTrio.avgScore}% avg compatibility
                      </Text>
                      <Text style={styles.trioHint}>Best possible 3-person group from your shortlist</Text>
                    </View>
                    <View style={[styles.groupBtn, { borderColor: ACCENT }]}>
                      <Feather name="users" size={14} color={ACCENT} />
                      <Text style={[styles.groupBtnText, { color: ACCENT }]}>Group</Text>
                    </View>
                  </View>
                </Pressable>
              </>
            ) : null}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Full Grid</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.matrixRow}>
                  <View style={[styles.matrixCell, styles.matrixHeader]} />
                  {renters.map(r => (
                    <View key={r.id} style={[styles.matrixCell, styles.matrixHeader]}>
                      <Avatar renter={r} size={24} />
                      <Text style={styles.matrixHeaderText} numberOfLines={1}>{getFirstName(r.id)}</Text>
                    </View>
                  ))}
                </View>

                {renters.map(row => (
                  <View key={row.id} style={styles.matrixRow}>
                    <View style={[styles.matrixCell, styles.matrixHeader]}>
                      <Text style={styles.matrixHeaderText} numberOfLines={1}>{getFirstName(row.id)}</Text>
                    </View>
                    {renters.map(col => {
                      const score = getScore(row.id, col.id);
                      const isSelf = row.id === col.id;
                      return (
                        <Pressable
                          key={col.id}
                          style={[
                            styles.matrixCell,
                            score !== null ? { backgroundColor: getScoreColor(score) + '20' } : null,
                            isSelf ? { backgroundColor: '#1a1a1a' } : null,
                          ]}
                          onPress={() => { if (!isSelf) openDetail(row.id, col.id); }}
                          disabled={isSelf}
                        >
                          <Text style={[
                            styles.matrixScore,
                            score !== null ? { color: getScoreColor(score) } : { color: '#333' },
                          ]}>
                            {score !== null ? `${score}%` : '--'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
                <Text style={styles.legendText}>80%+ Great</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: YELLOW }]} />
                <Text style={styles.legendText}>60-79% Decent</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: RED }]} />
                <Text style={styles.legendText}>Below 60% Avoid</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!detailPair}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailPair(null)}
      >
        {detailPair ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <Pressable style={styles.modalClose} onPress={() => setDetailPair(null)}>
                <Feather name="x" size={22} color="#999" />
              </Pressable>

              <View style={styles.modalPairHeader}>
                <Avatar renter={detailPair.a} size={52} />
                <View style={styles.modalScoreWrap}>
                  <Text style={[styles.modalScoreNum, { color: getScoreColor(detailPair.score) }]}>
                    {detailPair.score}%
                  </Text>
                  <Text style={[styles.modalScoreLabel, { color: getScoreColor(detailPair.score) }]}>
                    {getScoreLabel(detailPair.score)}
                  </Text>
                </View>
                <Avatar renter={detailPair.b} size={52} />
              </View>
              <Text style={styles.modalNames}>
                {detailPair.a.name.split(' ')[0]} + {detailPair.b.name.split(' ')[0]}
              </Text>

              <View style={styles.breakdownList}>
                {getPairBreakdown(detailPair.a, detailPair.b).map((item, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={[
                      styles.breakdownIcon,
                      {
                        backgroundColor: item.status === 'match' ? GREEN + '20'
                          : item.status === 'mismatch' ? RED + '20' : YELLOW + '20',
                      },
                    ]}>
                      <Feather
                        name={item.icon as any}
                        size={14}
                        color={item.status === 'match' ? GREEN : item.status === 'mismatch' ? RED : YELLOW}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownDetail}>{item.detail}</Text>
                    </View>
                    <Feather
                      name={item.status === 'match' ? 'check-circle' : item.status === 'mismatch' ? 'x-circle' : 'minus-circle'}
                      size={16}
                      color={item.status === 'match' ? GREEN : item.status === 'mismatch' ? RED : YELLOW}
                    />
                  </View>
                ))}
                {getPairBreakdown(detailPair.a, detailPair.b).length === 0 ? (
                  <Text style={styles.noBreakdown}>No detailed comparison data available for this pair</Text>
                ) : null}
              </View>

              <Pressable
                style={[styles.createGroupBtn, { backgroundColor: ACCENT }]}
                onPress={() => {
                  setDetailPair(null);
                  handleCreateGroup([detailPair.a.id, detailPair.b.id]);
                }}
              >
                <Feather name="users" size={18} color="#fff" />
                <Text style={styles.createGroupBtnText}>Create Group</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#999', fontSize: 14, marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },

  pairCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  pairAvatars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pairConnector: { flexDirection: 'row', alignItems: 'center', width: 56 },
  connectorLine: { flex: 1, height: 2 },
  scoreBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 11, fontWeight: '800' },
  pairInfo: { flex: 1 },
  pairNames: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pairLabel: { fontSize: 12, marginTop: 2 },

  groupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupBtnText: { fontSize: 13, fontWeight: '700' },

  trioCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  trioAvatars: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 14 },
  trioAvatarWrap: { alignItems: 'center', gap: 4 },
  trioName: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  trioBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trioScore: { fontSize: 15, fontWeight: '700' },
  trioHint: { color: '#777', fontSize: 12, marginTop: 2 },

  matrixRow: { flexDirection: 'row' },
  matrixCell: { width: 72, height: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#222', gap: 2 },
  matrixHeader: { backgroundColor: CARD_BG },
  matrixHeaderText: { color: '#ccc', fontSize: 11, fontWeight: '600' },
  matrixScore: { fontSize: 14, fontWeight: '700' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#888', fontSize: 11 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 16 },
  modalClose: { position: 'absolute', top: 14, right: 16, zIndex: 10 },

  modalPairHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  modalScoreWrap: { alignItems: 'center' },
  modalScoreNum: { fontSize: 28, fontWeight: '800' },
  modalScoreLabel: { fontSize: 12, fontWeight: '600' },
  modalNames: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },

  breakdownList: { gap: 12, marginBottom: 24 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  breakdownIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  breakdownDetail: { color: '#999', fontSize: 12, marginTop: 1 },
  noBreakdown: { color: '#666', fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  createGroupBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
