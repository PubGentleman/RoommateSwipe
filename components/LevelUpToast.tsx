import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import { Feather } from './VectorIcons';
import { TIER_INFO, ProfileTier } from '../utils/profileGate';

interface Props {
  tier: ProfileTier;
  visible: boolean;
  onDismiss: () => void;
}

const LevelUpToast: React.FC<Props> = ({ tier, visible, onDismiss }) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const info = TIER_INFO[tier];

  useEffect(() => {
    if (visible) {
      translateY.value = withSequence(
        withTiming(0, { duration: 400 }),
        withDelay(2500, withTiming(-100, { duration: 300 }))
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 400 }),
        withDelay(2500, withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        }))
      );
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, animStyle, { borderColor: info.color + '30' }]}>
      <Feather name={info.icon as any} size={24} color={info.color} />
      <Text style={styles.text}>
        Level Up! You are now <Text style={[styles.tierName, { color: info.color }]}>{info.label}</Text>
      </Text>
      <Text style={styles.desc}>{info.description}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16, padding: 16,
    borderWidth: 1, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 10, zIndex: 999,
  },
  text: { fontSize: 16, fontWeight: '700', color: '#fff' },
  tierName: { fontWeight: '800' },
  desc: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
});

export default LevelUpToast;
