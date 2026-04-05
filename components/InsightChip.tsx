import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { QuickInsight } from '../services/quickInsightService';

const TYPE_STYLES: Record<string, { bg: string; text: string; iconColor: string }> = {
  strength: { bg: 'rgba(39,174,96,0.12)', text: '#27AE60', iconColor: '#27AE60' },
  shared: { bg: 'rgba(108,92,231,0.12)', text: '#6C5CE7', iconColor: '#6C5CE7' },
  complementary: { bg: 'rgba(52,152,219,0.12)', text: '#3498DB', iconColor: '#3498DB' },
  heads_up: { bg: 'rgba(243,156,18,0.12)', text: '#F39C12', iconColor: '#F39C12' },
  fun: { bg: 'rgba(255,107,91,0.12)', text: '#ff6b5b', iconColor: '#ff6b5b' },
};

interface Props {
  insight: QuickInsight;
  compact?: boolean;
}

export default function InsightChip({ insight, compact }: Props) {
  const style = TYPE_STYLES[insight.type] || TYPE_STYLES.shared;

  return (
    <View style={[styles.chip, { backgroundColor: style.bg }, compact ? styles.chipCompact : null]}>
      <Feather name={insight.icon as any} size={compact ? 12 : 14} color={style.iconColor} />
      <Text
        style={[styles.text, { color: style.text }, compact ? styles.textCompact : null]}
        numberOfLines={compact ? 1 : 2}
      >
        {insight.text}
      </Text>
      {insight.source === 'ai' ? (
        <Feather name="cpu" size={10} color={style.iconColor} style={styles.aiIcon} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginTop: 6 },
  chipCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 12, flex: 1, lineHeight: 16 },
  textCompact: { fontSize: 11 },
  aiIcon: { marginLeft: 2 },
});
