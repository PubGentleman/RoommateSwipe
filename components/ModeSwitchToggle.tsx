import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { useAuth } from '../contexts/AuthContext';

interface ModeSwitchToggleProps {
  compact?: boolean;
}

export function ModeSwitchToggle({ compact }: ModeSwitchToggleProps) {
  const { activeMode, canSwitchMode, switchMode } = useAuth();

  if (!canSwitchMode) return null;

  const isHost = activeMode === 'host';

  const handlePress = (targetMode: 'renter' | 'host') => {
    if (targetMode === activeMode) return;
    switchMode(targetMode);
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Pressable
        style={[styles.pill, !isHost && styles.pillActive]}
        onPress={() => handlePress('renter')}
      >
        <Feather
          name="search"
          size={compact ? 13 : 15}
          color={!isHost ? '#fff' : '#999'}
        />
        <Text style={[styles.label, !isHost && styles.labelActive, compact && styles.labelCompact]}>
          Renter
        </Text>
      </Pressable>

      <Pressable
        style={[styles.pill, isHost && styles.pillActive]}
        onPress={() => handlePress('host')}
      >
        <Feather
          name="home"
          size={compact ? 13 : 15}
          color={isHost ? '#fff' : '#999'}
        />
        <Text style={[styles.label, isHost && styles.labelActive, compact && styles.labelCompact]}>
          Host
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 3,
    alignSelf: 'center',
  },
  containerCompact: {
    padding: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 17,
  },
  pillActive: {
    backgroundColor: '#1a1a2e',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  labelCompact: {
    fontSize: 12,
  },
  labelActive: {
    color: '#fff',
  },
});
