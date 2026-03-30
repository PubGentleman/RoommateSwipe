import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile } from '../../services/profileService';
import { joinGroupByCode } from '../../services/preformedGroupService';
import { RhomeLogo } from '../../components/RhomeLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RenterIntent = 'find_roommates' | 'find_place';
type RoommateSubIntent = 'room' | 'entire_apartment';
type PlaceSubIntent = 'solo' | 'with_partner' | 'have_group';

const INTENT_OPTIONS: { id: RenterIntent; icon: string; label: string; description: string; color: string }[] = [
  { id: 'find_roommates', icon: 'users', label: 'Find Roommates', description: 'Match with compatible people to share a place', color: '#ff6b5b' },
  { id: 'find_place', icon: 'home', label: 'Find a Place', description: 'Browse listings for you, a partner, or your group', color: '#4a9eff' },
];

const ROOMMATE_SUB_OPTIONS: { id: RoommateSubIntent; icon: string; label: string; description: string; color: string }[] = [
  { id: 'room', icon: 'user', label: 'A Room', description: 'Find a room in a shared apartment', color: '#2ecc71' },
  { id: 'entire_apartment', icon: 'home', label: 'Entire Apartment', description: 'Find roommates to get a whole place together', color: '#e83a7a' },
];

const PLACE_SUB_OPTIONS: { id: PlaceSubIntent; icon: string; label: string; description: string; color: string }[] = [
  { id: 'solo', icon: 'user', label: 'Just Me', description: 'Looking for my own place', color: '#4a9eff' },
  { id: 'with_partner', icon: 'heart', label: 'Me & Partner', description: 'Moving in with my significant other', color: '#e83a7a' },
  { id: 'have_group', icon: 'users', label: 'My Group', description: 'Already have roommates lined up', color: '#2ecc71' },
];

interface Props {
  onComplete: (action?: 'create_group') => void;
  isSettings?: boolean;
  initialIntent?: RenterIntent;
  initialSubIntent?: string;
  initialListingPref?: string;
}

export default function WhatAreYouLookingForScreen({ onComplete, isSettings, initialIntent, initialSubIntent, initialListingPref }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<'intent' | 'roommate_sub' | 'place_sub' | 'group_prompt'>(initialIntent ? (initialIntent === 'find_roommates' ? 'roommate_sub' : 'place_sub') : 'intent');
  const [intent, setIntent] = useState<RenterIntent | null>(initialIntent || null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateForward = useCallback((cb: () => void) => {
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      cb();
      slideAnim.setValue(SCREEN_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [slideAnim]);

  const animateBack = useCallback((cb: () => void) => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      cb();
      slideAnim.setValue(-SCREEN_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [slideAnim]);

  const [saving, setSaving] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const doSave = async (listingPref: 'room' | 'entire_apartment' | 'any', searchType: 'solo' | 'with_partner' | 'with_roommates' | 'have_group') => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile({
        listing_type_preference: listingPref,
        apartment_search_type: searchType,
      });
      await updateUser({
        profileData: {
          ...user.profileData,
          listing_type_preference: listingPref,
          apartment_search_type: searchType,
        },
      });
      onComplete();
    } catch (_) {
      setSaving(false);
    }
  };

  const saveAndContinue = async (listingPref: 'room' | 'entire_apartment' | 'any', searchType: 'solo' | 'with_partner' | 'with_roommates' | 'have_group') => {
    if (!user || saving) return;
    const currentSearch = user.profileData?.apartment_search_type;
    if (!isSettings || !currentSearch) {
      doSave(listingPref, searchType);
      return;
    }
    const wasMatching = currentSearch === 'with_roommates';
    const willMatch = searchType === 'with_roommates';
    const wasGroup = currentSearch === 'have_group';

    if (wasMatching && !willMatch) {
      Alert.alert(
        'Leave Roommate Matching?',
        'This will remove you from roommate matching and Pi auto-groups. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
          { text: 'Continue', onPress: () => doSave(listingPref, searchType) },
        ],
      );
    } else if (wasGroup) {
      Alert.alert(
        'Leave Your Group?',
        'Changing your search intent will remove you from your current group. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
          { text: 'Continue', onPress: () => doSave(listingPref, searchType) },
        ],
      );
    } else if (!wasMatching && willMatch) {
      Alert.alert(
        'Join Roommate Matching',
        'You\'ll be added to the roommate matching pool. Pi will start looking for your ideal roommates!',
        [{ text: 'Let\'s Go', onPress: () => doSave(listingPref, searchType) }],
      );
    } else {
      doSave(listingPref, searchType);
    }
  };

  const handleIntentSelect = (id: RenterIntent) => {
    setSelectedCard(id);
    setIntent(id);
    setTimeout(() => {
      setSelectedCard(null);
      if (id === 'find_roommates') {
        animateForward(() => setStep('roommate_sub'));
      } else {
        animateForward(() => setStep('place_sub'));
      }
    }, 150);
  };

  const handleRoommateSubSelect = (id: RoommateSubIntent) => {
    setSelectedCard(id);
    setTimeout(() => {
      setSelectedCard(null);
      const listingPref = id;
      saveAndContinue(listingPref, 'with_roommates');
    }, 150);
  };

  const handlePlaceSubSelect = (id: PlaceSubIntent) => {
    setSelectedCard(id);
    setTimeout(async () => {
      setSelectedCard(null);
      const listingPref = id === 'have_group' ? 'any' as const : 'entire_apartment' as const;
      if (id === 'have_group' && !isSettings) {
        setSaving(true);
        try {
          await updateProfile({
            listing_type_preference: listingPref,
            apartment_search_type: id,
          });
          await updateUser({
            profileData: {
              ...user?.profileData,
              listing_type_preference: listingPref,
              apartment_search_type: id,
            },
          });
          setSaving(false);
          animateForward(() => setStep('group_prompt'));
        } catch (_) {
          setSaving(false);
        }
      } else {
        saveAndContinue(listingPref, id);
      }
    }, 150);
  };

  const handleBack = () => {
    if (step === 'intent') return;
    if (step === 'group_prompt') {
      animateBack(() => setStep('place_sub'));
      return;
    }
    animateBack(() => setStep('intent'));
  };

  const renderCards = <T extends string>(
    options: { id: T; icon: string; label: string; description: string; color: string }[],
    onSelect: (id: T) => void,
  ) => (
    <View style={styles.typeGrid}>
      {options.map((opt) => {
        const isSelected = selectedCard === opt.id;
        const isCurrent = isSettings && (initialSubIntent === opt.id || initialListingPref === opt.id);
        return (
          <Pressable
            key={opt.id}
            style={[
              styles.typeCard,
              isCurrent ? { borderColor: opt.color, borderWidth: 2, backgroundColor: `${opt.color}10` } : null,
              isSelected ? { borderColor: opt.color, backgroundColor: `${opt.color}15` } : null,
            ]}
            onPress={() => onSelect(opt.id)}
          >
            <View style={[styles.typeIconWrap, { backgroundColor: `${opt.color}20` }]}>
              <Feather name={opt.icon} size={22} color={opt.color} />
            </View>
            <Text style={styles.typeLabel}>{opt.label}</Text>
            <Text style={styles.typeDesc}>{opt.description}</Text>
            {isCurrent ? <Text style={[styles.typeDesc, { color: opt.color, fontWeight: '600', marginTop: 2 }]}>Current</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );

  const STEP_CONFIG: Record<string, { headline: string; subheadline: string }> = {
    intent: { headline: 'What are you looking for?', subheadline: 'This personalizes your Rhome experience' },
    roommate_sub: { headline: 'What kind of place?', subheadline: 'Help us find the right match' },
    place_sub: { headline: "Who's moving in?", subheadline: 'This helps us show the right listings' },
    group_prompt: { headline: 'Set up your group', subheadline: 'Create a group so you can search together' },
  };

  const config = STEP_CONFIG[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.stepHeader}>
          {step !== 'intent' || isSettings ? (
            <Pressable onPress={isSettings && step === 'intent' ? onComplete : handleBack} style={styles.backBtn} hitSlop={12}>
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ) : (
            <RhomeLogo variant="horizontal" size="sm" />
          )}
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.headline}>{config.headline}</Text>
          <Text style={styles.subheadline}>{config.subheadline}</Text>
          {step === 'intent' ? renderCards(INTENT_OPTIONS, handleIntentSelect) : null}
          {step === 'roommate_sub' ? renderCards(ROOMMATE_SUB_OPTIONS, handleRoommateSubSelect) : null}
          {step === 'place_sub' ? renderCards(PLACE_SUB_OPTIONS, handlePlaceSubSelect) : null}
          {step === 'group_prompt' ? (
            <View style={styles.groupPromptWrap}>
              <View style={[styles.typeIconWrap, { backgroundColor: 'rgba(46,204,113,0.15)', alignSelf: 'center', marginBottom: 16 }]}>
                <Feather name="users" size={28} color="#2ecc71" />
              </View>
              <Pressable
                style={styles.groupPromptBtn}
                onPress={() => onComplete('create_group')}
              >
                <Feather name="plus-circle" size={18} color="#FFFFFF" />
                <Text style={styles.groupPromptBtnText}>Create Group Now</Text>
              </Pressable>
              {showJoinInput ? (
                <View style={styles.joinInputWrap}>
                  <TextInput
                    style={styles.joinInput}
                    placeholder="Enter invite code"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="characters"
                    maxLength={7}
                  />
                  <Pressable
                    style={[styles.joinSubmitBtn, !inviteCode.trim() ? { opacity: 0.5 } : null]}
                    disabled={!inviteCode.trim() || saving}
                    onPress={async () => {
                      if (!inviteCode.trim() || !user) return;
                      setSaving(true);
                      const result = await joinGroupByCode(inviteCode.trim(), user.profileData?.full_name || 'Member');
                      setSaving(false);
                      if (result.success) {
                        await updateUser({
                          profileData: {
                            ...user.profileData,
                            listing_type_preference: 'any',
                            apartment_search_type: 'have_group',
                          },
                        });
                        onComplete();
                      } else {
                        Alert.alert('Invalid Code', 'No active group found with that invite code. Check the code and try again.');
                      }
                    }}
                  >
                    <Text style={styles.joinSubmitText}>Join</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.joinExistingBtn}
                  onPress={() => setShowJoinInput(true)}
                >
                  <Feather name="log-out" size={16} color="#4a9eff" />
                  <Text style={styles.joinExistingText}>Join Existing Group</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.groupPromptSkip}
                onPress={() => onComplete()}
              >
                <Text style={styles.groupPromptSkipText}>Skip for now</Text>
              </Pressable>
            </View>
          ) : null}
          {saving ? (
            <View style={styles.savingOverlay}>
              <ActivityIndicator color="#ff6b5b" size="small" />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepHeader: {
    height: 44,
    justifyContent: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  typeCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 16,
  },
  groupPromptWrap: {
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  groupPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2ecc71',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    width: '100%',
    justifyContent: 'center',
  },
  groupPromptBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  joinExistingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  joinExistingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a9eff',
  },
  joinInputWrap: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  joinSubmitBtn: {
    backgroundColor: '#4a9eff',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  groupPromptSkip: {
    paddingVertical: 12,
  },
  groupPromptSkipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 18,
  },
});
