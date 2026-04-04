import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    neighbourhood?: string;
    borough?: string;
    county?: string;
    state?: string;
  };
}

interface LocationPickerProps {
  selectedState?: string;
  selectedCity?: string;
  selectedNeighborhood?: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  onNeighborhoodChange: (neighborhood: string) => void;
  showNeighborhood?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  selectedState,
  selectedCity,
  selectedNeighborhood,
  onStateChange,
  onCityChange,
  onNeighborhoodChange,
  showNeighborhood = true,
}) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasSelection = !!(selectedState && selectedCity);

  const searchLocations = useCallback(async (text: string) => {
    if (text.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?q=${encodeURIComponent(text)}&countrycodes=us&format=json&addressdetails=1&limit=5`,
        { headers: { 'User-Agent': 'RhomeApp/1.0' } }
      );
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(text), 300);
  };

  const handleSelect = (result: NominatimResult) => {
    const addr = result.address || {};
    let city = '';
    if (addr.borough && addr.borough !== addr.city) {
      city = addr.borough;
    } else if (addr.suburb && addr.city && addr.suburb !== addr.city) {
      city = addr.suburb;
    } else {
      city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
    }
    const state = addr.state || '';
    const neighborhood = addr.neighbourhood || (addr.suburb && addr.suburb !== city ? addr.suburb : '') || addr.quarter || '';

    onStateChange(state);
    onCityChange(city || result.display_name.split(',')[0]);
    if (showNeighborhood) {
      onNeighborhoodChange(neighborhood);
    }
    setQuery('');
    setResults([]);
  };

  const handleClear = () => {
    onStateChange('');
    onCityChange('');
    onNeighborhoodChange('');
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[Typography.h3, { color: theme.text, marginBottom: Spacing.sm }]}>
        {hasSelection ? 'Your Location' : 'Select Location'}
      </ThemedText>
      <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
        Search by city, neighborhood, or ZIP code
      </ThemedText>

      <View style={styles.autocompleteWrap}>
        <TextInput
          value={query}
          onChangeText={handleTextChange}
          placeholder="Search city, neighborhood, or ZIP..."
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
        ) : null}
        {results.length > 0 ? (
          <View style={[styles.listView, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.place_id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, { borderBottomColor: theme.border }]}
                  onPress={() => handleSelect(item)}
                >
                  <ThemedText style={[{ color: theme.text, fontSize: 14 }]} numberOfLines={2}>
                    {item.display_name}
                  </ThemedText>
                </Pressable>
              )}
            />
          </View>
        ) : null}
      </View>

      {hasSelection ? (
        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabel}>
              <Feather name="map" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>State</ThemedText>
            </View>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedState}</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabel}>
              <Feather name="home" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>City</ThemedText>
            </View>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedCity}</ThemedText>
          </View>
          {showNeighborhood && selectedNeighborhood ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryLabel}>
                  <Feather name="navigation" size={16} color={theme.textSecondary} />
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Neighborhood</ThemedText>
                </View>
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedNeighborhood}</ThemedText>
              </View>
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable style={styles.clearRow} onPress={handleClear}>
            <Feather name="x-circle" size={16} color={theme.primary} />
            <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>Change Location</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  autocompleteWrap: {
    zIndex: 100,
    marginBottom: Spacing.md,
  },
  textInput: {
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: 15,
    borderWidth: 1,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  listView: {
    borderRadius: BorderRadius.medium,
    marginTop: 4,
    borderWidth: 1,
    maxHeight: 200,
  },
  row: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  summaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
});
