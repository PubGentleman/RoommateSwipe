import React, { useState } from 'react';
import {
  View, Pressable, ActivityIndicator, StyleSheet, Text, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, FlatList,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { useTheme } from '../../../hooks/useTheme';
import { Typography, Spacing } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const US_STATES = [
  { label: 'Alabama', value: 'AL' }, { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' }, { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' }, { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' }, { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' }, { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' }, { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' }, { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' }, { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' }, { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' }, { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' }, { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' }, { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' }, { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' }, { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' }, { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' }, { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' }, { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' }, { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' }, { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' }, { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' }, { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' }, { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' }, { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' }, { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' }, { label: 'Wyoming', value: 'WY' },
  { label: 'Washington D.C.', value: 'DC' },
];

const COMPANY_BENEFITS = [
  { icon: 'users' as const, text: 'Manage multiple agents under one account' },
  { icon: 'dollar-sign' as const, text: 'Centralized billing for your entire team' },
  { icon: 'zap' as const, text: 'Smart AI matching connects your listings to ideal tenants' },
  { icon: 'bell' as const, text: 'Assign agents to listings and track performance' },
];

export function HostCompanySetupScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [unitsManaged, setUnitsManaged] = useState('');
  const [licensingState, setLicensingState] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const isFromSettings = user?.onboardingStep === 'complete';
  const selectedState = US_STATES.find(s => s.value === licensingState);
  const canContinue = companyName.trim().length > 0 && licenseNumber.trim().length > 0 && licensingState.length > 0;

  async function handleContinue() {
    if (!canContinue) return;
    const trimmedLicense = licenseNumber.trim();
    if (trimmedLicense.length < 4) {
      const { Alert } = require('react-native');
      Alert.alert('Invalid License', 'Please enter a valid brokerage license number (at least 4 characters).');
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        hostType: 'company',
        companyName: companyName.trim(),
        unitsManaged: unitsManaged ? parseInt(unitsManaged, 10) : undefined,
        brokerageLicense: trimmedLicense,
        licensingState,
        licenseVerificationStatus: 'pending',
        hostTypeLockedAt: new Date().toISOString(),
      });
      if (isFromSettings) {
        navigation.replace('HostSubscription');
      } else {
        await completeOnboardingStep('plan');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
          Set up your property management company profile.
        </Text>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Company Name *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Skyline Properties LLC"
            placeholderTextColor={theme.textSecondary + '60'}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Units Managed
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={unitsManaged}
            onChangeText={setUnitsManaged}
            placeholder="24"
            placeholderTextColor={theme.textSecondary + '60'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Licensing State *
          </Text>
          <Pressable
            style={[styles.stateSelector, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setShowStatePicker(true)}
          >
            <Text style={[styles.stateSelectorText, { color: selectedState ? theme.text : theme.textSecondary + '60' }]}>
              {selectedState ? `${selectedState.label} (${selectedState.value})` : 'Select your state'}
            </Text>
            <Feather name="chevron-down" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Brokerage License Number *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="Enter your brokerage license number"
            placeholderTextColor={theme.textSecondary + '60'}
          />
          <Text style={[Typography.small, { color: theme.textSecondary, marginTop: 4, fontSize: 12 }]}>
            Enter your license number exactly as it appears on your license
          </Text>
        </View>

        <Pressable
          style={[styles.continueBtn, { backgroundColor: canContinue && !saving ? '#22C55E' : theme.border }]}
          onPress={handleContinue}
          disabled={!canContinue || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.continueBtnText}>Continue</Text>
          }
        </Pressable>

        <View style={[styles.benefitsSection, { borderTopColor: theme.border }]}>
          <Text style={[styles.benefitsTitle, { color: theme.text }]}>Why list on Rhome?</Text>
          {COMPANY_BENEFITS.map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: '#22C55E15' }]}>
                <Feather name={item.icon} size={14} color="#22C55E" />
              </View>
              <Text style={[styles.benefitText, { color: theme.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showStatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[Typography.body, { color: theme.text, fontWeight: '700' }]}>Select State</Text>
              <Pressable onPress={() => setShowStatePicker(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.stateRow, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    setLicensingState(item.value);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={[Typography.body, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[Typography.small, { color: theme.textSecondary }]}>{item.value}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: Spacing.md,
  },
  fieldWrap: { marginBottom: Spacing.md },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  stateSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  stateSelectorText: { fontSize: 15 },
  continueBtn: {
    paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: Spacing.md,
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  benefitsSection: {
    marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1,
  },
  benefitsTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  benefitIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { fontSize: 13, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1,
  },
  stateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
