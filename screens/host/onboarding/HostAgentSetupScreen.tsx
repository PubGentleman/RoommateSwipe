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
  { icon: 'users' as const, text: 'Reach thousands of verified renters actively looking' },
  { icon: 'dollar-sign' as const, text: 'No listing fees — free to post and manage' },
  { icon: 'zap' as const, text: 'Smart AI matching connects your listings to ideal tenants' },
  { icon: 'bell' as const, text: 'Instant notifications when renters show interest' },
];

export function HostAgentSetupScreen() {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'verified' | 'not_found' | 'manual_review' | null>(null);
  const [licenseDocumentUri, setLicenseDocumentUri] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const isFromSettings = user?.onboardingStep === 'complete';
  const selectedState = US_STATES.find(s => s.value === values.licenseState);
  const canContinue = (values.licenseNumber ?? '').trim().length > 0 && !!values.licenseState;

  async function uploadLicenseDocument(uri: string): Promise<string | null> {
    if (!user?.id) return null;
    try {
      setUploadingDoc(true);
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/license.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage
        .from('license-documents')
        .upload(filePath, arrayBuffer, {
          contentType: ext === 'pdf' ? 'application/pdf' : `image/${ext}`,
          upsert: true,
        });
      if (error) {
        console.error('License upload error:', error);
        return null;
      }
      return filePath;
    } catch (e) {
      console.error('License upload failed:', e);
      return null;
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setLicenseDocumentUri(result.assets[0].uri);
        const publicUrl = await uploadLicenseDocument(result.assets[0].uri);
        if (publicUrl) {
          await updateUser({ licenseDocumentUrl: publicUrl });
        }
      }
    } catch {
      try {
        const imgResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!imgResult.canceled && imgResult.assets?.[0]) {
          setLicenseDocumentUri(imgResult.assets[0].uri);
          const publicUrl = await uploadLicenseDocument(imgResult.assets[0].uri);
          if (publicUrl) {
            await updateUser({ licenseDocumentUrl: publicUrl });
          }
        }
      } catch (e) {
        console.error('Document pick failed:', e);
      }
    }
  }

  async function handleRemoveDocument() {
    if (user?.licenseDocumentUrl) {
      await supabase.storage
        .from('license-documents')
        .remove([user.licenseDocumentUrl]);
    }
    setLicenseDocumentUri(null);
    await updateUser({ licenseDocumentUrl: null });
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
      let localLicenseStatus: 'verified' | 'not_found' | 'manual_review' = 'manual_review';

      try {
        const result = await verifyAgentLicense({
          licenseNumber: values.licenseNumber?.trim(),
          licenseState: values.licenseState,
          firstName: user?.firstName,
          lastName: user?.lastName,
        });

        if (result.verified) {
          await updateUser({ licenseVerificationStatus: 'verified', licenseVerified: true, licenseVerifiedAt: new Date().toISOString() });
          localLicenseStatus = 'verified';
          setVerificationResult('verified');
        } else if (result.reason === 'not_found') {
          await updateUser({ licenseVerificationStatus: 'pending' });
          localLicenseStatus = 'not_found';
          setVerificationResult('not_found');
        } else {
          await updateUser({ licenseVerificationStatus: 'manual_review' });
          localLicenseStatus = 'manual_review';
          setVerificationResult('manual_review');
        }
      } catch {
        await updateUser({ licenseVerificationStatus: 'manual_review' });
        localLicenseStatus = 'manual_review';
        setVerificationResult('manual_review');
      }

      setVerifying(false);

      if (localLicenseStatus === 'not_found') {
        const { Alert } = require('react-native');
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'License Not Found',
            'We couldn\'t verify your license automatically. You can still continue, but your listings will show as "Unverified" until manual review is complete (24-48 hours).',
            [
              { text: 'Re-enter License', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue Anyway', onPress: () => resolve(true) },
            ]
          );
        });
        if (!proceed) { setSaving(false); return; }
      } else if (localLicenseStatus === 'manual_review') {
        const { Alert } = require('react-native');
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Under Review',
            'Your license is being reviewed. You can start setting up while we verify (24-48 hours).',
            [{ text: 'Continue', onPress: () => resolve() }]
          );
        });
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }

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
                <Text style={[styles.uploadSuccessText, { color: theme.text }]}>
                  {uploadingDoc ? 'Uploading...' : 'License uploaded'}
                </Text>
                {uploadingDoc ? (
                  <ActivityIndicator size="small" color="#22C55E" />
                ) : (
                  <Pressable onPress={handleRemoveDocument} hitSlop={8}>
                    <Feather name="x" size={16} color={theme.textSecondary} />
                  </Pressable>
                )}
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
            <Text style={[Typography.small, { color: '#22C55E', fontWeight: '600' }]}>License Verified</Text>
          </View>
        ) : verificationResult === 'not_found' ? (
          <View style={[styles.verifyBanner, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <Text style={[styles.verifyBannerText, { color: '#EF4444' }]}>
              We couldn't verify this license. Please check your details or upload a document below.
            </Text>
          </View>
        ) : verificationResult === 'manual_review' ? (
          <View style={[styles.verifyBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
            <Feather name="clock" size={16} color="#F59E0B" />
            <Text style={[styles.verifyBannerText, { color: '#F59E0B' }]}>
              Your license will be manually reviewed within 24-48 hours.
            </Text>
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
          <Text style={[styles.benefitsTitle, { color: theme.text }]}>Why list on Rhome?</Text>
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
}): Promise<{ verified: boolean; reason: string }> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Verification timed out')), 15000)
    );
    const request = supabase.functions.invoke('verify-agent-license', {
      body: params,
    });
    const { data, error } = await Promise.race([request, timeout]);
    if (error) return { verified: false, reason: 'manual_review' };
    return {
      verified: data?.verified === true,
      reason: data?.reason || 'manual_review',
    };
  } catch {
    return { verified: false, reason: 'manual_review' };
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
  verifyBannerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
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
