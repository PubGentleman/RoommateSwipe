import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing } from '../constants/theme';
import { getAllCities, getSubAreasForCity, getSubAreaLabel } from '../utils/locationData';
import * as Haptics from 'expo-haptics';

const POPULAR_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Austin', 'Atlanta', 'Seattle', 'Boston'];

interface CityPickerModalProps {
  visible: boolean;
  activeCity: string | null;
  activeSubArea?: string | null;
  recentCities: string[];
  onCitySelect: (city: string | null) => void;
  onSubAreaSelect?: (subArea: string | null) => void;
  onClose: () => void;
}

export const CityPickerModal: React.FC<CityPickerModalProps> = ({
  visible,
  activeCity,
  activeSubArea,
  recentCities,
  onCitySelect,
  onSubAreaSelect,
  onClose,
}) => {
  const [citySearch, setCitySearch] = useState('');

  const allCitiesForSearch = getAllCities();
  const filteredSearchCities = citySearch.trim()
    ? allCitiesForSearch.filter(c => c.toLowerCase().includes(citySearch.trim().toLowerCase()))
    : [];

  const handleSelect = (city: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCitySelect(city);
    onSubAreaSelect?.(null);
    setCitySearch('');
  };

  const handleSubAreaSelect = (subArea: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSubAreaSelect?.(subArea);
    onClose();
    setCitySearch('');
  };

  const handleClose = () => {
    setCitySearch('');
    onClose();
  };

  const currentSubAreas = activeCity ? getSubAreasForCity(activeCity) : null;
  const subAreaLabel = activeCity ? getSubAreaLabel(activeCity) : 'Area';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.sheet}>
        <View style={styles.handle} />
        <ThemedText style={styles.title}>Choose a City</ThemedText>

        {recentCities.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Recently Viewed</ThemedText>
            <View style={styles.chips}>
              {recentCities.map(city => (
                <Pressable
                  key={`recent-${city}`}
                  style={[styles.chip, activeCity === city && !activeSubArea ? styles.chipActive : null]}
                  onPress={() => handleSelect(city)}
                >
                  <Feather name="clock" size={13} color={activeCity === city && !activeSubArea ? '#fff' : 'rgba(255,255,255,0.5)'} />
                  <ThemedText style={[styles.chipText, activeCity === city && !activeSubArea ? styles.chipTextActive : null]}>
                    {city}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Popular Cities</ThemedText>
          <View style={styles.chips}>
            {POPULAR_CITIES.map(city => (
              <Pressable
                key={`popular-${city}`}
                style={[styles.chip, activeCity === city && !activeSubArea ? styles.chipActive : null]}
                onPress={() => handleSelect(city)}
              >
                <ThemedText style={[styles.chipText, activeCity === city && !activeSubArea ? styles.chipTextActive : null]}>
                  {city}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {currentSubAreas && currentSubAreas.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>
              {activeCity} — Filter by {subAreaLabel}
            </ThemedText>
            <View style={styles.chips}>
              <Pressable
                style={[styles.chip, activeCity && !activeSubArea ? styles.chipActiveOutline : null]}
                onPress={() => handleSubAreaSelect(null)}
              >
                <Feather name="globe" size={13} color={!activeSubArea ? '#ff4d4d' : 'rgba(255,255,255,0.5)'} />
                <ThemedText style={[styles.chipText, !activeSubArea ? styles.chipTextActiveOutline : null]}>
                  All {activeCity}
                </ThemedText>
              </Pressable>
              {currentSubAreas.map(area => {
                const isActive = activeSubArea === area;
                return (
                  <Pressable
                    key={`sub-${area}`}
                    style={[styles.chip, isActive ? styles.chipActive : null]}
                    onPress={() => handleSubAreaSelect(area)}
                  >
                    <Feather name="map-pin" size={13} color={isActive ? '#fff' : 'rgba(255,255,255,0.5)'} />
                    <ThemedText style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                      {area}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Search</ThemedText>
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Type any city..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={citySearch}
              onChangeText={setCitySearch}
              autoCorrect={false}
            />
            {citySearch.length > 0 ? (
              <Pressable onPress={() => setCitySearch('')}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            ) : null}
          </View>
          {filteredSearchCities.length > 0 ? (
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {filteredSearchCities.map(city => (
                <Pressable
                  key={`search-${city}`}
                  style={styles.searchResultItem}
                  onPress={() => handleSelect(city)}
                >
                  <Feather name="map-pin" size={14} color="rgba(255,255,255,0.5)" />
                  <ThemedText style={styles.searchResultText}>{city}</ThemedText>
                  {activeCity === city ? (
                    <Feather name="check" size={16} color="#ff4d4d" />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : citySearch.trim().length > 0 ? (
            <View style={styles.searchEmpty}>
              <ThemedText style={styles.searchEmptyText}>
                No cities found for "{citySearch}"
              </ThemedText>
            </View>
          ) : null}
        </View>

        <Pressable
          style={styles.allCitiesBtn}
          onPress={() => handleSelect(null)}
        >
          <Feather name="globe" size={16} color="#ff4d4d" />
          <ThemedText style={styles.allCitiesBtnText}>Show All Cities</ThemedText>
        </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const CityPillButton: React.FC<{
  activeCity: string | null;
  activeSubArea?: string | null;
  onPress: () => void;
}> = ({ activeCity, activeSubArea, onPress }) => {
  const displayText = activeSubArea && activeCity
    ? `${activeCity} - ${activeSubArea}`
    : activeCity || 'All Cities';

  return (
    <Pressable
      style={styles.pillButton}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Feather name="map-pin" size={16} color="#ff4d4d" />
      <ThemedText style={styles.pillText} numberOfLines={1}>
        {displayText}
      </ThemedText>
      <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#ff4d4d',
    borderColor: '#ff4d4d',
  },
  chipActiveOutline: {
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.1)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chipTextActiveOutline: {
    color: '#ff4d4d',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
  },
  searchResults: {
    maxHeight: 160,
    marginTop: 8,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchResultText: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  searchEmpty: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  allCitiesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.3)',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  allCitiesBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff4d4d',
  },
  pillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
