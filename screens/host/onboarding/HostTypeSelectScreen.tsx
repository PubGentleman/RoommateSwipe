import React, { useState } from 'react';
import {
  View, Pressable, ActivityIndicator, StyleSheet, Text,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { useTheme } from '../../../hooks/useTheme';
import { Typography, Spacing } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StorageService } from '../../../utils/storage';
import type { HostType } from '../../../utils/hostTypeUtils';

const HOST_TYPES: Array<{ id: HostType; icon: string; label: string; description: string; color: string }> = [
  {
    id: 'individual',
    icon: 'user',
    label: 'Individual',
    description: "I'm renting my own property",
    color: '#6C63FF',
  },
  {
    id: 'company',
    icon: 'briefcase',
    label: 'Company',
    description: 'I manage multiple properties',
    color: '#22C55E',
  },
  {
    id: 'agent',
    icon: 'award',
    label: 'Licensed Agent',
    description: "I'm a real estate agent",
    color: '#F59E0B',
  },
];

export function HostTypeSelectScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<HostType | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const isFromSettings = user.onboardingStep === 'complete';
      await updateUser({ hostType: selected, hostTypeLockedAt: undefined });

      if (selected === 'company') {
        navigation.navigate('HostCompanySetup');
      } else if (selected === 'agent') {
        navigation.navigate('HostAgentSetup');
      } else {
        await updateUser({ hostTypeLockedAt: new Date().toISOString() });
        if (isFromSettings) {
          navigation.replace('HostSubscription');
        } else {
          await completeOnboardingStep('plan');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.xl }]}>
      <Text style={[Typography.h2, { color: theme.text, marginBottom: 6 }]}>
        What describes you?
      </Text>
      <Text style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
        This helps us personalise your host experience.
      </Text>

      {HOST_TYPES.map(type => {
        const isSelected = selected === type.id;
        return (
          <Pressable
            key={type.id}
            style={[
              styles.typeCard,
              {
                backgroundColor: isSelected ? type.color + '15' : theme.card,
                borderColor: isSelected ? type.color : theme.border,
              },
            ]}
            onPress={() => setSelected(type.id)}
          >
            <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
              <Feather name={type.icon} size={22} color={type.color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[Typography.body, { fontWeight: '700', color: theme.text }]}>
                {type.label}
              </Text>
              <Text style={[Typography.small, { color: theme.textSecondary }]}>
                {type.description}
              </Text>
            </View>

            {isSelected ? (
              <View style={[styles.checkCircle, { backgroundColor: type.color }]}>
                <Feather name="check" size={14} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Pressable
        style={[
          styles.continueBtn,
          { backgroundColor: selected ? theme.primary : theme.border, marginTop: Spacing.xl },
        ]}
        onPress={handleContinue}
        disabled={!selected || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={[Typography.body, { color: '#fff', fontWeight: '700' }]}>
              Continue
            </Text>
        }
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});
