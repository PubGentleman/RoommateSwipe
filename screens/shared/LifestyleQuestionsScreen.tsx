import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const ACCENT = '#ff6b5b';

interface QuestionOption {
  id: string;
  icon: string;
  label: string;
}

interface QuestionGroup {
  key: string;
  title: string;
  icon: string;
  options: QuestionOption[];
}

const QUESTIONS: QuestionGroup[] = [
  {
    key: 'sleepSchedule',
    title: 'Sleep schedule',
    icon: 'moon',
    options: [
      { id: 'early_sleeper', icon: 'sunrise', label: 'Early Bird (before 10pm)' },
      { id: 'late_sleeper', icon: 'moon', label: 'Night Owl (after midnight)' },
      { id: 'flexible', icon: 'clock', label: 'Flexible' },
    ],
  },
  {
    key: 'cleanliness',
    title: 'Cleanliness',
    icon: 'droplet',
    options: [
      { id: 'very_tidy', icon: 'star', label: 'Very Clean' },
      { id: 'moderately_tidy', icon: 'smile', label: 'Pretty Tidy' },
      { id: 'relaxed', icon: 'coffee', label: 'Relaxed' },
    ],
  },
  {
    key: 'noiseTolerance',
    title: 'Noise level',
    icon: 'volume-2',
    options: [
      { id: 'prefer_quiet', icon: 'volume-x', label: 'Quiet' },
      { id: 'normal_noise', icon: 'music', label: 'Some Music / TV' },
      { id: 'loud_environments', icon: 'speaker', label: 'Lively' },
    ],
  },
  {
    key: 'guestPolicy',
    title: 'Guests',
    icon: 'users',
    options: [
      { id: 'prefer_no_guests', icon: 'x-circle', label: 'No Guests' },
      { id: 'occasionally', icon: 'user', label: 'Occasionally' },
      { id: 'frequently', icon: 'home', label: 'Guests Welcome' },
    ],
  },
];

export const LifestyleQuestionsScreen = () => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const prefs = user?.profileData?.preferences || {};
  const [answers, setAnswers] = useState<Record<string, string>>({
    sleepSchedule: prefs.sleepSchedule || '',
    cleanliness: prefs.cleanliness || '',
    noiseTolerance: prefs.noiseTolerance || '',
    guestPolicy: prefs.guestPolicy || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSelect = (questionKey: string, optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => ({
      ...prev,
      [questionKey]: prev[questionKey] === optionId ? '' : optionId,
    }));
  };

  const answeredCount = Object.values(answers).filter(Boolean).length;
  const allAnswered = answeredCount === QUESTIONS.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        profileData: {
          ...user?.profileData,
          preferences: {
            ...user?.profileData?.preferences,
            sleepSchedule: answers.sleepSchedule || undefined,
            cleanliness: answers.cleanliness || undefined,
            noiseTolerance: answers.noiseTolerance || undefined,
            guestPolicy: answers.guestPolicy || undefined,
          },
        },
      });
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.headerTitle}>Lifestyle preferences</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>
        These help us match you with compatible roommates
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {QUESTIONS.map((q) => (
          <View key={q.key} style={styles.questionSection}>
            <View style={styles.questionHeader}>
              <Feather name={q.icon as any} size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.questionTitle}>{q.title}</Text>
            </View>
            <View style={styles.optionRow}>
              {q.options.map((opt) => {
                const isSelected = answers[q.key] === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.optionCard, isSelected ? styles.optionCardSelected : null]}
                    onPress={() => handleSelect(q.key, opt.id)}
                  >
                    <View style={[styles.optionIconWrap, isSelected ? styles.optionIconWrapSelected : null]}>
                      <Feather name={opt.icon as any} size={20} color={isSelected ? '#fff' : 'rgba(255,255,255,0.4)'} />
                    </View>
                    <Text style={[styles.optionLabel, isSelected ? styles.optionLabelSelected : null]} numberOfLines={2}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.progressText}>
          {answeredCount} of {QUESTIONS.length} answered
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || answeredCount === 0}
          style={{ opacity: (saving || answeredCount === 0) ? 0.4 : 1 }}
        >
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : allAnswered ? 'Save' : 'Save what you have'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
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
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  questionSection: {
    marginBottom: 28,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: ACCENT,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWrapSelected: {
    backgroundColor: 'rgba(255,107,91,0.3)',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 15,
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 10,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
