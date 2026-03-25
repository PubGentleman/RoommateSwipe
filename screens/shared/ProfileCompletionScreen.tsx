import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Text, TextInput, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { getCompletionPercentage } from '../../utils/profileReminderUtils';
import { OccupationBarSelector } from '../../components/OccupationBarSelector';
import { INTEREST_TAGS } from '../../constants/interestTags';

const ACCENT = '#ff6b5b';
const BG = '#111111';
const CARD_BG = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.08)';
const BIO_MAX = 150;

const LIFESTYLE_OPTIONS = [
  { id: 'early_bird', label: 'Early Bird', icon: 'sunrise' },
  { id: 'night_owl', label: 'Night Owl', icon: 'moon' },
  { id: 'quiet', label: 'Quiet', icon: 'volume-x' },
  { id: 'social', label: 'Social', icon: 'users' },
  { id: 'pet_friendly', label: 'Pet-Friendly', icon: 'heart' },
  { id: 'no_pets', label: 'No Pets', icon: 'x-circle' },
  { id: 'non_smoker', label: 'Non-Smoker', icon: 'wind' },
  { id: 'clean_freak', label: 'Clean Freak', icon: 'check-circle' },
  { id: 'relaxed', label: 'Relaxed', icon: 'coffee' },
  { id: 'fitness', label: 'Fitness', icon: 'activity' },
  { id: 'remote_work', label: 'Remote Work', icon: 'monitor' },
  { id: 'student', label: 'Student', icon: 'book' },
];

const BUDGET_PRESETS = [
  { label: '$500–$800', min: 500, max: 800 },
  { label: '$800–$1,200', min: 800, max: 1200 },
  { label: '$1,200–$1,800', min: 1200, max: 1800 },
  { label: '$1,800–$2,500', min: 1800, max: 2500 },
  { label: '$2,500–$3,500', min: 2500, max: 3500 },
  { label: '$3,500+', min: 3500, max: 5000 },
];

const FLAT_INTEREST_TAGS = Object.values(INTEREST_TAGS).flatMap(cat =>
  cat.tags.map(t => ({ ...t, category: cat.label }))
);

interface SectionHeaderProps {
  icon: string;
  title: string;
  complete: boolean;
}

const SectionHeader = ({ icon, title, complete }: SectionHeaderProps) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionIcon, complete ? styles.sectionIconDone : null]}>
      <Feather name={complete ? 'check' : (icon as any)} size={16} color={complete ? '#22C55E' : 'rgba(255,255,255,0.5)'} />
    </View>
    <Text style={styles.sectionTitle}>{title}</Text>
    {complete ? <Text style={styles.sectionDone}>Done</Text> : null}
  </View>
);

export const ProfileCompletionScreen = () => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const isAgent = user?.hostType === 'agent';

  const [photo, setPhoto] = useState<string | null>(user?.profilePicture || (user?.photos?.length ? user.photos[0] : null));
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [occupation, setOccupation] = useState(user?.profileData?.occupation || (isAgent ? 'Real Estate Agent' : ''));
  const [lifestyleTags, setLifestyleTags] = useState<string[]>(() => {
    const prefs = user?.profileData?.preferences;
    const tags: string[] = [];
    if (prefs?.sleepSchedule === 'early') tags.push('early_bird');
    if (prefs?.sleepSchedule === 'late') tags.push('night_owl');
    if (prefs?.noiseTolerance === 'quiet') tags.push('quiet');
    if (prefs?.noiseTolerance === 'social' || prefs?.guestPolicy === 'anytime') tags.push('social');
    if (prefs?.pets === 'have' || prefs?.pets === 'ok') tags.push('pet_friendly');
    if (prefs?.smoking === 'no') tags.push('non_smoker');
    if (prefs?.cleanliness === 'very_clean') tags.push('clean_freak');
    return tags;
  });
  const [budgetIdx, setBudgetIdx] = useState<number | null>(() => {
    const b = user?.profileData?.budget;
    if (!b) return null;
    const num = parseInt(String(b).replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return null;
    const idx = BUDGET_PRESETS.findIndex(p => num >= p.min && num <= p.max);
    return idx >= 0 ? idx : null;
  });
  const [interestTags, setInterestTags] = useState<string[]>(user?.profileData?.interests || []);
  const [saving, setSaving] = useState(false);

  const photoComplete = !!photo;
  const bioComplete = bio.trim().length >= 20;
  const occupationComplete = isAgent || !!occupation;
  const lifestyleComplete = lifestyleTags.length >= 2;
  const budgetComplete = budgetIdx !== null;
  const interestsComplete = interestTags.length >= 3;

  const sectionsDone = [photoComplete, bioComplete, occupationComplete, lifestyleComplete, budgetComplete, interestsComplete];
  const totalSections = isAgent ? sectionsDone.length - 1 : sectionsDone.length;
  const completedCount = sectionsDone.filter(Boolean).length - (isAgent && occupationComplete ? 0 : 0);
  const progressPct = Math.round((sectionsDone.filter(Boolean).length / sectionsDone.length) * 100);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhoto(result.assets[0].uri);
    }
  };

  const toggleLifestyle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLifestyleTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleInterest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInterestTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sleepSchedule = lifestyleTags.includes('early_bird') ? 'early' : lifestyleTags.includes('night_owl') ? 'late' : 'flexible';
      const cleanliness = lifestyleTags.includes('clean_freak') ? 'very_clean' : lifestyleTags.includes('relaxed') ? 'relaxed' : 'average';
      const noiseTolerance = lifestyleTags.includes('quiet') ? 'quiet' : lifestyleTags.includes('social') ? 'social' : 'moderate';
      const guestPolicy = lifestyleTags.includes('social') ? 'anytime' : 'sometimes';
      const pets = lifestyleTags.includes('pet_friendly') ? 'ok' : lifestyleTags.includes('no_pets') ? 'no' : undefined;
      const smoking = lifestyleTags.includes('non_smoker') ? 'no' : undefined;

      const budgetStr = budgetIdx !== null && budgetIdx >= 0 && budgetIdx < BUDGET_PRESETS.length
        ? BUDGET_PRESETS[budgetIdx].label
        : (user?.profileData?.budget || undefined);

      const updates: any = {
        profilePicture: photo || user?.profilePicture,
        photos: photo ? [photo, ...(user?.photos || []).filter((p: string) => p !== photo)] : user?.photos,
        profileData: {
          ...user?.profileData,
          bio: bio.trim(),
          occupation: isAgent ? 'Real Estate Agent' : occupation,
          budget: budgetStr,
          interests: interestTags,
          preferences: {
            ...user?.profileData?.preferences,
            sleepSchedule,
            cleanliness,
            noiseTolerance,
            guestPolicy,
            ...(pets ? { pets } : {}),
            ...(smoking ? { smoking } : {}),
          },
        },
      };
      await updateUser(updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert('Failed to save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.headerTitle}>Complete your profile</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.progressPct}>{progressPct}%</Text>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[ACCENT, '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.max(progressPct, 3)}%` }]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader icon="camera" title="Profile photo" complete={photoComplete} />
        <Pressable style={styles.photoRow} onPress={handlePickPhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photoPreview} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Feather name="camera" size={28} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View style={styles.photoInfo}>
            <Text style={styles.photoLabel}>{photo ? 'Change photo' : 'Add a photo'}</Text>
            <Text style={styles.photoHint}>Profiles with photos get 8x more matches</Text>
          </View>
          <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
        </Pressable>

        <SectionHeader icon="edit-2" title="Bio" complete={bioComplete} />
        <View style={styles.inputCard}>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
            placeholder="Tell people about yourself..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            maxLength={BIO_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/{BIO_MAX}</Text>
        </View>

        {!isAgent ? (
          <>
            <SectionHeader icon="briefcase" title="Occupation" complete={!!occupation} />
            <OccupationBarSelector selectedOccupation={occupation} onChange={setOccupation} />
          </>
        ) : null}

        <SectionHeader icon="sun" title="Lifestyle preferences" complete={lifestyleComplete} />
        <Text style={styles.tagHint}>Select at least 2</Text>
        <View style={styles.tagGrid}>
          {LIFESTYLE_OPTIONS.map(opt => {
            const selected = lifestyleTags.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                style={[styles.tag, selected ? styles.tagSelected : null]}
                onPress={() => toggleLifestyle(opt.id)}
              >
                <Feather name={opt.icon as any} size={14} color={selected ? ACCENT : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.tagText, selected ? styles.tagTextSelected : null]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader icon="dollar-sign" title="Budget range" complete={budgetComplete} />
        <View style={styles.budgetGrid}>
          {BUDGET_PRESETS.map((preset, i) => {
            const selected = budgetIdx === i;
            return (
              <Pressable
                key={i}
                style={[styles.budgetChip, selected ? styles.budgetChipSelected : null]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBudgetIdx(i);
                }}
              >
                <Text style={[styles.budgetText, selected ? styles.budgetTextSelected : null]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader icon="tag" title="Interest tags" complete={interestsComplete} />
        <Text style={styles.tagHint}>Select at least 3</Text>
        {Object.entries(INTEREST_TAGS).map(([key, category]) => (
          <View key={key} style={styles.tagCategory}>
            <Text style={styles.tagCatLabel}>{category.label}</Text>
            <View style={styles.tagGrid}>
              {category.tags.map(tag => {
                const selected = interestTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.tag, selected ? styles.tagSelected : null]}
                    onPress={() => toggleInterest(tag.id)}
                  >
                    <Text style={[styles.tagText, selected ? styles.tagTextSelected : null]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.saveWrap, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable onPress={handleSave} disabled={saving} style={{ width: '100%', opacity: saving ? 0.5 : 1 }}>
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  progressPct: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
    width: 40,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconDone: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionDone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
  },
  photoInfo: {
    flex: 1,
    gap: 2,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  inputCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  bioInput: {
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 80,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'right',
    marginTop: 4,
  },
  tagHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
    marginLeft: 2,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tagSelected: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderColor: 'rgba(255,107,91,0.3)',
  },
  tagText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  tagTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },
  tagCategory: {
    marginBottom: 16,
  },
  tagCatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  budgetChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  budgetChipSelected: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderColor: 'rgba(255,107,91,0.3)',
  },
  budgetText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  budgetTextSelected: {
    color: ACCENT,
  },
  saveWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
