import React from 'react';
import { View, StyleSheet, Pressable, Text, Modal } from 'react-native';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';

const BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const GOLD = '#ffd700';
const PURPLE = '#6C5CE7';

interface Props {
  visible: boolean;
  currentPlanLabel: string;
  newPlanLabel: string;
  currentMonthlyPrice: number;
  newMonthlyPrice: number;
  daysRemainingInPeriod: number;
  totalDaysInPeriod: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PlanChangePreviewModal({
  visible, currentPlanLabel, newPlanLabel,
  currentMonthlyPrice, newMonthlyPrice,
  daysRemainingInPeriod, totalDaysInPeriod,
  onConfirm, onCancel,
}: Props) {
  const isUpgrade = newMonthlyPrice > currentMonthlyPrice;
  const isDowngrade = newMonthlyPrice < currentMonthlyPrice;

  const dailyRate = totalDaysInPeriod > 0 ? currentMonthlyPrice / totalDaysInPeriod : 0;
  const unusedCredit = dailyRate * daysRemainingInPeriod;
  const newDailyRate = totalDaysInPeriod > 0 ? newMonthlyPrice / totalDaysInPeriod : 0;
  const newCharge = newDailyRate * daysRemainingInPeriod;
  const netCharge = isUpgrade ? Math.max(0, newCharge - unusedCredit) : 0;
  const netCredit = isDowngrade ? Math.max(0, unusedCredit - newCharge) : 0;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isUpgrade ? 'Upgrade' : 'Change'} Plan
            </Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.planChangeRow}>
            <View style={styles.planBox}>
              <Text style={styles.planBoxLabel}>Current</Text>
              <Text style={styles.planBoxName}>{currentPlanLabel}</Text>
              <Text style={styles.planBoxPrice}>${currentMonthlyPrice.toFixed(2)}/mo</Text>
            </View>
            <Feather name="arrow-right" size={18} color={PURPLE} />
            <View style={[styles.planBox, styles.newPlanBox]}>
              <Text style={styles.planBoxLabel}>New</Text>
              <Text style={[styles.planBoxName, { color: PURPLE }]}>{newPlanLabel}</Text>
              <Text style={styles.planBoxPrice}>${newMonthlyPrice.toFixed(2)}/mo</Text>
            </View>
          </View>

          <View style={styles.breakdown}>
            <Text style={styles.breakdownTitle}>Billing Preview</Text>

            {isUpgrade ? (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Unused credit ({daysRemainingInPeriod} days)
                  </Text>
                  <Text style={[styles.breakdownValue, { color: GREEN }]}>
                    -${unusedCredit.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {newPlanLabel} ({daysRemainingInPeriod} days)
                  </Text>
                  <Text style={styles.breakdownValue}>${newCharge.toFixed(2)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Due today</Text>
                  <Text style={styles.totalValue}>${netCharge.toFixed(2)}</Text>
                </View>
              </>
            ) : null}

            {isDowngrade ? (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Credit for remaining period</Text>
                  <Text style={[styles.breakdownValue, { color: GREEN }]}>
                    ${netCredit.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.breakdownNote}>
                  Credit will be applied to your next billing cycle.
                </Text>
              </>
            ) : null}

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Next full charge</Text>
              <Text style={styles.breakdownValue}>
                ${newMonthlyPrice.toFixed(2)}/mo
              </Text>
            </View>
          </View>

          {isDowngrade ? (
            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={16} color={GOLD} />
              <Text style={styles.warningText}>
                You'll lose access to {currentPlanLabel} features at the end of your current billing period.
              </Text>
            </View>
          ) : null}

          <Pressable style={styles.confirmBtn} onPress={onConfirm}>
            <LinearGradient
              colors={isUpgrade ? [ACCENT, '#e83a2a'] : ['#333', '#444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmText}>
                {isUpgrade ? `Pay $${netCharge.toFixed(2)} & Upgrade` : 'Confirm Change'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Keep Current Plan</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 20 },
  modal: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  planChangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  planBox: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  newPlanBox: { borderWidth: 1, borderColor: PURPLE + '40' },
  planBoxLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 },
  planBoxName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  planBoxPrice: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  breakdown: { backgroundColor: BG, borderRadius: 12, padding: 14, marginBottom: 16 },
  breakdownTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  breakdownLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', flex: 1 },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: '#fff' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#333', marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  totalValue: { fontSize: 16, fontWeight: '800', color: ACCENT },
  breakdownNote: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    marginBottom: 16,
  },
  warningText: { fontSize: 12, color: GOLD, flex: 1, lineHeight: 17 },
  confirmBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  confirmGradient: { paddingVertical: 14, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
