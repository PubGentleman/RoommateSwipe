import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile } from '../../services/profileService';
import { RhomeLogo } from '../../components/RhomeLogo';

type SearchType = 'solo' | 'with_partner' | 'with_roommates' | 'have_group';
type ListingPref = 'room' | 'entire_apartment' | 'any';

const COMBINED_OPTIONS: {
  id: string;
  searchType: SearchType;
  listingPref: ListingPref;
  icon: string;
  label: string;
  description: string;
  color: string;
  action?: 'create_group';
}[] = [
  {
    id: 'room',
    searchType: 'with_roommates',
    listingPref: 'room',
    icon: 'search',
    label: 'Find a Room',
    description: 'Join a shared apartment with compatible roommates',
    color: '#ff6b5b',
  },
  {
    id: 'roommates_apartment',
    searchType: 'with_roommates',
    listingPref: 'entire_apartment',
    icon: 'users',
    label: 'Get an Apartment Together',
    description: 'Find roommates to rent a whole place with',
    color: '#a855f7',
  },
  {
    id: 'solo',
    searchType: 'solo',
    listingPref: 'any',
    icon: 'user',
    label: 'Just Me',
    description: 'Browse apartments for myself',
    color: '#4a9eff',
  },
  {
    id: 'partner',
    searchType: 'with_partner',
    listingPref: 'any',
    icon: 'heart',
    label: 'Me & Partner',
    description: 'Moving in with my significant other',
    color: '#e83a7a',
  },
  {
    id: 'group',
    searchType: 'have_group',
    listingPref: 'any',
    icon: 'users',
    label: 'With My Group',
    description: 'I already have roommates lined up',
    color: '#22c55e',
    action: 'create_group',
  },
];

interface Props {
  onComplete: (action?: 'create_group') => void;
  isSettings?: boolean;
  initialIntent?: string;
  initialSubIntent?: string;
  initialListingPref?: string;
}

export default function WhatAreYouLookingForScreen({ onComplete, isSettings, initialSubIntent, initialListingPref }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const doSave = async (listingPref: ListingPref, searchType: SearchType) => {
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

  const handleSelect = async (option: typeof COMBINED_OPTIONS[0]) => {
    if (saving) return;
    setSelectedCard(option.id);

    const currentSearch = user?.profileData?.apartment_search_type;

    if (isSettings && currentSearch && currentSearch !== option.searchType) {
      const wasMatching = currentSearch === 'with_roommates';
      const willMatch = option.searchType === 'with_roommates';
      const wasGroup = currentSearch === 'have_group';

      if (wasMatching && !willMatch) {
        setConfirmAction({
          title: 'Leave Roommate Matching?',
          message: 'This will remove you from roommate matching and Pi auto-groups. Continue?',
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(option.listingPref, option.searchType);
            if (option.action === 'create_group') {
              onComplete('create_group');
            } else {
              onComplete();
            }
          },
        });
        setSelectedCard(null);
        return;
      } else if (wasGroup) {
        setConfirmAction({
          title: 'Leave Your Group?',
          message: 'Changing your search intent will remove you from your current group. Continue?',
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(option.listingPref, option.searchType);
            if (option.action === 'create_group') {
              onComplete('create_group');
            } else {
              onComplete();
            }
          },
        });
        setSelectedCard(null);
        return;
      } else if (!wasMatching && willMatch) {
        setConfirmAction({
          title: 'Join Roommate Matching',
          message: "You'll be added to the roommate matching pool. Pi will start looking for your ideal roommates!",
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(option.listingPref, option.searchType);
            if (option.action === 'create_group') {
              onComplete('create_group');
            } else {
              onComplete();
            }
          },
        });
        setSelectedCard(null);
        return;
      }
    }

    await doSave(option.listingPref, option.searchType);
    if (option.action === 'create_group') {
      onComplete('create_group');
    } else {
      onComplete();
    }
  };

  const currentSearchType = user?.profileData?.apartment_search_type;
  const currentListingPref = user?.profileData?.listing_type_preference;

  const getCurrentOptionId = () => {
    if (!currentSearchType) return null;
    return COMBINED_OPTIONS.find(o =>
      o.searchType === currentSearchType &&
      (o.listingPref === currentListingPref || !currentListingPref)
    )?.id ?? null;
  };

  const currentOptionId = getCurrentOptionId();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        {isSettings ? (
          <Pressable onPress={() => onComplete()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : (
          <RhomeLogo variant="horizontal" size="sm" />
        )}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>What are you looking for?</Text>
        <Text style={styles.subheadline}>This personalizes your Rhome experience</Text>
        <View style={styles.optionsGrid}>
          {COMBINED_OPTIONS.map((option) => {
            const isSelected = selectedCard === option.id;
            const isCurrent = isSettings && currentOptionId === option.id;
            return (
              <Pressable
                key={option.id}
                style={[
                  styles.optionCard,
                  isCurrent ? { borderColor: option.color, borderWidth: 2, backgroundColor: `${option.color}10` } : null,
                  isSelected ? { borderColor: option.color, backgroundColor: `${option.color}15` } : null,
                ]}
                onPress={() => handleSelect(option)}
                disabled={saving}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${option.color}20` }]}>
                  <Feather name={option.icon as any} size={22} color={option.color} />
                </View>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
                {isCurrent ? <Text style={[styles.optionDesc, { color: option.color, fontWeight: '600', marginTop: 2 }]}>Current</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {saving ? (
          <View style={styles.savingWrap}>
            <ActivityIndicator color="#ff6b5b" size="small" />
          </View>
        ) : null}
      </ScrollView>
      {confirmAction ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmAction.title}</Text>
            <Text style={styles.confirmMessage}>{confirmAction.message}</Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => { setConfirmAction(null); setSelectedCard(null); }}
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
  header: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 16,
    flex: 1,
  },
  savingWrap: {
    alignItems: 'center',
    marginTop: 20,
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
