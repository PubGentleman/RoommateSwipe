import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '../ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';

interface SelectionCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  isSelected: boolean;
  onPress: () => void;
  index?: number;
  multiSelect?: boolean;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  icon,
  title,
  subtitle,
  isSelected,
  onPress,
  index = 0,
  multiSelect = false,
}) => {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: isSelected ? theme.primary + '12' : theme.backgroundDefault,
            borderColor: isSelected ? theme.primary : theme.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={onPress}
      >
        <View style={[styles.iconContainer, { backgroundColor: isSelected ? theme.primary + '20' : theme.backgroundSecondary }]}>
          <Feather name={icon} size={22} color={isSelected ? theme.primary : theme.textSecondary} />
        </View>
        <View style={styles.textContainer}>
          <ThemedText style={[Typography.body, { fontWeight: isSelected ? '600' : '400', color: theme.text }]}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.checkCircle, {
          backgroundColor: isSelected ? theme.primary : 'transparent',
          borderColor: isSelected ? theme.primary : theme.border,
        }]}>
          {isSelected ? (
            <Feather name="check" size={14} color="#FFFFFF" />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
    minHeight: 64,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
