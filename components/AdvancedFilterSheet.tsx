import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet, Switch,
} from 'react-native';
import { Feather } from './VectorIcons';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRenterPlan, getRenterPlanLimits } from '../constants/renterPlanLimits';
import { SUBWAY_LINE_COLORS } from '../constants/transitData';
import { PlanBadgeInline } from './LockedFeatureOverlay';
import { PricePickerPair, STANDARD_MAX_VALUE } from './PricePicker';
import {
  ALL_AMENITIES,
  AMENITY_CATEGORIES,
  AmenityCategory,
} from '../constants/amenities';
import type { AdvancedPropertyFilter } from '../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  filters: AdvancedPropertyFilter;
  onApply: (filters: AdvancedPropertyFilter) => void;
  onClose: () => void;
  resultCount: number;
}

const BEDROOM_OPTIONS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Studio', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: 4 },
];

const MOVE_IN_OPTIONS = [
  { label: 'Available Now', key: 'now' },
  { label: 'This Month', key: 'month' },
  { label: 'Next 3 Months', key: '3months' },
];

const SORT_OPTIONS: { label: string; value: AdvancedPropertyFilter['sortBy'] }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price Low', value: 'price_low' },
  { label: 'Price High', value: 'price_high' },
  { label: 'Newest', value: 'newest' },
  { label: 'Rating', value: 'rating' },
];

const SUBWAY_LINES = Object.keys(SUBWAY_LINE_COLORS).filter(
  l => !['PATH', 'LIRR', 'Metro-North'].includes(l)
);

export default function AdvancedFilterSheet({
  visible, filters, onApply, onClose, resultCount,
}: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);

  const [temp, setTemp] = useState<AdvancedPropertyFilter>({ ...filters });
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['price']));
  const [expandedAmenities, setExpandedAmenities] = useState<Set<AmenityCategory>>(new Set(['unit_features']));

  useEffect(() => {
    if (visible) setTemp({ ...filters });
  }, [visible]);

  const toggleSection = (s: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const set = <K extends keyof AdvancedPropertyFilter>(key: K, value: AdvancedPropertyFilter[K]) => {
    setTemp(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setTemp({});

  const activeCount = Object.entries(temp).filter(([_, v]) => {
    if (v === undefined || v === null || v === 'any') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  const renderSectionHeader = (id: string, title: string, locked?: boolean) => {
    const isExpanded = expanded.has(id);
    return (
      <Pressable style={s.sectionHeader} onPress={() => toggleSection(id)}>
        <View style={s.sectionLeft}>
          <Text style={s.sectionTitle}>{title}</Text>
          {locked ? <PlanBadgeInline plan="Plus" locked /> : null}
        </View>
        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
      </Pressable>
    );
  };

  const renderLockedMessage = (feature: string) => (
    <View style={s.lockedBox}>
      <Feather name="lock" size={14} color="#F39C12" />
      <Text style={s.lockedText}>Upgrade to Plus for {feature}</Text>
    </View>
  );

  const renderChip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable key={label} style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  const handleMoveIn = (key: string) => {
    const now = new Date();
    if (key === 'now') {
      set('availableNow', !temp.availableNow);
      set('moveInDateStart', undefined);
      set('moveInDateEnd', undefined);
    } else if (key === 'month') {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      set('availableNow', false);
      set('moveInDateStart', now.toISOString().split('T')[0]);
      set('moveInDateEnd', end.toISOString().split('T')[0]);
    } else if (key === '3months') {
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      set('availableNow', false);
      set('moveInDateStart', now.toISOString().split('T')[0]);
      set('moveInDateEnd', end.toISOString().split('T')[0]);
    }
  };

  const getMoveInActive = (key: string) => {
    if (key === 'now') return !!temp.availableNow;
    if (key === 'month') return !!temp.moveInDateEnd && !temp.availableNow && !temp.moveInDateEnd?.includes(String(new Date().getMonth() + 3));
    if (key === '3months') return !!temp.moveInDateEnd && temp.moveInDateEnd?.includes(String(new Date().getMonth() + 3));
    return false;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={s.headerTitle}>Filters</Text>
          <View style={s.headerRight}>
            {activeCount > 0 ? (
              <Pressable onPress={resetFilters} hitSlop={8}>
                <Text style={s.resetText}>Reset</Text>
              </Pressable>
            ) : <View style={{ width: 40 }} />}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {renderSectionHeader('price', 'Price Range')}
          {expanded.has('price') ? (
            <View style={s.sectionContent}>
              <PricePickerPair
                minValue={temp.minPrice || 500}
                maxValue={temp.maxPrice || STANDARD_MAX_VALUE}
                onMinChange={val => set('minPrice', val > 500 ? val : undefined)}
                onMaxChange={val => set('maxPrice', val < STANDARD_MAX_VALUE ? val : undefined)}
                height={120}
              />
              <View style={s.chipRow}>
                {[1500, 2000, 2500, 3000, 4000].map(price =>
                  renderChip(
                    `Under $${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`,
                    temp.maxPrice === price,
                    () => set('maxPrice', temp.maxPrice === price ? undefined : price)
                  )
                )}
              </View>
            </View>
          ) : null}

          {renderSectionHeader('bedrooms', 'Bedrooms')}
          {expanded.has('bedrooms') ? (
            <View style={s.sectionContent}>
              <View style={s.chipRow}>
                {BEDROOM_OPTIONS.map(opt =>
                  renderChip(
                    opt.label,
                    temp.minBedrooms === opt.value,
                    () => set('minBedrooms', opt.value)
                  )
                )}
              </View>
            </View>
          ) : null}

          {renderSectionHeader('transit', 'Transit Lines', !renterLimits.hasTransitFiltering)}
          {expanded.has('transit') ? (
            !renterLimits.hasTransitFiltering ? renderLockedMessage('transit filters') : (
              <View style={s.sectionContent}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.transitRow}>
                    {SUBWAY_LINES.map(line => {
                      const isSelected = temp.transitLines?.includes(line);
                      const color = SUBWAY_LINE_COLORS[line] || '#999';
                      return (
                        <Pressable
                          key={line}
                          style={[
                            s.transitBadge,
                            { backgroundColor: isSelected ? color : 'rgba(255,255,255,0.08)', borderColor: color },
                          ]}
                          onPress={() => {
                            const current = temp.transitLines || [];
                            set('transitLines',
                              isSelected ? current.filter(l => l !== line) : [...current, line]
                            );
                          }}
                        >
                          <Text style={[s.transitText, { color: isSelected ? '#fff' : color }]}>{line}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={s.subLabel}>Max walk to transit</Text>
                <View style={s.chipRow}>
                  {[5, 10, 15, 20].map(min =>
                    renderChip(
                      `${min} min`,
                      temp.maxWalkToTransitMin === min,
                      () => set('maxWalkToTransitMin', temp.maxWalkToTransitMin === min ? undefined : min)
                    )
                  )}
                </View>
              </View>
            )
          ) : null}

          {renderSectionHeader('moveIn', 'Move-in Date')}
          {expanded.has('moveIn') ? (
            <View style={s.sectionContent}>
              <View style={s.chipRow}>
                {MOVE_IN_OPTIONS.map(opt =>
                  renderChip(
                    opt.label,
                    getMoveInActive(opt.key),
                    () => handleMoveIn(opt.key)
                  )
                )}
              </View>
            </View>
          ) : null}

          {renderSectionHeader('propertyType', 'Property Type')}
          {expanded.has('propertyType') ? (
            <View style={s.sectionContent}>
              <Text style={s.subLabel}>Room Type</Text>
              <View style={s.chipRow}>
                {(['any', 'room', 'entire'] as const).map(type =>
                  renderChip(
                    type === 'any' ? 'Any' : type === 'room' ? 'Room' : 'Entire',
                    temp.roomType === type,
                    () => set('roomType', type)
                  )
                )}
              </View>
              <Text style={s.subLabel}>Lease Type</Text>
              <View style={s.chipRow}>
                {(['any', 'lease', 'sublet'] as const).map(type =>
                  renderChip(
                    type.charAt(0).toUpperCase() + type.slice(1),
                    temp.leaseType === type,
                    () => set('leaseType', type)
                  )
                )}
              </View>
            </View>
          ) : null}

          {renderSectionHeader('host', 'Host Preferences', !renterLimits.hasAdvancedFilters)}
          {expanded.has('host') ? (
            !renterLimits.hasAdvancedFilters ? renderLockedMessage('host filters') : (
              <View style={s.sectionContent}>
                <View style={s.chipRow}>
                  {(['any', 'individual', 'agent', 'company'] as const).map(type =>
                    renderChip(
                      type === 'any' ? 'Any' : type.charAt(0).toUpperCase() + type.slice(1),
                      temp.hostType === type,
                      () => set('hostType', type)
                    )
                  )}
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Verified hosts only</Text>
                  <Switch
                    value={temp.verifiedHostOnly || false}
                    onValueChange={(v) => set('verifiedHostOnly', v)}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#6C5CE7' }}
                    thumbColor="#fff"
                  />
                </View>
                <Text style={s.subLabel}>Min host rating</Text>
                <View style={s.chipRow}>
                  {[3, 3.5, 4, 4.5].map(rating =>
                    renderChip(
                      `${rating}+`,
                      temp.minHostRating === rating,
                      () => set('minHostRating', temp.minHostRating === rating ? undefined : rating)
                    )
                  )}
                </View>
              </View>
            )
          ) : null}

          {renderSectionHeader('amenities', 'Amenities')}
          {expanded.has('amenities') ? (
            <View style={s.sectionContent}>
              <View style={s.chipRow}>
                {[
                  { label: 'Pet Friendly', key: 'petFriendly' as const },
                  { label: 'No Fee', key: 'noFee' as const },
                  { label: 'Furnished', key: 'furnished' as const },
                  { label: 'Utilities Incl.', key: 'utilitiesIncluded' as const },
                ].map(item =>
                  renderChip(
                    item.label,
                    !!temp[item.key],
                    () => set(item.key, !temp[item.key])
                  )
                )}
              </View>
              {AMENITY_CATEGORIES.map(category => {
                const categoryAmenities = ALL_AMENITIES.filter(a => a.category === category.key);
                const selectedInCategory = categoryAmenities.filter(a =>
                  temp.amenities?.includes(a.id)
                ).length;
                const isExpCat = expandedAmenities.has(category.key);
                return (
                  <View key={category.key} style={s.amenityCat}>
                    <Pressable
                      style={s.amenityCatHeader}
                      onPress={() => {
                        setExpandedAmenities(prev => {
                          const next = new Set(prev);
                          next.has(category.key) ? next.delete(category.key) : next.add(category.key);
                          return next;
                        });
                      }}
                    >
                      <View style={s.amenityCatLeft}>
                        <Feather name={category.icon} size={14} color="rgba(255,255,255,0.5)" />
                        <Text style={s.amenityCatLabel}>{category.label}</Text>
                        {selectedInCategory > 0 ? (
                          <View style={s.catBadge}>
                            <Text style={s.catBadgeText}>{selectedInCategory}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Feather name={isExpCat ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.4)" />
                    </Pressable>
                    {isExpCat ? (
                      <View style={s.amenityWrap}>
                        {categoryAmenities.map(amenity => {
                          const isSelected = temp.amenities?.includes(amenity.id) || false;
                          return (
                            <Pressable
                              key={amenity.id}
                              style={[s.amenityChip, isSelected && s.amenityChipActive]}
                              onPress={() => {
                                const current = temp.amenities || [];
                                set('amenities',
                                  isSelected ? current.filter(a => a !== amenity.id) : [...current, amenity.id]
                                );
                              }}
                            >
                              <Feather name={amenity.icon} size={12} color={isSelected ? '#fff' : 'rgba(255,255,255,0.5)'} style={{ marginRight: 4 }} />
                              <Text style={[s.amenityText, isSelected && s.amenityTextActive]}>{amenity.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {renderSectionHeader('roommate', 'Roommate Situation', !renterLimits.hasAdvancedFilters)}
          {expanded.has('roommate') ? (
            !renterLimits.hasAdvancedFilters ? renderLockedMessage('roommate filters') : (
              <View style={s.sectionContent}>
                <Text style={s.subLabel}>Gender preference</Text>
                <View style={s.chipRow}>
                  {(['any', 'female_only', 'male_only'] as const).map(g =>
                    renderChip(
                      g === 'any' ? 'Any' : g === 'female_only' ? 'Female Only' : 'Male Only',
                      temp.genderPreference === g,
                      () => set('genderPreference', g)
                    )
                  )}
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Host lives in unit</Text>
                  <Switch
                    value={temp.hostLivesIn === true}
                    onValueChange={(v) => set('hostLivesIn', v ? true : null)}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#6C5CE7' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            )
          ) : null}

          {renderSectionHeader('sort', 'Sort By')}
          {expanded.has('sort') ? (
            <View style={s.sectionContent}>
              <View style={s.chipRow}>
                {SORT_OPTIONS.map(opt =>
                  renderChip(
                    opt.label,
                    temp.sortBy === opt.value,
                    () => set('sortBy', opt.value)
                  )
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.resultCount}>
            {resultCount} listing{resultCount !== 1 ? 's' : ''}
            {activeCount > 0 ? ` \u00B7 ${activeCount} filter${activeCount > 1 ? 's' : ''}` : ''}
          </Text>
          <Pressable style={s.applyBtn} onPress={() => { onApply(temp); onClose(); }}>
            <Text style={s.applyText}>Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ACCENT = '#ff6b5b';
const PURPLE = '#6C5CE7';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '700' },
  headerRight: { width: 60, alignItems: 'flex-end' },
  resetText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  lockedText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  subLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  transitRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  transitBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  transitText: { fontSize: 14, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  amenityCat: { marginTop: 8 },
  amenityCatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  amenityCatLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amenityCatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  catBadge: { backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  catBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  amenityChipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  amenityText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  amenityTextActive: { color: '#fff' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingTop: 12 },
  resultCount: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  applyBtn: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
