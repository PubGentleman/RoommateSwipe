import React, { useState } from 'react';
import {
  View, Pressable, ActivityIndicator, StyleSheet, Text, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { useTheme } from '../../../hooks/useTheme';
import { Typography, Spacing } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';

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

const AGENT_BENEFITS = [
  { icon: 'shield' as const, text: 'Verified Agent badge on your profile and listings' },
  { icon: 'trending-up' as const, text: 'Priority placement in renter search results' },
  { icon: 'users' as const, text: 'AI-powered renter matching for your listings' },
  { icon: 'file-text' as const, text: 'Background check access built right in' },
  { icon: 'bar-chart-2' as const, text: 'Advanced analytics and leads tracking' },
];

export function HostAgentSetupScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'verified' | 'manual_review' | null>(null);
  const [licenseDocumentUri, setLicenseDocumentUri] = useState<string | null>(null);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const isFromSettings = user?.onboardingStep === 'complete';
  const selectedState = US_STATES.find(s => s.value === values.licenseState);
  const canContinue = (values.licenseNumber ?? '').trim().length > 0 && !!values.licenseState;

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setLicenseDocumentUri(result.assets[0].uri);
      }
    } catch {
      try {
        const imgResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!imgResult.canceled && imgResult.assets?.[0]) {
          setLicenseDocumentUri(imgResult.assets[0].uri);
        }
      } catch (e) {
        console.error('Document pick failed:', e);
      }
    }
  }

  async function handleContinue() {
    if (!canContinue) return;
    setSaving(true);
    try {
      await updateUser({
        hostType: 'agent',
        licenseNumber: values.licenseNumber?.trim(),
        licenseState: values.licenseState,
        agencyName: values.agencyName?.trim() || undefined,
        hostTypeLockedAt: new Date().toISOString(),
      });

      setVerifying(true);

      try {
        const verified = await verifyAgentLicense({
          licenseNumber: values.licenseNumber?.trim(),
          licenseState: values.licenseState,
          firstName: user?.firstName,
          lastName: user?.lastName,
        });

        if (verified) {
          await updateUser({ licenseVerificationStatus: 'verified', licenseVerified: true, licenseVerifiedAt: new Date().toISOString() });
          setVerificationResult('verified');
        } else {
          await updateUser({ licenseVerificationStatus: 'manual_review' });
          setVerificationResult('manual_review');
        }
      } catch {
        await updateUser({ licenseVerificationStatus: 'manual_review' });
        setVerificationResult('manual_review');
      }

      setVerifying(false);

      await new Promise(r => setTimeout(r, 1500));

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
        <View style={[styles.iconWrap, { backgroundColor: '#F59E0B20' }]}>
          <Feather name="award" size={32} color="#F59E0B" />
        </View>

        <Text style={[Typography.h2, { color: theme.text, marginBottom: 6, textAlign: 'center' }]}>
          Agent Details
        </Text>
        <Text style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl, textAlign: 'center' }]}>
          Verify your credentials to build trust with renters.
        </Text>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Licensing State
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
            License Number
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="NY-12345678"
            placeholderTextColor={theme.textSecondary + '60'}
            value={values.licenseNumber || ''}
            onChangeText={(text) => setValues(prev => ({ ...prev, licenseNumber: text }))}
          />
          <Text style={[Typography.small, { color: theme.textSecondary, marginTop: 4, fontSize: 12 }]}>
            Enter your license number exactly as it appears on your license
          </Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            Agency / Brokerage
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="RE/MAX Metro"
            placeholderTextColor={theme.textSecondary + '60'}
            value={values.agencyName || ''}
            onChangeText={(text) => setValues(prev => ({ ...prev, agencyName: text }))}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[Typography.small, { color: theme.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
            License Document
          </Text>
          <Pressable
            style={[styles.uploadBox, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handlePickDocument}
          >
            {licenseDocumentUri ? (
              <View style={styles.uploadSuccess}>
                <Feather name="check-circle" size={20} color="#22C55E" />
                <Text style={[styles.uploadSuccessText, { color: theme.text }]}>License uploaded</Text>
                <Pressable onPress={() => setLicenseDocumentUri(null)} hitSlop={8}>
                  <Feather name="x" size={16} color={theme.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.uploadPrompt}>
                <Feather name="upload" size={20} color="#6C63FF" />
                <Text style={[styles.uploadTitle, { color: theme.text }]}>Upload your license</Text>
                <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>
                  Photo or PDF — Optional but speeds up verification
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {verifying ? (
          <View style={[styles.verifyBanner, { backgroundColor: '#6C63FF15', borderColor: '#6C63FF30' }]}>
            <ActivityIndicator size="small" color="#6C63FF" />
            <Text style={[Typography.small, { color: theme.text }]}>Verifying your license...</Text>
          </View>
        ) : verificationResult === 'verified' ? (
          <View style={[styles.verifyBanner, { backgroundColor: '#22C55E15', borderColor: '#22C55E30' }]}>
            <Feather name="check-circle" size={16} color="#22C55E" />
            <Text style={[Typography.small, { color: '#22C55E', fontWeight: '600' }]}>License verified</Text>
          </View>
        ) : verificationResult === 'manual_review' ? (
          <View style={[styles.verifyBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
            <Feather name="clock" size={16} color="#F59E0B" />
            <Text style={[Typography.small, { color: theme.text }]}>We'll verify your license within 24 hours</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.continueBtn, { backgroundColor: canContinue && !saving ? theme.primary : theme.border }]}
          onPress={handleContinue}
          disabled={!canContinue || saving || verifying}
        >
          {saving || verifying
            ? <ActivityIndicator color="#fff" />
            : <Text style={[Typography.body, { color: '#fff', fontWeight: '700' }]}>Continue</Text>
          }
        </Pressable>

        <View style={[styles.benefitsSection, { borderTopColor: theme.border }]}>
          <Text style={[styles.benefitsTitle, { color: theme.text }]}>What you get as a verified agent</Text>
          {AGENT_BENEFITS.map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: '#6C63FF15' }]}>
                <Feather name={item.icon} size={14} color="#6C63FF" />
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
                    setValues(prev => ({ ...prev, licenseState: item.value }));
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

async function verifyAgentLicense(params: {
  licenseNumber: string;
  licenseState: string;
  firstName?: string;
  lastName?: string;
}): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-agent-license', {
      body: params,
    });
    if (error) return false;
    return data?.verified === true;
  } catch {
    return false;
  }
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
  stateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  stateSelectorText: {
    fontSize: 15,
  },
  uploadBox: {
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
    padding: Spacing.md,
  },
  uploadPrompt: {
    alignItems: 'center',
    gap: 6,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  uploadSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadSuccessText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.md,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
