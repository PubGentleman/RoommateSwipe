import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { PlanBadge } from './PlanBadge';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const NUM_PARTICLES = 20;

interface MatchCelebrationModalProps {
  visible: boolean;
  currentUserPhoto?: string;
  currentUserName?: string;
  currentUserPlan?: string;
  matchedUserPhoto?: string;
  matchedUserName?: string;
  matchedUserPlan?: string;
  compatibility?: number;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
  showInviteToGroup?: boolean;
  onInviteToGroup?: () => void;
}

const Particle = ({ index, visible }: { index: number; visible: boolean }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const angle = (index / NUM_PARTICLES) * Math.PI * 2;
      const radius = 120 + Math.random() * 100;
      const targetX = Math.cos(angle) * radius;
      const targetY = Math.sin(angle) * radius - 50;
      const delay = 400 + Math.random() * 300;

      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 0;
      rotation.value = 0;

      opacity.value = withDelay(delay, withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(800, withTiming(0, { duration: 600 }))
      ));
      translateX.value = withDelay(delay, withTiming(targetX, { duration: 1200, easing: Easing.out(Easing.cubic) }));
      translateY.value = withDelay(delay, withTiming(targetY + 80, { duration: 1200, easing: Easing.out(Easing.cubic) }));
      scale.value = withDelay(delay, withSequence(
        withSpring(1, { damping: 8, stiffness: 120 }),
        withDelay(600, withTiming(0, { duration: 400 }))
      ));
      rotation.value = withDelay(delay, withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 1200 }));
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const particleColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6B9D', '#C490E4', '#FF9671', '#FFC75F'];
  const color = particleColors[index % particleColors.length];
  const size = 6 + Math.random() * 8;
  const isCircle = index % 3 !== 0;

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          width: size,
          height: isCircle ? size : size * 2,
          borderRadius: isCircle ? size / 2 : 2,
          backgroundColor: color,
        },
      ]}
    />
  );
};

export const MatchCelebrationModal = ({
  visible,
  currentUserPhoto,
  currentUserName,
  currentUserPlan,
  matchedUserPhoto,
  matchedUserName,
  matchedUserPlan,
  compatibility,
  onSendMessage,
  onKeepSwiping,
  showInviteToGroup,
  onInviteToGroup,
}: MatchCelebrationModalProps) => {
  const { theme } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const photosScale = useSharedValue(0);
  const photosOpacity = useSharedValue(0);
  const leftPhotoTranslateX = useSharedValue(-100);
  const rightPhotoTranslateX = useSharedValue(100);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const compatibilityOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(30);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = 0;
      titleScale.value = 0;
      titleOpacity.value = 0;
      photosScale.value = 0;
      photosOpacity.value = 0;
      leftPhotoTranslateX.value = -100;
      rightPhotoTranslateX.value = 100;
      heartScale.value = 0;
      heartOpacity.value = 0;
      compatibilityOpacity.value = 0;
      buttonsOpacity.value = 0;
      buttonsTranslateY.value = 30;

      overlayOpacity.value = withTiming(1, { duration: 400 });

      photosOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      photosScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
      leftPhotoTranslateX.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 90 }));
      rightPhotoTranslateX.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 90 }));

      heartOpacity.value = withDelay(500, withTiming(1, { duration: 200 }));
      heartScale.value = withDelay(500, withSequence(
        withSpring(1.3, { damping: 6, stiffness: 150 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      ));

      titleOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
      titleScale.value = withDelay(700, withSequence(
        withSpring(1.1, { damping: 8, stiffness: 120 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      ));

      compatibilityOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));

      buttonsOpacity.value = withDelay(1100, withTiming(1, { duration: 300 }));
      buttonsTranslateY.value = withDelay(1100, withSpring(0, { damping: 14, stiffness: 90 }));
    }
  }, [visible]);

  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const leftPhotoAnimStyle = useAnimatedStyle(() => ({
    opacity: photosOpacity.value,
    transform: [
      { translateX: leftPhotoTranslateX.value },
      { scale: photosScale.value },
    ],
  }));

  const rightPhotoAnimStyle = useAnimatedStyle(() => ({
    opacity: photosOpacity.value,
    transform: [
      { translateX: rightPhotoTranslateX.value },
      { scale: photosScale.value },
    ],
  }));

  const heartAnimStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const compatAnimStyle = useAnimatedStyle(() => ({
    opacity: compatibilityOpacity.value,
  }));

  const buttonsAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onKeepSwiping}
    >
      <Animated.View style={[styles.overlay, overlayAnimStyle]}>
        <View style={styles.particleContainer}>
          {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
            <Particle key={i} index={i} visible={visible} />
          ))}
        </View>

        <Animated.View style={[styles.titleContainer, titleAnimStyle]}>
          <ThemedText style={styles.titleText}>
            It's a Match!
          </ThemedText>
        </Animated.View>

        <View style={styles.photosRow}>
          <Animated.View style={[styles.photoWrapper, leftPhotoAnimStyle]}>
            <View style={[styles.photoBorder, { borderColor: '#FFFFFF' }]}>
              {currentUserPhoto ? (
                <Image source={{ uri: currentUserPhoto }} style={styles.userPhoto} />
              ) : (
                <View style={[styles.userPhoto, styles.photoPlaceholder]}>
                  <Feather name="user" size={40} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <ThemedText style={styles.photoName} numberOfLines={1}>
                {currentUserName || 'You'}
              </ThemedText>
              <PlanBadge plan={currentUserPlan} size={14} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.heartIconContainer, heartAnimStyle]}>
            <View style={styles.heartCircle}>
              <Feather name="heart" size={28} color="#FF6B6B" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.photoWrapper, rightPhotoAnimStyle]}>
            <View style={[styles.photoBorder, { borderColor: '#FFFFFF' }]}>
              {matchedUserPhoto ? (
                <Image source={{ uri: matchedUserPhoto }} style={styles.userPhoto} />
              ) : (
                <View style={[styles.userPhoto, styles.photoPlaceholder]}>
                  <Feather name="user" size={40} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <ThemedText style={styles.photoName} numberOfLines={1}>
                {matchedUserName || 'Match'}
              </ThemedText>
              <PlanBadge plan={matchedUserPlan} size={14} />
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.subtitleContainer, compatAnimStyle]}>
          <ThemedText style={styles.subtitleText}>
            You and {matchedUserName || 'your match'} both liked each other
          </ThemedText>
          {compatibility ? (
            <View style={styles.compatBadge}>
              <Feather name="heart" size={16} color="#FFFFFF" />
              <ThemedText style={styles.compatText}>
                {compatibility}% Compatible
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.buttonsContainer, buttonsAnimStyle]}>
          <Pressable
            style={styles.sendMessageButton}
            onPress={onSendMessage}
          >
            <Feather name="message-circle" size={20} color="#FF6B6B" />
            <ThemedText style={styles.sendMessageText}>
              Send Message
            </ThemedText>
          </Pressable>
          {showInviteToGroup && onInviteToGroup ? (
            <Pressable
              style={styles.inviteToGroupButton}
              onPress={onInviteToGroup}
            >
              <Feather name="user-plus" size={16} color="#fff" />
              <ThemedText style={styles.inviteToGroupText}>
                Invite to My Group
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.keepSwipingButton}
            onPress={onKeepSwiping}
          >
            <ThemedText style={styles.keepSwipingText}>
              Keep Swiping
            </ThemedText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 107, 107, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  particleContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    left: SCREEN_WIDTH / 2,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
  titleContainer: {
    marginBottom: Spacing.xxl,
  },
  titleText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  photoWrapper: {
    alignItems: 'center',
  },
  photoBorder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  userPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 110,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  heartIconContainer: {
    marginHorizontal: Spacing.md,
    zIndex: 10,
  },
  heartCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  subtitleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  subtitleText: {
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  compatText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 320,
    gap: Spacing.md,
  },
  sendMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  sendMessageText: {
    color: '#FF6B6B',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  keepSwipingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  keepSwipingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteToGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inviteToGroupText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
