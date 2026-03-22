import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Platform, Text } from 'react-native';
import { Feather } from './VectorIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius } from '../constants/theme';
import { dispatchInsightTrigger } from '../utils/insightRefresh';

const ACCENT = '#ff6b5b';
const FILTERS_KEY = 'roomdr_match_filters';

export interface MatchFilters {
  budgetMin: number;
  budgetMax: number;
  moveInDate: string | null;
  roomTypes: string[];
  lifestyle: string[];
  searchRadius: number | null;
  minCompatibility: number;
}

export const DEFAULT_FILTERS: MatchFilters = {
  budgetMin: 500,
  budgetMax: 5000,
  moveInDate: null,
  roomTypes: [],
  lifestyle: [],
  searchRadius: 5,
  minCompatibility: 0,
};

const BUDGET_MIN = 500;
const BUDGET_MAX = 5000;
const BUDGET_STEP = 100;

const MOVE_IN_OPTIONS = [
  { label: 'ASAP', value: 'asap' },
  { label: 'Within 30 days', value: '30days' },
  { label: 'Within 3 months', value: '3months' },
];

const ROOM_TYPE_OPTIONS = [
  { key: 'Private Room', label: 'Private Room', icon: 'user' as const },
  { key: 'Shared Room', label: 'Shared Room', icon: 'users' as const },
  { key: 'Entire Unit', label: 'Entire Unit', icon: 'home' as const },
  { key: 'Studio', label: 'Studio', icon: 'square' as const },
];

const LIFESTYLE_OPTIONS = ['Pet Friendly', 'Non-Smoker', 'Remote Worker', 'Students OK', 'Night Owl', 'Early Bird'];

const RADIUS_OPTIONS = [
  { label: 'Nearby', value: 2 },
  { label: '5 mi', value: 5 },
  { label: '10 mi', value: 10 },
  { label: '25 mi', value: 25 },
];

const COMPATIBILITY_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '60%+', value: 60 },
  { label: '75%+', value: 75 },
  { label: '90%+', value: 90 },
];

export const getActiveFilterCount = (filters: MatchFilters): number => {
  let count = 0;
  if (filters.budgetMin > BUDGET_MIN || filters.budgetMax < BUDGET_MAX) count++;
  if (filters.moveInDate) count++;
  if (filters.roomTypes.length > 0) count += filters.roomTypes.length;
  if (filters.lifestyle.length > 0) count += filters.lifestyle.length;
  if (filters.searchRadius && filters.searchRadius !== 5) count++;
  if (filters.minCompatibility > 0) count++;
  return count;
};

export const getActiveFilterChips = (filters: MatchFilters): { label: string; key: string }[] => {
  const chips: { label: string; key: string }[] = [];
  if (filters.budgetMin > BUDGET_MIN || filters.budgetMax < BUDGET_MAX) {
    chips.push({ label: `$${filters.budgetMin.toLocaleString()}-$${filters.budgetMax.toLocaleString()}`, key: 'budget' });
  }
  if (filters.moveInDate) {
    const label = MOVE_IN_OPTIONS.find(o => o.value === filters.moveInDate)?.label || filters.moveInDate;
    chips.push({ label, key: 'moveIn' });
  }
  filters.roomTypes.forEach(rt => chips.push({ label: rt, key: `room-${rt}` }));
  filters.lifestyle.forEach(ls => chips.push({ label: ls, key: `life-${ls}` }));
  if (filters.searchRadius && filters.searchRadius !== 5) {
    const opt = RADIUS_OPTIONS.find(o => o.value === filters.searchRadius);
    chips.push({ label: opt?.label || `${filters.searchRadius}mi`, key: 'radius' });
  }
  if (filters.minCompatibility > 0) {
    chips.push({ label: `${filters.minCompatibility}%+ match`, key: 'compat' });
  }
  return chips;
};

export const removeFilterChip = (filters: MatchFilters, key: string): MatchFilters => {
  const updated = { ...filters };
  if (key === 'budget') {
    updated.budgetMin = BUDGET_MIN;
    updated.budgetMax = BUDGET_MAX;
  } else if (key === 'moveIn') {
    updated.moveInDate = null;
  } else if (key.startsWith('room-')) {
    updated.roomTypes = filters.roomTypes.filter(r => `room-${r}` !== key);
  } else if (key.startsWith('life-')) {
    updated.lifestyle = filters.lifestyle.filter(l => `life-${l}` !== key);
  } else if (key === 'radius') {
    updated.searchRadius = 5;
  } else if (key === 'compat') {
    updated.minCompatibility = 0;
  }
  return updated;
};

export const loadSavedFilters = async (): Promise<MatchFilters> => {
  try {
    const saved = await AsyncStorage.getItem(FILTERS_KEY);
    if (saved) return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_FILTERS };
};

export const saveFilters = async (filters: MatchFilters) => {
  try {
    await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    dispatchInsightTrigger('filter_change');
  } catch {}
};

export const applyFiltersToProfiles = (profiles: any[], filters: MatchFilters): any[] => {
  return profiles.filter(p => {
    if (filters.budgetMin > BUDGET_MIN || filters.budgetMax < BUDGET_MAX) {
      if (p.budget && (p.budget < filters.budgetMin || p.budget > filters.budgetMax)) return false;
    }
    if (filters.moveInDate && p.preferences?.moveInDate) {
      const profileDate = new Date(p.preferences.moveInDate);
      const now = new Date();
      if (filters.moveInDate === 'asap') {
        const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        if (profileDate > twoWeeks) return false;
      } else if (filters.moveInDate === '30days') {
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (profileDate > thirtyDays) return false;
      } else if (filters.moveInDate === '3months') {
        const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        if (profileDate > threeMonths) return false;
      }
    }
    if (filters.roomTypes.length > 0) {
      let profileType = 'Private Room';
      if (p.lookingFor === 'entire_apartment') profileType = 'Entire Unit';
      else if (p.preferences?.bedrooms === 1) profileType = 'Studio';
      else if (p.preferences?.bedrooms && p.preferences.bedrooms >= 3) profileType = 'Shared Room';
      if (!filters.roomTypes.includes(profileType)) return false;
    }
    if (filters.lifestyle.length > 0) {
      for (const pref of filters.lifestyle) {
        if (pref === 'Pet Friendly' && p.lifestyle?.pets === false) return false;
        if (pref === 'Non-Smoker' && p.lifestyle?.smoking === true) return false;
        if (pref === 'Remote Worker' && p.lifestyle?.workSchedule && !['Remote', 'Hybrid'].includes(p.lifestyle.workSchedule)) return false;
        if (pref === 'Night Owl' && p.lifestyle?.workSchedule === 'Office') continue;
        if (pref === 'Early Bird' && p.lifestyle?.workSchedule === 'Night Shift') return false;
      }
    }
    if (filters.minCompatibility > 0 && (p.compatibility || 0) < filters.minCompatibility) return false;
    return true;
  });
};

const SectionLabel = ({ icon, title }: { icon: string; title: string }) => (
  <View style={s.sectionLabelRow}>
    <Feather name={icon as any} size={13} color={ACCENT} />
    <ThemedText style={s.sectionLabel}>{title}</ThemedText>
  </View>
);

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: MatchFilters) => void;
  currentFilters: MatchFilters;
  allProfiles: any[];
  userPlan?: string;
}

export const RoommateFilterSheet: React.FC<Props> = ({ visible, onClose, onApply, currentFilters, allProfiles, userPlan = 'basic' }) => {
  const isLifestyleLocked = userPlan === 'basic';
  const [filters, setFilters] = useState<MatchFilters>({ ...currentFilters });

  useEffect(() => {
    if (visible) setFilters({ ...currentFilters });
  }, [visible]);

  const activeCount = getActiveFilterCount(filters);
  const liveMatchCount = applyFiltersToProfiles(allProfiles, filters).length;

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const handleReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handleApply = () => {
    if (isLifestyleLocked) {
      onApply({ ...filters, lifestyle: [] });
    } else {
      onApply(filters);
    }
  };

  const budgetSteps = Math.round((BUDGET_MAX - BUDGET_MIN) / BUDGET_STEP);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <ScrollView showsVerticalScrollIndicator={false} style={s.scrollContent}>
          <ThemedText style={s.title}>Filters</ThemedText>

          <View style={s.filterCountBar}>
            <Feather name="users" size={14} color={ACCENT} />
            <ThemedText style={s.filterCountText}>
              Showing <ThemedText style={s.filterCountNum}>{liveMatchCount}</ThemedText> roommate{liveMatchCount !== 1 ? 's' : ''}
            </ThemedText>
          </View>

          <View style={s.section}>
            <SectionLabel icon="dollar-sign" title="Budget Range" />
            <ThemedText style={s.budgetDisplay}>
              ${filters.budgetMin.toLocaleString()} — ${filters.budgetMax.toLocaleString()}/mo
            </ThemedText>
            <View style={s.sliderRow}>
              <ThemedText style={s.sliderLabel}>Min</ThemedText>
              <View style={s.sliderTrack}>
                <View style={[s.sliderFill, {
                  left: `${((filters.budgetMin - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%`,
                  right: `${100 - ((filters.budgetMax - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%`,
                }]} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.sliderTicks}
                  scrollEnabled={false}
                >
                  {Array.from({ length: budgetSteps + 1 }, (_, i) => {
                    const val = BUDGET_MIN + i * BUDGET_STEP;
                    const isInRange = val >= filters.budgetMin && val <= filters.budgetMax;
                    return (
                      <Pressable
                        key={val}
                        style={[s.sliderTick, isInRange ? s.sliderTickActive : null]}
                        onPress={() => {
                          if (val <= filters.budgetMax) setFilters(f => ({ ...f, budgetMin: val }));
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <View style={s.sliderRow}>
              <ThemedText style={s.sliderLabel}>Max</ThemedText>
              <View style={s.sliderTrack}>
                <View style={[s.sliderFill, {
                  left: `${((filters.budgetMin - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%`,
                  right: `${100 - ((filters.budgetMax - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%`,
                }]} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.sliderTicks}
                  scrollEnabled={false}
                >
                  {Array.from({ length: budgetSteps + 1 }, (_, i) => {
                    const val = BUDGET_MIN + i * BUDGET_STEP;
                    const isInRange = val >= filters.budgetMin && val <= filters.budgetMax;
                    return (
                      <Pressable
                        key={val}
                        style={[s.sliderTick, isInRange ? s.sliderTickActive : null]}
                        onPress={() => {
                          if (val >= filters.budgetMin) setFilters(f => ({ ...f, budgetMax: val }));
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <View style={s.budgetPresets}>
              {[
                { label: '$500-$1,000', min: 500, max: 1000 },
                { label: '$1,000-$2,000', min: 1000, max: 2000 },
                { label: '$2,000-$3,500', min: 2000, max: 3500 },
                { label: '$3,500+', min: 3500, max: 5000 },
              ].map(preset => {
                const isActive = filters.budgetMin === preset.min && filters.budgetMax === preset.max;
                return (
                  <Pressable
                    key={preset.label}
                    style={[s.filterChip, isActive ? s.filterChipActive : null]}
                    onPress={() => setFilters(f => ({ ...f, budgetMin: preset.min, budgetMax: preset.max }))}
                  >
                    <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{preset.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <SectionLabel icon="calendar" title="Move-in Date" />
            <View style={s.chipRow}>
              {MOVE_IN_OPTIONS.map(opt => {
                const isActive = filters.moveInDate === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[s.filterChip, isActive ? s.filterChipActive : null]}
                    onPress={() => setFilters(f => ({ ...f, moveInDate: isActive ? null : opt.value }))}
                  >
                    <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <SectionLabel icon="home" title="Room Type" />
            <View style={s.chipRow}>
              {ROOM_TYPE_OPTIONS.map(opt => {
                const isActive = filters.roomTypes.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[s.filterChip, isActive ? s.filterChipActive : null]}
                    onPress={() => setFilters(f => ({ ...f, roomTypes: toggleArrayItem(f.roomTypes, opt.key) }))}
                  >
                    <Feather
                      name={opt.icon}
                      size={12}
                      color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'}
                      style={{ marginRight: 5 }}
                    />
                    <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <SectionLabel icon="sun" title="Lifestyle" />
              {isLifestyleLocked ? (
                <View style={s.lockBadge}>
                  <Feather name="lock" size={10} color="#FFFFFF" />
                  <ThemedText style={s.lockBadgeText}>Plus</ThemedText>
                </View>
              ) : null}
            </View>
            {isLifestyleLocked ? (
              <View style={s.lockedOverlay}>
                <View style={s.lockedChipRow}>
                  {LIFESTYLE_OPTIONS.map(ls => (
                    <View key={ls} style={[s.filterChip, { opacity: 0.35 }]}>
                      <ThemedText style={[s.filterChipText, { opacity: 0.5 }]}>{ls}</ThemedText>
                    </View>
                  ))}
                </View>
                <View style={s.lockedMessage}>
                  <Feather name="lock" size={16} color={ACCENT} />
                  <ThemedText style={s.lockedMessageText}>Upgrade to Plus to unlock lifestyle filters</ThemedText>
                </View>
              </View>
            ) : (
              <View style={s.chipRow}>
                {LIFESTYLE_OPTIONS.map(ls => {
                  const isActive = filters.lifestyle.includes(ls);
                  return (
                    <Pressable
                      key={ls}
                      style={[s.filterChip, isActive ? s.filterChipActive : null]}
                      onPress={() => setFilters(f => ({ ...f, lifestyle: toggleArrayItem(f.lifestyle, ls) }))}
                    >
                      <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{ls}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={s.section}>
            <SectionLabel icon="map-pin" title="Search Radius" />
            <View style={s.chipRow}>
              {RADIUS_OPTIONS.map(opt => {
                const isActive = filters.searchRadius === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[s.filterChip, isActive ? s.filterChipActive : null]}
                    onPress={() => setFilters(f => ({ ...f, searchRadius: isActive ? null : opt.value }))}
                  >
                    <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <SectionLabel icon="heart" title="Minimum Compatibility" />
            <View style={s.compatRow}>
              {COMPATIBILITY_OPTIONS.map(opt => {
                const isActive = filters.minCompatibility === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[s.compatChip, isActive ? s.filterChipActive : null]}
                    onPress={() => setFilters(f => ({ ...f, minCompatibility: opt.value }))}
                  >
                    <ThemedText style={[s.filterChipText, isActive ? s.filterChipTextActive : null]}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={s.footer}>
          <Pressable style={s.resetBtn} onPress={handleReset}>
            <ThemedText style={s.resetBtnText}>Reset</ThemedText>
          </Pressable>
          <Pressable style={s.applyBtn} onPress={handleApply}>
            <ThemedText style={s.applyBtnText}>
              Apply{activeCount > 0 ? ` \u00B7 ${activeCount} filter${activeCount !== 1 ? 's' : ''}` : ''}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  filterCountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 20,
  },
  filterCountText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  filterCountNum: {
    color: ACCENT,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  budgetDisplay: {
    fontSize: 18,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    width: 28,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  sliderTicks: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sliderTick: {
    width: 4,
    height: 6,
    marginRight: 2,
    backgroundColor: 'transparent',
  },
  sliderTickActive: {
    backgroundColor: 'transparent',
  },
  budgetPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  compatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compatChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },
  lockedOverlay: {
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginTop: 12,
  },
  lockedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  lockedMessageText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
