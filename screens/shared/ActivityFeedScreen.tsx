import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { FeedEventCard } from '../../components/FeedEventCard';
import { useAuth } from '../../contexts/AuthContext';
import { getFeedEvents, markFeedRead, subscribeToFeed, type FeedEvent } from '../../services/activityFeedService';
import { useFeedBadge } from '../../contexts/FeedBadgeContext';
import { navigateToFeedAction } from '../../utils/feedNavigation';

type FilterTab = 'all' | 'matches' | 'groups' | 'listings' | 'social';

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'activity' },
  { key: 'matches', label: 'Matches', icon: 'heart' },
  { key: 'groups', label: 'Groups', icon: 'users' },
  { key: 'listings', label: 'Listings', icon: 'home' },
  { key: 'social', label: 'Social', icon: 'eye' },
];

function generateMockFeedEvents(userId: string): FeedEvent[] {
  const now = Date.now();
  return [
    {
      id: 'feed-1',
      userId,
      eventType: 'new_match',
      title: 'New Match!',
      body: 'You matched with Sarah J. — 87% compatible',
      metadata: { matchId: 'match-1', otherUserId: '1', otherUserName: 'Sarah J.', compatibilityScore: 87, otherUserPhoto: 'https://randomuser.me/api/portraits/women/44.jpg' },
      read: false,
      actionUrl: '/match/match-1',
      createdAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      id: 'feed-2',
      userId,
      eventType: 'listing_price_drop',
      title: 'Price dropped on Modern Downtown Apartment',
      body: '$2,400 \u2192 $2,200/mo',
      metadata: { listingId: '1', listingTitle: 'Modern Downtown Apartment', oldPrice: 2400, newPrice: 2200, photo: 'https://picsum.photos/800/600?random=10' },
      read: false,
      actionUrl: '/listing/1',
      createdAt: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'feed-3',
      userId,
      eventType: 'group_member_added',
      title: 'Emily R. joined NYC Apartment Hunters',
      body: 'Your group has a new member!',
      metadata: { groupId: '1', groupName: 'NYC Apartment Hunters', memberName: 'Emily R.', memberPhoto: 'https://randomuser.me/api/portraits/women/68.jpg' },
      read: false,
      actionUrl: '/group/1',
      createdAt: new Date(now - 5 * 3600000).toISOString(),
    },
    {
      id: 'feed-4',
      userId,
      eventType: 'profile_view',
      title: '3 people viewed your profile',
      body: 'See who checked you out',
      metadata: { viewCount: 3 },
      read: true,
      actionUrl: '/profile-views',
      createdAt: new Date(now - 8 * 3600000).toISOString(),
    },
    {
      id: 'feed-5',
      userId,
      eventType: 'super_interest_received',
      title: 'Someone sent you a Super Interest!',
      body: 'Upgrade to see who it is',
      metadata: { fromUserId: '5' },
      read: true,
      actionUrl: '/roommates',
      createdAt: new Date(now - 12 * 3600000).toISOString(),
    },
    {
      id: 'feed-6',
      userId,
      eventType: 'match_milestone',
      title: '10 messages milestone!',
      body: 'Your conversation with Michael is going strong',
      metadata: { matchId: 'match-2', milestone: '10 messages', messageCount: 10 },
      read: true,
      actionUrl: '/match/match-2',
      createdAt: new Date(now - 24 * 3600000).toISOString(),
    },
    {
      id: 'feed-7',
      userId,
      eventType: 'listing_new_in_area',
      title: 'New listing in Williamsburg',
      body: '$1,800/mo \u00B7 2 bed \u00B7 Available now',
      metadata: { listingId: '3', neighborhood: 'Williamsburg', photo: 'https://picsum.photos/800/600?random=12' },
      read: true,
      actionUrl: '/listing/3',
      createdAt: new Date(now - 36 * 3600000).toISOString(),
    },
    {
      id: 'feed-8',
      userId,
      eventType: 'group_property_linked',
      title: 'New listing added to Brooklyn Roommates',
      body: 'A member shared a listing with the group',
      metadata: { groupId: '2', groupName: 'Brooklyn Roommates', listingId: '4' },
      read: true,
      actionUrl: '/group/2',
      createdAt: new Date(now - 48 * 3600000).toISOString(),
    },
    {
      id: 'feed-9',
      userId,
      eventType: 'compatibility_update',
      title: 'Compatibility scores updated',
      body: 'Your match scores have improved after completing your profile',
      metadata: {},
      read: true,
      createdAt: new Date(now - 72 * 3600000).toISOString(),
    },
    {
      id: 'feed-10',
      userId,
      eventType: 'new_match',
      title: 'New Match!',
      body: 'You matched with Alex K. — 74% compatible',
      metadata: { matchId: 'match-3', otherUserId: '4', otherUserName: 'Alex K.', compatibilityScore: 74, otherUserPhoto: 'https://randomuser.me/api/portraits/men/32.jpg' },
      read: true,
      actionUrl: '/match/match-3',
      createdAt: new Date(now - 96 * 3600000).toISOString(),
    },
  ];
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

type SectionItem = { type: 'header'; title: string } | { type: 'event'; event: FeedEvent };

function groupEventsIntoSections(events: FeedEvent[]): SectionItem[] {
  const items: SectionItem[] = [];
  let lastGroup = '';
  for (const event of events) {
    const group = getDateGroup(event.createdAt);
    if (group !== lastGroup) {
      items.push({ type: 'header', title: group });
      lastGroup = group;
    }
    items.push({ type: 'event', event });
  }
  return items;
}

export function ActivityFeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { refreshFeedCount } = useFeedBadge();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const loadEvents = useCallback(async (reset = false) => {
    if (!user?.id) return;
    const offset = reset ? 0 : offsetRef.current;
    try {
      const data = await getFeedEvents(user.id, 30, offset, activeFilter === 'all' ? undefined : activeFilter);
      if (reset) {
        setEvents(data);
      } else {
        setEvents(prev => [...prev, ...data]);
      }
      offsetRef.current = offset + data.length;
      setHasMore(data.length >= 30);
    } catch {
      if (reset) {
        const mock = generateMockFeedEvents(user.id);
        const filtered = activeFilter === 'all' ? mock : mock.filter(e => {
          if (activeFilter === 'matches') return ['new_match', 'super_interest_received', 'match_milestone', 'compatibility_update'].includes(e.eventType);
          if (activeFilter === 'groups') return ['group_joined', 'group_member_added', 'group_formed', 'group_property_linked'].includes(e.eventType);
          if (activeFilter === 'listings') return ['listing_saved', 'listing_price_drop', 'listing_new_in_area'].includes(e.eventType);
          if (activeFilter === 'social') return ['profile_view', 'roommate_moved'].includes(e.eventType);
          return true;
        });
        setEvents(filtered);
        setHasMore(false);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, activeFilter]);

  useEffect(() => {
    setIsLoading(true);
    offsetRef.current = 0;
    loadEvents(true);
  }, [activeFilter]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToFeed(user.id, (newEvent) => {
      setEvents(prev => [newEvent, ...prev]);
    });
    return unsub;
  }, [user?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    offsetRef.current = 0;
    loadEvents(true);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) loadEvents(false);
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEvents(prev => prev.map(e => ({ ...e, read: true })));
    markFeedRead(user.id).then(() => refreshFeedCount()).catch(() => {});
  };

  const handleEventPress = (event: FeedEvent) => {
    if (!event.read) {
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, read: true } : e));
      if (user?.id) markFeedRead(user.id, [event.id]).then(() => refreshFeedCount()).catch(() => {});
    }
    navigateToFeedAction(navigation, event.actionUrl);
  };

  const unreadCount = events.filter(e => !e.read).length;
  const sectionItems = groupEventsIntoSections(events);

  const renderItem = ({ item, index }: { item: SectionItem; index: number }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }
    return (
      <FeedEventCard
        event={item.event}
        onPress={() => handleEventPress(item.event)}
        index={index}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Activity</Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => {
          const active = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveFilter(tab.key);
              }}
              style={[styles.filterPill, active ? styles.filterPillActive : null]}
            >
              <Feather name={tab.icon} size={13} color={active ? '#fff' : '#A0A0A0'} />
              <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <Animated.View key={i} entering={FadeIn.delay(i * 100)} style={styles.skeleton}>
              <View style={styles.skelCircle} />
              <View style={styles.skelContent}>
                <View style={[styles.skelLine, { width: '70%' }]} />
                <View style={[styles.skelLine, { width: '45%', marginTop: 6 }]} />
              </View>
            </Animated.View>
          ))}
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="activity" size={40} color="rgba(255,255,255,0.15)" />
          </View>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>Start swiping to see updates here!</Text>
        </View>
      ) : (
        <FlatList
          data={sectionItems}
          keyExtractor={(item, idx) => item.type === 'header' ? `header-${item.title}` : (item as any).event.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#ff6b5b" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={hasMore && events.length > 0 ? (
            <View style={styles.loadMoreWrap}>
              <ActivityIndicator size="small" color="#ff6b5b" />
            </View>
          ) : null}
        />
      )}
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
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  markReadText: {
    fontSize: 13,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    gap: 5,
  },
  filterPillActive: {
    backgroundColor: '#ff6b5b',
  },
  filterPillText: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingContainer: {
    padding: 16,
    gap: 12,
  },
  skeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  skelCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 12,
  },
  skelContent: {
    flex: 1,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  loadMoreWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
