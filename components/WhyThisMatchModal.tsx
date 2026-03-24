import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { Feather } from './VectorIcons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius } from '../constants/theme';

interface Props {
  visible: boolean;
  profileId: string;
  profileName: string;
  compatibilityScore: number;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
}

export const WhyThisMatchModal: React.FC<Props> = ({
  visible, profileId, profileName, compatibilityScore, onClose, onSendMessage,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && profileId) {
      setResult(null);
      setError(null);
      fetchExplanation();
    }
  }, [visible, profileId]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabase.functions.invoke('explain-match', {
        body: { targetProfileId: profileId },
      });
      if (response.error) throw new Error(response.error.message);
      setResult(response.data);
    } catch (e: any) {
      setError('Could not load explanation. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.header}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.scoreNumber}>{compatibilityScore}%</ThemedText>
                <ThemedText style={styles.scoreLabel}>Match</ThemedText>
              </View>
              <View style={styles.scoreMeta}>
                <ThemedText style={[styles.scoreTitle, { color: theme.text }]}>
                  Why {profileName}?
                </ThemedText>
                <ThemedText style={[styles.scoreSubtitle, { color: theme.textSecondary }]}>
                  AI analyzed your profiles
                </ThemedText>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.primary} size="large" />
                <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Analyzing compatibility...
                </ThemedText>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
                <Pressable style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={fetchExplanation}>
                  <ThemedText style={styles.retryText}>Try Again</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {result && !loading ? (
              <>
                <View style={[styles.headlineCard, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
                  <ThemedText style={[styles.headline, { color: theme.text }]}>
                    "{result.headline}"
                  </ThemedText>
                </View>

                <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Why you'd work well together
                </ThemedText>
                {result.topReasons?.map((reason: string, i: number) => (
                  <View key={i} style={styles.reasonRow}>
                    <View style={styles.reasonDot} />
                    <ThemedText style={[styles.reasonText, { color: theme.text }]}>{reason}</ThemedText>
                  </View>
                ))}

                {result.concerns?.length > 0 && result.concerns[0] ? (
                  <>
                    <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                      Worth keeping in mind
                    </ThemedText>
                    {result.concerns.map((concern: string, i: number) => (
                      <View key={i} style={styles.concernRow}>
                        <Feather name="alert-circle" size={16} color="#FF9800" />
                        <ThemedText style={[styles.concernText, { color: theme.text }]}>{concern}</ThemedText>
                      </View>
                    ))}
                  </>
                ) : null}

                {result.conversationStarter && onSendMessage ? (
                  <View style={[styles.starterCard, { backgroundColor: theme.background }]}>
                    <ThemedText style={[styles.starterLabel, { color: theme.textSecondary }]}>
                      Suggested opener
                    </ThemedText>
                    <ThemedText style={[styles.starterText, { color: theme.text }]}>
                      "{result.conversationStarter}"
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.useStarterButton, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        onSendMessage(result.conversationStarter);
                        onClose();
                      }}
                    >
                      <Feather name="send" size={14} color="#fff" />
                      <ThemedText style={styles.useStarterText}>Use this opener</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  scoreBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  scoreMeta: { flex: 1 },
  scoreTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scoreSubtitle: {
    fontSize: 13,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 30,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: BorderRadius.medium,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  headlineCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
  },
  headline: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  reasonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginTop: 6,
  },
  reasonText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  concernRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  concernText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  starterCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  starterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  starterText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  useStarterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  useStarterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
