import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from './VectorIcons';
import { useTheme } from '../hooks/useTheme';
import * as Haptics from 'expo-haptics';
import type { RefinementQuestion } from '../utils/refinementQuestions';

interface Props {
  question: RefinementQuestion;
  onAnswer: (questionId: string, value: string) => void;
  onSkip: () => void;
}

export function AIQuestionCard({ question, onAnswer, onSkip }: Props) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  async function handleAnswer(value: string) {
    if (answered) return;
    setSelected(value);
    setAnswered(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setTimeout(() => {
      onAnswer(question.id, value);
    }, 600);
  }

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#ff6b5bCC', '#ff6b5b44']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerRow}>
          <View style={styles.aiLabel}>
            <Feather name="cpu" size={14} color="#fff" />
            <Text style={styles.aiLabelText}>Rhome AI</Text>
          </View>
          {!answered ? (
            <TouchableOpacity onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.questionText}>{question.aiMessage}</Text>
      </LinearGradient>

      <View style={styles.optionsContainer}>
        {question.options.map((opt) => {
          const isSelected = selected === opt.value;
          const isOther = answered && !isSelected;

          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => handleAnswer(opt.value)}
              disabled={answered}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? 'rgba(255,107,91,0.2)' : '#1a1a1a',
                  borderColor: isSelected ? '#ff6b5b' : 'rgba(255,255,255,0.1)',
                  opacity: isOther ? 0.4 : 1,
                },
              ]}
              activeOpacity={0.75}
            >
              <Feather name={opt.icon as any} size={18} color={isSelected ? '#ff6b5b' : 'rgba(255,255,255,0.6)'} />
              <Text style={[
                styles.optionLabel,
                { color: isSelected ? '#ff6b5b' : '#fff', fontWeight: isSelected ? '700' : '500' }
              ]}>
                {opt.label}
              </Text>
              {isSelected ? (
                <Feather name="check-circle" size={18} color="#ff6b5b" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.followUp}>
          <Feather name="check-circle" size={16} color="#ff6b5b" />
          <Text style={styles.followUpText}>
            {question.followUpMessage}
          </Text>
        </View>
      ) : null}

      {!answered ? (
        <Text style={styles.hint}>
          Swipe left to skip — Your answer improves your matches
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#141414',
  },
  gradientHeader: {
    padding: 20,
    paddingBottom: 24,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  aiLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  questionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsContainer: {
    padding: 16,
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center' as const,
  },
  optionLabel: {
    fontSize: 14,
    flex: 1,
  },
  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  followUpText: {
    fontSize: 13,
    flex: 1,
    color: 'rgba(255,255,255,0.5)',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    paddingBottom: 14,
    paddingTop: 4,
    color: 'rgba(255,255,255,0.4)',
  },
});
