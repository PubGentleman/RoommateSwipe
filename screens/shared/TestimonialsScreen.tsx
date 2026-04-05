import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Image, Alert, RefreshControl, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../components/VectorIcons';
import { getReceivedTestimonials, getTestimonialsWrittenByMe, updateTestimonialStatus, getTraitEmoji, getProfileShareLink } from '../../services/socialProfileService';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRenterPlan } from '../../constants/renterPlanLimits';

type Tab = 'received' | 'written';

function relativeDate(d: string): string {
  const now = Date.now();
  const diff = now - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TestimonialCard({ item, tab, onApprove, onHide }: {
  item: any;
  tab: Tab;
  onApprove?: (id: string) => void;
  onHide?: (id: string) => void;
}) {
  const isPending = item.status === 'pending';
  const personName = tab === 'received'
    ? (item.author?.full_name || 'Unknown')
    : (item.recipient?.full_name || 'Unknown');
  const personPhoto = tab === 'received'
    ? item.author?.avatar_url
    : item.recipient?.avatar_url;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        {personPhoto ? (
          <Image source={{ uri: personPhoto }} style={cardStyles.avatar} />
        ) : (
          <View style={[cardStyles.avatar, cardStyles.avatarFallback]}>
            <Feather name="user" size={16} color="#A0A0A0" />
          </View>
        )}
        <View style={cardStyles.meta}>
          <Text style={cardStyles.name}>{personName}</Text>
          <View style={cardStyles.subRow}>
            <View style={cardStyles.relBadge}>
              <Text style={cardStyles.relText}>{(item.relationship || '').replace('_', ' ')}</Text>
            </View>
            {isPending && tab === 'received' ? (
              <View style={cardStyles.pendingBadge}>
                <Text style={cardStyles.pendingText}>Pending Review</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={cardStyles.date}>{relativeDate(item.created_at)}</Text>
      </View>

      <View style={cardStyles.starsRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <Feather key={i} name="star" size={14} color={i <= (item.rating || 0) ? '#ff6b5b' : '#333'} />
        ))}
      </View>

      {item.traits && item.traits.length > 0 ? (
        <View style={cardStyles.traitsRow}>
          {item.traits.slice(0, 4).map((t: string) => (
            <View key={t} style={cardStyles.traitPill}>
              <Text style={cardStyles.traitText}>{getTraitEmoji(t)} {t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {item.content ? (
        <Text style={cardStyles.content}>"{item.content}"</Text>
      ) : null}

      {isPending && tab === 'received' && onApprove && onHide ? (
        <View style={cardStyles.actions}>
          <Pressable style={cardStyles.approveBtn} onPress={() => onApprove(item.id)}>
            <Feather name="check" size={14} color="#22C55E" />
            <Text style={cardStyles.approveBtnText}>Approve</Text>
          </Pressable>
          <Pressable style={cardStyles.hideBtn} onPress={() => onHide(item.id)}>
            <Feather name="eye-off" size={14} color="#A0A0A0" />
            <Text style={cardStyles.hideBtnText}>Hide</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function TestimonialsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<any[]>([]);
  const [written, setWritten] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [r, w] = await Promise.all([
        getReceivedTestimonials(user.id),
        getTestimonialsWrittenByMe(user.id),
      ]);
      setReceived(r);
      setWritten(w);
    } catch {
      setReceived([]);
      setWritten([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    if (!user?.id) return;
    try {
      await updateTestimonialStatus(id, user.id, 'approved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setReceived(prev => prev.map(t => t.id === id ? { ...t, status: 'approved' } : t));
    } catch {
      Alert.alert('Error', 'Failed to approve testimonial');
    }
  };

  const handleHide = async (id: string) => {
    if (!user?.id) return;
    try {
      await updateTestimonialStatus(id, user.id, 'hidden');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setReceived(prev => prev.filter(t => t.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to hide testimonial');
    }
  };

  const plan = normalizeRenterPlan(user?.subscription?.plan);
  const maxVisible = plan === 'elite' ? Infinity : plan === 'plus' ? 10 : 3;
  const approvedReceived = received.filter(t => t.status === 'approved');
  const pendingReceived = received.filter(t => t.status === 'pending');
  const visibleApproved = approvedReceived.slice(0, maxVisible);
  const gatedCount = Math.max(0, approvedReceived.length - maxVisible);
  const displayReceived = [...pendingReceived, ...visibleApproved];
  const data = tab === 'received' ? displayReceived : written;
  const pendingCount = pendingReceived.length;

  const handleRequestTestimonial = async () => {
    try {
      const slug = user?.profile_slug || user?.id || '';
      const link = getProfileShareLink(slug);
      await Share.share({
        message: `Hey! Could you write a testimonial about me on Rhome? It really helps with finding roommates. Here's my profile: ${link}`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Testimonials</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'received' ? styles.tabActive : null]}
          onPress={() => setTab('received')}
        >
          <Text style={[styles.tabText, tab === 'received' ? styles.tabTextActive : null]}>
            Received{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'written' ? styles.tabActive : null]}
          onPress={() => setTab('written')}
        >
          <Text style={[styles.tabText, tab === 'written' ? styles.tabTextActive : null]}>Written</Text>
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TestimonialCard
            item={item}
            tab={tab}
            onApprove={handleApprove}
            onHide={handleHide}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor="#ff6b5b"
          />
        }
        ListFooterComponent={
          <>
            {tab === 'received' && gatedCount > 0 ? (
              <View style={styles.gatedBanner}>
                <Feather name="lock" size={14} color="#ff6b5b" />
                <Text style={styles.gatedText}>
                  {gatedCount} more testimonial{gatedCount > 1 ? 's' : ''} visible with {plan === 'basic' ? 'Plus' : 'Elite'}
                </Text>
              </View>
            ) : null}
            {tab === 'received' ? (
              <Pressable style={styles.requestBtn} onPress={handleRequestTestimonial}>
                <Feather name="send" size={16} color="#ff6b5b" />
                <Text style={styles.requestBtnText}>Request a Testimonial</Text>
              </Pressable>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={40} color="#333" />
            <Text style={styles.emptyTitle}>
              {tab === 'received' ? 'No testimonials yet' : 'You haven\'t written any testimonials'}
            </Text>
            <Text style={styles.emptyDesc}>
              {tab === 'received'
                ? 'Ask someone you\'ve matched or grouped with to write one!'
                : 'Write testimonials for people you\'ve matched or grouped with.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
  },
  tabTextActive: {
    color: '#ff6b5b',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 18,
  },
  gatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  gatedText: {
    fontSize: 13,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  requestBtnText: {
    fontSize: 15,
    color: '#ff6b5b',
    fontWeight: '700',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  subRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  relBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pendingBadge: {
    backgroundColor: 'rgba(234,179,8,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 11,
    color: '#EAB308',
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    color: '#666',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 10,
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  traitPill: {
    backgroundColor: 'rgba(255,107,91,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  traitText: {
    fontSize: 11,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  content: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveBtnText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
  },
  hideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  hideBtnText: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '600',
  },
});
