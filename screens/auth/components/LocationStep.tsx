import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

type AccountType = 'renter' | 'individual' | 'agent' | 'company';

interface LocationStepProps {
  accountType: AccountType;
  onLocationSelect: (location: {
    state: string;
    city: string;
    borough?: string;
    neighborhood?: string;
    lat?: number;
    lng?: number;
  }) => void;
}

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const LocationStep: React.FC<LocationStepProps> = ({
  accountType,
  onLocationSelect,
}) => {
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const ref = useRef<any>(null);

  const headlines: Record<AccountType, string> = {
    renter: 'Where are you looking?',
    individual: 'Where is your property?',
    agent: 'Where do you work?',
    company: 'Where are your properties?',
  };

  const handlePlaceSelect = (data: any, details: any) => {
    if (!details) return;

    const components = details.address_components || [];
    let city = '';
    let stateCode = '';
    let neighborhood = '';
    let borough = '';

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('locality')) {
        city = comp.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        stateCode = comp.short_name;
      }
      if (types.includes('neighborhood')) {
        neighborhood = comp.long_name;
      }
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        borough = comp.long_name;
      }
    }

    if (!city && !stateCode) {
      city = data.description?.split(',')[0] || '';
    }

    const lat = details.geometry?.location?.lat;
    const lng = details.geometry?.location?.lng;

    setSelectedPlace(data.description);

    onLocationSelect({
      state: stateCode,
      city: city || data.description?.split(',')[0] || '',
      borough: borough || undefined,
      neighborhood: neighborhood || undefined,
      lat,
      lng,
    });
  };

  const handleClear = () => {
    setSelectedPlace(null);
    ref.current?.clear();
    ref.current?.setAddressText('');
  };

  return (
    <View style={s.container}>
      <Text style={s.headline}>{headlines[accountType]}</Text>
      <Text style={s.subtitle}>
        Search by city, neighborhood, or ZIP code
      </Text>

      <View style={s.autocompleteWrap}>
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
            placeholderTextColor: 'rgba(255,255,255,0.35)',
            returnKeyType: 'search',
          }}
          styles={{
            container: { flex: 0 },
            textInputContainer: {
              backgroundColor: 'transparent',
            },
            textInput: {
              backgroundColor: 'rgba(255,255,255,0.07)',
              color: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 16,
              height: 52,
              fontSize: 15,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            },
            listView: {
              backgroundColor: 'rgba(30,30,30,0.98)',
              borderRadius: 14,
              marginTop: 6,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              ...(Platform.OS === 'web' ? { zIndex: 1000 } : {}),
            },
            row: {
              backgroundColor: 'transparent',
              paddingHorizontal: 16,
              paddingVertical: 14,
            },
            description: {
              color: 'rgba(255,255,255,0.85)',
              fontSize: 14,
            },
            separator: {
              backgroundColor: 'rgba(255,255,255,0.06)',
            },
            poweredContainer: {
              display: 'none',
            },
          }}
          enablePoweredByContainer={false}
          debounce={300}
        />
      </View>

      {selectedPlace ? (
        <View style={s.selectedCard}>
          <View style={s.selectedInfo}>
            <Feather name="map-pin" size={18} color="#ff6b5b" />
            <Text style={s.selectedText}>{selectedPlace}</Text>
          </View>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      ) : (
        <View style={s.hintContainer}>
          <Feather name="info" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={s.hintText}>
            Type at least 3 characters to see suggestions
          </Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 24,
  },
  autocompleteWrap: {
    zIndex: 100,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
});
