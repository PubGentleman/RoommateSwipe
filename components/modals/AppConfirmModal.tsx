import React from 'react';
import { View, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '../VectorIcons';
import { ThemedText } from '../ThemedText';
import { BorderRadius } from '../../constants/theme';

const ACCENT = '#ff6b5b';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  showCancel?: boolean;
}

interface Props extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_CONFIG: Record<ConfirmVariant, { icon: string; color: string }> = {
  danger: { icon: 'alert-triangle', color: '#EF4444' },
  warning: { icon: 'alert-circle', color: '#F59E0B' },
  info: { icon: 'info', color: ACCENT },
  success: { icon: 'check-circle', color: '#22C55E' },
};

export function AppConfirmModal({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'info',
  showCancel = true,
  onConfirm,
  onCancel,
}: Props) {
  const config = VARIANT_CONFIG[variant];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={showCancel ? onCancel : undefined} />
        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: config.color + '18' }]}>
            <Feather name={config.icon as any} size={24} color={config.color} />
          </View>

          <ThemedText style={s.title}>{title}</ThemedText>
          <ThemedText style={s.message}>{message}</ThemedText>

          <View style={s.actions}>
            {showCancel ? (
              <Pressable style={s.cancelBtn} onPress={onCancel}>
                <ThemedText style={s.cancelText}>{cancelText}</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                s.confirmBtn,
                { backgroundColor: config.color },
                !showCancel ? { flex: 1 } : null,
              ]}
              onPress={onConfirm}
            >
              <ThemedText style={s.confirmText}>{confirmText}</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
