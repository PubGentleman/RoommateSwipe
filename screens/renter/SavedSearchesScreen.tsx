import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, Alert,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSavedSearches, deleteSavedSearch, checkForNewMatches, updateSavedSearch,
  SavedSearch,
} from '../../services/savedSearchService';

export default function SavedSearchesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const loadSearches = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getSavedSearches(user.id);
      setSearches(data);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadSearches(); }, [loadSearches]);

  const handleCheckMatches = async (search: SavedSearch) => {
    setCheckingId(search.id);
    try {
      const result = await checkForNewMatches(search.id, search.filters);
      setSearches(prev =>
        prev.map(s => s.id === search.id
          ? { ...s, new_match_count: result.newCount, last_checked_at: new Date().toISOString() }
          : s
        )
      );
      if (result.newCount > 0) {
        Alert.alert('New Matches!', `${result.newCount} new listing${result.newCount !== 1 ? 's' : ''} match this search.`);
      } else {
        Alert.alert('No New Matches', 'No new listings since last check.');
      }
    } catch (err) {
      console.error('Failed to check matches:', err);
    } finally {
      setCheckingId(null);
    }
  };

  const handleRunSearch = (search: SavedSearch) => {
    navigation.navigate('ExploreMain', {
      applySavedFilters: search.filters,
      savedSearchId: search.id,
    });
  };

  const handleDelete = (search: SavedSearch) => {
    Alert.alert(
      'Delete Saved Search',
      `Remove "${search.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedSearch(search.id);
              setSearches(prev => prev.filter(s => s.id !== search.id));
            } catch (err) {
              console.error('Failed to delete:', err);
            }
          },
        },
      ]
    );
  };

  const handleToggleNotify = async (search: SavedSearch) => {
    try {
      const updated = await updateSavedSearch(search.id, {
        notify_enabled: !search.notify_enabled,
      });
      setSearches(prev => prev.map(s => s.id === search.id ? updated : s));
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
    }
  };

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderSearch = ({ item }: { item: SavedSearch }) => {
    const isChecking = checkingId === item.id;
    const hasNew = item.new_match_count > 0;

    const filterParts: string[] = [];
    const f = item.filters;
    if (f.city) filterParts.push(f.city);
    if (f.neighborhood) filterParts.push(f.neighborhood);
    if (f.minPrice || f.maxPrice) {
      filterParts.push(
        f.minPrice && f.maxPrice ? `$${f.minPrice}-$${f.maxPrice}`
        : f.maxPrice ? `\u2264$${f.maxPrice}`
        : `\u2265$${f.minPrice}`
      );
    }
    if (f.minBedrooms) filterParts.push(`${f.minBedrooms}+ BR`);
    if (f.listingTypes?.length) filterParts.push(...f.listingTypes);
    if (f.petFriendly) filterParts.push('Pets');
    if (f.noFee) filterParts.push('No Fee');
    if (f.amenities?.length) filterParts.push(`${f.amenities.length} amenities`);
    if (f.transitLines?.length) filterParts.push(`${f.transitLines.length} lines`);

    return (
      <Pressable style={styles.searchCard} onPress={() => handleRunSearch(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.searchName} numberOfLines={1}>{item.name}</Text>
            {hasNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{item.new_match_count} new</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.lastChecked}>Checked {timeAgo(item.last_checked_at)}</Text>
        </View>

        <View style={styles.filterChipsRow}>
          {filterParts.slice(0, 5).map((part, i) => (
            <View key={i} style={styles.miniChip}>
              <Text style={styles.miniChipText}>{part}</Text>
            </View>
          ))}
          {filterParts.length > 5 ? (
            <Text style={styles.moreFilters}>+{filterParts.length - 5} more</Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.totalMatches}>{item.total_matches} total matches</Text>
          <Text style={styles.dot}>{'\u00B7'}</Text>
          <Text style={styles.frequency}>
            {item.notify_enabled ? `Alerts: ${item.notify_frequency}` : 'Alerts off'}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleCheckMatches(item)}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <Feather name="refresh-cw" size={16} color="#6C5CE7" />
            )}
            <Text style={styles.actionText}>Check Now</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => handleToggleNotify(item)}>
            <Feather
              name={item.notify_enabled ? 'bell' : 'bell-off'}
              size={16}
              color={item.notify_enabled ? '#F39C12' : '#666'}
            />
            <Text style={styles.actionText}>
              {item.notify_enabled ? 'Alerts On' : 'Alerts Off'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => handleDelete(item)}>
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={searches}
        keyExtractor={item => item.id}
        renderItem={renderSearch}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSearches(); }} tintColor="#6C5CE7" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color="#333" />
            <Text style={styles.emptyTitle}>No Saved Searches</Text>
            <Text style={styles.emptySubtitle}>
              Set your filters on the Explore screen, then tap "Save Search" to get notified when new listings match.
            </Text>
            <Pressable
              style={styles.exploreButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.exploreButtonText}>Go to Explore</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  list: { padding: 16, gap: 12 },
  searchCard: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#222' },
  cardHeader: { marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  searchName: { fontSize: 17, fontWeight: '700', color: '#fff', flex: 1 },
  newBadge: { backgroundColor: '#ff6b5b', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  newBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  lastChecked: { color: '#666', fontSize: 12 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  miniChip: { backgroundColor: '#252525', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  miniChipText: { color: '#999', fontSize: 11 },
  moreFilters: { color: '#666', fontSize: 11, alignSelf: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  totalMatches: { color: '#999', fontSize: 13 },
  dot: { color: '#444' },
  frequency: { color: '#999', fontSize: 13 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#252525', paddingTop: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  actionText: { color: '#999', fontSize: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 24 },
  exploreButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  exploreButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
