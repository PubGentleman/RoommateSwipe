import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../../components/VectorIcons';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { supabase } from '../../../lib/supabase';
import { BOROUGH_NEIGHBORHOODS } from '../../../constants/transitData';
import { getRenterPreferenceAmenities } from '../../../constants/amenities';
import OnboardingHeader from '../../../components/OnboardingHeader';
import { PricePickerPair } from '../../../components/PricePicker';

const TOTAL_STEPS = 3;

const ROOM_TYPES: { id: string; icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
  { id: 'private', icon: 'lock', label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users', label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home', label: 'Full Apartment', desc: 'An entire place to yourself' },
];

const NICE_TO_HAVE_ITEMS: { id: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'natural_light', label: 'Natural Light', icon: 'sun' },
  { id: 'high_ceilings', label: 'High Ceilings', icon: 'arrow-up' },
  { id: 'rooftop', label: 'Rooftop', icon: 'layers' },
  { id: 'gym', label: 'Gym', icon: 'zap' },
  { id: 'pool', label: 'Pool', icon: 'droplet' },
  { id: 'doorman', label: 'Doorman', icon: 'shield' },
  { id: 'coworking_space', label: 'Co-Working', icon: 'monitor' },
  { id: 'ev_charging', label: 'EV Charging', icon: 'battery-charging' },
];

const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1 BR' },
  { value: 2, label: '2 BR' },
  { value: 3, label: '3 BR' },
  { value: 4, label: '4+' },
];

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'ASAP', icon: 'zap' as const },
  { value: '1_month', label: 'Within 1 month', icon: 'calendar' as const },
  { value: '2_months', label: '1-2 months', icon: 'calendar' as const },
  { value: '3_months', label: '2-3 months', icon: 'calendar' as const },
  { value: 'flexible', label: 'Flexible', icon: 'clock' as const },
];

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabelText}>{text}</Text>
    </View>
  );
}

function SelectionCard({
  icon, label, subtitle, selected, onPress, accentColor = '#ff6b5b',
}: {
  icon: keyof typeof Feather.glyphMap; label: string; subtitle?: string; selected: boolean; onPress: () => void; accentColor?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.selectionCard, selected ? { borderColor: accentColor, backgroundColor: accentColor + '12' } : null]}>
      <View style={[styles.selectionCardIcon, { backgroundColor: accentColor + '15' }]}>
        <Feather name={icon} size={20} color={selected ? accentColor : 'rgba(255,255,255,0.5)'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectionCardLabel, selected ? { color: accentColor } : null]}>{label}</Text>
        {subtitle ? <Text style={styles.selectionCardSubtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? <Feather name="check-circle" size={18} color={accentColor} /> : null}
    </Pressable>
  );
}

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
  const [budgetMin, setBudgetMin] = useState<number>(1000);
  const [budgetMax, setBudgetMax] = useState<number>(2500);
  const listingPref = user?.profileData?.listing_type_preference;
  const roomTypeKnown = listingPref === 'entire_apartment' || listingPref === 'room';
  const [roomTypes, setRoomTypes] = useState<string[]>(
    listingPref === 'entire_apartment' ? ['apartment'] :
    listingPref === 'room' ? ['private'] : []
  );
  const [loading, setLoading] = useState(false);
  const [expandedBoroughs, setExpandedBoroughs] = useState<string[]>([]);

  useEffect(() => {
    if (roomTypeKnown && roomTypes.length === 0) {
      setRoomTypes(listingPref === 'entire_apartment' ? ['apartment'] : ['private']);
    }
  }, [listingPref]);

  const toggleBorough = (borough: string) => {
    setExpandedBoroughs(prev =>
      prev.includes(borough) ? prev.filter(b => b !== borough) : [...prev, borough]
    );
  };

  const boroughEntries = Object.entries(BOROUGH_NEIGHBORHOODS);
  const hasBoroughs = boroughEntries.length > 0;

  const toggleNeighborhood = (id: string) => {
    setSelectedNeighborhoods(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : prev.length < 5 ? [...prev, id] : prev
    );
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleRoomType = (id: string) => {
    setRoomTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleNiceToHave = (id: string) => {
    setNiceToHaves(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const STEP_TITLES = [
    'Budget & Neighborhoods',
    'What are you looking for?',
    'Almost done!',
  ];

  const STEP_SUBTITLES = [
    'Set your range and pick where you want to live',
    'Bedrooms and must-have amenities',
    'Timeline and nice-to-haves',
  ];

  const STEP_ICONS: (keyof typeof Feather.glyphMap)[] = [
    'dollar-sign', 'search', 'check-circle',
  ];

  const renderBudgetAndNeighborhoodsStep = () => (
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
              />
            ))}
          </View>
        </>
      ) : null}

      {hasBoroughs ? (
        <>
          <View style={{ height: 20 }} />
          <SectionLabel text="Neighborhoods" />
          <Text style={styles.sectionHint}>Pick up to 5 \u2014 we'll prioritize listings in these areas</Text>

          {selectedNeighborhoods.length > 0 ? (
            <View style={styles.selectedChipsRow}>
              {selectedNeighborhoods.map(hood => (
                <View key={hood} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{hood}</Text>
                  <Pressable onPress={() => setSelectedNeighborhoods(prev => prev.filter(n => n !== hood))} hitSlop={8}>
                    <Feather name="x" size={12} color="#ff6b5b" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {boroughEntries.map(([borough, hoods]) => {
            const isExpanded = expandedBoroughs.includes(borough);
            const selectedCount = hoods.filter(h => selectedNeighborhoods.includes(h)).length;
            return (
              <View key={borough} style={styles.boroughSection}>
                <Pressable style={styles.boroughHeader} onPress={() => toggleBorough(borough)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.boroughLabel}>{borough}</Text>
                    {selectedCount > 0 ? (
                      <View style={styles.boroughBadge}>
                        <Text style={styles.boroughBadgeText}>{selectedCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
                </Pressable>
                {isExpanded ? (
                  <View style={styles.boroughChips}>
                    {hoods.map(hood => {
                      const isActive = selectedNeighborhoods.includes(hood);
                      const disabled = !isActive && selectedNeighborhoods.length >= 5;
                      return (
                        <Pressable
                          key={hood}
                          disabled={disabled}
                          onPress={() => toggleNeighborhood(hood)}
                          style={[styles.hoodChip, isActive ? styles.hoodChipActive : null, disabled ? { opacity: 0.3 } : null]}
                        >
                          <Text style={{ fontSize: 12, color: isActive ? '#ff6b5b' : '#ccc' }}>{hood}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text style={styles.chipHint}>{selectedNeighborhoods.length}/5 selected</Text>
        </>
      ) : null}
    </View>
  );

  const renderStep2 = () => {
    const amenities = getRenterPreferenceAmenities();
    return (
      <View>
        <SectionLabel text="Bedrooms" />
        <View style={styles.bedroomRow}>
          {BEDROOM_OPTIONS.map(option => {
            const isActive = bedrooms === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.bedroomChip, isActive ? { borderColor: '#ff6b5b', backgroundColor: 'rgba(255,107,91,0.12)' } : null]}
                onPress={() => { setBedrooms(option.value); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              >
                <Text style={[styles.bedroomChipText, isActive ? { color: '#ff6b5b' } : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 20 }} />
        <SectionLabel text="Must-haves" />
        <Text style={styles.sectionHint}>What can't you live without?</Text>
        <View style={styles.chipsWrap}>
          {amenities.map(amenity => {
            const isSelected = selectedAmenities.includes(amenity.id);
            return (
              <Pressable
                key={amenity.id}
                style={[styles.amenityChip, isSelected ? { borderColor: '#ff6b5b', backgroundColor: 'rgba(255,107,91,0.12)' } : null]}
                onPress={() => toggleAmenity(amenity.id)}
              >
                <Feather name={amenity.icon as any} size={14} color={isSelected ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
                <Text style={[styles.amenityChipText, isSelected ? { color: '#fff' } : null]}>{amenity.label}</Text>
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
        <SectionLabel text="When do you need to move?" />
        <View style={{ gap: 8 }}>
          {TIMELINE_OPTIONS.map(option => {
            const isActive = moveInDate === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => { setMoveInDate(option.value); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
                style={[styles.timelineCard, isActive ? styles.timelineCardActive : null]}
              >
                <View style={[styles.timelineIcon, isActive ? { backgroundColor: 'rgba(255,107,91,0.15)' } : null]}>
                  <Feather name={option.icon} size={16} color={isActive ? '#ff6b5b' : 'rgba(255,255,255,0.4)'} />
                </View>
                <Text style={[styles.timelineLabel, isActive ? { color: '#ff6b5b' } : null]}>{option.label}</Text>
                {isActive ? <Feather name="check" size={16} color="#ff6b5b" /> : null}
              </Pressable>
            );
          })}
        </View>

        {filteredNiceToHaves.length > 0 ? (
          <>
            <View style={{ height: 20 }} />
            <SectionLabel text="Nice to have" />
            <Text style={styles.sectionHint}>Optional \u2014 helps us find better matches</Text>
            <View style={styles.chipsWrap}>
              {filteredNiceToHaves.map(item => {
                const isSelected = niceToHaves.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.amenityChip, isSelected ? { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' } : null]}
                    onPress={() => toggleNiceToHave(item.id)}
                  >
                    <Feather name={item.icon} size={14} color={isSelected ? '#3b82f6' : 'rgba(255,255,255,0.5)'} />
                    <Text style={[styles.amenityChipText, isSelected ? { color: '#fff' } : null]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    );
  };

  const convertTimelineToDate = (timeline: string | null): string | null => {
    if (!timeline) return null;
    const now = new Date();
    switch (timeline) {
      case 'asap': return now.toISOString().split('T')[0];
      case '1_month': return new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
      case '2_months': return new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0];
      case '3_months': return new Date(now.getTime() + 90 * 86400000).toISOString().split('T')[0];
      case 'flexible': return null;
      default: return null;
    }
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

      const roomTypeVal = roomTypes.join(',') || (listingPref === 'entire_apartment' ? 'apartment' : listingPref === 'room' ? 'private' : undefined);
      const lookingForVal = roomTypes.includes('apartment') ? 'entire_apartment' : (roomTypes.length > 0 ? 'room' : (listingPref === 'entire_apartment' ? 'entire_apartment' : listingPref === 'room' ? 'room' : undefined));

      await updateUser({
        typeOnboardingComplete: true,
        preferredNeighborhoods: selectedNeighborhoods,
        preferredBedrooms: bedrooms,
        amenityPreferences: selectedAmenities,
        niceToHaveAmenities: niceToHaves,
        moveInTimeline: moveInDate || undefined,
        profileData: {
          ...user.profileData,
          budget: budgetMax,
          budgetMin: budgetMin,
          budgetMax: budgetMax,
          roomType: roomTypeVal,
          lookingFor: lookingForVal,
          preferred_neighborhoods: selectedNeighborhoods,
        },
      });

      try {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          budget_min: budgetMin,
          budget_max: budgetMax,
          preferred_neighborhoods: selectedNeighborhoods,
          desired_bedrooms: bedrooms,
          amenity_must_haves: selectedAmenities,
          room_type: roomTypeVal || null,
          move_in_date: convertTimelineToDate(moveInDate),
        }, { onConflict: 'user_id' });
      } catch (syncErr) {
        console.warn('Profiles sync failed:', syncErr);
      }

      try {
        await supabase.from('user_ai_memory').upsert({
          user_id: user.id,
          budget_stated: budgetMax,
          move_in_timeline: moveInDate || 'flexible',
          must_haves: selectedAmenities,
          preferred_neighborhoods: selectedNeighborhoods,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (memErr) {
        console.warn('AI memory sync failed:', memErr);
      }
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
      case 1: return renderBudgetAndNeighborhoodsStep();
      case 2: return renderStep2();
      case 3: return renderStep3();
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
            style={styles.nextBtn}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step === TOTAL_STEPS ? "Let's Go" : 'Continue'}</Text>
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
  sectionHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  chipHint: {
    fontSize: 12,
    marginTop: 12,
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
  selectedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ff6b5b',
    gap: 6,
  },
  selectedChipText: {
    fontSize: 12,
    color: '#ff6b5b',
  },
  boroughSection: {
    marginBottom: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  boroughHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  boroughLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  boroughBadge: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  boroughBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  boroughChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  hoodChip: {
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  hoodChipActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
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
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  bedroomChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  amenityChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  timelineCardActive: {
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
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
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
