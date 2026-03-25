import React, { useState } from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Text,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { useTheme } from '../../../hooks/useTheme';
import { Typography, Spacing } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { HostType } from '../../../utils/hostTypeUtils';

const HOST_TYPES: Array<{
  id: HostType;
  icon: string;
  label: string;
  description: string;
  color: string;
  hostOnly: boolean;
  lockWarning: string;
}> = [
  {
    id: 'individual',
    icon: 'user',
    label: 'Individual',
    description: "I'm renting out my own property",
    color: '#6C63FF',
    hostOnly: false,
    lockWarning: 'You can switch between Renter and Host mode at any time.',
  },
  {
    id: 'agent',
    icon: 'award',
    label: 'Licensed Agent',
    description: "I'm a real estate professional",
    color: '#F59E0B',
    hostOnly: true,
    lockWarning:
      'Agent accounts are host-only. To use Rhome as a renter, create a separate renter account.',
  },
  {
    id: 'company',
    icon: 'briefcase',
    label: 'Property Company',
    description: 'I manage multiple properties',
    color: '#22C55E',
    hostOnly: true,
    lockWarning:
      'Company accounts are host-only. To use Rhome as a renter, create a separate renter account.',
  },
];

export function HostTypeSelectScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<HostType | null>(
    user?.hostType ?? null,
  );
  const [saving, setSaving] = useState(false);

  // If the user's host type is already locked, show read-only state
  const isLocked = !!user?.hostTypeLockedAt;
  const lockedType = isLocked
    ? HOST_TYPES.find(t => t.id === user?.hostType)
    : null;

  const selectedType = HOST_TYPES.find(t => t.id === selected);

  function handleSelect(typeId: HostType) {
    if (isLocked) return;
    setSelected(typeId);
  }

  async function handleContinue() {
    if (!selected || !user || saving) return;

    const isFromSettings = user.onboardingStep === 'complete';
    const typeInfo = HOST_TYPES.find(t => t.id === selected)!;

    // Show lock-in confirmation for agents and companies
    if (selected === 'agent' || selected === 'company') {
      Alert.alert(
        `Continue as ${typeInfo.label}?`,
        `${typeInfo.lockWarning}\n\nThis selection cannot be changed later.`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Continue',
            style: 'default',
            onPress: () => proceedWithSelection(selected, isFromSettings),
          },
        ],
      );
      return;
    }

    // Individual — no extra confirmation needed
    await proceedWithSelection(selected, isFromSettings);
  }

  async function proceedWithSelection(
    hostType: HostType,
    isFromSettings: boolean,
  ) {
    setSaving(true);
    try {
      await updateUser({ hostType, role: 'host', hostTypeLockedAt: undefined });

      if (hostType === 'company') {
        navigation.navigate('HostCompanySetup');
      } else if (hostType === 'agent') {
        navigation.navigate('HostAgentSetup');
      } else {
        // Individual — lock immediately and proceed to subscription
        await updateUser({ hostTypeLockedAt: new Date().toISOString() });
        if (isFromSettings) {
          navigation.replace('HostSubscription');
        } else {
          await completeOnboardingStep('plan');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // --- Locked state: user already has a confirmed host type ---
  if (isLocked && lockedType) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + Spacing.xl,
          },
        ]}
      >
        <Text style={[Typography.h2, { color: theme.text, marginBottom: 6 }]}>
          Your Host Type
        </Text>
        <Text
          style={[
            Typography.body,
            { color: theme.textSecondary, marginBottom: Spacing.xl },
          ]}
        >
          This was set when you joined as a host.
        </Text>

        <View
          style={[
            styles.typeCard,
            {
              backgroundColor: lockedType.color + '15',
              borderColor: lockedType.color,
            },
          ]}
        >
          <View
            style={[
              styles.typeIcon,
              { backgroundColor: lockedType.color + '20' },
            ]}
          >
            <Feather name={lockedType.icon} size={22} color={lockedType.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                Typography.body,
                { fontWeight: '700', color: theme.text },
              ]}
            >
              {lockedType.label}
            </Text>
            <Text style={[Typography.small, { color: theme.textSecondary }]}>
              {lockedType.description}
            </Text>
          </View>
          <View style={[styles.checkCircle, { backgroundColor: lockedType.color }]}>
            <Feather name="lock" size={13} color="#fff" />
          </View>
        </View>

        <View style={[styles.lockedNotice, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="info" size={15} color={theme.textSecondary} />
          <Text style={[Typography.small, { color: theme.textSecondary, flex: 1 }]}>
            To change your host type, contact{' '}
            <Text style={{ color: theme.primary }}>support@rhome.app</Text>
          </Text>
        </View>
      </View>
    );
  }

  // --- Selection state ---
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[Typography.h2, { color: theme.text, marginBottom: 6 }]}>
        What describes you?
      </Text>
      <Text
        style={[
          Typography.body,
          { color: theme.textSecondary, marginBottom: Spacing.xl },
        ]}
      >
        This shapes your host experience and can't be changed later.
      </Text>

      {HOST_TYPES.map(type => {
        const isSelected = selected === type.id;
        return (
          <Pressable
            key={type.id}
            style={[
              styles.typeCard,
              {
                backgroundColor: isSelected
                  ? type.color + '15'
                  : theme.card,
                borderColor: isSelected ? type.color : theme.border,
              },
            ]}
            onPress={() => handleSelect(type.id)}
          >
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: type.color + '20' },
              ]}
            >
              <Feather name={type.icon} size={22} color={type.color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  Typography.body,
                  { fontWeight: '700', color: theme.text },
                ]}
              >
                {type.label}
              </Text>
              <Text
                style={[Typography.small, { color: theme.textSecondary }]}
              >
                {type.description}
              </Text>
            </View>

            {isSelected ? (
              <View
                style={[
                  styles.checkCircle,
                  { backgroundColor: type.color },
                ]}
              >
                <Feather name="check" size={14} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {/* Host-only notice — shown when agent or company is selected */}
      {selectedType?.hostOnly && (
        <View
          style={[
            styles.hostOnlyBanner,
            { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' },
          ]}
        >
          <Feather name="info" size={15} color="#F59E0B" />
          <Text style={[Typography.small, { color: theme.text, flex: 1 }]}>
            <Text style={{ fontWeight: '700' }}>Host-only account. </Text>
            To use Rhome as a renter, create a separate renter account.
          </Text>
        </View>
      )}

      <Pressable
        style={[
          styles.continueBtn,
          {
            backgroundColor: selected ? theme.primary : theme.border,
            marginTop: Spacing.xl,
          },
        ]}
        onPress={handleContinue}
        disabled={!selected || saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={[Typography.body, { color: '#fff', fontWeight: '700' }]}
          >
            Continue
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  hostOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  continueBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});
