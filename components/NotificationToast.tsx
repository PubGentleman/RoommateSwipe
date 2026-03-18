import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
  type: 'match' | 'message' | 'group_invite' | 'group_accepted' | 'property_update' | 'property_rented' | 'application_status' | 'system' | 'super_like' | 'interest_received' | 'interest_accepted' | 'interest_passed' | 'interest_expired';
  onPress?: () => void;
}

interface NotificationToastProps {
  notification: ToastNotification | null;
  onDismiss: () => void;
}

const TOAST_DURATION = 4000;

const getIconForType = (type: string): string => {
  switch (type) {
    case 'match': return 'heart';
    case 'super_like': return 'star';
    case 'message': return 'message-circle';
    case 'group_invite':
    case 'group_accepted': return 'users';
    case 'property_update':
    case 'property_rented': return 'home';
    case 'application_status': return 'file-text';
    case 'interest_received': return 'heart';
    case 'interest_accepted': return 'check-circle';
    case 'interest_passed': return 'x-circle';
    case 'interest_expired': return 'clock';
    default: return 'bell';
  }
};

const getColorForType = (type: string): string => {
  switch (type) {
    case 'match': return '#FF6B6B';
    case 'super_like': return '#FFD700';
    case 'message': return '#4ECDC4';
    case 'group_invite':
    case 'group_accepted': return '#9B59B6';
    case 'property_update':
    case 'property_rented': return '#3498DB';
    case 'interest_received': return '#ff6b5b';
    case 'interest_accepted': return '#3ECF8E';
    case 'interest_passed': return '#999999';
    case 'interest_expired': return '#666666';
    default: return '#95A5A6';
  }
};

export const NotificationToast = ({ notification, onDismiss }: NotificationToastProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notification) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dismiss();
      }, TOAST_DURATION);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification?.id]);

  const dismiss = () => {
    translateY.value = withTiming(-150, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!notification) return null;

  const iconName = getIconForType(notification.type);
  const accentColor = getColorForType(notification.type);

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + Spacing.sm },
        animatedStyle,
      ]}
    >
      <Pressable
        style={[styles.toast, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          if (notification.onPress) {
            notification.onPress();
          }
          dismiss();
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
          <Feather name={iconName as any} size={20} color={accentColor} />
        </View>
        <View style={styles.textContainer}>
          <ThemedText style={[Typography.body, { fontWeight: '700' }]} numberOfLines={1}>
            {notification.title}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]} numberOfLines={2}>
            {notification.body}
          </ThemedText>
        </View>
        <Pressable onPress={dismiss} hitSlop={8} style={styles.closeButton}>
          <Feather name="x" size={16} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
});
