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
import { isHostTypeEditable, type HostType } from '../../../utils/hostTypeUtils';

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
    label: 'Host',
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

const BENEFITS_BY_TYPE: Record<string, Array<{ icon: string; text: string }>> = {
  individual: [
    { icon: 'users', text: 'Reach thousands of verified renters actively looking' },
    { icon: 'dollar-sign', text: 'No listing fees — free to post and manage' },
    { icon: 'zap', text: 'Smart AI matching connects your listings to ideal tenants' },
    { icon: 'bell', text: 'Instant notifications when renters show interest' },
  ],
  agent: [
    { icon: 'users', text: 'Reach thousands of verified renters actively looking' },
    { icon: 'dollar-sign', text: 'No listing fees — free to post and manage' },
    { icon: 'zap', text: 'Smart AI matching connects your listings to ideal tenants' },
    { icon: 'bell', text: 'Instant notifications when renters show interest' },
  ],
  company: [
    { icon: 'users', text: 'Reach thousands of verified renters actively looking' },
    { icon: 'dollar-sign', text: 'No listing fees — free to post and manage' },
    { icon: 'zap', text: 'Smart AI matching connects your listings to ideal tenants' },
    { icon: 'bell', text: 'Instant notifications when renters show interest' },
  ],
};

export function HostTypeSelectScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<HostType | null>(
    user?.hostType ?? null,
  );
  const [saving, setSaving] = useState(false);

  const hasValidLock = !!user?.hostTypeLockedAt && !!user?.hostType;
  const isLocked = hasValidLock && !isHostTypeEditable(user?.hostTypeLockedAt || null);
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
      if (hostType === 'company') {
        await updateUser({ hostType, role: 'host', hostTypeLockedAt: undefined });
        navigation.navigate('HostCompanySetup');
      } else if (hostType === 'agent') {
        await updateUser({ hostType, role: 'host', hostTypeLockedAt: undefined });
        navigation.navigate('HostAgentSetup');
      } else {
        await updateUser({
          hostType,
          role: 'host',
          hostTypeLockedAt: new Date().toISOString(),
          hasCompletedHostOnboarding: true,
          activeMode: 'host' as 'renter' | 'host',
        });
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
            <Text style={{ color: theme.primary }}>hello@rhomeapp.io</Text>
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

      {selected ? (
        <View style={[styles.benefitsSection, { borderTopColor: theme.border }]}>
          <Text style={[styles.benefitsTitle, { color: theme.text }]}>
            Why list on Rhome?
          </Text>
          {(BENEFITS_BY_TYPE[selected] || []).map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: (HOST_TYPES.find(t => t.id === selected)?.color || '#6C63FF') + '15' }]}>
                <Feather name={item.icon} size={14} color={HOST_TYPES.find(t => t.id === selected)?.color || '#6C63FF'} />
              </View>
              <Text style={[styles.benefitText, { color: theme.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  benefitsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 13,
    flex: 1,
  },
});
