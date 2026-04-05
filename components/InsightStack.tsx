import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { QuickInsight } from '../services/quickInsightService';
import InsightChip from './InsightChip';

interface Props {
  insights: QuickInsight[];
  maxVisible?: number;
  onSeeAll?: () => void;
  isPremium?: boolean;
}

export default function InsightStack({ insights, maxVisible = 3, onSeeAll, isPremium }: Props) {
  const visible = insights.slice(0, maxVisible);
  const remaining = insights.length - maxVisible;

  if (insights.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="zap" size={14} color="#ff6b5b" />
        <Text style={styles.headerText}>Compatibility Insights</Text>
      </View>

      {visible.map((insight, i) => (
        <InsightChip key={i} insight={insight} />
      ))}

      {remaining > 0 && onSeeAll ? (
        <Pressable style={styles.seeAllButton} onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See full breakdown (+{remaining} more)</Text>
          <Feather name="chevron-right" size={14} color="#6C5CE7" />
        </Pressable>
      ) : null}

      {!isPremium ? (
        <View style={styles.premiumHint}>
          <Feather name="cpu" size={12} color="#6C5CE7" />
          <Text style={styles.premiumHintText}>Upgrade for AI-powered insights</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  headerText: { color: '#999', fontSize: 12, fontWeight: '600' },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  seeAllText: { color: '#6C5CE7', fontSize: 12, fontWeight: '600' },
  premiumHint: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingTop: 6 },
  premiumHintText: { color: '#6C5CE7', fontSize: 11 },
});
