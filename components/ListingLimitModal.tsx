import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ListingLimitModalProps {
  visible: boolean;
  message: string;
  onCancel: () => void;
  onUpgrade: () => void;
}

export function ListingLimitModal({ visible, message, onCancel, onUpgrade }: ListingLimitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Feather name="lock" size={28} color="#ff6b5b" />
          </View>

          <Text style={styles.title}>Listing Limit Reached</Text>
          <Text style={styles.message}>{message}</Text>

          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeBtn}
          >
            <Pressable style={styles.upgradeBtnInner} onPress={onUpgrade}>
              <Feather name="zap" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
            </Pressable>
          </LinearGradient>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface OverageModalProps {
  visible: boolean;
  message: string;
  onCancel: () => void;
  onContinue: () => void;
}

export function OverageModal({ visible, message, onCancel, onContinue }: OverageModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
            <Feather name="alert-triangle" size={28} color="#f59e0b" />
          </View>

          <Text style={styles.title}>Heads Up</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Continue Anyway</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  upgradeBtn: {
    width: '100%',
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  upgradeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  upgradeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
});
