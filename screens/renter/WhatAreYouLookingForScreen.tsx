import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Text,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile } from '../../services/profileService';
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
  { id: 'have_group', icon: 'users', label: 'With My Group', description: 'Already have roommates lined up', color: '#2ecc71' },
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
  const [step, setStep] = useState<'intent' | 'roommate_sub' | 'place_sub' | 'group_prompt'>(
    isSettings ? 'intent' : (initialIntent ? (initialIntent === 'find_roommates' ? 'roommate_sub' : 'place_sub') : 'intent')
  );
  const [intent, setIntent] = useState<RenterIntent | null>(initialIntent || null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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

  const doSave = async (listingPref: 'room' | 'entire_apartment' | 'any', searchType: 'solo' | 'with_partner' | 'with_roommates' | 'have_group', skipComplete?: boolean) => {
    if (!user) return;
    setSaving(true);

    updateProfile(user.id, {
      listing_type_preference: listingPref,
      apartment_search_type: searchType,
    }).catch(err => {
      console.warn('Profile update failed during intent selection, will retry during onboarding:', err);
    });

    try {
      await AsyncStorage.setItem('@rhome/renter_intent', JSON.stringify({
        apartment_search_type: searchType,
        listing_type_preference: listingPref,
      }));

      updateUser({
        profileData: {
          ...user.profileData,
          listing_type_preference: listingPref,
          apartment_search_type: searchType,
        },
      }).catch(err => {
        console.warn('User state sync failed (non-blocking):', err);
      });

      setSaving(false);
      if (!skipComplete) onComplete();
    } catch (err) {
      console.error('Failed to save intent:', err);
      setSaving(false);
      setConfirmAction({
        title: 'Something went wrong',
        message: 'Could not save your preference. Please try again.',
        onConfirm: () => setConfirmAction(null),
      });
    }
  };

  const saveAndContinue = async (listingPref: 'room' | 'entire_apartment' | 'any', searchType: 'solo' | 'with_partner' | 'with_roommates' | 'have_group') => {
    if (!user || saving) return;
    const currentSearch = user.profileData?.apartment_search_type;
    if (!isSettings || !currentSearch) {
      doSave(listingPref, searchType);
      return;
    }

    if (currentSearch === searchType) {
      doSave(listingPref, searchType);
      return;
    }

    const wasMatching = currentSearch === 'with_roommates';
    const willMatch = searchType === 'with_roommates';
    const wasGroup = currentSearch === 'have_group';

    if (wasMatching && !willMatch) {
      setConfirmAction({
        title: 'Leave Roommate Matching?',
        message: 'This will remove you from roommate matching and Pi auto-groups. Continue?',
        onConfirm: () => { setConfirmAction(null); doSave(listingPref, searchType); },
      });
    } else if (wasGroup) {
      setConfirmAction({
        title: 'Leave Your Group?',
        message: 'Changing your search intent will remove you from your current group. Continue?',
        onConfirm: () => { setConfirmAction(null); doSave(listingPref, searchType); },
      });
    } else if (!wasMatching && willMatch) {
      setConfirmAction({
        title: 'Join Roommate Matching',
        message: "You'll be added to the roommate matching pool. Pi will start looking for your ideal roommates!",
        onConfirm: () => { setConfirmAction(null); doSave(listingPref, searchType); },
      });
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
        saveAndContinue('room', 'with_roommates');
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
    setTimeout(() => {
      setSelectedCard(null);
      const listingPref = id === 'have_group' ? 'any' as const : 'entire_apartment' as const;
      if (id === 'have_group' && !isSettings) {
        doSave(listingPref, id, true).then(() => {
          animateForward(() => setStep('group_prompt'));
        });
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
      {confirmAction ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmAction.title}</Text>
            <Text style={styles.confirmMessage}>{confirmAction.message}</Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setConfirmAction(null)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmOkBtn}
                onPress={confirmAction.onConfirm}
              >
                <Text style={styles.confirmOkText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  confirmBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: '85%',
    maxWidth: 340,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  confirmOkBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
