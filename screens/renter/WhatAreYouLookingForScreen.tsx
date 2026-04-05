import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { RhomeLogo } from '../../components/RhomeLogo';

type SearchType = 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | 'entire_apartment';
type ListingPref = 'room' | 'entire_apartment' | 'any';

const PATHS = [
  {
    id: 'roommates',
    label: 'Roommates',
    icon: 'users' as const,
    color: '#ff6b5b',
    description: 'Find compatible people to share a place with',
    searchType: 'with_roommates' as SearchType,
    listingPref: 'room' as ListingPref,
  },
  {
    id: 'entire_apartment',
    label: 'Entire Apartment',
    icon: 'home' as const,
    color: '#4a9eff',
    description: 'Get a whole apartment for yourself or your group',
    searchType: 'entire_apartment' as SearchType,
    listingPref: 'entire_apartment' as ListingPref,
  },
];

interface Props {
  onComplete: (action?: 'create_group' | 'find_roommates' | 'browse_listings') => void;
  isSettings?: boolean;
  initialIntent?: string;
  initialSubIntent?: string;
  initialListingPref?: string;
}

export default function WhatAreYouLookingForScreen({ onComplete, isSettings, initialIntent, initialSubIntent }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (isSettings) {
      const currentSearch = user?.profileData?.apartment_search_type;
      if (currentSearch === 'with_roommates') {
        setSelectedPath('roommates');
      } else if (currentSearch) {
        setSelectedPath('entire_apartment');
      }
    }
  }, []);

  const doSave = async (path: typeof PATHS[0]) => {
    if (!user) return;
    setSaving(true);

    const updates = {
      apartment_search_type: path.searchType,
      listing_type_preference: path.listingPref,
    };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      console.warn('[Intent] Users table update failed, retrying once:', err);
      try {
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
        if (error) throw error;
      } catch (retryErr) {
        console.warn('[Intent] Users table update retry also failed:', retryErr);
      }
    }

    try {
      await AsyncStorage.setItem('@rhome/renter_intent', JSON.stringify(updates));

      updateUser({
        profileData: {
          ...user.profileData,
          apartment_search_type: path.searchType,
          listing_type_preference: path.listingPref,
        },
      });

      onComplete(path.searchType === 'with_roommates' ? 'find_roommates' : 'browse_listings');
    } catch (err) {
      console.error('[Intent] Save failed:', err);
      setConfirmAction({
        title: 'Something went wrong',
        message: 'Could not save your preference. Please try again.',
        onConfirm: () => setConfirmAction(null),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = async (path: typeof PATHS[0]) => {
    if (saving) return;
    setSelectedPath(path.id);

    const currentSearch = user?.profileData?.apartment_search_type;

    if (isSettings && currentSearch && currentSearch !== path.searchType) {
      const wasMatching = currentSearch === 'with_roommates';
      const willMatch = path.searchType === 'with_roommates';
      const wasGroup = currentSearch === 'have_group';

      if (wasMatching && !willMatch) {
        setConfirmAction({
          title: 'Leave Roommate Matching?',
          message: 'This will remove you from roommate matching and Pi auto-groups. Continue?',
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(path);
          },
        });
        setSelectedPath(null);
        return;
      } else if (wasGroup) {
        setConfirmAction({
          title: 'Leave Your Group?',
          message: 'Changing your search intent will remove you from your current group. Continue?',
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(path);
          },
        });
        setSelectedPath(null);
        return;
      } else if (!wasMatching && willMatch) {
        setConfirmAction({
          title: 'Join Roommate Matching',
          message: "You'll be added to the roommate matching pool. Pi will start looking for your ideal roommates!",
          onConfirm: async () => {
            setConfirmAction(null);
            await doSave(path);
          },
        });
        setSelectedPath(null);
        return;
      }
    }

    await doSave(path);
  };

  const currentSearchType = user?.profileData?.apartment_search_type;
  const getCurrentPathId = () => {
    if (!currentSearchType) return null;
    if (currentSearchType === 'with_roommates') return 'roommates';
    return 'entire_apartment';
  };
  const currentPathId = getCurrentPathId();

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

      <View style={styles.content}>
        <Text style={styles.headline}>What are you looking for?</Text>
        <Text style={styles.subheadline}>This personalizes your Rhome experience</Text>

        {PATHS.map((path) => {
          const isSelected = selectedPath === path.id;
          const isCurrent = isSettings && currentPathId === path.id;
          return (
            <Pressable
              key={path.id}
              onPress={() => handleSelect(path)}
              disabled={saving}
              style={({ pressed }) => [
                styles.optionCard,
                isCurrent ? { borderColor: path.color, borderWidth: 2, backgroundColor: `${path.color}10` } : null,
                isSelected ? { borderColor: path.color, backgroundColor: `${path.color}15` } : null,
                { opacity: pressed ? 0.8 : (saving && selectedPath !== path.id ? 0.5 : 1) },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${path.color}20` }]}>
                <Feather name={path.icon} size={24} color={path.color} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.optionLabel}>{path.label}</Text>
                <Text style={styles.optionDesc}>{path.description}</Text>
                {isCurrent ? <Text style={[styles.currentTag, { color: path.color }]}>Current</Text> : null}
              </View>
              {saving && selectedPath === path.id ? (
                <ActivityIndicator size="small" color={path.color} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {confirmAction ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmAction.title}</Text>
            <Text style={styles.confirmMessage}>{confirmAction.message}</Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => { setConfirmAction(null); setSelectedPath(null); }}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  currentTag: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
