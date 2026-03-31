import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';

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

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const LocationStep: React.FC<LocationStepProps> = ({
  accountType,
  onLocationSelect,
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const headlines: Record<AccountType, string> = {
    renter: 'Where are you looking?',
    individual: 'Where is your property?',
    agent: 'Where do you work?',
    company: 'Where are your properties?',
  };

  const fetchPredictions = useCallback(async (text: string) => {
    if (text.length < 3 || !GOOGLE_PLACES_KEY) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(regions)&components=country:us&key=${GOOGLE_PLACES_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        setPredictions(data.predictions || []);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Places autocomplete error:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (selectedPlace) setSelectedPlace(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    setPredictions([]);
    setQuery(prediction.description);
    setSelectedPlace(prediction.description);
    setLoading(true);

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=address_components,geometry&key=${GOOGLE_PLACES_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const components = data.result.address_components || [];
        const geo = data.result.geometry?.location;

        let city = '';
        let stateCode = '';
        let neighborhood = '';
        let borough = '';

        for (const comp of components) {
          const types: string[] = comp.types || [];
          if (types.includes('locality')) city = comp.long_name;
          if (types.includes('administrative_area_level_1')) stateCode = comp.short_name;
          if (types.includes('neighborhood')) neighborhood = comp.long_name;
          if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
            borough = comp.long_name;
          }
        }

        if (!neighborhood && borough) neighborhood = borough;

        onLocationSelect({
          state: stateCode,
          city: city || prediction.structured_formatting.main_text,
          borough: borough || undefined,
          neighborhood: neighborhood || undefined,
          lat: geo?.lat,
          lng: geo?.lng,
        });
      }
    } catch (error) {
      console.error('Place details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setQuery('');
    setPredictions([]);
  };

  return (
    <View style={s.container}>
      <Text style={s.headline}>{headlines[accountType]}</Text>
      <Text style={s.subtitle}>
        Search by city, neighborhood, or ZIP code
      </Text>

      <View style={s.autocompleteWrap}>
        <View style={s.inputContainer}>
          <TextInput
            style={s.input}
            value={query}
            onChangeText={handleTextChange}
            placeholder="Search city, neighborhood, or ZIP..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            returnKeyType="search"
            autoFocus={!selectedPlace}
          />
          {loading ? (
            <ActivityIndicator style={s.inputIcon} color="#ff6b5b" size="small" />
          ) : query.length > 0 && !selectedPlace ? (
            <Pressable onPress={handleClear} hitSlop={8} style={s.inputIcon}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ) : null}
        </View>

        {predictions.length > 0 ? (
          <FlatList
            data={predictions}
            keyExtractor={item => item.place_id}
            style={s.listView}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => handleSelect(item)}>
                <Text style={s.mainText}>
                  {item.structured_formatting.main_text}
                </Text>
                <Text style={s.secondaryText}>
                  {item.structured_formatting.secondary_text}
                </Text>
              </Pressable>
            )}
          />
        ) : null}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 14,
    height: 52,
  },
  inputIcon: {
    marginLeft: 8,
  },
  listView: {
    backgroundColor: 'rgba(30,30,30,0.98)',
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: 300,
    ...(Platform.OS === 'web' ? { zIndex: 1000 } : {}),
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mainText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 2,
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
