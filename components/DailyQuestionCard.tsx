import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Feather } from './VectorIcons';
import { useTheme } from '../hooks/useTheme';
import { getDailyQuestion, answerDailyQuestion } from '../utils/aiService';
import type { DailyQuestion } from '../types/models';
import * as Haptics from 'expo-haptics';

interface Props {
  onAnswered?: () => void;
}

export function DailyQuestionCard({ onAnswered }: Props) {
  const { theme } = useTheme();
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    loadQuestion();
  }, []);

  useEffect(() => {
    if (question) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [question]);

  async function loadQuestion() {
    setLoading(true);
    const q = await getDailyQuestion();
    setQuestion(q);
    if (q?.selected_value) {
      setSelected(q.selected_value);
      setAnswered(true);
    }
    setLoading(false);
  }

  async function handleAnswer(value: string) {
    if (answered || submitting || !question) return;
    setSelected(value);
    setSubmitting(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const success = await answerDailyQuestion(question.id, value);
    if (success) {
      setAnswered(true);
      onAnswered?.();
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <View style={{
        backgroundColor: '#1c1c1c',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 16,
      }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 13 }}>
          Generating your question...
        </Text>
      </View>
    );
  }

  if (!question) return null;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      backgroundColor: '#1c1c1c',
      borderRadius: 20,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{
          backgroundColor: theme.primary + '20',
          borderRadius: 8,
          padding: 6,
        }}>
          <Feather name="zap" size={16} color={theme.primary} />
        </View>
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>
          QUESTION OF THE DAY
        </Text>
        {answered ? (
          <View style={{ marginLeft: 'auto' }}>
            <Feather name="check-circle" size={18} color="#22c55e" />
          </View>
        ) : null}
      </View>

      <Text style={{
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
        lineHeight: 24,
        marginBottom: 16,
      }}>
        {question.question_text}
      </Text>

      <View style={{ gap: 10 }}>
        {question.options.map((option) => {
          const isSelected = selected === option.value;
          const isOther = answered && selected !== option.value;

          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleAnswer(option.value)}
              disabled={answered}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                backgroundColor: isSelected
                  ? theme.primary + '20'
                  : '#141414',
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isSelected ? theme.primary : 'rgba(255,255,255,0.1)',
                opacity: isOther ? 0.45 : 1,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 22 }}>{option.emoji}</Text>
              <Text style={{
                flex: 1,
                fontSize: 14,
                fontWeight: isSelected ? '700' : '500',
                color: isSelected ? theme.primary : '#fff',
              }}>
                {option.label}
              </Text>
              {isSelected ? (
                <Feather name="check-circle" size={20} color={theme.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {answered ? (
        <Text style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 12,
          textAlign: 'center',
          marginTop: 12,
        }}>
          Answer saved — your matches just got smarter
        </Text>
      ) : null}
    </Animated.View>
  );
}
