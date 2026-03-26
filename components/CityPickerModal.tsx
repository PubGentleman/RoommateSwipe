import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing } from '../constants/theme';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Haptics from 'expo-haptics';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const [hasSearchResults, setHasSearchResults] = useState(false);

  const handleSelect = (city: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCitySelect(city);
    onSubAreaSelect?.(null);
  };

  const handleClose = () => {
    onClose();
  };

  const handlePlaceSelect = (data: any, details: any) => {
    if (!details) return;
    const components = details.address_components || [];
    let city = '';
    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('locality')) {
        city = comp.long_name;
        break;
      }
    }
    if (!city) {
      city = data.description?.split(',')[0] || '';
    }
    handleSelect(city);
    onClose();
  };

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

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Search</ThemedText>
            <View style={styles.autocompleteWrap}>
              <GooglePlacesAutocomplete
                placeholder="Search city, neighborhood, or ZIP..."
                fetchDetails={true}
                onPress={handlePlaceSelect}
                query={{
                  key: GOOGLE_PLACES_KEY,
                  language: 'en',
                  types: '(cities)',
                  components: 'country:us',
                }}
                textInputProps={{
                  placeholderTextColor: 'rgba(255,255,255,0.3)',
                  returnKeyType: 'search',
                }}
                onFail={() => setHasSearchResults(false)}
                styles={{
                  container: { flex: 0 },
                  textInputContainer: { backgroundColor: 'transparent' },
                  textInput: {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#FFFFFF',
                    borderRadius: BorderRadius.large,
                    paddingHorizontal: 14,
                    height: 44,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                  listView: {
                    backgroundColor: 'rgba(30,30,30,0.98)',
                    borderRadius: BorderRadius.large,
                    marginTop: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    maxHeight: 200,
                  },
                  row: {
                    backgroundColor: 'transparent',
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                  },
                  description: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
                  separator: { backgroundColor: 'rgba(255,255,255,0.06)' },
                  poweredContainer: { display: 'none' },
                }}
                enablePoweredByContainer={false}
                debounce={300}
              />
            </View>
          </View>

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
  autocompleteWrap: {
    zIndex: 100,
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
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  allCitiesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.large,
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
