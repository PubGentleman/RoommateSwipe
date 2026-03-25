import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import {
  getStatesWithData,
  getCitiesByState,
  getBoroughsByCity,
  getNeighborhoodsByBorough,
  getNeighborhoodsByCity,
  getStateNameFromCode,
} from '../../../utils/locationData';

type AccountType = 'renter' | 'individual' | 'agent' | 'company';

interface LocationStepProps {
  accountType: AccountType;
  onLocationSelect: (location: {
    state: string;
    city: string;
    borough?: string;
    neighborhood?: string;
  }) => void;
}

type Tier = 'state' | 'city' | 'borough' | 'neighborhood';

export const LocationStep: React.FC<LocationStepProps> = ({
  accountType,
  onLocationSelect,
}) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBorough, setSelectedBorough] = useState('');
  const [search, setSearch] = useState('');

  const currentTier: Tier = useMemo(() => {
    if (!selectedState) return 'state';
    if (!selectedCity) return 'city';
    const boroughs = getBoroughsByCity(selectedCity);
    if (boroughs.length > 0 && !selectedBorough) return 'borough';
    return 'neighborhood';
  }, [selectedState, selectedCity, selectedBorough]);

  const statesWithData = useMemo(() => getStatesWithData(), []);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: { id: string; label: string; sub?: string }[] = [];

    if (currentTier === 'state') {
      list = statesWithData.map(s => ({ id: s.code, label: s.name, sub: s.code }));
    } else if (currentTier === 'city') {
      list = getCitiesByState(selectedState).map(c => ({ id: c, label: c }));
    } else if (currentTier === 'borough') {
      list = getBoroughsByCity(selectedCity).map(b => ({ id: b, label: b }));
    } else {
      const boroughs = getBoroughsByCity(selectedCity);
      const hoods = boroughs.length > 0
        ? getNeighborhoodsByBorough(selectedCity, selectedBorough)
        : getNeighborhoodsByCity(selectedCity);
      list = hoods.map(n => ({ id: n, label: n }));
    }

    if (q) {
      list = list.filter(
        item =>
          item.label.toLowerCase().includes(q) ||
          (item.sub && item.sub.toLowerCase().includes(q))
      );
    }
    return list;
  }, [currentTier, statesWithData, selectedState, selectedCity, selectedBorough, search]);

  const handleSelect = useCallback(
    (id: string) => {
      setSearch('');
      if (currentTier === 'state') {
        setSelectedState(id);
      } else if (currentTier === 'city') {
        setSelectedCity(id);
        const boroughs = getBoroughsByCity(id);
        if (boroughs.length === 0) {
          const hoods = getNeighborhoodsByCity(id);
          if (hoods.length === 0) {
            onLocationSelect({ state: selectedState, city: id });
          }
        }
      } else if (currentTier === 'borough') {
        setSelectedBorough(id);
      } else {
        const boroughs = getBoroughsByCity(selectedCity);
        onLocationSelect({
          state: selectedState,
          city: selectedCity,
          borough: boroughs.length > 0 ? selectedBorough : undefined,
          neighborhood: id,
        });
      }
    },
    [currentTier, selectedState, selectedCity, selectedBorough, onLocationSelect]
  );

  const handleBack = useCallback(() => {
    setSearch('');
    if (currentTier === 'neighborhood') {
      const boroughs = getBoroughsByCity(selectedCity);
      if (boroughs.length > 0) {
        setSelectedBorough('');
      } else {
        setSelectedCity('');
      }
    } else if (currentTier === 'borough') {
      setSelectedCity('');
    } else if (currentTier === 'city') {
      setSelectedState('');
    }
  }, [currentTier, selectedCity]);

  const handleSkipNeighborhood = useCallback(() => {
    const boroughs = getBoroughsByCity(selectedCity);
    onLocationSelect({
      state: selectedState,
      city: selectedCity,
      borough: boroughs.length > 0 ? selectedBorough : undefined,
    });
  }, [selectedState, selectedCity, selectedBorough, onLocationSelect]);

  const headlines: Record<AccountType, string> = {
    renter: 'Where are you looking?',
    individual: 'Where is your property?',
    agent: 'Where do you work?',
    company: 'Where are your properties?',
  };

  const tierLabels: Record<Tier, string> = {
    state: 'Select a state',
    city: 'Select a city',
    borough: 'Select a borough',
    neighborhood: 'Select a neighborhood',
  };

  const breadcrumbs: { label: string; onPress: () => void }[] = [];
  if (selectedState) {
    breadcrumbs.push({
      label: getStateNameFromCode(selectedState),
      onPress: () => {
        setSelectedState('');
        setSelectedCity('');
        setSelectedBorough('');
        setSearch('');
      },
    });
  }
  if (selectedCity) {
    breadcrumbs.push({
      label: selectedCity,
      onPress: () => {
        setSelectedCity('');
        setSelectedBorough('');
        setSearch('');
      },
    });
  }
  if (selectedBorough) {
    breadcrumbs.push({
      label: selectedBorough,
      onPress: () => {
        setSelectedBorough('');
        setSearch('');
      },
    });
  }

  return (
    <View style={s.container}>
      <Text style={s.headline}>{headlines[accountType]}</Text>
      <Text style={s.tierLabel}>{tierLabels[currentTier]}</Text>

      {breadcrumbs.length > 0 ? (
        <View style={s.breadcrumbRow}>
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              {i > 0 ? (
                <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.3)" />
              ) : null}
              <Pressable onPress={bc.onPress} hitSlop={6}>
                <Text style={s.breadcrumbText}>{bc.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      <View style={s.searchWrap}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={s.searchInput}
          placeholder={`Search ${currentTier === 'state' ? 'states' : currentTier === 'city' ? 'cities' : currentTier === 'borough' ? 'boroughs' : 'neighborhoods'}...`}
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.35)" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={s.scrollArea}>
        <View style={s.chipGrid}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={s.chip}
              onPress={() => handleSelect(item.id)}
            >
              <Feather
                name={currentTier === 'state' ? 'map' : currentTier === 'city' ? 'map-pin' : currentTier === 'borough' ? 'grid' : 'navigation'}
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={s.chipText}>{item.label}</Text>
              {item.sub ? (
                <Text style={s.chipSub}>{item.sub}</Text>
              ) : null}
              <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.25)" />
            </Pressable>
          ))}
          {items.length === 0 ? (
            <Text style={s.emptyText}>No results found</Text>
          ) : null}
        </View>
      </ScrollView>

      {currentTier === 'neighborhood' ? (
        <Pressable onPress={handleSkipNeighborhood} style={s.skipBtn} hitSlop={8}>
          <Text style={s.skipText}>Skip — any neighborhood is fine</Text>
        </Pressable>
      ) : null}

      {currentTier !== 'state' ? (
        <Pressable onPress={handleBack} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={s.backText}>Back</Text>
        </Pressable>
      ) : null}
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
  tierLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 16,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  scrollArea: {
    flex: 1,
  },
  chipGrid: {
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  chipSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 32,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  backText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
