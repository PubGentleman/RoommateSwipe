import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { useConfirm } from '../contexts/ConfirmContext';

type ReportType = 'user' | 'listing' | 'group';

interface ReportReason {
  id: string;
  label: string;
  icon: string;
}

const LISTING_REPORT_REASONS: ReportReason[] = [
  { id: 'fake_listing', label: 'Fake or misleading listing', icon: 'alert-circle' },
  { id: 'scam_fraud', label: 'Scam or fraud attempt', icon: 'alert-triangle' },
  { id: 'fake_photos', label: "Photos don't match reality", icon: 'camera-off' },
  { id: 'stolen_photos', label: 'Stolen photos from another listing', icon: 'copy' },
  { id: 'wrong_info', label: 'Incorrect price, address, or details', icon: 'info' },
  { id: 'already_rented', label: 'Already rented / not available', icon: 'x-circle' },
  { id: 'discriminatory', label: 'Discriminatory content', icon: 'slash' },
  { id: 'inappropriate_photos', label: 'Inappropriate photos', icon: 'eye-off' },
  { id: 'other', label: 'Other', icon: 'more-horizontal' },
];

const USER_REPORT_REASONS: ReportReason[] = [
  { id: 'fake_profile', label: 'Fake profile', icon: 'user-x' },
  { id: 'harassment', label: 'Harassment or threats', icon: 'alert-triangle' },
  { id: 'scam', label: 'Scam or fraud', icon: 'alert-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'flag' },
  { id: 'underage', label: 'May be underage', icon: 'alert-octagon' },
  { id: 'impersonation', label: 'Impersonating someone', icon: 'users' },
  { id: 'spam', label: 'Spam or commercial solicitation', icon: 'mail' },
  { id: 'other', label: 'Other', icon: 'more-horizontal' },
];

const GROUP_REPORT_REASONS: ReportReason[] = [
  { id: 'inappropriate_name', label: 'Inappropriate group name', icon: 'flag' },
  { id: 'spam_group', label: 'Spam group', icon: 'mail' },
  { id: 'suspicious', label: 'Suspicious activity', icon: 'alert-triangle' },
  { id: 'harassment', label: 'Harassment', icon: 'alert-circle' },
  { id: 'other', label: 'Other', icon: 'more-horizontal' },
];

function getReasonsForType(type: ReportType): ReportReason[] {
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
  onReport: (reason: string, evidenceUris?: string[]) => void;
  onBlock?: () => void;
  type?: ReportType;
}

export const ReportBlockModal = ({ visible, onClose, userName, onReport, onBlock, type = 'user' }: ReportBlockModalProps) => {
  const { theme } = useTheme();
  const { confirm, alert: showAlert } = useConfirm();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [showReportSection, setShowReportSection] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const reasons = getReasonsForType(type);
  const labels = getLabelsForType(type, userName);

  const addEvidence = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3 - evidencePhotos.length,
        quality: 0.7,
      });

      if (!result.canceled) {
        setEvidencePhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 3));
      }
    } catch {}
  };

  const handleReport = async () => {
    if (!selectedReason) {
      await showAlert({ title: 'Select a Reason', message: 'Please select a reason for your report.', variant: 'warning' });
      return;
    }
    onReport(selectedReason, evidencePhotos.length > 0 ? evidencePhotos : undefined);
    setSelectedReason(null);
    setShowReportSection(false);
    setEvidencePhotos([]);
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
      setEvidencePhotos([]);
      onClose();
      await showAlert({ title: 'Blocked', message: labels.blockSuccessMsg, variant: 'success' });
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setShowReportSection(false);
    setEvidencePhotos([]);
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
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
                {labels.reportPrompt}
              </ThemedText>

              {reasons.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[
                    styles.reasonOption,
                    {
                      backgroundColor: selectedReason === reason.id ? theme.primary + '15' : theme.backgroundDefault,
                      borderColor: selectedReason === reason.id ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Feather name={reason.icon as any} size={18} color={selectedReason === reason.id ? theme.primary : theme.textSecondary} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    {reason.label}
                  </ThemedText>
                  {selectedReason === reason.id ? (
                    <Feather name="check-circle" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}

              <View style={styles.evidenceSection}>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
                  Add evidence (optional, up to 3 photos)
                </ThemedText>
                <View style={styles.evidenceRow}>
                  {evidencePhotos.map((uri, i) => (
                    <View key={i} style={styles.evidenceThumbnail}>
                      <Image source={{ uri }} style={styles.evidenceImage} />
                      <Pressable
                        style={styles.removeEvidence}
                        onPress={() => setEvidencePhotos(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Feather name="x-circle" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                  {evidencePhotos.length < 3 ? (
                    <Pressable
                      style={[styles.addEvidenceButton, { borderColor: theme.border }]}
                      onPress={addEvidence}
                    >
                      <Feather name="plus" size={24} color="#6C5CE7" />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.reportActions}>
                <Pressable
                  style={[styles.backButton, { borderColor: theme.border }]}
                  onPress={() => { setShowReportSection(false); setSelectedReason(null); setEvidencePhotos([]); }}
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
            </ScrollView>
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
    maxHeight: '85%',
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
  evidenceSection: {
    marginTop: Spacing.lg,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  evidenceThumbnail: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.small,
    overflow: 'hidden',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  removeEvidence: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  addEvidenceButton: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
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
