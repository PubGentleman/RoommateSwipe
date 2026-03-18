import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '../ThemedText';

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
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        style={[
          styles.card,
          isSelected && styles.cardSelected,
        ]}
        onPress={onPress}
      >
        <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
          <Feather name={icon} size={20} color={isSelected ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
        </View>
        <View style={styles.textContainer}>
          <ThemedText style={styles.cardTitle}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText style={styles.cardSubtitle}>{subtitle}</ThemedText>
          ) : null}
        </View>
        {isSelected ? (
          <Feather name="check-circle" size={20} color="#ff6b5b" />
        ) : null}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1c1c1c',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  cardSelected: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderColor: '#ff6b5b',
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(255,107,91,0.2)',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
});
