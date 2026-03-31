import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
  Alert,
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
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface SelectedLocation {
  city: string;
  state: string;
  neighborhood: string;
  borough?: string;
  lat: number;
  lng: number;
}

// ============================================================
// HARDCODED VALUES — same as lib/supabase.ts
// The anon key is safe to expose (public/anonymous access only)
// ============================================================
const SUPABASE_URL = 'https://lnjupgvvsbdooomvdjho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuanVwZ3Z2c2Jkb29vbXZkamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTEwODAsImV4cCI6MjA4ODY2NzA4MH0.XAGtYsRhSRRPe9yc3jqrO9viqgIZzvFGx_cd1D1y9BU';

export const LocationStep: React.FC<LocationStepProps> = ({
  accountType,
  onLocationSelect,
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  const headlines: Record<AccountType, string> = {
    renter: 'Where are you looking?',
    individual: 'Where is your property?',
    agent: 'Where do you work?',
    company: 'Where are your properties?',
  };

  const fetchPredictions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setPredictions([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/places-proxy?action=autocomplete&input=${encodeURIComponent(text)}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setSearchFailed(false);
        setPredictions(
          data.predictions.slice(0, 5).map((p: any) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text || p.description?.split(',')[0] || '',
            secondaryText: p.structured_formatting?.secondary_text || '',
            description: p.description || '',
          }))
        );
      } else if (data.status === 'ZERO_RESULTS') {
        setPredictions([]);
      } else {
        // API returned but with an error (e.g. missing Google key)
        console.warn('Places proxy error:', data.status, data.error_message);
        setSearchFailed(true);
        setError('Search unavailable. Type your city, state and tap Next.');
        setPredictions([]);
      }
    } catch (err: any) {
      // Network error, 401, 404, etc.
      console.warn('Location search error:', err?.message || err);
      setSearchFailed(true);
      setError('Search unavailable. Type your city, state and tap Next.');
      setPredictions([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    setSelected(null);
    setSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    Keyboard.dismiss();
    setQuery(prediction.description);
    setPredictions([]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/places-proxy?action=details&place_id=${encodeURIComponent(prediction.placeId)}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

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
        if (!city && borough) city = borough;
        if (!city) city = prediction.mainText;

        setSelected({
          city,
          state: stateCode,
          neighborhood,
          borough,
          lat: geo?.lat || 0,
          lng: geo?.lng || 0,
        });
      } else {
        setSelected({
          city: prediction.mainText,
          state: prediction.secondaryText.replace(/, USA$/i, '').trim(),
          neighborhood: '',
          lat: 0,
          lng: 0,
        });
      }
    } catch (err) {
      console.warn('Place details error:', err);
      setSelected({
        city: prediction.mainText,
        state: prediction.secondaryText.replace(/, USA$/i, '').trim(),
        neighborhood: '',
        lat: 0,
        lng: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    // Option A: User selected from dropdown — best case
    if (selected) {
      onLocationSelect({
        city: selected.city,
        state: selected.state,
        neighborhood: selected.neighborhood || undefined,
        borough: selected.borough || undefined,
        lat: selected.lat,
        lng: selected.lng,
      });
      return;
    }

    const trimmed = query.trim();

    // Option B: "City, State" format (e.g. "Brooklyn, NY")
    const parts = trimmed.split(',').map(s => s.trim());
    if (parts.length >= 2 && parts[0].length >= 2 && parts[1].length >= 1) {
      onLocationSelect({
        city: parts[0],
        state: parts[1],
        lat: 0,
        lng: 0,
      });
      return;
    }

    // Option C: Search is broken — accept any text 2+ chars
    // Don't trap the user on this screen if the API is down
    if (searchFailed && trimmed.length >= 2) {
      onLocationSelect({
        city: trimmed,
        state: '',
        lat: 0,
        lng: 0,
      });
      return;
    }

    // Option D: ZIP code
    if (/^\d{5}$/.test(trimmed)) {
      if (searchFailed) {
        onLocationSelect({
          city: trimmed,
          state: '',
          lat: 0,
          lng: 0,
        });
      } else {
        Alert.alert(
          'Select from results',
          'Please wait for search results and select your location, or type "City, State" (e.g. "Brooklyn, NY").'
        );
      }
      return;
    }

    // Not enough input
    if (trimmed.length < 2) {
      Alert.alert('Enter a location', 'Please type a city, neighborhood, or ZIP code.');
    } else {
      Alert.alert(
        'Add your state',
        'Try entering as "City, State" (e.g. "Brooklyn, NY") for best results.'
      );
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelected(null);
    setPredictions([]);
    setError(null);
    setSearched(false);
    setSearchFailed(false);
    inputRef.current?.focus();
  };

  const selectedDisplay = selected
    ? selected.neighborhood
      ? `${selected.neighborhood}, ${selected.city}, ${selected.state}`
      : `${selected.city}${selected.state ? `, ${selected.state}` : ''}`
    : '';

  // Next button enabled if: something selected, OR 2+ chars typed
  const nextDisabled = !selected && query.trim().length < 2;

  return (
    <View style={s.container}>
      <Text style={s.headline}>{headlines[accountType]}</Text>
      <Text style={s.subtitle}>
        Search by city, neighborhood, or ZIP code
      </Text>

      <View style={s.autocompleteWrap}>
        <View style={s.inputContainer}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={query}
            onChangeText={handleTextChange}
            placeholder="e.g. Brooklyn, NY or 11222"
            placeholderTextColor="rgba(255,255,255,0.35)"
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
          />
          {loading ? (
            <ActivityIndicator style={s.inputIcon} color="#ff6b5b" size="small" />
          ) : query.length > 0 ? (
            <Pressable onPress={handleClear} hitSlop={8} style={s.inputIcon}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ) : null}
        </View>

        {predictions.length > 0 ? (
          <View style={s.listView}>
            {predictions.map(item => (
              <Pressable
                key={item.placeId}
                style={s.row}
                onPress={() => handleSelect(item)}
              >
                <Text style={s.mainText}>{item.mainText}</Text>
                <Text style={s.secondaryText}>{item.secondaryText}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={s.searchingRow}>
          <ActivityIndicator size="small" color="#ff6b5b" />
          <Text style={s.searchingText}>Searching...</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={s.errorText}>{error}</Text>
      ) : null}

      {!loading && !error && searched && query.length >= 2 && predictions.length === 0 && !selected ? (
        <Text style={s.hintText}>No results found. Try a different search or type "City, State".</Text>
      ) : null}

      {!loading && !error && !searched && query.length > 0 && query.length < 2 ? (
        <Text style={s.hintText}>Type at least 2 characters</Text>
      ) : null}

      {selected ? (
        <View style={s.selectedCard}>
          <View style={s.selectedInfo}>
            <Feather name="map-pin" size={18} color="#ff6b5b" />
            <Text style={s.selectedText}>{selectedDisplay}</Text>
          </View>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      ) : !error && !loading && !searched ? (
        <View style={s.hintContainer}>
          <Feather name="info" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={s.hintInfoText}>
            Select a suggestion, or type "City, State" and tap Next
          </Text>
        </View>
      ) : null}

      <Pressable
        style={[s.nextButton, nextDisabled ? s.nextButtonDisabled : null]}
        onPress={handleNext}
        disabled={nextDisabled}
      >
        <Text style={s.nextButtonText}>Next</Text>
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: '#111111',
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
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 14,
    height: 52,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
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
    overflow: 'hidden',
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
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  searchingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  errorText: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 10,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 10,
    textAlign: 'center',
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
    color: '#ff6b5b',
    flex: 1,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
  },
  hintInfoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  nextButton: {
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
