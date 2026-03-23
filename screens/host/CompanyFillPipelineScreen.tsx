import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { getFillPipeline, FillPipelineItem } from '../../services/companyMatchmakerService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

export const CompanyFillPipelineScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [pipeline, setPipeline] = useState<FillPipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPipeline = async () => {
    try {
      const data = await getFillPipeline(user!.id);
      setPipeline(data);
    } catch (e) {
      console.error('[CompanyFillPipeline] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadPipeline(); }, [user]));

  const totalVacant = pipeline.filter(p => p.status !== 'filled').length;
  const urgentCount = pipeline.filter(p => p.status === 'urgent').length;
  const totalMatches = pipeline.reduce((sum, p) => sum + p.totalGroupsMatched, 0);

  const getStatusColor = (status: FillPipelineItem['status']) => {
    if (status === 'urgent') return '#FF4444';
    if (status === 'active') return '#FF8C00';
    return '#2ecc71';
  };

  const getStatusLabel = (status: FillPipelineItem['status']) => {
    if (status === 'urgent') return 'URGENT';
    if (status === 'active') return 'ACTIVE';
    return 'FILLED';
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={ACCENT} onRefresh={() => { setRefreshing(true); loadPipeline(); }} />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>AI Fill Pipeline</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{totalVacant}</Text>
          <Text style={styles.summaryLabel}>Vacant</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, urgentCount > 0 ? { color: '#FF4444' } : null]}>
            {urgentCount}
          </Text>
          <Text style={styles.summaryLabel}>Urgent</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, { color: ACCENT }]}>{totalMatches}</Text>
          <Text style={styles.summaryLabel}>AI Matches</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Portfolio</Text>

      {pipeline.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="home" size={48} color="#444" />
          <Text style={styles.emptyText}>No active listings found.</Text>
          <Text style={styles.emptySubtext}>Add listings to start the AI fill pipeline.</Text>
        </View>
      ) : null}

      {pipeline.map(item => {
        const statusColor = getStatusColor(item.status);
        return (
          <Pressable
            key={item.listingId}
            style={styles.listingCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('CompanyListingAI', { listingId: item.listingId });
            }}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listingAddress} numberOfLines={1}>{item.address}</Text>
                <Text style={styles.listingNeighborhood}>{item.neighborhood}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Feather name="clock" size={13} color="#888" />
                <Text style={styles.statText}>{item.daysVacant}d vacant</Text>
              </View>
              <View style={styles.statItem}>
                <Feather name="users" size={13} color="#888" />
                <Text style={styles.statText}>{item.totalGroupsMatched} matched</Text>
              </View>
              <View style={styles.statItem}>
                <Feather name="send" size={13} color="#888" />
                <Text style={styles.statText}>{item.totalInvitesSent} invites</Text>
              </View>
            </View>

            {item.bestMatchScore > 0 ? (
              <View style={styles.bestMatchBar}>
                <Text style={styles.bestMatchLabel}>Best match</Text>
                <View style={styles.scoreTrack}>
                  <View style={[styles.scoreFill, { width: `${item.bestMatchScore}%` }]} />
                </View>
                <Text style={styles.scoreValue}>{item.bestMatchScore}%</Text>
              </View>
            ) : null}

            <View style={styles.cardActions}>
              <Pressable
                style={styles.aiButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('CompanyListingAI', {
                    listingId: item.listingId,
                    autoRunPairing: true,
                  });
                }}
              >
                <Feather name="zap" size={14} color="#fff" />
                <Text style={styles.aiButtonText}>AI Pair Group</Text>
              </Pressable>
              <Pressable
                style={styles.viewMatchesButton}
                onPress={() => navigation.navigate('GroupMatches', { listingId: item.listingId })}
              >
                <Text style={styles.viewMatchesText}>View Matches</Text>
                <Feather name="chevron-right" size={14} color={ACCENT} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    backgroundColor: CARD_BG,
    borderRadius: 14,
  },
  summaryNumber: { fontSize: 26, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#555', marginTop: 4 },
  listingCard: {
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  listingAddress: { fontSize: 15, fontWeight: '600', color: '#fff' },
  listingNeighborhood: { fontSize: 12, color: '#888', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#aaa' },
  bestMatchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bestMatchLabel: { fontSize: 11, color: '#888', width: 80 },
  scoreTrack: { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' },
  scoreFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  scoreValue: { fontSize: 12, fontWeight: '700', color: ACCENT, width: 32, textAlign: 'right' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  aiButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  viewMatchesButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  viewMatchesText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
