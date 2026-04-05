import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { getWeightProfile, updateWeightProfile, MatchWeightProfile } from '../../services/matchWeightService';

const PRIORITY_FACTORS = [
  { key: 'weight_location', label: 'Location Match', icon: 'map-pin' as const, description: 'How important is living in the same area?' },
  { key: 'weight_budget', label: 'Budget Alignment', icon: 'dollar-sign' as const, description: 'How close should your budgets be?' },
  { key: 'weight_sleep', label: 'Sleep Schedule', icon: 'moon' as const, description: 'How important is matching sleep times?' },
  { key: 'weight_cleanliness', label: 'Cleanliness', icon: 'droplet' as const, description: 'How important is cleanliness compatibility?' },
  { key: 'weight_smoking', label: 'Smoking Preferences', icon: 'slash' as const, description: 'How much does smoking preference matter?' },
  { key: 'weight_pets', label: 'Pet Compatibility', icon: 'heart' as const, description: 'How important is pet preference alignment?' },
  { key: 'weight_lifestyle', label: 'Lifestyle Match', icon: 'activity' as const, description: 'Hobbies, interests, daily routine alignment.' },
  { key: 'weight_social', label: 'Social Style', icon: 'users' as const, description: 'Guest policy, noise tolerance, interaction level.' },
];

const WEIGHT_LABELS = ['Not important', 'Slightly', 'Somewhat', 'Important', 'Very', 'Critical'];

export default function MatchPrioritiesScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<MatchWeightProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) {
      getWeightProfile(user.id)
        .then(p => { setProfile(p); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [user]);

  const handleSliderChange = useCallback((key: string, value: number) => {
    setProfile(prev => {
      if (!prev) return prev;
      return { ...prev, [key]: Math.round(value) } as MatchWeightProfile;
    });
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!profile || !user) return;
    setSaving(true);
    try {
      const updates: any = {};
      for (const factor of PRIORITY_FACTORS) {
        updates[factor.key] = (profile as any)[factor.key];
      }
      await updateWeightProfile(user.id, updates);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save priorities:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!profile) return;
    const reset = { ...profile };
    for (const factor of PRIORITY_FACTORS) {
      (reset as any)[factor.key] = 5;
    }
    setProfile(reset);
    setHasChanges(true);
  };

  const getWeightLabel = (value: number): string => {
    const idx = Math.min(Math.floor(value / 2), WEIGHT_LABELS.length - 1);
    return WEIGHT_LABELS[idx];
  };

  if (loading || !profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Match Priorities</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerText}>
          Adjust what matters most to you. Your matches will be ranked based on these priorities.
        </Text>

        {profile.total_swipes_analyzed >= 20 ? (
          <View style={styles.learningBanner}>
            <Feather name="zap" size={16} color="#F39C12" />
            <Text style={styles.learningText}>
              Analyzed {profile.total_swipes_analyzed} swipes to fine-tune your matches
            </Text>
          </View>
        ) : null}

        {PRIORITY_FACTORS.map(factor => {
          const value = (profile as any)[factor.key] as number;
          return (
            <View key={factor.key} style={styles.factorCard}>
              <View style={styles.factorHeader}>
                <View style={styles.iconCircle}>
                  <Feather name={factor.icon} size={16} color="#6C5CE7" />
                </View>
                <Text style={styles.factorLabel}>{factor.label}</Text>
                <Text style={[styles.factorValue, {
                  color: value >= 7 ? '#3ECF8E' : value <= 3 ? '#ef4444' : '#F39C12',
                }]}>
                  {value}/10
                </Text>
              </View>
              <Text style={styles.factorDescription}>{factor.description}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={value}
                onValueChange={(v) => handleSliderChange(factor.key, v)}
                minimumTrackTintColor="#6C5CE7"
                maximumTrackTintColor="#333"
                thumbTintColor="#6C5CE7"
              />
              <Text style={styles.weightLabel}>{getWeightLabel(value)}</Text>
            </View>
          );
        })}

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Feather name="refresh-cw" size={14} color="#999" />
          <Text style={styles.resetText}>Reset to Defaults</Text>
        </Pressable>
      </ScrollView>

      {hasChanges ? (
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Priorities'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: { padding: 16, paddingBottom: 100 },
  headerText: { color: '#A0A0A0', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  learningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243,156,18,0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  learningText: { color: '#F39C12', fontSize: 13, flex: 1 },
  factorCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  factorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108,92,231,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorLabel: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  factorValue: { fontSize: 15, fontWeight: '700' },
  factorDescription: { color: '#A0A0A0', fontSize: 12, marginBottom: 8, marginLeft: 42 },
  slider: { width: '100%', height: 36 },
  weightLabel: { color: '#A0A0A0', fontSize: 11, textAlign: 'center' },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  resetText: { color: '#999', fontSize: 14 },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
