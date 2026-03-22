import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius } from '../constants/theme';
import { INTEREST_TAGS, MIN_TAGS, MAX_TAGS } from '../constants/interestTags';
import { useConfirm } from '../contexts/ConfirmContext';

type TagMap = Record<string, { label: string; icon: string; tags: { id: string; label: string }[] }>;

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  minTags?: number;
  maxTags?: number;
  showCount?: boolean;
  tags?: TagMap;
  singleSelect?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TagPill = React.memo(({
  tagId,
  label,
  isSelected,
  onPress,
}: {
  tagId: string;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );
    onPress();
  };

  if (isSelected) {
    return (
      <AnimatedPressable onPress={handlePress} style={animatedStyle}>
        <LinearGradient
          colors={['#ff6b5b', '#e83a2a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.tagPill}
        >
          <Feather name="check" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
          <ThemedText style={styles.tagTextSelected}>{label}</ThemedText>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable onPress={handlePress} style={[animatedStyle, styles.tagPill, styles.tagUnselected]}>
      <ThemedText style={styles.tagText}>{label}</ThemedText>
    </AnimatedPressable>
  );
});

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onChange,
  minTags = MIN_TAGS,
  maxTags = MAX_TAGS,
  showCount = false,
  tags,
  singleSelect = false,
}) => {
  const { theme } = useTheme();
  const { alert: showAlert } = useConfirm();
  const counterShake = useSharedValue(0);

  const counterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: counterShake.value }],
  }));

  const toggleTag = useCallback((tagId: string) => {
    if (singleSelect) {
      onChange(selectedTags.includes(tagId) ? [] : [tagId]);
      return;
    }
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter((t) => t !== tagId));
    } else {
      if (selectedTags.length >= maxTags) {
        counterShake.value = withSequence(
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(-4, { duration: 50 }),
          withTiming(4, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
        showAlert({ title: 'Limit Reached', message: `Max ${maxTags} tags selected — remove one to add another`, variant: 'warning' });
        return;
      }
      onChange([...selectedTags, tagId]);
    }
  }, [selectedTags, onChange, maxTags, counterShake, singleSelect, showAlert]);

  const count = selectedTags.length;
  const progress = count / maxTags;
  const belowMin = count < minTags;
  const atMax = count >= maxTags;

  const counterColor = belowMin
    ? theme.error
    : atMax
    ? '#ff6b5b'
    : theme.text;

  const categories = Object.entries(tags || INTEREST_TAGS);

  return (
    <View>
      {showCount ? (
        <Animated.View style={[styles.counterContainer, counterAnimatedStyle]}>
          <ThemedText style={[styles.counterText, { color: counterColor }]}>
            {belowMin
              ? `Pick at least ${minTags} to continue`
              : `${count} / ${maxTags} selected`}
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: belowMin ? theme.error : '#ff6b5b',
                },
              ]}
            />
          </View>
        </Animated.View>
      ) : null}

      {categories.map(([key, category]) => (
        <View key={key} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Feather name={category.icon as any} size={16} color={theme.text} />
            <ThemedText style={[styles.categoryLabel, { color: theme.text }]}>
              {category.label}
            </ThemedText>
          </View>
          <View style={styles.tagsWrap}>
            {category.tags.map((tag) => (
              <TagPill
                key={tag.id}
                tagId={tag.id}
                label={tag.label}
                isSelected={selectedTags.includes(tag.id)}
                onPress={() => toggleTag(tag.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  counterContainer: {
    marginBottom: Spacing.lg,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagUnselected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tagTextSelected: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
