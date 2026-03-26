import React, { useRef } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const ref = useRef<any>(null);

  const hasSelection = !!(selectedState && selectedCity);

  const handlePlaceSelect = (data: any, details: any) => {
    if (!details) return;
    const components = details.address_components || [];
    let city = '';
    let stateCode = '';
    let neighborhood = '';

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('locality')) city = comp.long_name;
      if (types.includes('administrative_area_level_1')) stateCode = comp.short_name;
      if (types.includes('neighborhood')) neighborhood = comp.long_name;
      if (!neighborhood && (types.includes('sublocality') || types.includes('sublocality_level_1'))) {
        neighborhood = comp.long_name;
      }
    }

    if (!city) city = data.description?.split(',')[0] || '';

    onStateChange(stateCode);
    onCityChange(city);
    if (showNeighborhood) {
      onNeighborhoodChange(neighborhood || '');
    }
  };

  const handleClear = () => {
    onStateChange('');
    onCityChange('');
    onNeighborhoodChange('');
    ref.current?.clear();
    ref.current?.setAddressText('');
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
        <GooglePlacesAutocomplete
          ref={ref}
          placeholder="Search city, neighborhood, or ZIP..."
          fetchDetails={true}
          onPress={handlePlaceSelect}
          query={{
            key: GOOGLE_PLACES_KEY,
            language: 'en',
            types: '(regions)',
            components: 'country:us',
          }}
          textInputProps={{
            placeholderTextColor: theme.textSecondary,
            returnKeyType: 'search',
          }}
          styles={{
            container: { flex: 0 },
            textInputContainer: { backgroundColor: 'transparent' },
            textInput: {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderRadius: BorderRadius.medium,
              paddingHorizontal: Spacing.md,
              height: 48,
              fontSize: 15,
              borderWidth: 1,
              borderColor: theme.border,
            },
            listView: {
              backgroundColor: theme.backgroundDefault,
              borderRadius: BorderRadius.medium,
              marginTop: 4,
              borderWidth: 1,
              borderColor: theme.border,
              ...(Platform.OS === 'web' ? { zIndex: 1000 } : {}),
            },
            row: {
              backgroundColor: 'transparent',
              paddingHorizontal: Spacing.md,
              paddingVertical: 13,
            },
            description: { color: theme.text, fontSize: 14 },
            separator: { backgroundColor: theme.border },
            poweredContainer: { display: 'none' },
          }}
          enablePoweredByContainer={false}
          debounce={300}
        />
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
