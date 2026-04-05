import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../components/VectorIcons';
import { EventCard } from '../../components/EventCard';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUpcomingEvents,
  getMyEvents,
  rsvpToEvent,
  EVENT_TYPES,
  type RhomeEvent,
} from '../../services/eventService';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  ...EVENT_TYPES.map(t => ({ key: t.key, label: t.label.split(' ')[0] })),
];

export function EventsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'discover' | 'my'>('discover');
  const [filterType, setFilterType] = useState('all');
  const [events, setEvents] = useState<RhomeEvent[]>([]);
  const [hosting, setHosting] = useState<RhomeEvent[]>([]);
  const [attending, setAttending] = useState<RhomeEvent[]>([]);
  const [past, setPast] = useState<RhomeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiscover = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getUpcomingEvents(
        user.id,
        undefined,
        filterType === 'all' ? undefined : filterType
      );
      setEvents(data);
    } catch (err) {
      console.error('[Events] load error:', err);
    }
  }, [user?.id, filterType]);

  const loadMyEvents = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getMyEvents(user.id);
      setHosting(data.hosting);
      setAttending(data.attending);
      setPast(data.past);
    } catch (err) {
      console.error('[Events] my events error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'discover') {
      loadDiscover().finally(() => setLoading(false));
    } else {
      loadMyEvents().finally(() => setLoading(false));
    }
  }, [activeTab, loadDiscover, loadMyEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'discover') {
      await loadDiscover();
    } else {
      await loadMyEvents();
    }
    setRefreshing(false);
  };

  const handleRsvp = async (eventId: string) => {
    if (!user?.id) return;
    try {
      await rsvpToEvent(eventId, user.id, 'going');
      if (activeTab === 'discover') await loadDiscover();
      else await loadMyEvents();
    } catch {}
  };

  const renderEvent = ({ item }: { item: RhomeEvent }) => (
    <EventCard
      event={item}
      onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      onRsvp={() => handleRsvp(item.id)}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Events</Text>
          <Pressable
            onPress={() => navigation.navigate('CreateEvent', {})}
            style={styles.createBtn}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
              Discover
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Events
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'discover' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTER_TABS.map(f => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filterType === f.key && styles.filterChipActive]}
                onPress={() => setFilterType(f.key)}
              >
                <Text style={[styles.filterChipText, filterType === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#ff6b5b" />
            </View>
          ) : events.length === 0 ? (
            <View style={styles.center}>
              <Feather name="calendar" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>No upcoming events in your area</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateEvent', {})}
              >
                <Text style={styles.emptyBtnText}>Create an Event</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={events}
              renderItem={renderEvent}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b5b" />
              }
            />
          )}
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b5b" />
          }
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#ff6b5b" />
            </View>
          ) : (
            <>
              {hosting.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Hosting</Text>
                  {hosting.map(e => (
                    <EventCard
                      key={e.id}
                      event={e}
                      compact
                      onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
                    />
                  ))}
                </View>
              ) : null}
              {attending.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Attending</Text>
                  {attending.map(e => (
                    <EventCard
                      key={e.id}
                      event={e}
                      compact
                      onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
                    />
                  ))}
                </View>
              ) : null}
              {hosting.length === 0 && attending.length === 0 ? (
                <View style={styles.center}>
                  <Feather name="calendar" size={40} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.emptyText}>You haven't joined any events yet</Text>
                </View>
              ) : null}
              {past.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: 'rgba(255,255,255,0.35)' }]}>Past Events</Text>
                  {past.map(e => (
                    <EventCard
                      key={e.id}
                      event={e}
                      compact
                      onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  createBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(255,107,91,0.12)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabTextActive: {
    color: '#ff6b5b',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterChipTextActive: {
    color: '#ff6b5b',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  emptyBtn: {
    borderWidth: 1,
    borderColor: '#ff6b5b',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
});
