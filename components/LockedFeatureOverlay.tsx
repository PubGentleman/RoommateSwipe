import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useNavigation } from '@react-navigation/native';

interface LockedFeatureOverlayProps {
  requiredPlan: 'Plus' | 'Elite';
  children: React.ReactNode;
  style?: any;
  compact?: boolean;
}

export function LockedFeatureOverlay({ requiredPlan, children, style, compact }: LockedFeatureOverlayProps) {
  const navigation = useNavigation();

  return (
    <View style={[styles.container, style]}>
      {children}
      <View style={StyleSheet.absoluteFill}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          style={styles.overlay}
          onPress={() => (navigation as any).navigate('Plans')}
        >
          <View style={[styles.badge, compact ? styles.badgeCompact : null]}>
            <Feather name="lock" size={compact ? 10 : 14} color="#a855f7" />
            <ThemedText style={[styles.badgeText, compact ? styles.badgeTextCompact : null]}>
              {requiredPlan.toUpperCase()}
            </ThemedText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

interface LockedRowOverlayProps {
  requiredPlan: 'Plus' | 'Elite';
  featureLabel: string;
  iconName?: string;
  onPress?: () => void;
}

export function LockedRowItem({ requiredPlan, featureLabel, iconName, onPress }: LockedRowOverlayProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      (navigation as any).navigate('Plans');
    }
  };

  return (
    <Pressable style={styles.lockedRow} onPress={handlePress}>
      <View style={styles.lockedRowLeft}>
        {iconName ? (
          <View style={styles.lockedIconWrap}>
            <Feather name={iconName as any} size={18} color="rgba(255,255,255,0.3)" />
          </View>
        ) : null}
        <ThemedText style={styles.lockedRowLabel}>{featureLabel}</ThemedText>
      </View>
      <View style={styles.lockedRowRight}>
        <View style={styles.rowBadge}>
          <Feather name="lock" size={9} color="#a855f7" />
          <ThemedText style={styles.rowBadgeText}>{requiredPlan.toUpperCase()}</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export function PlanBadgeInline({ plan, locked }: { plan: 'Plus' | 'Elite'; locked?: boolean }) {
  return (
    <View style={[styles.inlineBadge, locked ? styles.inlineBadgeLocked : null]}>
      {locked ? <Feather name="lock" size={8} color="#a855f7" /> : null}
      <ThemedText style={styles.inlineBadgeText}>{plan.toUpperCase()}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  badgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 8,
  },
  lockedRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lockedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lockedRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  lockedRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  rowBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
  },
  inlineBadgeLocked: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderColor: 'rgba(168,85,247,0.25)',
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
});
