import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { ProfileTier, TIER_INFO } from '../utils/profileGate';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCompleteProfile: () => void;
  featureName: string;
  requiredTier: ProfileTier;
  currentTier: ProfileTier;
  nextItems: string[];
}

const FeatureGateModal: React.FC<Props> = ({
  visible, onClose, onCompleteProfile, featureName, requiredTier, currentTier, nextItems,
}) => {
  const requiredInfo = TIER_INFO[requiredTier];
  const currentInfo = TIER_INFO[currentTier];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={[styles.lockCircle, { borderColor: requiredInfo.color + '40' }]}>
            <Feather name="lock" size={28} color={requiredInfo.color} />
          </View>

          <Text style={styles.title}>Unlock {featureName}</Text>
          <Text style={styles.subtitle}>
            This feature requires{' '}
            <Text style={{ color: requiredInfo.color, fontWeight: '700' }}>
              {requiredInfo.label}
            </Text>{' '}tier
          </Text>

          <View style={styles.tierRow}>
            <Text style={styles.tierLabel}>Your level:</Text>
            <View style={[styles.tierBadge, { backgroundColor: currentInfo.color + '15' }]}>
              <Feather name={currentInfo.icon as any} size={13} color={currentInfo.color} />
              <Text style={[styles.tierBadgeText, { color: currentInfo.color }]}>
                {currentInfo.label}
              </Text>
            </View>
          </View>

          <Text style={styles.toDoTitle}>Complete to unlock:</Text>
          {nextItems.map((item, i) => (
            <View key={i} style={styles.todoItem}>
              <View style={styles.todoCircle}>
                <Text style={styles.todoNumber}>{i + 1}</Text>
              </View>
              <Text style={styles.todoText}>{item}</Text>
            </View>
          ))}

          <Pressable style={styles.completeBtn} onPress={onCompleteProfile}>
            <Text style={styles.completeBtnText}>Complete Your Profile</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </Pressable>

          <Pressable onPress={onClose}>
            <Text style={styles.laterText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  lockCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  tierLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  tierBadgeText: { fontSize: 13, fontWeight: '700' },
  toDoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', alignSelf: 'flex-start', marginBottom: 12 },
  todoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginBottom: 10 },
  todoCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  todoNumber: { fontSize: 11, fontWeight: '700', color: '#ff6b5b' },
  todoText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ff6b5b', borderRadius: 14,
    paddingVertical: 14, width: '100%',
    marginTop: 20,
  },
  completeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  laterText: { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 14 },
});

export default FeatureGateModal;
