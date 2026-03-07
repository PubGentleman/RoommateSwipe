import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import {
  US_STATES,
  getStatesWithData,
  getCitiesByState,
  getNeighborhoodsByCity,
  getCoordinatesFromNeighborhood,
  getStateFromNeighborhood,
  getCityFromNeighborhood,
} from '../utils/locationData';

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
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');

  const statesWithData = useMemo(() => getStatesWithData(), []);

  const allStates = useMemo(() => {
    if (!stateSearch.trim()) return statesWithData;
    const q = stateSearch.toLowerCase();
    return statesWithData.filter(
      s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [statesWithData, stateSearch]);

  const cities = useMemo(() => {
    if (!selectedState) return [];
    const c = getCitiesByState(selectedState);
    if (!citySearch.trim()) return c;
    const q = citySearch.toLowerCase();
    return c.filter(city => city.toLowerCase().includes(q));
  }, [selectedState, citySearch]);

  const neighborhoods = useMemo(() => {
    if (!selectedCity) return [];
    const n = getNeighborhoodsByCity(selectedCity);
    if (!neighborhoodSearch.trim()) return n;
    const q = neighborhoodSearch.toLowerCase();
    return n.filter(nb => nb.toLowerCase().includes(q));
  }, [selectedCity, neighborhoodSearch]);

  const handleStateSelect = (code: string) => {
    onStateChange(code);
    onCityChange('');
    onNeighborhoodChange('');
    setCitySearch('');
    setNeighborhoodSearch('');
  };

  const handleCitySelect = (city: string) => {
    onCityChange(city);
    onNeighborhoodChange('');
    setNeighborhoodSearch('');
  };

  const renderSearchInput = (
    value: string,
    onChange: (text: string) => void,
    placeholder: string
  ) => (
    <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
      <Feather name="search" size={16} color={theme.textSecondary} />
      <TextInput
        style={[styles.searchInput, { color: theme.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange('')}>
          <Feather name="x" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderOption = (
    label: string,
    subtitle: string | undefined,
    isSelected: boolean,
    onPress: () => void,
    index: number,
    icon: keyof typeof Feather.glyphMap
  ) => (
    <Animated.View key={label} entering={FadeInDown.delay(Math.min(index * 40, 300)).duration(250)}>
      <Pressable
        style={[
          styles.option,
          {
            backgroundColor: isSelected ? theme.primary + '12' : theme.backgroundDefault,
            borderColor: isSelected ? theme.primary : theme.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={onPress}
      >
        <View style={[styles.optionIcon, { backgroundColor: isSelected ? theme.primary + '20' : theme.backgroundSecondary }]}>
          <Feather name={icon} size={18} color={isSelected ? theme.primary : theme.textSecondary} />
        </View>
        <View style={styles.optionText}>
          <ThemedText style={[Typography.body, { fontWeight: isSelected ? '600' : '400', color: theme.text }]}>
            {label}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {isSelected ? (
          <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
            <Feather name="check" size={14} color="#fff" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  if (!selectedState) {
    return (
      <View style={styles.container}>
        <ThemedText style={[Typography.h3, { color: theme.text, marginBottom: Spacing.sm }]}>
          Select State
        </ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
          Choose the state where you want to live
        </ThemedText>
        {renderSearchInput(stateSearch, setStateSearch, 'Search states...')}
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {allStates.map((s, i) =>
            renderOption(s.name, s.code, selectedState === s.code, () => handleStateSelect(s.code), i, 'map-pin')
          )}
          {allStates.length === 0 ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.lg }]}>
              No states match your search
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (!selectedCity) {
    const stateName = US_STATES.find(s => s.code === selectedState)?.name || selectedState;
    return (
      <View style={styles.container}>
        <Pressable style={styles.breadcrumb} onPress={() => handleStateSelect('')}>
          <Feather name="chevron-left" size={18} color={theme.primary} />
          <ThemedText style={[Typography.caption, { color: theme.primary }]}>
            Change State
          </ThemedText>
        </Pressable>
        <ThemedText style={[Typography.h3, { color: theme.text, marginBottom: Spacing.sm }]}>
          Select City in {stateName}
        </ThemedText>
        {cities.length > 4 ? renderSearchInput(citySearch, setCitySearch, 'Search cities...') : null}
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {cities.map((city, i) =>
            renderOption(city, selectedState, selectedCity === city, () => handleCitySelect(city), i, 'home')
          )}
          {cities.length === 0 ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.lg }]}>
              No cities found in this state
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (showNeighborhood && !selectedNeighborhood) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.breadcrumb} onPress={() => handleCitySelect('')}>
          <Feather name="chevron-left" size={18} color={theme.primary} />
          <ThemedText style={[Typography.caption, { color: theme.primary }]}>
            Change City
          </ThemedText>
        </Pressable>
        <ThemedText style={[Typography.h3, { color: theme.text, marginBottom: Spacing.sm }]}>
          Select Neighborhood in {selectedCity}
        </ThemedText>
        {neighborhoods.length > 6 ? renderSearchInput(neighborhoodSearch, setNeighborhoodSearch, 'Search neighborhoods...') : null}
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {neighborhoods.map((nb, i) =>
            renderOption(nb, selectedCity, selectedNeighborhood === nb, () => onNeighborhoodChange(nb), i, 'navigation')
          )}
        </ScrollView>
      </View>
    );
  }

  const selectedStateName = US_STATES.find(s => s.code === selectedState)?.name || selectedState;
  return (
    <View style={styles.container}>
      <ThemedText style={[Typography.h3, { color: theme.text, marginBottom: Spacing.md }]}>
        Your Location
      </ThemedText>
      <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <Pressable style={styles.summaryRow} onPress={() => handleStateSelect('')}>
          <View style={styles.summaryLabel}>
            <Feather name="map" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>State</ThemedText>
          </View>
          <View style={styles.summaryValue}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedStateName}</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </View>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable style={styles.summaryRow} onPress={() => handleCitySelect('')}>
          <View style={styles.summaryLabel}>
            <Feather name="home" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>City</ThemedText>
          </View>
          <View style={styles.summaryValue}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedCity}</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </View>
        </Pressable>
        {showNeighborhood && selectedNeighborhood ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable style={styles.summaryRow} onPress={() => onNeighborhoodChange('')}>
              <View style={styles.summaryLabel}>
                <Feather name="navigation" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Neighborhood</ThemedText>
              </View>
              <View style={styles.summaryValue}>
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>{selectedNeighborhood}</ThemedText>
                <Feather name="chevron-right" size={16} color={theme.textSecondary} />
              </View>
            </Pressable>
          </>
        ) : null}
      </View>
      <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
        Tap any field above to change it
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  optionsList: {
    maxHeight: 320,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
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
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
});
