import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Modal, Switch,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from './VectorIcons';
import {
  createSavedSearch, generateSearchName, getSavedSearchLimit,
  getNotifyFrequencyOptions, SavedSearchFilters,
} from '../services/savedSearchService';

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: SavedSearchFilters;
  userId: string;
  currentPlan: string;
  currentSavedCount: number;
  onSaved: () => void;
}

export default function SaveSearchSheet({
  visible, onClose, filters, userId, currentPlan, currentSavedCount, onSaved,
}: Props) {
  const autoName = generateSearchName(filters);
  const [name, setName] = useState(autoName);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily');
  const [saving, setSaving] = useState(false);

  const limit = getSavedSearchLimit(currentPlan);
  const atLimit = currentSavedCount >= limit;
  const frequencyOptions = getNotifyFrequencyOptions(currentPlan);

  useEffect(() => {
    if (visible) {
      setName(generateSearchName(filters));
      setSaving(false);
    }
  }, [visible, filters]);

  const filterSummaryParts: string[] = [];
  if (filters.city) filterSummaryParts.push(filters.city);
  if (filters.neighborhood) filterSummaryParts.push(filters.neighborhood);
  if (filters.minPrice || filters.maxPrice) {
    const priceStr = filters.minPrice && filters.maxPrice
      ? `$${filters.minPrice} - $${filters.maxPrice}`
      : filters.maxPrice ? `Up to $${filters.maxPrice}` : `$${filters.minPrice}+`;
    filterSummaryParts.push(priceStr);
  }
  if (filters.minBedrooms) filterSummaryParts.push(`${filters.minBedrooms}+ bed`);
  if (filters.listingTypes?.length) filterSummaryParts.push(filters.listingTypes.join(', '));
  if (filters.amenities?.length) filterSummaryParts.push(`${filters.amenities.length} amenities`);
  if (filters.petFriendly) filterSummaryParts.push('Pet Friendly');
  if (filters.noFee) filterSummaryParts.push('No Fee');
  if (filters.verifiedOnly) filterSummaryParts.push('Verified Only');
  if (filters.transitLines?.length) filterSummaryParts.push(`${filters.transitLines.length} transit lines`);

  const handleSave = async () => {
    if (atLimit) return;
    setSaving(true);
    try {
      await createSavedSearch(userId, name || autoName, filters, frequency, notifyEnabled);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save search:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>Save This Search</Text>

            {atLimit ? (
              <View style={styles.limitBanner}>
                <Feather name="alert-circle" size={18} color="#F39C12" />
                <Text style={styles.limitText}>
                  You've reached your limit of {limit} saved search{limit !== 1 ? 'es' : ''}.
                  Upgrade to save more.
                </Text>
              </View>
            ) : null}

            <View style={styles.filterSummary}>
              <Text style={styles.filterSummaryLabel}>Filters being saved:</Text>
              <View style={styles.filterChips}>
                {filterSummaryParts.map((part, i) => (
                  <View key={i} style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{part}</Text>
                  </View>
                ))}
                {filterSummaryParts.length === 0 ? (
                  <Text style={styles.noFiltersText}>No filters applied (will match all listings)</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>Search Name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder={autoName}
              placeholderTextColor="#666"
              maxLength={50}
            />

            <View style={styles.notifyRow}>
              <View style={styles.notifyInfo}>
                <Feather name="bell" size={20} color="#ccc" />
                <Text style={styles.notifyLabel}>Notify me of new matches</Text>
              </View>
              <Switch
                value={notifyEnabled}
                onValueChange={setNotifyEnabled}
                trackColor={{ true: '#6C5CE7', false: '#333' }}
                thumbColor="#fff"
              />
            </View>

            {notifyEnabled ? (
              <View style={styles.frequencyRow}>
                <Text style={styles.frequencyLabel}>How often:</Text>
                <View style={styles.frequencyOptions}>
                  {(['instant', 'daily', 'weekly'] as const).map(opt => {
                    const available = frequencyOptions.includes(opt);
                    const selected = frequency === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[
                          styles.frequencyChip,
                          selected && styles.frequencyChipSelected,
                          !available && styles.frequencyChipLocked,
                        ]}
                        onPress={() => { if (available) setFrequency(opt); }}
                        disabled={!available}
                      >
                        <Text style={[
                          styles.frequencyChipText,
                          selected && styles.frequencyChipTextSelected,
                          !available && styles.frequencyChipTextLocked,
                        ]}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </Text>
                        {!available ? (
                          <Feather name="lock" size={10} color="#666" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.usageText}>
              {currentSavedCount} of {limit} saved searches used
            </Text>

            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, (atLimit || saving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={atLimit || saving}
              >
                <Feather name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Search'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetContainer: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,156,18,0.15)', padding: 12, borderRadius: 10, marginBottom: 16, gap: 8 },
  limitText: { flex: 1, color: '#F39C12', fontSize: 13 },
  filterSummary: { marginBottom: 16 },
  filterSummaryLabel: { color: '#999', fontSize: 12, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  filterChipText: { color: '#ccc', fontSize: 12 },
  noFiltersText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  label: { color: '#999', fontSize: 12, marginBottom: 6 },
  nameInput: { backgroundColor: '#141414', color: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  notifyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notifyInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifyLabel: { color: '#fff', fontSize: 15 },
  frequencyRow: { marginBottom: 16 },
  frequencyLabel: { color: '#999', fontSize: 12, marginBottom: 8 },
  frequencyOptions: { flexDirection: 'row', gap: 8 },
  frequencyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#222', borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center', gap: 4 },
  frequencyChipSelected: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  frequencyChipLocked: { opacity: 0.5 },
  frequencyChipText: { color: '#ccc', fontSize: 13 },
  frequencyChipTextSelected: { color: '#fff', fontWeight: '600' },
  frequencyChipTextLocked: { color: '#666' },
  usageText: { color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  cancelText: { color: '#999', fontSize: 15, fontWeight: '600' },
  saveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#6C5CE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
