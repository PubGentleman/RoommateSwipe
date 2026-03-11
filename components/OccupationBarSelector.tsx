import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { OCCUPATION_TAGS, getTagLabel } from '../constants/interestTags';
import { Spacing } from '../constants/theme';

const ACCENT = '#ff6b5b';
const SHEET_BG = '#1a1a1a';

interface OccupationBarSelectorProps {
  selectedOccupation: string;
  onChange: (occupation: string) => void;
}

export const OccupationBarSelector = ({ selectedOccupation, onChange }: OccupationBarSelectorProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const hasSelection = !!selectedOccupation;
  const displayLabel = hasSelection ? getTagLabel(selectedOccupation) : 'Select your occupation';

  const handleSelect = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(tagId);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        style={[styles.bar, hasSelection && styles.barSelected]}
        onPress={() => setModalVisible(true)}
      >
        <Feather name="briefcase" size={18} color={hasSelection ? ACCENT : 'rgba(255,255,255,0.4)'} />
        <Text style={[styles.barLabel, hasSelection && styles.barLabelSelected]}>{displayLabel}</Text>
        {hasSelection ? (
          <Feather name="check" size={18} color={ACCENT} />
        ) : (
          <Feather name="chevron-down" size={18} color="rgba(255,255,255,0.4)" />
        )}
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>What do you do?</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {Object.entries(OCCUPATION_TAGS).map(([catKey, category]) => (
                <View key={catKey} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <Feather name={category.icon as any} size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.categoryLabel}>{category.label}</Text>
                  </View>
                  <View style={styles.tagsWrap}>
                    {category.tags.map((tag) => {
                      const isSelected = selectedOccupation === tag.id;
                      return isSelected ? (
                        <Pressable key={tag.id} onPress={() => handleSelect(tag.id)}>
                          <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagPill}>
                            <Feather name="check" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.tagTextSelected}>{tag.label}</Text>
                          </LinearGradient>
                        </Pressable>
                      ) : (
                        <Pressable key={tag.id} style={styles.tagPillUnselected} onPress={() => handleSelect(tag.id)}>
                          <Text style={styles.tagText}>{tag.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Pressable
                style={styles.preferNotToSay}
                onPress={() => { onChange(''); setModalVisible(false); }}
              >
                <Text style={styles.preferNotToSayText}>Prefer not to say</Text>
              </Pressable>

              <View style={{ height: Spacing.xxl }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  barSelected: {
    borderColor: 'rgba(255,107,91,0.4)',
  },
  barLabel: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
  },
  barLabelSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPillUnselected: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  tagTextSelected: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  preferNotToSay: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  preferNotToSayText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
});
