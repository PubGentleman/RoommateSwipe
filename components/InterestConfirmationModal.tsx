import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface InterestConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  isSuperInterest?: boolean;
}

const CORAL = "#ff6b5b";
const GOLD = "#FFD700";
const AUTO_DISMISS_MS = 3000;

export function InterestConfirmationModal({
  visible,
  onClose,
  isSuperInterest,
}: InterestConfirmationModalProps) {
  const { theme } = useTheme();

  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      checkScale.value = 0;
      textOpacity.value = 0;
      buttonOpacity.value = 0;

      checkScale.value = withSpring(1, { damping: 8, stiffness: 120 });
      textOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
      buttonOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));

      const timer = setTimeout(() => {
        onClose();
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Animated.View style={[styles.checkCircle, checkAnimatedStyle]}>
            <Feather name="check" size={48} color="#fff" />
          </Animated.View>

          <Animated.Text style={[styles.title, { color: "#fff" }, textAnimatedStyle]}>
            Interest Sent!
          </Animated.Text>

          <Animated.Text
            style={[styles.subtitle, { color: "rgba(255,255,255,0.7)" }, textAnimatedStyle]}
          >
            You'll be notified when they respond
          </Animated.Text>

          {isSuperInterest ? (
            <Animated.Text style={[styles.superText, textAnimatedStyle]}>
              Your Super Interest was bumped to the top!
            </Animated.Text>
          ) : null}

          <Animated.View style={buttonAnimatedStyle}>
            <Pressable style={styles.button} onPress={onClose}>
              <Animated.Text style={styles.buttonText}>Got it</Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xxl,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: CORAL,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  superText: {
    ...Typography.caption,
    color: GOLD,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: CORAL,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl * 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  buttonText: {
    color: "#fff",
    ...Typography.h3,
    textAlign: "center",
  },
});
