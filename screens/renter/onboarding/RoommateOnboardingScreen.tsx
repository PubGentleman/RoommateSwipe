import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../../components/VectorIcons';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { supabase } from '../../../lib/supabase';
import OnboardingHeader from '../../../components/OnboardingHeader';
import { PricePickerPair } from '../../../components/PricePicker';

const TOTAL_STEPS = 6;

type GenderPref = 'any' | 'female_only' | 'male_only' | 'same_gender';

const GENDER_PREF_OPTIONS: { value: GenderPref; icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
  { value: 'any', icon: 'users', label: 'Anyone', desc: 'Open to all' },
  { value: 'female_only', icon: 'user', label: 'Women only', desc: 'Female household' },
  { value: 'male_only', icon: 'user', label: 'Men only', desc: 'Male household' },
  { value: 'same_gender', icon: 'repeat', label: 'Same gender', desc: 'Match my gender' },
];

const ROOM_TYPES: { id: string; icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
  { id: 'private', icon: 'lock', label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users', label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home', label: 'Full Apartment', desc: 'An entire place to yourself' },
];

type DealbreakerId = 'smoking' | 'pets' | 'overnight_guests' | 'drinking' | 'loud_music' | 'drugs';

const DEALBREAKER_OPTIONS: { id: DealbreakerId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
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

const SLEEP_OPTIONS: { value: SleepSchedule; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { value: 'early_sleeper', label: 'Early Bird', icon: 'sunrise', desc: 'Bed by 10pm' },
  { value: 'late_sleeper', label: 'Night Owl', icon: 'moon', desc: 'After midnight' },
  { value: 'flexible', label: 'Flexible', icon: 'clock', desc: 'Can adjust' },
  { value: 'irregular', label: 'Shift Worker', icon: 'shuffle', desc: 'Irregular hours' },
];

const CLEANLINESS_OPTIONS: { value: Cleanliness; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { value: 'very_tidy', label: 'Very Tidy', icon: 'star', desc: 'Everything has a place' },
  { value: 'moderately_tidy', label: 'Moderate', icon: 'check-circle', desc: 'I clean up after myself' },
  { value: 'relaxed', label: 'Relaxed', icon: 'coffee', desc: 'Life is too short to stress' },
];

const NOISE_OPTIONS: { value: NoiseTolerance; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { value: 'prefer_quiet', label: 'Very Quiet', icon: 'volume', desc: 'Need near-silence' },
  { value: 'normal_noise', label: 'Moderate', icon: 'volume-1', desc: 'Normal sounds fine' },
  { value: 'loud_environments', label: 'Lively', icon: 'volume-2', desc: 'Love an active home' },
];

const IDEAL_SNIPPETS = [
  { label: 'Clean and quiet', text: "Someone who's clean but not uptight about it. Keeps shared spaces tidy." },
  { label: 'Social and outgoing', text: "A social person who loves going out. Someone who's down for weekend plans." },
  { label: 'Remote worker', text: "Another remote worker on a similar schedule. WFH buddies who respect focus time." },
  { label: 'Chill vibes', text: "Someone laid back and easygoing. Low drama, good energy." },
];

function SelectionCard({
  icon,
  label,
  subtitle,
  selected,
  onPress,
  accentColor = '#ff6b5b',
  danger = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
  danger?: boolean;
}) {
  const borderColor = danger
    ? (selected ? '#E74C3C' : '#2a2a2a')
    : (selected ? accentColor : '#2a2a2a');
  const bgColor = danger
    ? (selected ? 'rgba(231,76,60,0.08)' : '#1a1a1a')
    : (selected ? accentColor + '12' : '#1a1a1a');
  return (
    <Pressable onPress={onPress} style={[styles.selectionCard, { borderColor, backgroundColor: bgColor }]}>
      <View style={[styles.selectionCardIcon, { backgroundColor: (danger && selected ? '#E74C3C' : accentColor) + '15' }]}>
        <Feather name={icon} size={20} color={danger && selected ? '#E74C3C' : (selected ? accentColor : 'rgba(255,255,255,0.5)')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectionCardLabel, selected ? { color: danger ? '#E74C3C' : accentColor } : null]}>{label}</Text>
        {subtitle ? <Text style={styles.selectionCardSubtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? <Feather name={danger ? 'x-circle' : 'check-circle'} size={18} color={danger ? '#E74C3C' : accentColor} /> : null}
    </Pressable>
  );
}

function OptionCard({
  icon, label, subtitle, selected, onPress, accentColor = '#ff6b5b',
}: {
  icon: keyof typeof Feather.glyphMap; label: string; subtitle?: string; selected: boolean; onPress: () => void; accentColor?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.optionCard, selected ? { borderColor: accentColor, backgroundColor: accentColor + '12' } : null]}>
      <View style={[styles.optionCardIconWrap, { backgroundColor: accentColor + '15' }]}>
        <Feather name={icon} size={22} color={selected ? accentColor : 'rgba(255,255,255,0.5)'} />
      </View>
      <Text style={[styles.optionCardLabel, selected ? { color: accentColor } : null]}>{label}</Text>
      {subtitle ? <Text style={styles.optionCardSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

function ScaleSelector({
  levels, selected, onSelect, accentColor = '#ff6b5b',
}: {
  levels: { value: string; icon: keyof typeof Feather.glyphMap; label: string; desc?: string }[];
  selected: string; onSelect: (v: string) => void; accentColor?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {levels.map((level) => {
        const active = selected === level.value;
        return (
          <Pressable key={level.value} onPress={() => onSelect(level.value)} style={[styles.scaleItem, active ? { borderColor: accentColor, backgroundColor: accentColor + '10' } : null]}>
            <View style={[styles.scaleIcon, { backgroundColor: accentColor + '15' }]}>
              <Feather name={level.icon} size={18} color={active ? accentColor : 'rgba(255,255,255,0.4)'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scaleLabel, active ? { color: accentColor } : null]}>{level.label}</Text>
              {level.desc ? <Text style={styles.scaleDesc}>{level.desc}</Text> : null}
            </View>
            {active ? <Feather name="check" size={16} color={accentColor} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabelText}>{text}</Text>
    </View>
  );
}

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
  const [maxRoommates, setMaxRoommates] = useState(2);
  const [genderPreference, setGenderPreference] = useState<GenderPref | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roomTypeKnown && roomTypes.length === 0) {
      setRoomTypes(listingPref === 'entire_apartment' ? ['apartment'] : ['private']);
    }
  }, [listingPref]);

  const toggleDealbreaker = (id: DealbreakerId) => {
    setDealbreakers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const toggleRoomType = (id: string) => {
    setRoomTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const STEP_TITLES = [
    "What's your budget?",
    'How many roommates?',
    'Any dealbreakers?',
    'Your lifestyle',
    'Gender preference',
    'Your ideal roommate',
  ];

  const STEP_SUBTITLES = [
    'Set your range and room type preferences',
    'This helps us find the right matches',
    'These are hard filters \u2014 we\'ll remove incompatible matches',
    'Sleep, cleanliness, and noise \u2014 the make-or-break stuff',
    'Who are you comfortable living with?',
    'Tell Pi what you\'re looking for in your own words',
  ];

  const STEP_ICONS: (keyof typeof Feather.glyphMap)[] = [
    'dollar-sign', 'users', 'shield', 'home', 'heart', 'edit-3',
  ];

  const renderBudgetStep = () => (
    <View>
      <SectionLabel text="Monthly Budget" />
      <PricePickerPair
        minValue={budgetMin}
        maxValue={budgetMax}
        onMinChange={setBudgetMin}
        onMaxChange={setBudgetMax}
        height={160}
      />
      {!roomTypeKnown ? (
        <>
          <View style={{ height: 20 }} />
          <SectionLabel text="Room Type" />
          <View style={{ gap: 8 }}>
            {ROOM_TYPES.map(rt => (
              <SelectionCard
                key={rt.id}
                icon={rt.icon}
                label={rt.label}
                subtitle={rt.desc}
                selected={roomTypes.includes(rt.id)}
                onPress={() => toggleRoomType(rt.id)}
                accentColor="#ff6b5b"
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderRoommateCountStep = () => (
    <View>
      <View style={styles.stepperContainer}>
        <Pressable
          style={[styles.stepperButton, maxRoommates <= 1 && styles.stepperButtonDisabled]}
          onPress={() => { setMaxRoommates(prev => Math.max(1, prev - 1)); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
          disabled={maxRoommates <= 1}
        >
          <Feather name="minus" size={24} color={maxRoommates <= 1 ? 'rgba(255,255,255,0.2)' : '#fff'} />
        </Pressable>
        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValue}>{maxRoommates === 4 ? '4+' : maxRoommates}</Text>
          <Text style={styles.stepperLabel}>{maxRoommates === 1 ? 'roommate' : 'roommates'}</Text>
        </View>
        <Pressable
          style={[styles.stepperButton, maxRoommates >= 4 && styles.stepperButtonDisabled]}
          onPress={() => { setMaxRoommates(prev => Math.min(4, prev + 1)); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
          disabled={maxRoommates >= 4}
        >
          <Feather name="plus" size={24} color={maxRoommates >= 4 ? 'rgba(255,255,255,0.2)' : '#fff'} />
        </Pressable>
      </View>
    </View>
  );

  const renderDealbreakerStep = () => (
    <View>
      <View style={{ gap: 8 }}>
        {DEALBREAKER_OPTIONS.map(item => (
          <SelectionCard
            key={item.id}
            icon={item.icon}
            label={item.label}
            selected={dealbreakers.includes(item.id)}
            onPress={() => toggleDealbreaker(item.id)}
            danger
          />
        ))}
      </View>
      {dealbreakers.length > 0 ? (
        <Animated.View entering={FadeIn} style={styles.dealbreakerCount}>
          <Feather name="shield" size={14} color="#E74C3C" />
          <Text style={styles.dealbreakerCountText}>{dealbreakers.length} dealbreaker{dealbreakers.length > 1 ? 's' : ''} set</Text>
        </Animated.View>
      ) : (
        <Text style={styles.chipHint}>None selected \u2014 all good!</Text>
      )}
    </View>
  );

  const renderLifestyleStep = () => (
    <View>
      <SectionLabel text="Sleep schedule" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SLEEP_OPTIONS.map(opt => (
          <OptionCard key={opt.value} icon={opt.icon} label={opt.label} subtitle={opt.desc} selected={sleepSchedule === opt.value} onPress={() => setSleepSchedule(opt.value)} accentColor="#F59E0B" />
        ))}
      </View>

      <View style={{ height: 20 }} />
      <SectionLabel text="Cleanliness" />
      <ScaleSelector
        levels={CLEANLINESS_OPTIONS}
        selected={cleanliness || ''}
        onSelect={(v) => setCleanliness(v as Cleanliness)}
        accentColor="#3b82f6"
      />

      <View style={{ height: 20 }} />
      <SectionLabel text="Noise tolerance" />
      <ScaleSelector
        levels={NOISE_OPTIONS}
        selected={noiseTolerance || ''}
        onSelect={(v) => setNoiseTolerance(v as NoiseTolerance)}
        accentColor="#F59E0B"
      />
    </View>
  );

  const renderGenderPrefStep = () => (
    <View>
      <View style={{ gap: 8 }}>
        {GENDER_PREF_OPTIONS.map(opt => (
          <SelectionCard
            key={opt.value}
            icon={opt.icon}
            label={opt.label}
            subtitle={opt.desc}
            selected={genderPreference === opt.value}
            onPress={() => setGenderPreference(opt.value)}
            accentColor="#ec4899"
          />
        ))}
      </View>
    </View>
  );

  const renderIdealStep = () => (
    <View>
      <View style={styles.snippetRow}>
        {IDEAL_SNIPPETS.map((s, i) => (
          <Pressable key={i} onPress={() => setIdealRoommate(s.text)} style={styles.snippetChip}>
            <Text style={styles.snippetChipText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.letterInput, idealRoommate.length > 0 ? { borderColor: '#A855F7' } : null]}>
        <TextInput
          style={styles.letterTextInput}
          placeholder="e.g. Someone who's tidy, respectful of quiet hours, and enjoys cooking together occasionally..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={idealRoommate}
          onChangeText={setIdealRoommate}
          maxLength={500}
        />
        <Text style={styles.charCount}>{idealRoommate.length}/500</Text>
      </View>
      <View style={styles.piHint}>
        <Feather name="cpu" size={14} color="#A855F7" />
        <Text style={styles.piHintText}>Pi reads this to find people who actually fit your vibe</Text>
      </View>
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
      if (budgetMin) profileFields.budget_min = budgetMin;
      if (budgetMax) profileFields.budget_max = budgetMax;
      if (sleepSchedule) profileFields.sleep_schedule = sleepSchedule;
      if (cleanliness) profileFields.cleanliness = mapCleanlinessToInt(cleanliness);
      if (noiseTolerance) profileFields.noise_tolerance = mapNoiseToInt(noiseTolerance);
      if (idealRoommate.trim()) profileFields.ideal_roommate_text = idealRoommate.trim();
      if (dealbreakers.length > 0) {
        profileFields.smoking = dealbreakers.includes('smoking') ? 'no' : undefined;
        profileFields.dealbreakers = dealbreakers;
      }
      if (dealbreakers.includes('pets')) profileFields.pets = 'no_pets';
      profileFields.max_roommates = maxRoommates;
      if (genderPreference) profileFields.household_gender_preference = genderPreference;
      const roomTypeVal = roomTypes.join(',') || (listingPref === 'entire_apartment' ? 'apartment' : listingPref === 'room' ? 'private' : undefined);
      if (roomTypeVal) profileFields.room_type = roomTypeVal;

      if (Object.keys(profileFields).length > 0) {
        const cleanFields = Object.fromEntries(
          Object.entries(profileFields).filter(([_, v]) => v !== undefined)
        );
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ user_id: user.id, ...cleanFields }, { onConflict: 'user_id' });
        if (profileError) console.error('Error saving profile preferences:', profileError);
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
      userUpdates.max_roommates = maxRoommates;
      userUpdates.profileData.max_roommates = maxRoommates;
      if (genderPreference) {
        userUpdates.household_gender_preference = genderPreference;
        userUpdates.profileData.household_gender_preference = genderPreference;
      }
      if (idealRoommate.trim()) {
        userUpdates.ideal_roommate_text = idealRoommate.trim();
        userUpdates.profileData.ideal_roommate_text = idealRoommate.trim();
      }
      await updateUser(userUpdates);

      try {
        await supabase.from('user_ai_memory').upsert({
          user_id: user.id,
          dealbreakers: dealbreakers,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (memErr) {
        console.warn('AI memory sync failed:', memErr);
      }
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
      await supabase.from('users').update({ type_onboarding_complete: true }).eq('id', user.id);
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

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderBudgetStep();
      case 2: return renderRoommateCountStep();
      case 3: return renderDealbreakerStep();
      case 4: return renderLifestyleStep();
      case 5: return renderGenderPrefStep();
      case 6: return renderIdealStep();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
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
          ) : step === 5 ? (
            <Pressable onPress={() => { setGenderPreference('any'); setStep(s => s + 1); }} hitSlop={8}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Skip</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(250)} key={step}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIconWrap}>
              <Feather name={STEP_ICONS[step - 1]} size={24} color="#ff6b5b" />
            </View>
            <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>
            <Text style={styles.stepSubtitle}>{STEP_SUBTITLES[step - 1]}</Text>
          </View>
          {renderCurrentStep()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {step > 1 ? (
          <Pressable style={styles.backButton} onPress={() => setStep(s => s - 1)}>
            <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}

        <Pressable
          style={{ borderRadius: 14, overflow: 'hidden', opacity: loading ? 0.6 : 1 }}
          onPress={() => {
            if (step < TOTAL_STEPS) {
              if (step === 5 && !genderPreference) setGenderPreference('any');
              setStep(s => s + 1);
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            } else {
              handleComplete();
            }
          }}
          disabled={loading}
        >
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{step === TOTAL_STEPS ? "Let's Go" : 'Continue'}</Text>
                <Feather name={step === TOTAL_STEPS ? 'check' : 'arrow-right'} size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#ff6b5b',
  },
  sectionLabelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  chipHint: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  selectionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  selectionCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  optionCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    width: '47%',
  },
  optionCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  optionCardSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  scaleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  scaleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scaleDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  dealbreakerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: 10,
    alignSelf: 'center',
  },
  dealbreakerCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 48,
    marginBottom: 24,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepperValueWrap: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepperValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: -4,
    color: 'rgba(255,255,255,0.5)',
  },
  letterInput: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  letterTextInput: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  snippetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  snippetChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  snippetChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  piHint: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  piHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
