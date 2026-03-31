import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../../components/VectorIcons';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { supabase } from '../../../lib/supabase';
import OnboardingHeader from '../../../components/OnboardingHeader';
import { PricePickerPair } from '../../../components/PricePicker';

const TOTAL_STEPS = 4;

const ROOM_TYPES = [
  { id: 'private', icon: 'lock' as const, label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users' as const, label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home' as const, label: 'Full Apartment', desc: 'An entire place to yourself' },
];

type DealbreakerId = 'smoking' | 'pets' | 'overnight_guests' | 'drinking' | 'loud_music' | 'drugs';

const DEALBREAKER_OPTIONS: { id: DealbreakerId; label: string; icon: string }[] = [
  { id: 'smoking', label: 'Smoking indoors', icon: 'wind' },
  { id: 'pets', label: 'Pets', icon: 'heart' },
  { id: 'overnight_guests', label: 'Overnight guests', icon: 'moon' },
  { id: 'drinking', label: 'Heavy drinking', icon: 'coffee' },
  { id: 'loud_music', label: 'Loud music', icon: 'volume-2' },
  { id: 'drugs', label: 'Drug use', icon: 'alert-triangle' },
];

type SleepSchedule = 'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular';
type Cleanliness = 'very_tidy' | 'moderately_tidy' | 'relaxed';
type NoiseTolerance = 'prefer_quiet' | 'normal_noise' | 'loud_environments';

const SLEEP_OPTIONS: { value: SleepSchedule; label: string; icon: string }[] = [
  { value: 'early_sleeper', label: 'Early bird (before 11pm)', icon: 'sunrise' },
  { value: 'late_sleeper', label: 'Night owl (after midnight)', icon: 'moon' },
  { value: 'flexible', label: 'Flexible', icon: 'clock' },
  { value: 'irregular', label: 'Irregular schedule', icon: 'shuffle' },
];

const CLEANLINESS_OPTIONS: { value: Cleanliness; label: string }[] = [
  { value: 'very_tidy', label: 'Very tidy — I clean regularly' },
  { value: 'moderately_tidy', label: 'Moderate — clean but not obsessive' },
  { value: 'relaxed', label: 'Relaxed — I have other priorities' },
];

const NOISE_OPTIONS: { value: NoiseTolerance; label: string }[] = [
  { value: 'prefer_quiet', label: 'I prefer quiet spaces' },
  { value: 'normal_noise', label: 'Normal noise is fine' },
  { value: 'loud_environments', label: 'I don\'t mind loud environments' },
];

export default function RoommateOnboardingScreen() {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [dealbreakers, setDealbreakers] = useState<DealbreakerId[]>([]);
  const [sleepSchedule, setSleepSchedule] = useState<SleepSchedule | null>(null);
  const [cleanliness, setCleanliness] = useState<Cleanliness | null>(null);
  const [noiseTolerance, setNoiseTolerance] = useState<NoiseTolerance | null>(null);
  const [idealRoommate, setIdealRoommate] = useState('');
  const [budgetMin, setBudgetMin] = useState<number>(1000);
  const [budgetMax, setBudgetMax] = useState<number>(2500);
  const listingPref = user?.profileData?.listing_type_preference;
  const roomTypeKnown = listingPref === 'entire_apartment' || listingPref === 'room';
  const [roomTypes, setRoomTypes] = useState<string[]>(
    listingPref === 'entire_apartment' ? ['apartment'] :
    listingPref === 'room' ? ['private'] : []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roomTypeKnown && roomTypes.length === 0) {
      setRoomTypes(listingPref === 'entire_apartment' ? ['apartment'] : ['private']);
    }
  }, [listingPref]);

  const toggleDealbreaker = (id: DealbreakerId) => {
    setDealbreakers(prev =>
      prev.includes(id)
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  };

  const toggleRoomType = (id: string) => {
    setRoomTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const renderBudgetStep = () => (
    <View>
      <Text style={[styles.stepTitle, { color: theme.text }]}>What's your budget?</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Set your monthly rent range to find compatible roommates
      </Text>

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Monthly Budget</Text>
      <PricePickerPair
        minValue={budgetMin}
        maxValue={budgetMax}
        onMinChange={setBudgetMin}
        onMaxChange={setBudgetMax}
        height={160}
      />

      {!roomTypeKnown ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 28 }]}>Room Type</Text>
          <View style={{ gap: 10 }}>
            {ROOM_TYPES.map(rt => {
              const isActive = roomTypes.includes(rt.id);
              return (
                <Pressable
                  key={rt.id}
                  style={[
                    styles.roomCard,
                    { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.15)' },
                    isActive && { backgroundColor: `${theme.primary}15` },
                  ]}
                  onPress={() => toggleRoomType(rt.id)}
                >
                  <View style={[styles.roomIconWrap, isActive && { backgroundColor: `${theme.primary}20` }]}>
                    <Feather name={rt.icon} size={20} color={isActive ? theme.primary : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roomLabel, { color: isActive ? theme.primary : theme.text }]}>
                      {rt.label}
                    </Text>
                    <Text style={[styles.roomDesc, { color: theme.textTertiary }]}>{rt.desc}</Text>
                  </View>
                  {isActive ? (
                    <Feather name="check-circle" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Any dealbreakers?</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Select anything you absolutely can't live with. We'll filter out incompatible matches.
      </Text>

      <View style={styles.optionList}>
        {DEALBREAKER_OPTIONS.map(item => {
          const isActive = dealbreakers.includes(item.id);
          return (
            <Pressable
              key={item.id}
              style={[
                styles.optionRow,
                { borderColor: isActive ? '#ef4444' : 'rgba(255,255,255,0.1)' },
                isActive && { backgroundColor: 'rgba(239,68,68,0.1)' },
              ]}
              onPress={() => toggleDealbreaker(item.id)}
            >
              <View style={styles.optionLeft}>
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={isActive ? '#ef4444' : theme.textSecondary}
                />
                <Text style={[
                  styles.optionText,
                  { color: isActive ? '#ef4444' : theme.text },
                ]}>
                  {item.label}
                </Text>
              </View>
              {isActive ? (
                <Feather name="x-circle" size={20} color="#ef4444" />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.chipHint, { color: theme.textTertiary }]}>
        {dealbreakers.length === 0 ? 'None selected — all good!' : `${dealbreakers.length} dealbreaker${dealbreakers.length > 1 ? 's' : ''} set`}
      </Text>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Your lifestyle</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Help us match you with compatible roommates
      </Text>

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Sleep schedule</Text>
      <View style={styles.optionList}>
        {SLEEP_OPTIONS.map(option => {
          const isActive = sleepSchedule === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.optionRow,
                { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.1)' },
                isActive && { backgroundColor: `${theme.primary}15` },
              ]}
              onPress={() => setSleepSchedule(option.value)}
            >
              <View style={styles.optionLeft}>
                <Feather
                  name={option.icon as any}
                  size={18}
                  color={isActive ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.optionText,
                  { color: isActive ? theme.primary : theme.text },
                ]}>
                  {option.label}
                </Text>
              </View>
              {isActive ? (
                <Feather name="check-circle" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 24 }]}>Cleanliness</Text>
      <View style={styles.optionList}>
        {CLEANLINESS_OPTIONS.map(option => {
          const isActive = cleanliness === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.optionRow,
                { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.1)' },
                isActive && { backgroundColor: `${theme.primary}15` },
              ]}
              onPress={() => setCleanliness(option.value)}
            >
              <Text style={[
                styles.optionText,
                { color: isActive ? theme.primary : theme.text, marginLeft: 8 },
              ]}>
                {option.label}
              </Text>
              {isActive ? (
                <Feather name="check-circle" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 24 }]}>Noise tolerance</Text>
      <View style={styles.optionList}>
        {NOISE_OPTIONS.map(option => {
          const isActive = noiseTolerance === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.optionRow,
                { borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.1)' },
                isActive && { backgroundColor: `${theme.primary}15` },
              ]}
              onPress={() => setNoiseTolerance(option.value)}
            >
              <Text style={[
                styles.optionText,
                { color: isActive ? theme.primary : theme.text, marginLeft: 8 },
              ]}>
                {option.label}
              </Text>
              {isActive ? (
                <Feather name="check-circle" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Your ideal roommate</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Describe who you'd love to live with. Pi uses this to find better matches for you.
      </Text>

      <TextInput
        style={[
          styles.textArea,
          {
            color: theme.text,
            borderColor: idealRoommate.length > 0 ? theme.primary : 'rgba(255,255,255,0.15)',
            backgroundColor: 'rgba(255,255,255,0.05)',
          },
        ]}
        placeholder="e.g. Someone who's tidy, respectful of quiet hours, and enjoys cooking together occasionally..."
        placeholderTextColor={theme.textTertiary}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        value={idealRoommate}
        onChangeText={setIdealRoommate}
        maxLength={500}
      />
      <Text style={[styles.charCount, { color: theme.textTertiary }]}>
        {idealRoommate.length}/500
      </Text>
    </View>
  );

  const mapCleanlinessToInt = (val: Cleanliness | null): number | null => {
    if (!val) return null;
    const map: Record<Cleanliness, number> = { very_tidy: 5, moderately_tidy: 3, relaxed: 1 };
    return map[val] ?? null;
  };

  const mapNoiseToInt = (val: NoiseTolerance | null): number | null => {
    if (!val) return null;
    const map: Record<NoiseTolerance, number> = { prefer_quiet: 1, normal_noise: 3, loud_environments: 5 };
    return map[val] ?? null;
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: userError } = await supabase
        .from('users')
        .update({ type_onboarding_complete: true })
        .eq('id', user.id);

      if (userError) throw userError;

      const profileFields: Record<string, any> = {};
      if (sleepSchedule) profileFields.sleep_schedule = sleepSchedule;
      if (cleanliness) profileFields.cleanliness = mapCleanlinessToInt(cleanliness);
      if (noiseTolerance) profileFields.noise_tolerance = mapNoiseToInt(noiseTolerance);
      if (idealRoommate.trim()) profileFields.ideal_roommate_text = idealRoommate.trim();
      if (dealbreakers.length > 0) profileFields.smoking = dealbreakers.includes('smoking') ? 'no' : undefined;
      if (dealbreakers.includes('pets')) profileFields.pets = 'no_pets';

      if (Object.keys(profileFields).length > 0) {
        const cleanFields = Object.fromEntries(
          Object.entries(profileFields).filter(([_, v]) => v !== undefined)
        );
        const { error: profileError } = await supabase
          .from('profiles')
          .update(cleanFields)
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error saving profile preferences:', profileError);
        }
      }

      const userUpdates: Record<string, any> = {
        typeOnboardingComplete: true,
        profileData: {
          ...user.profileData,
          budget: budgetMax,
          budgetMin: budgetMin,
          budgetMax: budgetMax,
          roomType: roomTypes.join(',') || (listingPref === 'entire_apartment' ? 'apartment' : listingPref === 'room' ? 'private' : undefined),
          lookingFor: roomTypes.includes('apartment') ? 'entire_apartment' : (roomTypes.length > 0 ? 'room' : (listingPref === 'entire_apartment' ? 'entire_apartment' : listingPref === 'room' ? 'room' : undefined)),
          dealbreakers: dealbreakers,
          preferences: {
            ...user.profileData?.preferences,
            ...(sleepSchedule ? { sleepSchedule } : {}),
            ...(cleanliness ? { cleanliness } : {}),
            ...(noiseTolerance ? { noiseTolerance } : {}),
            ...(dealbreakers.includes('smoking') ? { smoking: 'no' } : {}),
            ...(dealbreakers.includes('pets') ? { pets: 'no_pets' } : dealbreakers.length > 0 ? { pets: 'open_to_pets' } : {}),
          },
        },
      };

      if (idealRoommate.trim()) {
        userUpdates.ideal_roommate_text = idealRoommate.trim();
        userUpdates.profileData.ideal_roommate_text = idealRoommate.trim();
      }

      await updateUser(userUpdates);
    } catch (err) {
      console.error('Error saving roommate preferences:', err);
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
        {step === 1 ? renderBudgetStep() : step === 2 ? renderStep1() : step === 3 ? renderStep2() : renderStep3()}
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipHint: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  optionList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 12,
  },
  roomIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  roomDesc: {
    fontSize: 12,
    marginTop: 2,
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
