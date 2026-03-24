import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { getAIMemory } from '../utils/aiMemory';

interface Props {
  onPress: () => void;
  rightSwipeCount: number;
  totalSwipeCount: number;
}

function generateInsight(rightSwipes: number, totalSwipes: number, memData: any): string | null {
  if (totalSwipes < 3) return null;

  const likeRate = rightSwipes / totalSwipes;

  if (likeRate > 0.8 && totalSwipes >= 5) {
    return "You're swiping right a lot — I can help you narrow down your top picks";
  }
  if (likeRate < 0.15 && totalSwipes >= 8) {
    return "Being selective is smart — let me help you find exactly what you need";
  }
  if (totalSwipes >= 15 && rightSwipes === 0) {
    return "No matches yet? Let me help adjust what you're looking for";
  }
  if (totalSwipes >= 10 && likeRate > 0.3 && likeRate < 0.6) {
    return "You have great taste — I can find more profiles like your favorites";
  }
  if (totalSwipes >= 20) {
    return "You've been swiping a while — want me to surface your best matches?";
  }

  return null;
}

export function AIInsightBanner({ onPress, rightSwipeCount, totalSwipeCount }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    loadInsight();
  }, [rightSwipeCount, totalSwipeCount]);

  async function loadInsight() {
    try {
      const mem = await getAIMemory();
      const text = generateInsight(rightSwipeCount, totalSwipeCount, mem);
      if (text && text !== insight) {
        setInsight(text);
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      }
    } catch {}
  }

  function dismiss() {
    Animated.timing(slideAnim, {
      toValue: -60,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setInsight(null);
    });
  }

  if (!visible || !insight) return null;

  return (
    <Animated.View style={[
      styles.banner,
      { transform: [{ translateY: slideAnim }] }
    ]}>
      <Feather name="cpu" size={14} color="#ff6b5b" />
      <Text
        style={styles.text}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {insight}
      </Text>
      <TouchableOpacity onPress={onPress} style={styles.actionBtn}>
        <Text style={styles.actionText}>Ask AI</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1c1c1c',
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: '#ff6b5b',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
