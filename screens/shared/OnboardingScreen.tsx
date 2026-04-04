import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, FlatList,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withSequence, withRepeat, interpolate,
  useAnimatedScrollHandler, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 'welcome',
    headline: 'Find your people,\nthen your place',
    subtext: 'Rhome matches you with compatible roommates and helps you find the perfect apartment together.',
  },
  {
    id: 'matching',
    headline: '87% compatible?\nHere\'s why',
    subtext: 'Our algorithm checks sleep schedules, cleanliness, budget, lifestyle, and more \u2014 so you know before you match.',
  },
  {
    id: 'together',
    headline: 'Apartment hunt\nas a team',
    subtext: 'Form groups, shortlist apartments together, vote on favorites, and schedule tours \u2014 all in one place.',
  },
  {
    id: 'verified',
    headline: 'Real people,\nreal listings',
    subtext: 'ID verification, host badges, and reviews keep the community safe and trustworthy.',
  },
  {
    id: 'start',
    headline: 'Ready to\nfind home?',
    subtext: 'Join thousands of renters already matched on Rhome.',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(SLIDES.length - 1, Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)));
    setActiveIndex(idx);
  };

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      onComplete();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {activeIndex < SLIDES.length - 1 ? (
        <Pressable style={styles.skipBtn} onPress={onComplete}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <View style={styles.visualContainer}>
              {index === 0 ? <WelcomeVisual active={activeIndex === 0} /> : null}
              {index === 1 ? <MatchingVisual active={activeIndex === 1} /> : null}
              {index === 2 ? <TogetherVisual active={activeIndex === 2} /> : null}
              {index === 3 ? <VerifiedVisual active={activeIndex === 3} /> : null}
              {index === 4 ? <StartVisual active={activeIndex === 4} /> : null}
            </View>
            <Text style={styles.headline}>{item.headline}</Text>
            <Text style={styles.subtext}>{item.subtext}</Text>
          </View>
        )}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <DotIndicator key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        <Pressable style={styles.ctaBtn} onPress={goNext}>
          <LinearGradient
            colors={['#FF8E53', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {activeIndex === SLIDES.length - 1 ? "Let's Go" : 'Next'}
            </Text>
            <Feather name={activeIndex === SLIDES.length - 1 ? 'check' : 'arrow-right'} size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const DotIndicator = ({ index, scrollX }: { index: number; scrollX: Animated.SharedValue<number> }) => {
  const dotStyle = useAnimatedStyle(() => {
    const input = scrollX.value / SCREEN_W;
    const width = interpolate(input, [index - 1, index, index + 1], [8, 24, 8], Extrapolation.CLAMP);
    const opacity = interpolate(input, [index - 1, index, index + 1], [0.3, 1, 0.3], Extrapolation.CLAMP);
    return { width, opacity };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
};

const WelcomeVisual = ({ active }: { active: boolean }) => {
  const scale = useSharedValue(0);
  React.useEffect(() => {
    if (active) scale.value = withSpring(1, { damping: 12 });
    else scale.value = 0;
  }, [active]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.visualCenter, animStyle]}>
      <LinearGradient colors={['#FF8E53', '#FF6B6B']} style={styles.logoBig}>
        <Feather name="home" size={48} color="#fff" />
      </LinearGradient>
      <View style={styles.orbitRing}>
        {['#6366f1', '#3ECF8E', '#f59e0b', '#ec4899'].map((color, i) => (
          <View key={i} style={[styles.orbitDot, {
            backgroundColor: color,
            transform: [
              { rotate: `${i * 90}deg` },
              { translateX: 60 },
            ],
          }]} />
        ))}
      </View>
    </Animated.View>
  );
};

const MatchBar = ({ label, pct, color, delay, active }: { label: string; pct: number; color: string; delay: number; active: boolean }) => {
  const width = useSharedValue(0);
  React.useEffect(() => {
    if (active) width.value = withDelay(delay, withTiming(pct, { duration: 600 }));
    else width.value = 0;
  }, [active]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, barStyle]} />
      </View>
      <Text style={styles.barPct}>{pct}%</Text>
    </View>
  );
};

const MatchingVisual = ({ active }: { active: boolean }) => {
  const bars = [
    { label: 'Location', pct: 85, color: '#3ECF8E' },
    { label: 'Budget', pct: 100, color: '#3ECF8E' },
    { label: 'Sleep', pct: 92, color: '#3ECF8E' },
    { label: 'Cleanliness', pct: 75, color: '#ff6b5b' },
  ];

  return (
    <View style={styles.barsVisual}>
      {bars.map((bar, i) => (
        <MatchBar key={i} label={bar.label} pct={bar.pct} color={bar.color} delay={i * 200} active={active} />
      ))}
    </View>
  );
};

const AvatarEntry = ({ colors, delay, active }: { colors: string[]; delay: number; active: boolean }) => {
  const translateX = useSharedValue(100);
  React.useEffect(() => {
    if (active) translateX.value = withDelay(delay, withSpring(0, { damping: 14 }));
    else translateX.value = 100;
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <Animated.View style={style}>
      <LinearGradient colors={colors as [string, string]} style={styles.avatarCircle}>
        <Feather name="user" size={20} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
};

const TogetherVisual = ({ active }: { active: boolean }) => {
  const avatarColors: [string, string][] = [['#667eea', '#764ba2'], ['#f7971e', '#ffd200'], ['#11998e', '#38ef7d']];
  const cardY = useSharedValue(60);
  const cardOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (active) {
      cardY.value = withDelay(450, withSpring(0, { damping: 14 }));
      cardOpacity.value = withDelay(450, withTiming(1, { duration: 300 }));
    } else {
      cardY.value = 60;
      cardOpacity.value = 0;
    }
  }, [active]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <View style={styles.togetherVisual}>
      <View style={styles.avatarRow}>
        {avatarColors.map((colors, i) => (
          <AvatarEntry key={i} colors={colors} delay={i * 150} active={active} />
        ))}
      </View>
      <Animated.View style={cardStyle}>
        <View style={styles.miniCard}>
          <View style={styles.miniCardPhoto} />
          <View style={styles.miniCardLines}>
            <View style={[styles.miniCardLine, { width: '70%' }]} />
            <View style={[styles.miniCardLine, { width: '50%' }]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const VerifiedVisual = ({ active }: { active: boolean }) => {
  const fillHeight = useSharedValue(0);
  const checkScale = useSharedValue(0);

  React.useEffect(() => {
    if (active) {
      fillHeight.value = withDelay(200, withTiming(100, { duration: 800 }));
      checkScale.value = withDelay(800, withSpring(1, { damping: 10 }));
    } else {
      fillHeight.value = 0;
      checkScale.value = 0;
    }
  }, [active]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${fillHeight.value}%` }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  return (
    <View style={styles.shieldVisual}>
      <View style={styles.shieldOuter}>
        <Animated.View style={[styles.shieldFill, fillStyle]} />
        <Feather name="shield" size={60} color="rgba(255,255,255,0.15)" style={{ position: 'absolute' }} />
        <Animated.View style={[{ position: 'absolute' }, checkStyle]}>
          <Feather name="check" size={32} color="#fff" />
        </Animated.View>
      </View>
    </View>
  );
};

const StartVisual = ({ active }: { active: boolean }) => {
  const scale = useSharedValue(1);
  React.useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1, true
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.visualCenter, style]}>
      <LinearGradient colors={['#FF8E53', '#FF6B6B']} style={styles.logoBig}>
        <Feather name="home" size={48} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  skipBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  slide: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  visualContainer: {
    height: SCREEN_H * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
  },
  subtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  bottom: {
    paddingHorizontal: 32,
    gap: 20,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6b5b',
  },
  ctaBtn: { width: '100%' },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  visualCenter: { alignItems: 'center', justifyContent: 'center' },
  logoBig: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  orbitRing: {
    position: 'absolute',
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 20, height: 20, borderRadius: 10,
  },
  barsVisual: { gap: 14, width: 260 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 80 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barPct: { fontSize: 12, color: 'rgba(255,255,255,0.35)', width: 36, textAlign: 'right' },
  togetherVisual: { alignItems: 'center', gap: 20 },
  avatarRow: { flexDirection: 'row', gap: 12 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  miniCard: {
    width: 200, backgroundColor: '#161616', borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  miniCardPhoto: { width: '100%', height: 60, backgroundColor: 'rgba(255,255,255,0.04)' },
  miniCardLines: { padding: 10, gap: 6 },
  miniCardLine: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  shieldVisual: { alignItems: 'center', justifyContent: 'center' },
  shieldOuter: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(62,207,142,0.1)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  shieldFill: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(62,207,142,0.3)',
  },
});

export default OnboardingScreen;
