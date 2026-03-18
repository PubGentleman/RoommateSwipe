import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';

type ReportReason = 'Inappropriate content' | 'Fake profile' | 'Harassment' | 'Spam' | 'Other';

const REPORT_REASONS: ReportReason[] = [
  'Inappropriate content',
  'Fake profile',
  'Harassment',
  'Spam',
  'Other',
];

interface ReportBlockModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  onReport: (reason: string) => void;
  onBlock: () => void;
}

export const ReportBlockModal = ({ visible, onClose, userName, onReport, onBlock }: ReportBlockModalProps) => {
  const { theme } = useTheme();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [showReportSection, setShowReportSection] = useState(false);

  const handleReport = () => {
    if (!selectedReason) {
      Alert.alert('Select a Reason', 'Please select a reason for reporting this user.');
      return;
    }
    onReport(selectedReason);
    setSelectedReason(null);
    setShowReportSection(false);
    onClose();
    Alert.alert('Report Submitted', `Thank you for reporting. We'll review ${userName}'s profile.`);
  };

  const handleBlock = () => {
    Alert.alert(
      `Block ${userName}?`,
      `${userName} will no longer be able to see your profile or contact you. You won't see them in your feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            onBlock();
            setSelectedReason(null);
            setShowReportSection(false);
            onClose();
            Alert.alert('User Blocked', `${userName} has been blocked.`);
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setSelectedReason(null);
    setShowReportSection(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.header}>
            <ThemedText style={[Typography.h2, { textAlign: 'center' }]}>
              {showReportSection ? 'Report User' : 'Options'}
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {!showReportSection ? (
            <View style={styles.content}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
                What would you like to do with {userName}'s profile?
              </ThemedText>

              <Pressable
                style={[styles.optionButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowReportSection(true)}
              >
                <Feather name="flag" size={20} color={theme.warning} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                    Report {userName}
                  </ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Flag this profile for review
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                style={[styles.optionButton, { backgroundColor: theme.backgroundDefault, borderColor: '#DC2626' }]}
                onPress={handleBlock}
              >
                <Feather name="slash" size={20} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600', color: '#DC2626' }]}>
                    Block {userName}
                  </ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Prevent all future interactions
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          ) : (
            <View style={styles.content}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
                Why are you reporting {userName}?
              </ThemedText>

              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonOption,
                    {
                      backgroundColor: selectedReason === reason ? theme.primary + '15' : theme.backgroundDefault,
                      borderColor: selectedReason === reason ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={[
                    styles.radioOuter,
                    { borderColor: selectedReason === reason ? theme.primary : theme.textSecondary },
                  ]}>
                    {selectedReason === reason ? (
                      <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                    ) : null}
                  </View>
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
                    {reason}
                  </ThemedText>
                </Pressable>
              ))}

              <View style={styles.reportActions}>
                <Pressable
                  style={[styles.backButton, { borderColor: theme.border }]}
                  onPress={() => { setShowReportSection(false); setSelectedReason(null); }}
                >
                  <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                    Back
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.submitButton,
                    { backgroundColor: selectedReason ? theme.primary : theme.backgroundDefault },
                  ]}
                  onPress={handleReport}
                  disabled={!selectedReason}
                >
                  <ThemedText style={[Typography.body, { color: selectedReason ? '#FFFFFF' : theme.textSecondary, fontWeight: '600' }]}>
                    Submit Report
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.xl,
    top: Spacing.xl,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  reportActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  backButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  submitButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
});
