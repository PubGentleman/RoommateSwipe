import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { OCCUPATION_TAGS, getTagLabel } from '../../constants/interestTags';
import * as Haptics from 'expo-haptics';

const ACCENT = '#ff6b5b';

export const OccupationPickerScreen = () => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(user?.profileData?.occupation || '');
  const [saving, setSaving] = useState(false);

  const handleSelect = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(tagId === selected ? '' : tagId);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateUser({
        profileData: {
          ...user?.profileData,
          occupation: selected,
        },
      });
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.headerTitle}>What do you do?</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>Your occupation helps find compatible roommates</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(OCCUPATION_TAGS).map(([catKey, category]) => (
          <View key={catKey} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Feather name={category.icon as any} size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.categoryLabel}>{category.label}</Text>
            </View>
            <View style={styles.chipGrid}>
              {category.tags.map((tag) => {
                const isSelected = selected === tag.id;
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.chip, isSelected ? styles.chipSelected : null]}
                    onPress={() => handleSelect(tag.id)}
                  >
                    <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                      {tag.label}
                    </Text>
                    {isSelected ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {selected ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.selectedRow}>
            <Feather name="briefcase" size={14} color={ACCENT} />
            <Text style={styles.selectedLabel}>{getTagLabel(selected)}</Text>
          </View>
          <Pressable onPress={handleSave} disabled={saving} style={{ opacity: saving ? 0.5 : 1 }}>
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
