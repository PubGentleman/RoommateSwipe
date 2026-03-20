import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '../VectorIcons';
import { ThemedText } from '../ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import type { PurchaseConfig } from '../../constants/purchaseConfig';

interface PurchaseConfirmModalProps {
  visible: boolean;
  config: PurchaseConfig;
  currentPlan?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseConfirmModal({
  visible,
  config,
  currentPlan,
  loading = false,
  onConfirm,
  onCancel,
}: PurchaseConfirmModalProps) {
  const { theme } = useTheme();
  const { iconColor } = config;

  const translateY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(400);
      opacity.setValue(0);
    }
  }, [visible]);

  function renderSubtitle() {
    if (config.type === 'subscription' && currentPlan) {
      return (
        <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
          Upgrading from{' '}
          <ThemedText style={{ fontWeight: '700', color: theme.text }}>{currentPlan}</ThemedText>
          {' '}to{' '}
          <ThemedText style={{ fontWeight: '700', color: iconColor }}>{config.targetLabel}</ThemedText>.
        </ThemedText>
      );
    }
    if (config.type === 'subscription') {
      return (
        <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
          Subscribe to{' '}
          <ThemedText style={{ fontWeight: '700', color: iconColor }}>{config.targetLabel}</ThemedText>{' '}
          and start growing your rental business.
        </ThemedText>
      );
    }
    if (config.type === 'one_time') {
      return (
        <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
          You're purchasing a{' '}
          <ThemedText style={{ fontWeight: '700', color: iconColor }}>{config.targetLabel}</ThemedText>{' '}
          outreach package.
        </ThemedText>
      );
    }
    if (config.type === 'credits') {
      return (
        <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
          You've hit today's limit. Unlock{' '}
          <ThemedText style={{ fontWeight: '700', color: iconColor }}>{config.targetLabel}</ThemedText>{' '}
          to keep reaching groups.
        </ThemedText>
      );
    }
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={loading ? undefined : onCancel}
      >
        <Animated.View style={[styles.backdrop, { opacity }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
          <Feather name={config.icon as any} size={26} color={iconColor} />
        </View>

        <ThemedText style={[Typography.h2, styles.title]}>
          {config.title}
        </ThemedText>

        {renderSubtitle()}

        <View style={[styles.priceCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[{ fontSize: 28, fontWeight: '800', color: iconColor }]}>
              {config.price}
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
              {config.priceNote}
            </ThemedText>
          </View>
          <View style={[styles.planBadge, { backgroundColor: iconColor + '18', borderColor: iconColor + '35' }]}>
            <ThemedText style={[Typography.small, { color: iconColor, fontWeight: '700' }]}>
              {config.targetLabel}
            </ThemedText>
          </View>
        </View>

        {config.perks && config.perks.length > 0 ? (
          <View style={[styles.perksCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {config.perks.map((perk, i) => (
              <View key={i} style={styles.perkRow}>
                <View style={[styles.perkCheck, { backgroundColor: '#22C55E20' }]}>
                  <Feather name="check" size={11} color="#22C55E" />
                </View>
                <ThemedText style={[Typography.small, { color: theme.text, flex: 1 }]}>
                  {perk}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {config.type === 'credits' ? (
          <View style={[styles.warningRow, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B35' }]}>
            <Feather name="clock" size={13} color="#F59E0B" />
            <ThemedText style={[Typography.small, { color: '#F59E0B', marginLeft: 6, flex: 1, fontWeight: '600' }]}>
              Credits expire at midnight tonight. Unused sends do not roll over.
            </ThemedText>
          </View>
        ) : null}

        <ThemedText style={[Typography.small, styles.disclaimer, { color: theme.textSecondary }]}>
          {config.disclaimer}
        </ThemedText>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.cancelBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={onCancel}
            disabled={loading}
          >
            <ThemedText style={[Typography.body, { color: theme.textSecondary, fontWeight: '600' }]}>
              Cancel
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.confirmBtn, { backgroundColor: iconColor, opacity: loading ? 0.7 : 1 }]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name={config.icon as any} size={16} color="#fff" />
                <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '700', marginLeft: 6 }]}>
                  {config.confirmLabel}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: 36,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.lg,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center', marginBottom: Spacing.lg,
  },
  priceCard: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  planBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  perksCard: {
    width: '100%', borderRadius: 14, borderWidth: 1,
    padding: Spacing.md, gap: 10,
    marginBottom: Spacing.sm,
  },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  perkCheck: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  warningRow: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  disclaimer: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    width: '100%', flexDirection: 'row', gap: 10,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', borderWidth: 1.5,
  },
  confirmBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
});
