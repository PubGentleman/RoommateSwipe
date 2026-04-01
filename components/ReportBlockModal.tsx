import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { useConfirm } from '../contexts/ConfirmContext';

type ReportType = 'user' | 'listing' | 'group';

const USER_REPORT_REASONS = [
  'Inappropriate content',
  'Fake profile',
  'Harassment',
  'Spam',
  'Other',
];

const LISTING_REPORT_REASONS = [
  'Fake or misleading listing',
  'Scam or fraud',
  'Incorrect information',
  'Inappropriate photos',
  'Already rented / unavailable',
  'Discriminatory content',
  'Other',
];

const GROUP_REPORT_REASONS = [
  'Inappropriate group name',
  'Spam group',
  'Suspicious activity',
  'Harassment',
  'Other',
];

function getReasonsForType(type: ReportType): string[] {
  switch (type) {
    case 'listing': return LISTING_REPORT_REASONS;
    case 'group': return GROUP_REPORT_REASONS;
    default: return USER_REPORT_REASONS;
  }
}

function getLabelsForType(type: ReportType, name: string) {
  switch (type) {
    case 'listing':
      return {
        title: 'Options',
        subtitle: 'What would you like to do with this listing?',
        reportTitle: 'Report Listing',
        reportLabel: 'Report Listing',
        reportDesc: 'Flag this listing for review',
        reportPrompt: 'Why are you reporting this listing?',
        successMsg: "Thank you for reporting. We'll review this listing.",
        blockLabel: `Block ${name}`,
        blockDesc: 'Hide all listings from this host',
        blockConfirmTitle: `Block ${name}?`,
        blockConfirmMsg: `You won't see any listings from ${name}. They won't be able to contact you.`,
        blockSuccessMsg: `${name} has been blocked. Their listings are now hidden.`,
        showBlock: true,
      };
    case 'group':
      return {
        title: 'Options',
        subtitle: 'What would you like to do with this group?',
        reportTitle: 'Report Group',
        reportLabel: 'Report Group',
        reportDesc: 'Flag this group for review',
        reportPrompt: 'Why are you reporting this group?',
        successMsg: "Thank you for reporting. We'll review this group.",
        blockLabel: '',
        blockDesc: '',
        blockConfirmTitle: '',
        blockConfirmMsg: '',
        blockSuccessMsg: '',
        showBlock: false,
      };
    default:
      return {
        title: 'Options',
        subtitle: `What would you like to do with ${name}'s profile?`,
        reportTitle: 'Report User',
        reportLabel: `Report ${name}`,
        reportDesc: 'Flag this profile for review',
        reportPrompt: `Why are you reporting ${name}?`,
        successMsg: `Thank you for reporting. We'll review ${name}'s profile.`,
        blockLabel: `Block ${name}`,
        blockDesc: 'Prevent all future interactions',
        blockConfirmTitle: `Block ${name}?`,
        blockConfirmMsg: `${name} will no longer be able to see your profile or contact you. You won't see them in your feed.`,
        blockSuccessMsg: `${name} has been blocked.`,
        showBlock: true,
      };
  }
}

interface ReportBlockModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  onReport: (reason: string) => void;
  onBlock?: () => void;
  type?: ReportType;
}

export const ReportBlockModal = ({ visible, onClose, userName, onReport, onBlock, type = 'user' }: ReportBlockModalProps) => {
  const { theme } = useTheme();
  const { confirm, alert: showAlert } = useConfirm();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [showReportSection, setShowReportSection] = useState(false);

  const reasons = getReasonsForType(type);
  const labels = getLabelsForType(type, userName);

  const handleReport = async () => {
    if (!selectedReason) {
      await showAlert({ title: 'Select a Reason', message: 'Please select a reason for your report.', variant: 'warning' });
      return;
    }
    onReport(selectedReason);
    setSelectedReason(null);
    setShowReportSection(false);
    onClose();
    await showAlert({ title: 'Report Submitted', message: labels.successMsg, variant: 'success' });
  };

  const handleBlock = async () => {
    if (!onBlock) return;
    const confirmed = await confirm({
      title: labels.blockConfirmTitle,
      message: labels.blockConfirmMsg,
      confirmText: 'Block',
      variant: 'danger',
    });
    if (confirmed) {
      onBlock();
      setSelectedReason(null);
      setShowReportSection(false);
      onClose();
      await showAlert({ title: 'Blocked', message: labels.blockSuccessMsg, variant: 'success' });
    }
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
              {showReportSection ? labels.reportTitle : labels.title}
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {!showReportSection ? (
            <View style={styles.content}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
                {labels.subtitle}
              </ThemedText>

              <Pressable
                style={[styles.optionButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowReportSection(true)}
              >
                <Feather name="flag" size={20} color={theme.warning} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                    {labels.reportLabel}
                  </ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    {labels.reportDesc}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>

              {labels.showBlock && onBlock ? (
                <Pressable
                  style={[styles.optionButton, { backgroundColor: theme.backgroundDefault, borderColor: '#DC2626' }]}
                  onPress={handleBlock}
                >
                  <Feather name="slash" size={20} color="#DC2626" />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.body, { fontWeight: '600', color: '#DC2626' }]}>
                      {labels.blockLabel}
                    </ThemedText>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                      {labels.blockDesc}
                    </ThemedText>
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.content}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
                {labels.reportPrompt}
              </ThemedText>

              {reasons.map((reason) => (
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
