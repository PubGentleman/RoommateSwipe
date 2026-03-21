import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Text } from 'react-native';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { INTEREST_TAGS, getTagLabel } from '../constants/interestTags';
import { validateInterestTags } from '../utils/profileReminderUtils';
import { Spacing } from '../constants/theme';

const ACCENT = '#ff6b5b';
const SHEET_BG = '#1a1a1a';

const CATEGORY_ORDER = ['lifestyle', 'habits', 'hobbies', 'social', 'diet'] as const;
const REQUIRED_CATEGORIES = ['lifestyle', 'habits', 'hobbies', 'social', 'diet'];

type CategoryKey = typeof CATEGORY_ORDER[number];

const CATEGORY_META: Record<CategoryKey, { required: boolean }> = {
  lifestyle: { required: true },
  habits: { required: true },
  hobbies: { required: true },
  social: { required: true },
  diet: { required: true },
};

const TAG_IDS_BY_CATEGORY: Record<string, string[]> = {};
for (const [key, cat] of Object.entries(INTEREST_TAGS)) {
  TAG_IDS_BY_CATEGORY[key] = cat.tags.map(t => t.id);
}

interface InterestCategoryBarsProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export const InterestCategoryBars = ({ selectedTags: rawSelectedTags, onChange, maxTags = 10 }: InterestCategoryBarsProps) => {
  const selectedTags = Array.isArray(rawSelectedTags) ? rawSelectedTags : [];
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);
  const [tempSelection, setTempSelection] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const tagsByCategory = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const key of CATEGORY_ORDER) {
      result[key] = selectedTags.filter(t => TAG_IDS_BY_CATEGORY[key]?.includes(t));
    }
    return result;
  }, [selectedTags]);

  const validation = useMemo(() => {
    return validateInterestTags(selectedTags, TAG_IDS_BY_CATEGORY);
  }, [selectedTags]);

  const openModal = (catKey: CategoryKey) => {
    setTempSelection(tagsByCategory[catKey] || []);
    setOpenCategory(catKey);
  };

  const toggleTempTag = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tempSelection.includes(tagId)) {
      setTempSelection(tempSelection.filter(t => t !== tagId));
    } else {
      const otherCategoryCount = selectedTags.filter(t => !TAG_IDS_BY_CATEGORY[openCategory!]?.includes(t)).length;
      if (otherCategoryCount + tempSelection.length >= maxTags) return;
      setTempSelection([...tempSelection, tagId]);
    }
  };

  const confirmSelection = () => {
    if (!openCategory) return;
    const otherTags = selectedTags.filter(t => !TAG_IDS_BY_CATEGORY[openCategory]?.includes(t));
    onChange([...otherTags, ...tempSelection]);
    setOpenCategory(null);
  };

  const currentCategory = openCategory ? INTEREST_TAGS[openCategory] : null;
  const isRequired = openCategory ? CATEGORY_META[openCategory].required : false;
  const doneDisabled = isRequired && tempSelection.length === 0;

  return (
    <View>
      <View style={styles.dotsRow}>
        {CATEGORY_ORDER.map((key) => {
          const hasSelection = (tagsByCategory[key]?.length || 0) > 0;
          const meta = CATEGORY_META[key];
          return (
            <View key={key} style={styles.dotItem}>
              <View style={[styles.dot, hasSelection && styles.dotFilled]} />
              <Text style={styles.dotLabel}>{INTEREST_TAGS[key].label}</Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.totalCount, selectedTags.length >= 5 && { color: ACCENT }]}>
        {selectedTags.length} / 5 tags selected
      </Text>

      {CATEGORY_ORDER.map((key) => {
        const category = INTEREST_TAGS[key];
        const meta = CATEGORY_META[key];
        const catTags = tagsByCategory[key] || [];
        const hasSelection = catTags.length > 0;

        return (
          <Pressable key={key} style={({ pressed }) => [styles.categoryBar, hasSelection && styles.categoryBarFilled, !hasSelection && meta.required && styles.categoryBarRequired, pressed && { opacity: 0.7 }]} onPress={() => openModal(key)} android_ripple={{ color: 'rgba(255,107,91,0.15)' }}>
            <View style={styles.categoryBarLeft}>
              <Feather name={category.icon as any} size={18} color="#fff" />
              <Text style={styles.categoryBarName}>{category.label}</Text>
            </View>
            <View style={styles.categoryBarRight}>
              {hasSelection ? (
                <>
                  <View style={styles.selectedPills}>
                    {catTags.slice(0, 2).map(tagId => (
                      <View key={tagId} style={styles.miniPill}>
                        <Text style={styles.miniPillText}>{getTagLabel(tagId)}</Text>
                      </View>
                    ))}
                    {catTags.length > 2 ? (
                      <Text style={styles.moreText}>+{catTags.length - 2} more</Text>
                    ) : null}
                  </View>
                  <View style={styles.checkCircle}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                </>
              ) : (
                <View style={[styles.badge, meta.required ? styles.badgeRequired : styles.badgeOptional]}>
                  <Text style={[styles.badgeText, meta.required ? styles.badgeTextRequired : styles.badgeTextOptional]}>
                    {meta.required ? 'Required' : 'Optional'}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {!validation.valid && validation.message ? (
        <Text style={styles.helperText}>{validation.message}</Text>
      ) : null}

      <Modal visible={!!openCategory} transparent animationType="slide" onRequestClose={() => setOpenCategory(null)}>
        <Pressable style={styles.overlay} onPress={() => setOpenCategory(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                {currentCategory ? <Feather name={currentCategory.icon as any} size={18} color="#fff" /> : null}
                <Text style={styles.sheetTitle}>{currentCategory?.label || ''}</Text>
              </View>
              <Pressable onPress={() => setOpenCategory(null)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>
            <Text style={styles.sheetSubtext}>
              {isRequired ? 'Select at least 1' : 'Optional \u2014 select any that apply'}
            </Text>

            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <View style={styles.tagsWrap}>
                {currentCategory?.tags.map((tag) => {
                  const isSelected = tempSelection.includes(tag.id);
                  return isSelected ? (
                    <Pressable key={tag.id} onPress={() => toggleTempTag(tag.id)}>
                      <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagPill}>
                        <Feather name="check" size={12} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.tagTextSelected}>{tag.label}</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Pressable key={tag.id} style={styles.tagPillUnselected} onPress={() => toggleTempTag(tag.id)}>
                      <Text style={styles.tagText}>{tag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable onPress={confirmSelection} disabled={doneDisabled}>
                <LinearGradient
                  colors={['#ff6b5b', '#e83a2a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.doneButton, doneDisabled && { opacity: 0.4 }]}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  dotItem: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 4,
  },
  dotFilled: {
    backgroundColor: ACCENT,
  },
  dotLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  dotOptional: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontStyle: 'italic',
  },
  totalCount: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  categoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryBarFilled: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  categoryBarRequired: {
    borderColor: 'rgba(255,107,91,0.25)',
  },
  categoryBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryBarName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  categoryBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  selectedPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  miniPill: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  miniPillText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
  },
  moreText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeRequired: {
    backgroundColor: 'rgba(255,107,91,0.15)',
  },
  badgeOptional: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextRequired: {
    color: ACCENT,
  },
  badgeTextOptional: {
    color: 'rgba(255,255,255,0.4)',
  },
  helperText: {
    color: ACCENT,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
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
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  sheetSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
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
  sheetFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  doneButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
