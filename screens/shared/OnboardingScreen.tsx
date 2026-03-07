import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingPage {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  features: { icon: keyof typeof Feather.glyphMap; text: string }[];
}

const PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: 'home',
    iconColor: '#FF6B6B',
    iconBg: 'rgba(255, 107, 107, 0.12)',
    title: 'Welcome to Roomdr',
    subtitle: 'Find your perfect roommate match with smart compatibility scoring',
    features: [
      { icon: 'users', text: 'AI-powered roommate matching' },
      { icon: 'map-pin', text: 'Location-aware property search' },
      { icon: 'shield', text: 'Verified profiles you can trust' },
    ],
  },
  {
    id: 'matching',
    icon: 'heart',
    iconColor: '#4ECDC4',
    iconBg: 'rgba(78, 205, 196, 0.12)',
    title: 'Swipe to Match',
    subtitle: 'Browse compatible roommates and find your ideal living situation',
    features: [
      { icon: 'arrow-right', text: 'Swipe right to like a profile' },
      { icon: 'arrow-left', text: 'Swipe left to pass' },
      { icon: 'star', text: 'Super Like to stand out' },
    ],
  },
  {
    id: 'compatibility',
    icon: 'bar-chart-2',
    iconColor: '#5B7FFF',
    iconBg: 'rgba(91, 127, 255, 0.12)',
    title: 'Smart Compatibility',
    subtitle: 'Our algorithm scores 14 lifestyle factors for accurate matching',
    features: [
      { icon: 'moon', text: 'Sleep schedule & cleanliness habits' },
      { icon: 'dollar-sign', text: 'Budget & shared expense preferences' },
      { icon: 'map-pin', text: 'Neighborhood & move-in timeline' },
    ],
  },
  {
    id: 'groups',
    icon: 'users',
    iconColor: '#9B59B6',
    iconBg: 'rgba(155, 89, 182, 0.12)',
    title: 'Form Groups',
    subtitle: 'Team up with compatible roommates to find a place together',
    features: [
      { icon: 'plus-circle', text: 'Create or join roommate groups' },
      { icon: 'message-circle', text: 'Group chat with potential roommates' },
      { icon: 'search', text: 'Browse properties as a group' },
    ],
  },
  {
    id: 'getstarted',
    icon: 'check-circle',
    iconColor: '#3ECF8E',
    iconBg: 'rgba(62, 207, 142, 0.12)',
    title: 'Ready to Start',
    subtitle: 'Complete your profile to get the best matches',
    features: [
      { icon: 'user', text: 'Add photos & fill in your preferences' },
      { icon: 'check', text: 'Verify your identity for more matches' },
      { icon: 'zap', text: 'Upgrade anytime for premium features' },
    ],
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progress = useSharedValue(0);

  const isLastPage = currentPage === PAGES.length - 1;

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
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== currentPage && page >= 0 && page < PAGES.length) {
      setCurrentPage(page);
      progress.value = withSpring(page);
    }
  };

  const renderPage = ({ item, index }: { item: OnboardingPage; index: number }) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={styles.pageContent}>
        <Animated.View
          entering={FadeIn.delay(200).duration(400)}
          style={[styles.iconContainer, { backgroundColor: item.iconBg }]}
        >
          <Feather name={item.icon} size={48} color={item.iconColor} />
        </Animated.View>

        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>

        <View style={styles.featuresContainer}>
          {item.features.map((feature, fIndex) => (
            <Animated.View
              key={fIndex}
              entering={FadeInDown.delay(300 + fIndex * 100).duration(400)}
              style={[styles.featureRow, { backgroundColor: theme.backgroundSecondary }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: item.iconBg }]}>
                <Feather name={feature.icon} size={18} color={item.iconColor} />
              </View>
              <Text style={[styles.featureText, { color: theme.text }]}>{feature.text}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        {currentPage > 0 ? (
          <Pressable
            onPress={() => {
              const prevPage = currentPage - 1;
              flatListRef.current?.scrollToIndex({ index: prevPage, animated: true });
              setCurrentPage(prevPage);
              progress.value = withSpring(prevPage);
            }}
            style={styles.headerButton}
          >
            <Feather name="arrow-left" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}

        <View style={styles.dotsContainer}>
          {PAGES.map((_, index) => (
            <DotIndicator
              key={index}
              index={index}
              currentPage={currentPage}
              theme={theme}
            />
          ))}
        </View>

        {!isLastPage ? (
          <Pressable onPress={handleSkip} style={styles.headerButton}>
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md }]}>
        <Pressable
          onPress={handleNext}
          style={[styles.nextButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.nextButtonText}>
            {isLastPage ? "Let's Go" : 'Next'}
          </Text>
          <Feather
            name={isLastPage ? 'check' : 'arrow-right'}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>

        {!isLastPage ? (
          <Text style={[styles.pageCounter, { color: theme.textSecondary }]}>
            {currentPage + 1} of {PAGES.length}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const DotIndicator: React.FC<{
  index: number;
  currentPage: number;
  theme: any;
}> = ({ index, currentPage, theme }) => {
  const isActive = index === currentPage;

  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: isActive ? theme.primary : theme.backgroundTertiary,
          width: isActive ? 24 : 8,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerButton: {
    width: 60,
    alignItems: 'center',
  },
  skipText: {
    ...Typography.body,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  featuresContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
    gap: Spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    ...Typography.body,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.large,
    gap: Spacing.sm,
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...Typography.h3,
  },
  pageCounter: {
    ...Typography.small,
  },
});
