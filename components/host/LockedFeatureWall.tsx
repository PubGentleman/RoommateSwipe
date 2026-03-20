import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Feather } from '../VectorIcons';

const CORAL = '#ff6b5b';

interface LockedFeatureWallProps {
  icon: string;
  title: string;
  description: string;
  requiredPlan: string;
  onUpgrade: () => void;
}

export function LockedFeatureWall({ icon, title, description, requiredPlan, onUpgrade }: LockedFeatureWallProps) {
  return (
    <View style={styles.wall}>
      <View style={styles.lockCircle}>
        <Feather name="lock" size={28} color={CORAL} />
      </View>

      <View style={styles.featureCircle}>
        <Feather name={icon as any} size={20} color="rgba(255,255,255,0.5)" />
      </View>

      <Text style={styles.title}>{title} is locked</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.planBadge}>
        <Feather name="zap" size={12} color={CORAL} />
        <Text style={styles.planBadgeText}>Requires {requiredPlan} plan</Text>
      </View>

      <Pressable style={styles.upgradeBtn} onPress={onUpgrade}>
        <Text style={styles.upgradeBtnText}>Upgrade to {requiredPlan}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#111',
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${CORAL}15`,
  },
  featureCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: -12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: `${CORAL}15`,
    borderColor: `${CORAL}30`,
    marginBottom: 20,
    gap: 4,
  },
  planBadgeText: {
    fontSize: 13,
    color: CORAL,
    fontWeight: '700',
  },
  upgradeBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    backgroundColor: CORAL,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
