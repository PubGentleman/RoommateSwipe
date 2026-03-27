import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { ProgressBar } from '../../components/questionnaire/ProgressBar';
import { ApartmentPreferences } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { updateProfile } from '../../services/profileService';
import {
  SUBWAY_LINES,
  OTHER_TRANSIT,
  SUBWAY_LINE_COLORS,
  BOROUGH_NEIGHBORHOODS,
} from '../../constants/transitData';
import { PricePickerPair, STANDARD_MAX_VALUE } from '../../components/PricePicker';

const TOTAL_STEPS = 6;
const CORAL = '#ff6b5b';
const BG = '#111';

const BEDROOM_OPTIONS = [
  { label: 'Studio', value: 0, hint: 'Just you' },
  { label: '1BR', value: 1, hint: 'Just you or 1 roommate' },
  { label: '2BR', value: 2, hint: '1 roommate' },
  { label: '3BR', value: 3, hint: '2 roommates' },
  { label: '4BR+', value: 4, hint: '3 roommates' },
];


const AMENITY_OPTIONS = [
  'In-unit laundry', 'Laundry in building', 'Dishwasher', 'Elevator',
  'Doorman / Security', 'Outdoor space', 'Pet friendly', 'Parking',
  'Air conditioning', 'Gym', 'No fee', 'Furnished',
];

export default function ApartmentPreferencesScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [budgetMin, setBudgetMin] = useState<number>(1000);
  const [budgetMax, setBudgetMax] = useState<number>(2000);
  const [selectedTrains, setSelectedTrains] = useState<string[]>([]);
  const [hasCar, setHasCar] = useState(false);
  const [isWfh, setIsWfh] = useState(false);
  const [moveInFlexible, setMoveInFlexible] = useState(false);
  const [moveInDate, setMoveInDate] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const canProceed = useCallback(() => {
    switch (step) {
      case 0: return bedrooms !== null;
      case 1: return true;
      case 2: return selectedTrains.length > 0 || hasCar || isWfh;
      case 3: return moveInFlexible || moveInDate.length > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  }, [step, bedrooms, budgetMin, budgetMax, selectedTrains, hasCar, isWfh, moveInFlexible, moveInDate, amenities]);

  const handleNext = useCallback(async () => {
    if (!canProceed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      await handleSave();
    }
  }, [step, canProceed]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const handleSave = async () => {
    if (!user || bedrooms === null) return;
    setSaving(true);
    const prefs: ApartmentPreferences = {
      desiredBedrooms: bedrooms,
      budgetPerPersonMin: budgetMin,
      budgetPerPersonMax: budgetMax,
      preferredTrains: selectedTrains,
      preferredNeighborhoods: neighborhoods,
      amenityMustHaves: amenities,
      moveInDate: moveInFlexible ? '' : moveInDate,
      locationFlexible: hasCar,
      wfh: isWfh,
      apartmentPrefsComplete: true,
    };

    await StorageService.setApartmentPreferences(user.id, prefs);

    try {
      await updateProfile({
        desired_bedrooms: bedrooms,
        budget_per_person_min: budget.min,
        budget_per_person_max: budget.max,
        preferred_trains: selectedTrains,
        preferred_neighborhoods: neighborhoods,
        amenity_must_haves: amenities,
        location_flexible: hasCar,
        wfh: isWfh,
        apartment_prefs_complete: true,
      } as any);
    } catch (e) {
      console.warn('[ApartmentPrefs] Supabase sync failed:', e);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    navigation.goBack();
  };

  const toggleTrain = (line: string) => {
    setSelectedTrains(prev =>
      prev.includes(line) ? prev.filter(t => t !== line) : [...prev, line]
    );
  };

  const toggleAmenity = (a: string) => {
    setAmenities(prev => {
      if (prev.includes(a)) return prev.filter(x => x !== a);
      if (prev.length >= 3) return prev;
      return [...prev, a];
    });
  };

  const toggleNeighborhood = (n: string) => {
    setNeighborhoods(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  };

  const getMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  const renderBedroomStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="bedrooms">
      <ThemedText style={styles.stepTitle}>
        How many bedrooms are you looking for?
      </ThemedText>
      <ThemedText style={styles.stepHint}>
        This tells us how many roommates you need
      </ThemedText>
      <View style={styles.optionGrid}>
        {BEDROOM_OPTIONS.map((opt, i) => (
          <Pressable
            key={opt.value}
            style={[
              styles.bedroomChip,
              bedrooms === opt.value && styles.chipSelected,
            ]}
            onPress={() => setBedrooms(opt.value)}
          >
            <ThemedText style={[
              styles.chipLabel,
              bedrooms === opt.value && styles.chipLabelSelected,
            ]}>
              {opt.label}
            </ThemedText>
            <ThemedText style={[
              styles.chipHint,
              bedrooms === opt.value && { color: 'rgba(255,107,91,0.7)' },
            ]}>
              {opt.hint}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderBudgetStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="budget">
      <ThemedText style={styles.stepTitle}>
        What's your budget per person per month?
      </ThemedText>
      <ThemedText style={styles.stepHint}>
        This is your share, not the total rent
      </ThemedText>
      <PricePickerPair
        minValue={budgetMin}
        maxValue={budgetMax}
        onMinChange={setBudgetMin}
        onMaxChange={setBudgetMax}
        height={160}
      />
    </Animated.View>
  );

  const renderTrainStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="trains">
      <ThemedText style={styles.stepTitle}>
        What train do you take to work or use most?
      </ThemedText>
      <ThemedText style={styles.stepHint}>Select all that apply</ThemedText>

      <ThemedText style={styles.sectionLabel}>Subway lines</ThemedText>
      <View style={styles.trainGrid}>
        {SUBWAY_LINES.map(line => {
          const isSelected = selectedTrains.includes(line);
          const bgColor = SUBWAY_LINE_COLORS[line] ?? '#666';
          return (
            <Pressable
              key={line}
              style={[
                styles.trainChip,
                { backgroundColor: isSelected ? bgColor : '#1c1c1c' },
                isSelected && { borderColor: bgColor },
              ]}
              onPress={() => toggleTrain(line)}
            >
              <ThemedText style={[
                styles.trainLabel,
                isSelected && { color: '#fff', fontWeight: '700' },
              ]}>
                {line === 'S' ? 'S (Shuttle)' : line}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
        Other transit
      </ThemedText>
      <View style={styles.trainGrid}>
        {OTHER_TRANSIT.map(line => {
          const isSelected = selectedTrains.includes(line);
          const bgColor = SUBWAY_LINE_COLORS[line] ?? '#555';
          return (
            <Pressable
              key={line}
              style={[
                styles.trainChip,
                styles.wideChip,
                { backgroundColor: isSelected ? bgColor : '#1c1c1c' },
                isSelected && { borderColor: bgColor },
              ]}
              onPress={() => toggleTrain(line)}
            >
              <ThemedText style={[
                styles.trainLabel,
                isSelected && { color: '#fff', fontWeight: '700' },
              ]}>
                {line}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <Pressable
          style={[styles.flexOption, hasCar && styles.chipSelected]}
          onPress={() => { setHasCar(!hasCar); }}
        >
          <Feather name="truck" size={18} color={hasCar ? CORAL : '#888'} />
          <ThemedText style={[styles.flexLabel, hasCar && { color: CORAL }]}>
            I have a car — location flexible
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.flexOption, isWfh && styles.chipSelected]}
          onPress={() => { setIsWfh(!isWfh); }}
        >
          <Feather name="home" size={18} color={isWfh ? CORAL : '#888'} />
          <ThemedText style={[styles.flexLabel, isWfh && { color: CORAL }]}>
            I work from home — location flexible
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderMoveInStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="movein">
      <ThemedText style={styles.stepTitle}>
        When do you want to move in?
      </ThemedText>

      <Pressable
        style={[styles.flexOption, moveInFlexible && styles.chipSelected]}
        onPress={() => {
          setMoveInFlexible(!moveInFlexible);
          if (!moveInFlexible) setMoveInDate('');
        }}
      >
        <Feather name="calendar" size={18} color={moveInFlexible ? CORAL : '#888'} />
        <ThemedText style={[styles.flexLabel, moveInFlexible && { color: CORAL }]}>
          I'm flexible — within 60 days
        </ThemedText>
      </Pressable>

      {!moveInFlexible ? (
        <View style={styles.dateInputWrapper}>
          <ThemedText style={styles.dateLabel}>Select a date</ThemedText>
          <ThemedText style={styles.dateHint}>
            Minimum 2 weeks from today
          </ThemedText>
          <View style={styles.dateChips}>
            {[14, 30, 45, 60].map(days => {
              const d = new Date();
              d.setDate(d.getDate() + days);
              const iso = d.toISOString().split('T')[0];
              const isSelected = moveInDate === iso;
              const label = days === 14 ? '2 weeks' : days === 30 ? '1 month' : days === 45 ? '6 weeks' : '2 months';
              return (
                <Pressable
                  key={days}
                  style={[styles.dateChip, isSelected && styles.chipSelected]}
                  onPress={() => setMoveInDate(iso)}
                >
                  <ThemedText style={[
                    styles.dateChipLabel,
                    isSelected && styles.chipLabelSelected,
                  ]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );

  const renderAmenitiesStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="amenities">
      <ThemedText style={styles.stepTitle}>
        What are your must-haves?
      </ThemedText>
      <ThemedText style={styles.stepHint}>
        Pick up to 3
      </ThemedText>
      <View style={styles.amenityGrid}>
        {AMENITY_OPTIONS.map(a => {
          const isSelected = amenities.includes(a);
          return (
            <Pressable
              key={a}
              style={[
                styles.amenityChip,
                isSelected && styles.chipSelected,
                amenities.length >= 3 && !isSelected && { opacity: 0.4 },
              ]}
              onPress={() => toggleAmenity(a)}
            >
              <ThemedText style={[
                styles.amenityLabel,
                isSelected && styles.chipLabelSelected,
              ]}>
                {a}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  const renderNeighborhoodStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} key="neighborhoods">
      <ThemedText style={styles.stepTitle}>
        Any specific neighborhoods you love?
      </ThemedText>
      <ThemedText style={styles.stepHint}>
        Optional. We'll factor in your train line automatically.
      </ThemedText>
      <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
        {Object.entries(BOROUGH_NEIGHBORHOODS).map(([borough, hoods]) => (
          <View key={borough} style={styles.boroughSection}>
            <ThemedText style={styles.boroughTitle}>{borough}</ThemedText>
            <View style={styles.hoodGrid}>
              {hoods.map(hood => {
                const isSelected = neighborhoods.includes(hood);
                return (
                  <Pressable
                    key={hood}
                    style={[styles.hoodChip, isSelected && styles.chipSelected]}
                    onPress={() => toggleNeighborhood(hood)}
                  >
                    <ThemedText style={[
                      styles.hoodLabel,
                      isSelected && styles.chipLabelSelected,
                    ]}>
                      {hood}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderBedroomStep();
      case 1: return renderBudgetStep();
      case 2: return renderTrainStep();
      case 3: return renderMoveInStep();
      case 4: return renderAmenitiesStep();
      case 5: return renderNeighborhoodStep();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Apartment Preferences</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[
            styles.nextBtn,
            !canProceed() && styles.nextBtnDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || saving}
        >
          <ThemedText style={styles.nextBtnText}>
            {saving ? 'Saving...' : step === TOTAL_STEPS - 1 ? 'Done' : 'Continue'}
          </ThemedText>
          {step < TOTAL_STEPS - 1 ? (
            <Feather name="arrow-right" size={18} color="#fff" />
          ) : null}
        </Pressable>
        {step === 4 || step === 5 ? (
          <Pressable onPress={handleNext} style={styles.skipBtn}>
            <ThemedText style={styles.skipText}>Skip</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1c1c1c', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  stepTitle: {
    fontSize: 22, fontWeight: '700', color: '#fff',
    marginBottom: Spacing.xs, marginTop: Spacing.md,
  },
  stepHint: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1,
  },
  optionGrid: { gap: 10 },
  bedroomChip: {
    backgroundColor: '#1c1c1c', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,107,91,0.1)', borderColor: CORAL,
  },
  chipLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  chipLabelSelected: { color: CORAL },
  chipHint: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  trainGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  trainChip: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  wideChip: { width: 'auto', paddingHorizontal: 16 },
  trainLabel: { fontSize: 16, fontWeight: '600', color: '#aaa' },
  flexOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1c1c1c', borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#2a2a2a',
    marginBottom: 8,
  },
  flexLabel: { fontSize: 15, color: '#ccc' },
  dateInputWrapper: { marginTop: Spacing.lg },
  dateLabel: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  dateHint: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: Spacing.md },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateChip: {
    backgroundColor: '#1c1c1c', borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 20, borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  dateChipLabel: { fontSize: 14, fontWeight: '600', color: '#ccc' },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    backgroundColor: '#1c1c1c', borderRadius: 12, paddingVertical: 10,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  amenityLabel: { fontSize: 14, color: '#ccc' },
  boroughSection: { marginBottom: Spacing.lg },
  boroughTitle: {
    fontSize: 15, fontWeight: '700', color: CORAL,
    marginBottom: Spacing.sm,
  },
  hoodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hoodChip: {
    backgroundColor: '#1c1c1c', borderRadius: 10, paddingVertical: 8,
    paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  hoodLabel: { fontSize: 13, color: '#ccc' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    backgroundColor: BG,
  },
  nextBtn: {
    backgroundColor: CORAL, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});
