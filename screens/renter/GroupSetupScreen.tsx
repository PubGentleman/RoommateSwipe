import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { createPreformedGroup } from '../../services/preformedGroupService';
import { RhomeLogo } from '../../components/RhomeLogo';

const SIZE_OPTIONS = [2, 3, 4, 5];

interface Props {
  onComplete: (groupId: string, inviteCode: string) => void;
  onSkip?: () => void;
}

export default function GroupSetupScreen({ onComplete, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [groupName, setGroupName] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [memberNames, setMemberNames] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const updateMemberName = (index: number, name: string) => {
    const updated = [...memberNames];
    updated[index] = name;
    setMemberNames(updated);
  };

  const handleSizeChange = (size: number) => {
    setGroupSize(size);
    const othersCount = size - 1;
    const newNames = [...memberNames];
    while (newNames.length < othersCount) newNames.push('');
    setMemberNames(newNames.slice(0, othersCount));
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      const group = await createPreformedGroup({
        name: groupName.trim() || undefined,
        groupSize,
        memberNames,
      });
      if (group) {
        onComplete(group.id, group.invite_code);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 20 }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoWrap}>
        <RhomeLogo size="small" />
      </View>

      <Text style={styles.headline}>Set up your group</Text>
      <Text style={styles.subheadline}>
        You'll be the Group Lead {'\u2014'} you can start searching right away
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Group name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., The Brooklyn Crew"
          placeholderTextColor="#666"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>How many people total?</Text>
        <View style={styles.sizeRow}>
          {SIZE_OPTIONS.map(size => (
            <Pressable
              key={size}
              style={[
                styles.sizeBtn,
                groupSize === size && styles.sizeBtnActive,
              ]}
              onPress={() => handleSizeChange(size)}
            >
              <Text
                style={[
                  styles.sizeBtnText,
                  groupSize === size && styles.sizeBtnTextActive,
                ]}
              >
                {size}{size === 5 ? '+' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Add your roommates</Text>
        {memberNames.map((name, idx) => (
          <TextInput
            key={idx}
            style={[styles.input, { marginBottom: 8 }]}
            placeholder={`Roommate ${idx + 1} first name`}
            placeholderTextColor="#666"
            value={name}
            onChangeText={(text) => updateMemberName(idx, text)}
          />
        ))}
        <Text style={styles.hint}>
          Just first names for now. They'll be invited to join later.
        </Text>
      </View>

      <Pressable
        style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.continueBtnText}>Create Group</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </>
        )}
      </Pressable>

      {onSkip ? (
        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sizeBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: '#22C55E',
  },
  sizeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  sizeBtnTextActive: {
    color: '#22C55E',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});
