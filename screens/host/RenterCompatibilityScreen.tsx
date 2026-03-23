import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
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

export const RenterCompatibilityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const renters: AgentRenter[] = route.params?.renters ?? [];

  const matrix = useMemo(() => calculatePairMatrix(renters), [renters]);

  const getScore = (aId: string, bId: string): number | null => {
    if (aId === bId) return null;
    const pair = matrix.find(p =>
      (p.a === aId && p.b === bId) || (p.a === bId && p.b === aId)
    );
    return pair?.score ?? null;
  };

  const highestPair = useMemo(() => {
    if (matrix.length === 0) return null;
    return matrix.reduce((best, p) => p.score > best.score ? p : best, matrix[0]);
  }, [matrix]);

  const lowPairs = useMemo(() => matrix.filter(p => p.score < 60), [matrix]);

  const poorRenters = useMemo(() => {
    return renters.filter(r => {
      const scores = matrix.filter(p => p.a === r.id || p.b === r.id);
      return scores.length > 0 && scores.every(s => s.score < 60);
    });
  }, [renters, matrix]);

  const getRenterName = (id: string) => renters.find(r => r.id === id)?.name ?? 'Unknown';
  const getFirstName = (id: string) => getRenterName(id).split(' ')[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Compatibility Matrix</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}>
        <Text style={styles.subtitle}>
          How your {renters.length} shortlisted renters score against each other
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.matrixRow}>
              <View style={[styles.matrixCell, styles.matrixHeader]} />
              {renters.map(r => (
                <View key={r.id} style={[styles.matrixCell, styles.matrixHeader]}>
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
                  return (
                    <View
                      key={col.id}
                      style={[
                        styles.matrixCell,
                        score !== null ? { backgroundColor: getScoreColor(score) + '30' } : null,
                      ]}
                    >
                      <Text style={[
                        styles.matrixScore,
                        score !== null ? { color: getScoreColor(score) } : { color: '#555' },
                      ]}>
                        {score !== null ? `${score}%` : '--'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.insights}>
          {highestPair ? (
            <View style={styles.insightCard}>
              <Feather name="trending-up" size={16} color={GREEN} />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Best Match</Text>
                <Text style={styles.insightText}>
                  {getRenterName(highestPair.a)} and {getRenterName(highestPair.b)} score {highestPair.score}% — consider grouping them together
                </Text>
              </View>
            </View>
          ) : null}

          {lowPairs.map(pair => (
            <View key={`${pair.a}-${pair.b}`} style={styles.insightCard}>
              <Feather name="alert-triangle" size={16} color={YELLOW} />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Low Compatibility</Text>
                <Text style={styles.insightText}>
                  {getRenterName(pair.a)} and {getRenterName(pair.b)} score only {pair.score}% — avoid pairing
                </Text>
              </View>
            </View>
          ))}

          {poorRenters.map(r => (
            <View key={r.id} style={styles.insightCard}>
              <Feather name="user-x" size={16} color={RED} />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Consider Replacing</Text>
                <Text style={styles.insightText}>
                  {r.name} scores poorly against everyone — consider swapping from the browse feed
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
            <Text style={styles.legendText}>80%+ Strong match</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: YELLOW }]} />
            <Text style={styles.legendText}>60-79% Moderate</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: RED }]} />
            <Text style={styles.legendText}>Below 60% Avoid pairing</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#999', fontSize: 14, marginBottom: 20 },
  matrixRow: { flexDirection: 'row' },
  matrixCell: { width: 72, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#333' },
  matrixHeader: { backgroundColor: CARD_BG },
  matrixHeaderText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  matrixScore: { fontSize: 15, fontWeight: '700' },
  insights: { marginTop: 24, gap: 12 },
  insightCard: { flexDirection: 'row', gap: 12, backgroundColor: CARD_BG, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  insightTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  insightText: { color: '#aaa', fontSize: 13, marginTop: 4, lineHeight: 20 },
  legend: { marginTop: 24, backgroundColor: CARD_BG, borderRadius: 12, padding: 16 },
  legendTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: '#aaa', fontSize: 13 },
});
