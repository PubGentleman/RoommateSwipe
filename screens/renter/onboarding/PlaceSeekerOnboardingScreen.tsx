import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../../components/VectorIcons';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { supabase } from '../../../lib/supabase';
import { getNeighborhoodsByBorough, getNeighborhoodsForCity } from '../../../constants/neighborhoods';
import { getRenterPreferenceAmenities } from '../../../constants/amenities';
import OnboardingHeader from '../../../components/OnboardingHeader';

const TOTAL_STEPS = 3;

const NICE_TO_HAVE_ITEMS = [
  { id: 'natural_light', label: 'Natural Light', icon: 'sun' as const },
  { id: 'high_ceilings', label: 'High Ceilings', icon: 'arrow-up' as const },
  { id: 'rooftop', label: 'Rooftop', icon: 'layers' as const },
  { id: 'gym', label: 'Gym', icon: 'zap' as const },
  { id: 'pool', label: 'Pool', icon: 'droplet' as const },
  { id: 'doorman', label: 'Doorman', icon: 'shield' as const },
  { id: 'coworking_space', label: 'Co-Working', icon: 'monitor' as const },
  { id: 'ev_charging', label: 'EV Charging', icon: 'battery-charging' as const },
];

const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1 BR' },
  { value: 2, label: '2 BR' },
  { value: 3, label: '3 BR' },
  { value: 4, label: '4+' },
];

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'ASAP' },
  { value: '1_month', label: 'Within 1 month' },
  { value: '2_months', label: '1-2 months' },
  { value: '3_months', label: '2-3 months' },
  { value: 'flexible', label: 'Flexible' },
];

export default function PlaceSeekerOnboardingScreen() {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [moveInDate, setMoveInDate] = useState<string>('');
  const [niceToHaves, setNiceToHaves] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const userCity = user?.profileData?.city || user?.profileData?.neighborhood || '';
  const boroughGroups = getNeighborhoodsByBorough(userCity);
  const allNeighborhoods = getNeighborhoodsForCity(userCity);
  const hasBoroughs = boroughGroups.size > 0;

  const toggleNeighborhood = (id: string) => {
    setSelectedNeighborhoods(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  const toggleNiceToHave = (id: string) => {
    setNiceToHaves(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  const renderStep1 = () => (
    <View>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Where do you want to live?</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Pick your top neighborhoods — we'll prioritize listings in these areas
      </Text>

      {hasBoroughs ? (
        Array.from(boroughGroups.entries()).map(([borough, neighborhoods]) => (
          <View key={borough} style={styles.boroughSection}>
            <Text style={[styles.boroughLabel, { color: theme.textSecondary }]}>{borough}</Text>
            <View style={styles.chipsWrap}>
              {neighborhoods.map(area => {
                const isActive = selectedNeighborhoods.includes(area.id);
                return (
                  <Pressable
                    key={area.id}
                    style={[
                      styles.chip,
                      { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.15)' },
                      isActive && { backgroundColor: `${theme.primary}20` },
                    ]}
                    onPress={() => toggleNeighborhood(area.id)}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: isActive ? theme.primary : theme.textSecondary },
                    ]}>
                      {area.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary, marginTop: 16 }]}>
          Neighborhood suggestions are available for NYC. Your preferences will still be saved from other onboarding data.
        </Text>
      )}

      <Text style={[styles.chipHint, { color: theme.textTertiary }]}>
        {selectedNeighborhoods.length}/5 selected
      </Text>
    </View>
  );

  const renderStep2 = () => {
    const amenities = getRenterPreferenceAmenities();
    return (
      <View>
        <Text style={[styles.stepTitle, { color: theme.text }]}>What are you looking for?</Text>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Bedrooms</Text>
        <View style={styles.bedroomRow}>
          {BEDROOM_OPTIONS.map(option => {
            const isActive = bedrooms === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.bedroomChip,
                  { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.15)' },
                  isActive && { backgroundColor: `${theme.primary}20` },
                ]}
                onPress={() => setBedrooms(option.value)}
              >
                <Text style={[
                  styles.bedroomChipText,
                  { color: isActive ? theme.primary : theme.textSecondary },
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 28 }]}>Must-haves</Text>
        <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
          What can't you live without?
        </Text>
        <View style={styles.chipsWrap}>
          {amenities.map(amenity => {
            const isSelected = selectedAmenities.includes(amenity.id);
            return (
              <Pressable
                key={amenity.id}
                style={[
                  styles.amenityChip,
                  { borderColor: isSelected ? theme.primary : 'rgba(255,255,255,0.15)' },
                  isSelected && { backgroundColor: `${theme.primary}20` },
                ]}
                onPress={() => toggleAmenity(amenity.id)}
              >
                <Feather
                  name={amenity.icon as any}
                  size={14}
                  color={isSelected ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.amenityChipText,
                  { color: isSelected ? '#fff' : theme.textSecondary },
                ]}>
                  {amenity.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep3 = () => {
    const filteredNiceToHaves = NICE_TO_HAVE_ITEMS.filter(
      item => !selectedAmenities.includes(item.id)
    );

    return (
      <View>
        <Text style={[styles.stepTitle, { color: theme.text }]}>Almost done!</Text>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>When do you need to move?</Text>
        <View style={styles.chipsWrap}>
          {TIMELINE_OPTIONS.map(option => {
            const isActive = moveInDate === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.15)' },
                  isActive && { backgroundColor: `${theme.primary}20` },
                ]}
                onPress={() => setMoveInDate(option.value)}
              >
                <Text style={[
                  styles.chipText,
                  { color: isActive ? theme.primary : theme.textSecondary },
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredNiceToHaves.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 28 }]}>
              Nice to have
            </Text>
            <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
              Optional — helps us find better matches
            </Text>
            <View style={styles.chipsWrap}>
              {filteredNiceToHaves.map(item => {
                const isSelected = niceToHaves.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.amenityChip,
                      { borderColor: isSelected ? '#4a9eff' : 'rgba(255,255,255,0.15)' },
                      isSelected && { backgroundColor: 'rgba(74,158,255,0.2)' },
                    ]}
                    onPress={() => toggleNiceToHave(item.id)}
                  >
                    <Feather
                      name={item.icon}
                      size={14}
                      color={isSelected ? '#fff' : theme.textSecondary}
                    />
                    <Text style={[
                      styles.amenityChipText,
                      { color: isSelected ? '#fff' : theme.textSecondary },
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          preferred_neighborhoods: selectedNeighborhoods,
          preferred_bedrooms: bedrooms,
          amenity_preferences: selectedAmenities,
          nice_to_have_amenities: niceToHaves,
          move_in_timeline: moveInDate || null,
          type_onboarding_complete: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      await updateUser({
        typeOnboardingComplete: true,
        preferredNeighborhoods: selectedNeighborhoods,
        preferredBedrooms: bedrooms,
        amenityPreferences: selectedAmenities,
        niceToHaveAmenities: niceToHaves,
        moveInTimeline: moveInDate || undefined,
      });
    } catch (err) {
      console.error('Error saving place seeker preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase
        .from('users')
        .update({ type_onboarding_complete: true })
        .eq('id', user.id);

      await updateUser({ typeOnboardingComplete: true });
    } catch (err) {
      console.error('Error skipping:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    if (step > 1) {
      setStep(s => s - 1);
    } else {
      if (user?.id) {
        await supabase.from('users').update({ apartment_search_type: null }).eq('id', user.id);
        await updateUser({ profileData: { ...user.profileData, apartment_search_type: undefined } });
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <OnboardingHeader
        showBack
        onBack={handleBack}
        step={step}
        totalSteps={TOTAL_STEPS}
        rightAction={
          step === 1 ? (
            <Pressable onPress={handleSkip} disabled={loading} hitSlop={8}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Skip</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {step > 1 ? (
          <Pressable style={styles.backButton} onPress={() => setStep(s => s - 1)}>
            <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}

        <Pressable
          style={[styles.nextButton, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={() => {
            if (step < TOTAL_STEPS) {
              setStep(s => s + 1);
            } else {
              handleComplete();
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === TOTAL_STEPS ? "Let's Go" : 'Next'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  boroughSection: {
    marginBottom: 16,
  },
  boroughLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  chipHint: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bedroomRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  bedroomChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bedroomChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  amenityChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 100,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
