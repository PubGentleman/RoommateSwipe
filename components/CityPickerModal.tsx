import React, { useState, Component } from 'react';
import { View, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform, TextInput, Text } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { BorderRadius, Spacing } from '../constants/theme';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const POPULAR_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Austin', 'Atlanta', 'Seattle', 'Boston'];

let _cachedGPA: any = null;
let _gpaAttempted = false;

function getGooglePlacesComponent() {
  if (!_gpaAttempted) {
    _gpaAttempted = true;
    try {
      const mod = require('react-native-google-places-autocomplete');
      _cachedGPA = mod.GooglePlacesAutocomplete;
    } catch (e) {
      console.warn('GooglePlacesAutocomplete not available:', e);
    }
  }
  return _cachedGPA;
}

type SearchErrorBoundaryState = { hasError: boolean };

class SearchErrorBoundary extends Component<{ children: React.ReactNode; fallback: React.ReactNode }, SearchErrorBoundaryState> {
  state: SearchErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): SearchErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const FallbackSearchInput: React.FC<{ onCitySelect: (city: string) => void }> = ({ onCitySelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ label: string; city: string }[]>([]);
  const [isGeocodingZip, setIsGeocodingZip] = useState(false);

  const handleChange = async (text: string) => {
    try {
      setQuery(text);
      const trimmed = text.trim();

      if (!trimmed) {
        setResults([]);
        return;
      }

      const lower = trimmed.toLowerCase();
      const matched = POPULAR_CITIES
        .filter(c => c.toLowerCase().includes(lower))
        .map(c => ({ label: c, city: c }));

      if (/^\d{5}$/.test(trimmed)) {
        setIsGeocodingZip(true);
        try {
          const geocoded = await Location.geocodeAsync(trimmed);
          if (geocoded.length > 0) {
            const { latitude, longitude } = geocoded[0];
            const reverseResult = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseResult.length > 0) {
              const place = reverseResult[0];
              const cityName = place.city || place.subregion || '';
              if (cityName) {
                matched.unshift({ label: `${trimmed} — ${cityName}`, city: cityName });
              }
            }
          }
        } catch (e) {
          console.warn('[CityPickerModal] zip geocoding failed:', e);
        }
        setIsGeocodingZip(false);
      }

      setResults(matched);
    } catch {}
  };

  return (
    <View>
      <TextInput
        style={fallbackStyles.input}
        placeholder="Search city or ZIP..."
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={query}
        onChangeText={handleChange}
        returnKeyType="search"
        keyboardType="default"
      />
      {isGeocodingZip ? (
        <Text style={fallbackStyles.loadingText}>Looking up ZIP code...</Text>
      ) : null}
      {results.map((r, i) => (
        <Pressable key={`${r.city}-${i}`} style={fallbackStyles.resultRow} onPress={() => onCitySelect(r.city)}>
          <Text style={fallbackStyles.resultText}>{r.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const fallbackStyles = StyleSheet.create({
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    borderRadius: BorderRadius.large,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  resultText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});

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
  const [zipOverrideResult, setZipOverrideResult] = useState<{ label: string; city: string } | null>(null);
  const [isGeocodingZip, setIsGeocodingZip] = useState(false);

  const handleSelect = (city: string | null) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    try {
      onCitySelect(city);
    } catch (e) {
      console.warn('[CityPickerModal] onCitySelect error:', e);
    }
    if (onSubAreaSelect) {
      try { onSubAreaSelect(null); } catch (e) {
        console.warn('[CityPickerModal] onSubAreaSelect error:', e);
      }
    }
  };

  const handleClose = () => {
    try { onClose(); } catch {}
  };

  const handlePlaceSelect = (data: any, details: any) => {
    try {
      if (!details) return;
      const components = details?.address_components || [];
      let city = '';
      for (const comp of components) {
        const types: string[] = comp?.types || [];
        if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_2')) {
          city = comp.long_name || '';
          break;
        }
      }
      if (!city) {
        city = data?.description?.split(',')[0]?.trim() || '';
      }
      if (city) {
        handleSelect(city);
        handleClose();
      }
    } catch {}
  };

  const handleFallbackSelect = (city: string) => {
    handleSelect(city);
    handleClose();
  };

  const handleGoogleInputChange = async (text: string) => {
    const trimmed = text.trim();
    if (/^\d{5}$/.test(trimmed)) {
      setIsGeocodingZip(true);
      setZipOverrideResult(null);
      try {
        const geocoded = await Location.geocodeAsync(trimmed);
        if (geocoded.length > 0) {
          const { latitude, longitude } = geocoded[0];
          const reverseResult = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverseResult.length > 0) {
            const place = reverseResult[0];
            const cityName = place.city || place.subregion || '';
            if (cityName) {
              setZipOverrideResult({ label: `${trimmed} — ${cityName}`, city: cityName });
            }
          }
        }
      } catch {}
      setIsGeocodingZip(false);
    } else {
      setZipOverrideResult(null);
      setIsGeocodingZip(false);
    }
  };

  const renderSearchSection = () => {
    const GooglePlacesAutocomplete = getGooglePlacesComponent();
    if (!GooglePlacesAutocomplete || !GOOGLE_PLACES_KEY) {
      return (
        <FallbackSearchInput onCitySelect={handleFallbackSelect} />
      );
    }

    return (
      <SearchErrorBoundary fallback={<FallbackSearchInput onCitySelect={handleFallbackSelect} />}>
        <View style={styles.autocompleteWrap}>
          <GooglePlacesAutocomplete
            placeholder="Search city, neighborhood, or ZIP..."
            fetchDetails={true}
            onPress={handlePlaceSelect}
            query={{
              key: GOOGLE_PLACES_KEY,
              language: 'en',
              components: 'country:us',
            }}
            textInputProps={{
              placeholderTextColor: 'rgba(255,255,255,0.3)',
              returnKeyType: 'search',
              onChangeText: handleGoogleInputChange,
              onFocus: () => {},
            }}
            onFail={() => {}}
            onNotFound={() => {}}
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
          {isGeocodingZip ? (
            <Text style={fallbackStyles.loadingText}>Looking up ZIP code...</Text>
          ) : null}
          {zipOverrideResult ? (
            <Pressable
              style={fallbackStyles.resultRow}
              onPress={() => {
                handleFallbackSelect(zipOverrideResult.city);
                setZipOverrideResult(null);
              }}
            >
              <Text style={fallbackStyles.resultText}>{zipOverrideResult.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </SearchErrorBoundary>
    );
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
            {renderSearchSection()}
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
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
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
