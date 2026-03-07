import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RoomdrLogo } from '../../components/RoomdrLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingFeature {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}

interface OnboardingPage {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  accentColor: string;
  accentBg: string;
  gradient: [string, string];
  title: string;
  subtitle: string;
  features: OnboardingFeature[];
}

const ACCENT = '#ff6b5b';

const PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: 'home',
    accentColor: ACCENT,
    accentBg: 'rgba(255, 107, 91, 0.15)',
    gradient: ['#ff6b5b', '#ff4040'],
    title: 'Welcome to Roomdr',
    subtitle: 'Find your perfect roommate match\nwith smart compatibility scoring',
    features: [
      { icon: 'users', title: 'AI-powered roommate matching', subtitle: 'Smart compatibility scores based on your lifestyle' },
      { icon: 'map-pin', title: 'Location-aware property search', subtitle: 'Find rooms near you, work, or school' },
      { icon: 'shield', title: 'Verified profiles you can trust', subtitle: 'ID-verified users and background checks' },
    ],
  },
  {
    id: 'matching',
    icon: 'heart',
    accentColor: '#4ECDC4',
    accentBg: 'rgba(78, 205, 196, 0.15)',
    gradient: ['#4ECDC4', '#36B5AC'],
    title: 'Swipe to Match',
    subtitle: 'Browse compatible roommates and\nfind your ideal living situation',
    features: [
      { icon: 'arrow-right', title: 'Swipe right to like', subtitle: 'Show interest in potential roommates' },
      { icon: 'arrow-left', title: 'Swipe left to pass', subtitle: 'Skip profiles that aren\'t a fit' },
      { icon: 'star', title: 'Super Like to stand out', subtitle: 'Let someone know you\'re really interested' },
    ],
  },
  {
    id: 'compatibility',
    icon: 'bar-chart-2',
    accentColor: '#5B7FFF',
    accentBg: 'rgba(91, 127, 255, 0.15)',
    gradient: ['#5B7FFF', '#4060E0'],
    title: 'Smart Compatibility',
    subtitle: 'Our algorithm scores 14 lifestyle\nfactors for accurate matching',
    features: [
      { icon: 'moon', title: 'Sleep schedule & cleanliness', subtitle: 'Matched on daily habits and routines' },
      { icon: 'dollar-sign', title: 'Budget & shared expenses', subtitle: 'Aligned financial expectations' },
      { icon: 'map-pin', title: 'Neighborhood & timeline', subtitle: 'Coordinated location and move-in dates' },
    ],
  },
  {
    id: 'groups',
    icon: 'users',
    accentColor: '#9B59B6',
    accentBg: 'rgba(155, 89, 182, 0.15)',
    gradient: ['#9B59B6', '#8040A0'],
    title: 'Form Groups',
    subtitle: 'Team up with compatible roommates\nto find a place together',
    features: [
      { icon: 'plus-circle', title: 'Create or join groups', subtitle: 'Build your ideal roommate team' },
      { icon: 'message-circle', title: 'Group chat', subtitle: 'Coordinate with potential roommates' },
      { icon: 'search', title: 'Browse as a group', subtitle: 'Find properties that fit everyone' },
    ],
  },
  {
    id: 'getstarted',
    icon: 'check-circle',
    accentColor: '#3ECF8E',
    accentBg: 'rgba(62, 207, 142, 0.15)',
    gradient: ['#3ECF8E', '#28B070'],
    title: 'Ready to Start',
    subtitle: 'Complete your profile to get\nthe best matches',
    features: [
      { icon: 'user', title: 'Add photos & preferences', subtitle: 'Build a profile that attracts great matches' },
      { icon: 'check', title: 'Verify your identity', subtitle: 'Get more matches with a verified badge' },
      { icon: 'zap', title: 'Upgrade for premium', subtitle: 'Unlock advanced features anytime' },
    ],
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progress = useSharedValue(0);

  const isLastPage = currentPage === PAGES.length - 1;
  const page = PAGES[currentPage];

  const handleNext = () => {
    if (isLastPage) {
      onComplete();
    } else {
      const nextPage = currentPage + 1;
      flatListRef.current?.scrollToIndex({ index: nextPage, animated: true });
      setCurrentPage(nextPage);
      progress.value = withSpring(nextPage);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(offsetX / SCREEN_WIDTH);
    if (newPage !== currentPage && newPage >= 0 && newPage < PAGES.length) {
      setCurrentPage(newPage);
      progress.value = withSpring(newPage);
    }
  };

  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageContent}>
        {item.id === 'welcome' ? (
          <Animated.View entering={FadeIn.delay(150).duration(350)}>
            <RoomdrLogo variant="stacked" size="lg" showTagline />
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.delay(150).duration(350)}
            style={[styles.appIcon, {
              backgroundColor: item.accentBg,
              borderColor: `${item.accentColor}30`,
            }]}
          >
            <Feather name={item.icon} size={36} color={item.accentColor} />
          </Animated.View>
        )}

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        <View style={styles.divider} />

        <View style={styles.featuresContainer}>
          {item.features.map((feature, fIndex) => (
            <Animated.View
              key={fIndex}
              entering={FadeInDown.delay(250 + fIndex * 80).duration(350)}
              style={styles.featureCard}
            >
              <View style={[styles.featureIcon, {
                backgroundColor: item.accentBg,
                borderColor: `${item.accentColor}40`,
              }]}>
                <Feather name={feature.icon} size={18} color={item.accentColor} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {!isLastPage ? (
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <Pressable onPress={handleNext} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, width: '100%' }]}>
          <LinearGradient
            colors={page.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {isLastPage ? "Let's Go" : 'Next'}
            </Text>
            <Feather
              name={isLastPage ? 'check' : 'arrow-right'}
              size={18}
              color="#FFFFFF"
            />
          </LinearGradient>
        </Pressable>

        <View style={styles.dotsContainer}>
          {PAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentPage
                  ? { width: 22, borderRadius: 4, backgroundColor: page.accentColor }
                  : { width: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 28,
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    maxWidth: 400,
    width: '100%',
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 35,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 26,
  },
  featuresContainer: {
    width: '100%',
    gap: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '400',
    lineHeight: 17,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 18,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 56,
    borderRadius: 18,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 7,
  },
});
