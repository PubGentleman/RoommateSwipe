import React, { useState } from 'react';
import {
  View, Pressable, ActivityIndicator, StyleSheet, Text, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { useTheme } from '../../../hooks/useTheme';
import { Typography, Spacing } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const FIELDS = [
  { key: 'companyName', label: 'Company Name', placeholder: 'Skyline Properties LLC', keyboardType: 'default' as const },
  { key: 'unitsManaged', label: 'Units Managed', placeholder: '24', keyboardType: 'numeric' as const },
];

export function HostCompanySetupScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isFromSettings = user?.onboardingStep === 'complete';
  const canContinue = (values.companyName ?? '').trim().length > 0;

  async function handleContinue() {
    if (!canContinue) return;
    setSaving(true);
    try {
      await updateUser({
        companyName: values.companyName?.trim(),
        unitsManaged: values.unitsManaged ? parseInt(values.unitsManaged, 10) : undefined,
        hostTypeLockedAt: new Date().toISOString(),
      });
      if (isFromSettings) {
        navigation.replace('HostSubscription');
      } else {
        await completeOnboardingStep('plan');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.iconWrap, { backgroundColor: '#22C55E20' }]}>
          <Feather name="briefcase" size={32} color="#22C55E" />
        </View>

        <Text style={[Typography.h2, { color: theme.text, marginBottom: 6, textAlign: 'center' }]}>
          Company Details
        </Text>
        <Text style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl, textAlign: 'center' }]}>
          Tell us about your property management company.
        </Text>

        {FIELDS.map(field => (
          <View key={field.key} style={styles.fieldWrap}>
            <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
              {field.label}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder={field.placeholder}
              placeholderTextColor={theme.textSecondary + '60'}
              value={values[field.key] || ''}
              onChangeText={(text) => setValues(prev => ({ ...prev, [field.key]: text }))}
              keyboardType={field.keyboardType}
            />
          </View>
        ))}

        <View style={[styles.verifyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.verifyIcon, { backgroundColor: '#22C55E15' }]}>
            <Feather name="shield" size={18} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
              Business Verification
            </Text>
            <Text style={[Typography.small, { color: theme.textSecondary }]}>
              Upload your EIN or business license to get a verified badge. You can do this later from Settings.
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.continueBtn, { backgroundColor: canContinue ? theme.primary : theme.border }]}
          onPress={handleContinue}
          disabled={!canContinue || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={[Typography.body, { color: '#fff', fontWeight: '700' }]}>Continue</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  fieldWrap: {
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  verifyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});
