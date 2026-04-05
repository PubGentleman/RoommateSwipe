import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { writeTestimonial, getTraitEmoji, canWriteTestimonial } from '../../services/socialProfileService';
import { useAuth } from '../../contexts/AuthContext';

const RELATIONSHIPS = ['Roommate', 'Group Member', 'Matched', 'Co-searcher'];
const RATING_LABELS = ['Terrible', 'Bad', 'OK', 'Good', 'Great'];
const TRAITS = [
  'Clean', 'Respectful', 'Communicative', 'Fun', 'Reliable', 'Quiet',
  'Organized', 'Flexible', 'Friendly', 'Considerate', 'Honest', 'Punctual',
];
const MAX_TRAITS = 5;
const MAX_CONTENT = 500;

export default function WriteTestimonialScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { recipientId, recipientName, recipientPhoto, relationship: preRelationship } = (route.params || {}) as any;

  const [step, setStep] = useState(0);
  const [relationship, setRelationship] = useState(preRelationship || '');
  const [rating, setRating] = useState(0);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (user?.id && recipientId) {
      canWriteTestimonial(user.id, recipientId).then(setEligible).catch(() => setEligible(false));
    }
  }, [user?.id, recipientId]);

  const canProceed = useCallback(() => {
    if (step === 0) return relationship.length > 0;
    if (step === 1) return rating > 0;
    if (step === 2) return selectedTraits.length > 0;
    return true;
  }, [step, relationship, rating, selectedTraits]);

  const handleNext = () => {
    if (step < 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  const toggleTrait = (trait: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedTraits(prev => {
      if (prev.includes(trait)) return prev.filter(t => t !== trait);
      if (prev.length >= MAX_TRAITS) return prev;
      return [...prev, trait];
    });
  };

  const handleSubmit = async () => {
    if (!user?.id || !recipientId || eligible === false) {
      Alert.alert('Not eligible', 'You need to have matched or shared a group with this person to write a testimonial.');
      return;
    }
    setSubmitting(true);
    try {
      await writeTestimonial(
        user.id,
        recipientId,
        content || `${rating}/5 stars`,
        rating,
        relationship.toLowerCase().replace(' ', '_'),
        selectedTraits.map(t => t.toLowerCase())
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSubmitted(true);
      setTimeout(() => navigation.goBack(), 2500);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit testimonial');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successWrap}>
          <Animated.View entering={ZoomIn.duration(400)}>
            <View style={styles.successIcon}>
              <Feather name="check" size={48} color="#22C55E" />
            </View>
          </Animated.View>
          <Text style={styles.successTitle}>Testimonial Submitted!</Text>
          <Text style={styles.successDesc}>
            {recipientName || 'They'} will review your testimonial before it appears on their profile.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Write a Testimonial</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progress}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, i <= step ? styles.dotActive : null]} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>How do you know {recipientName || 'them'}?</Text>
              <View style={styles.pillGrid}>
                {RELATIONSHIPS.map(r => (
                  <Pressable
                    key={r}
                    style={[styles.pill, relationship === r ? styles.pillSelected : null]}
                    onPress={() => { setRelationship(r); Haptics.selectionAsync().catch(() => {}); }}
                  >
                    <Text style={[styles.pillText, relationship === r ? styles.pillTextSelected : null]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : step === 1 ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>Overall, how was your experience?</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Pressable
                    key={i}
                    onPress={() => { setRating(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={styles.starBtn}
                  >
                    <Feather name="star" size={36} color={i <= rating ? '#ff6b5b' : '#333'} />
                  </Pressable>
                ))}
              </View>
              {rating > 0 ? (
                <Text style={styles.ratingLabel}>{RATING_LABELS[rating - 1]}</Text>
              ) : null}
            </Animated.View>
          ) : step === 2 ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>What stands out about {recipientName || 'them'}?</Text>
              <Text style={styles.stepHint}>Select up to {MAX_TRAITS} traits</Text>
              <View style={styles.traitGrid}>
                {TRAITS.map(t => {
                  const sel = selectedTraits.includes(t);
                  return (
                    <Pressable key={t} style={[styles.traitPill, sel ? styles.traitPillSelected : null]} onPress={() => toggleTrait(t)}>
                      <Text style={[styles.traitPillText, sel ? styles.traitPillTextSelected : null]}>
                        {getTraitEmoji(t)} {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>Write a short testimonial (optional)</Text>
              <TextInput
                style={styles.input}
                multiline
                placeholder={`What would you want others to know about living with ${recipientName || 'them'}?`}
                placeholderTextColor="#555"
                value={content}
                onChangeText={t => setContent(t.slice(0, MAX_CONTENT))}
                maxLength={MAX_CONTENT}
              />
              <Text style={styles.charCount}>{content.length}/{MAX_CONTENT}</Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, !canProceed() ? styles.nextBtnDisabled : null]}
          onPress={handleNext}
          disabled={!canProceed() || submitting}
        >
          <Text style={styles.nextBtnText}>
            {submitting ? 'Submitting...' : step === 3 ? 'Submit' : 'Next'}
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#ff6b5b',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingTop: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  stepHint: {
    fontSize: 13,
    color: '#A0A0A0',
    marginBottom: 16,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillSelected: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
  },
  pillText: {
    fontSize: 15,
    color: '#A0A0A0',
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#ff6b5b',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
  },
  starBtn: {
    padding: 6,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6b5b',
    marginTop: 16,
  },
  traitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  traitPillSelected: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
  },
  traitPillText: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '600',
  },
  traitPillTextSelected: {
    color: '#ff6b5b',
  },
  input: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    minHeight: 140,
    textAlignVertical: 'top',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 6,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
  },
  nextBtn: {
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  successWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 20,
  },
});
