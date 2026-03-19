import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Modal, Pressable, TextInput, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Feather } from '../components/VectorIcons';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Typography, Spacing } from '../constants/theme';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';

interface ListingResult {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  rent: number;
  bedrooms: number;
  photos: string[];
  transitInfo?: string[];
}

interface Filters {
  city: string;
  minRent: number | null;
  maxRent: number | null;
  bedrooms: number | null;
}

const DEFAULT_FILTERS: Filters = {
  city: '',
  minRent: null,
  maxRent: null,
  bedrooms: null,
};

const PRICE_RANGES = [
  { label: 'Any', min: null, max: null },
  { label: 'Under $1k', min: null, max: 1000 },
  { label: '$1k-$2k', min: 1000, max: 2000 },
  { label: '$2k-$3k', min: 2000, max: 3000 },
  { label: '$3k+', min: 3000, max: null },
];

const BEDROOM_OPTIONS = [
  { label: 'Any', value: null },
  { label: '1 BR', value: 1 },
  { label: '2 BR', value: 2 },
  { label: '3 BR', value: 3 },
  { label: '4+ BR', value: 4 },
];

interface Props {
  visible: boolean;
  currentListingId?: string | null;
  onSelect: (listing: ListingResult | null) => void;
  onClose: () => void;
}

export function GroupPropertySearchModal({ visible, currentListingId, onSelect, onClose }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<ListingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      supabase
        .from('listings')
        .select('city')
        .eq('status', 'available')
        .then(({ data }) => {
          const unique = [...new Set((data || []).map((r: any) => r.city))].sort();
          setCities(unique.slice(0, 20));
        });
      searchListings('', DEFAULT_FILTERS);
    } else {
      setQuery('');
      setFilters(DEFAULT_FILTERS);
      setShowFilters(false);
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchListings(query, filters);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filters]);

  const searchListings = async (q: string, f: Filters) => {
    setLoading(true);
    try {
      let req = supabase
        .from('listings')
        .select('id, title, address, city, state, rent, bedrooms, photos, transit_info')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(30);

      if (q.trim()) {
        req = req.or(
          `title.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,neighborhood.ilike.%${q}%`
        );
      }

      if (f.city) req = req.ilike('city', `%${f.city}%`);
      if (f.minRent !== null) req = req.gte('rent', f.minRent);
      if (f.maxRent !== null) req = req.lte('rent', f.maxRent);

      if (f.bedrooms !== null) {
        if (f.bedrooms >= 4) {
          req = req.gte('bedrooms', 4);
        } else {
          req = req.eq('bedrooms', f.bedrooms);
        }
      }

      const { data, error } = await req;
      if (error) throw error;

      setResults((data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        address: r.address,
        city: r.city,
        state: r.state,
        rent: r.rent,
        bedrooms: r.bedrooms,
        photos: r.photos || [],
        transitInfo: r.transit_info || [],
      })));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = [
    filters.city,
    filters.minRent !== null || filters.maxRent !== null,
    filters.bedrooms !== null,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>
            Find a Property
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="search" size={17} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by address, city, or name..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Feather name="x-circle" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[
              styles.filterBtn,
              { backgroundColor: activeFilterCount > 0 ? theme.primary : theme.card,
                borderColor: activeFilterCount > 0 ? theme.primary : theme.border }
            ]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Feather
              name="sliders"
              size={17}
              color={activeFilterCount > 0 ? '#fff' : theme.textSecondary}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {showFilters ? (
          <View style={[styles.filterPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 8 }]}>
              CITY
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Pressable
                style={[styles.chip, { borderColor: !filters.city ? theme.primary : theme.border,
                  backgroundColor: !filters.city ? theme.primary + '20' : 'transparent' }]}
                onPress={() => setFilters(f => ({ ...f, city: '' }))}
              >
                <ThemedText style={[Typography.small, { color: !filters.city ? theme.primary : theme.text }]}>
                  Any City
                </ThemedText>
              </Pressable>
              {cities.map(city => (
                <Pressable
                  key={city}
                  style={[styles.chip, { borderColor: filters.city === city ? theme.primary : theme.border,
                    backgroundColor: filters.city === city ? theme.primary + '20' : 'transparent' }]}
                  onPress={() => setFilters(f => ({ ...f, city: f.city === city ? '' : city }))}
                >
                  <ThemedText style={[Typography.small, { color: filters.city === city ? theme.primary : theme.text }]}>
                    {city}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 8 }]}>
              PRICE RANGE
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {PRICE_RANGES.map(range => {
                const active = filters.minRent === range.min && filters.maxRent === range.max;
                return (
                  <Pressable
                    key={range.label}
                    style={[styles.chip, { borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary + '20' : 'transparent' }]}
                    onPress={() => setFilters(f => ({ ...f, minRent: range.min, maxRent: range.max }))}
                  >
                    <ThemedText style={[Typography.small, { color: active ? theme.primary : theme.text }]}>
                      {range.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 8 }]}>
              BEDROOMS
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {BEDROOM_OPTIONS.map(opt => {
                const active = filters.bedrooms === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.chip, { borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary + '20' : 'transparent' }]}
                    onPress={() => setFilters(f => ({ ...f, bedrooms: opt.value }))}
                  >
                    <ThemedText style={[Typography.small, { color: active ? theme.primary : theme.text }]}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeFilterCount > 0 ? (
              <Pressable onPress={clearFilters} style={styles.clearFilters}>
                <ThemedText style={[Typography.small, { color: theme.primary }]}>
                  Clear all filters
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {currentListingId ? (
          <Pressable
            style={[styles.removeOption, { borderColor: theme.border }]}
            onPress={() => onSelect(null)}
          >
            <Feather name="slash" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
              Remove linked property
            </ThemedText>
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="home" size={40} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
              No listings found.{'\n'}Try adjusting your search or filters.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.listingCard,
                  { backgroundColor: theme.card, borderColor: item.id === currentListingId ? theme.primary : theme.border,
                    borderWidth: item.id === currentListingId ? 2 : 1 }
                ]}
                onPress={() => onSelect(item)}
              >
                {item.photos[0] ? (
                  <Image source={{ uri: item.photos[0] }} style={styles.listingPhoto} />
                ) : (
                  <View style={[styles.listingPhotoPlaceholder, { backgroundColor: theme.border }]}>
                    <Feather name="home" size={24} color={theme.textSecondary} />
                  </View>
                )}

                <View style={styles.listingInfo}>
                  <ThemedText style={[Typography.body, { fontWeight: '700' }]} numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.address}, {item.city}, {item.state}
                  </ThemedText>
                  <View style={styles.listingMeta}>
                    <View style={[styles.metaChip, { backgroundColor: theme.primary + '15' }]}>
                      <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '700' }]}>
                        ${item.rent.toLocaleString()}/mo
                      </ThemedText>
                    </View>
                    <View style={[styles.metaChip, { backgroundColor: theme.border }]}>
                      <Feather name="home" size={11} color={theme.textSecondary} />
                      <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 3 }]}>
                        {item.bedrooms} BR
                      </ThemedText>
                    </View>
                    {item.transitInfo && item.transitInfo.length > 0 ? (
                      <View style={[styles.metaChip, { backgroundColor: theme.border }]}>
                        <Feather name="navigation" size={11} color={theme.textSecondary} />
                        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 3 }]}>
                          Transit
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>

                {item.id === currentListingId ? (
                  <Feather name="check-circle" size={22} color={theme.primary} style={{ marginLeft: 4 }} />
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 20, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 10,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, borderRadius: 12, borderWidth: 1, height: 46,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  filterBtn: {
    width: 46, height: 46, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  filterPanel: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    padding: Spacing.md, borderRadius: 14, borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, marginRight: 8,
  },
  clearFilters: { alignSelf: 'flex-start', marginTop: 8 },
  removeOption: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.md,
    borderRadius: 12, borderWidth: 1,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  listingCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, marginBottom: Spacing.sm, overflow: 'hidden', padding: Spacing.sm,
  },
  listingPhoto: { width: 72, height: 72, borderRadius: 10 },
  listingPhotoPlaceholder: {
    width: 72, height: 72, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  listingInfo: { flex: 1, marginLeft: Spacing.sm, gap: 3 },
  listingMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
});
