import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Typography, Spacing } from '../../constants/theme';
import { getVerificationLevel, getVerificationLabel } from '../../components/VerificationBadge';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Verification'>;

export function VerificationScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const verification = user?.verification;
  const level = getVerificationLevel(verification);
  const userPlan = user?.subscription?.plan || 'basic';
  const isElite = userPlan === 'elite';
  const fromHostPurchase = route.params?.fromHostPurchase ?? false;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'linkedin' | 'facebook' | null>(null);
  const [backgroundChecking, setBackgroundChecking] = useState(false);
  const [incomeVerifying, setIncomeVerifying] = useState(false);
  const [hostIdUploading, setHostIdUploading] = useState(false);

  const syncVerificationToSupabase = async (verificationData: any) => {
    await updateUser({ verification: verificationData });
  };

  const hostVerificationPaid = user?.purchases?.hostVerificationPaid === true;
  const hostVerificationBadge = user?.purchases?.hostVerificationBadge === true;
  const govIdVerified = verification?.government_id?.verified === true;

  const handleCompleteHostVerification = async () => {
    if (!govIdVerified) {
      Alert.alert('ID Required', 'You must complete Government ID verification before activating your Host Verification Badge.');
      return;
    }
    setHostIdUploading(true);
    setTimeout(async () => {
      await updateUser({
        purchases: {
          ...user?.purchases,
          hostVerificationBadge: true,
        },
      });
      setHostIdUploading(false);
      Alert.alert('Host Verified', 'Your Host Verification Badge is now active! Renters will see you as a verified host.');
    }, 1500);
  };

  const handleSendPhoneCode = () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }
    setPhoneSent(true);
    Alert.alert('Code Sent', 'A verification code has been sent to your phone number.');
  };

  const handleVerifyPhone = async () => {
    if (phoneCode.length < 4) {
      Alert.alert('Invalid Code', 'Please enter the verification code.');
      return;
    }
    const newVerification = {
      ...verification,
      phone: { verified: true, verifiedAt: new Date() },
    };
    await updateUser({
      verification: newVerification,
    });
    await syncVerificationToSupabase(newVerification);
    setPhoneSent(false);
    setPhoneNumber('');
    setPhoneCode('');
    Alert.alert('Phone Verified', 'Your phone number has been verified successfully.');
  };

  const handleVerifyId = async () => {
    setIdUploading(true);
    setTimeout(async () => {
      const newVerification = {
        ...verification,
        government_id: { verified: true, verifiedAt: new Date() },
      };
      await updateUser({
        verification: newVerification,
      });
      await syncVerificationToSupabase(newVerification);
      setIdUploading(false);
      Alert.alert('ID Verified', 'Your government ID has been verified successfully.');
    }, 1500);
  };

  const handleVerifySocial = async (platform: 'instagram' | 'linkedin' | 'facebook') => {
    setSocialPlatform(platform);
    setTimeout(async () => {
      const newVerification = {
        ...verification,
        social_media: { verified: true, verifiedAt: new Date(), platform },
      };
      await updateUser({
        verification: newVerification,
      });
      await syncVerificationToSupabase(newVerification);
      setSocialPlatform(null);
      Alert.alert('Social Media Verified', `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} account has been linked and verified.`);
    }, 1200);
  };

  const handleVerifyBackground = () => {
    if (!isElite) return;
    Alert.alert(
      'Background Check',
      'This will initiate a background verification check. Your information will be securely processed. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Verification',
          onPress: async () => {
            setBackgroundChecking(true);
            setTimeout(async () => {
              const newVerification = {
                ...verification,
                background_check: { verified: true, verifiedAt: new Date() },
              };
              await updateUser({
                verification: newVerification,
              });
              await syncVerificationToSupabase(newVerification);
              setBackgroundChecking(false);
              Alert.alert('Background Verified', 'Your background check has been completed successfully.');
            }, 2000);
          },
        },
      ]
    );
  };

  const handleVerifyIncome = () => {
    if (!isElite) return;
    Alert.alert(
      'Income Verification',
      'This will verify your income through secure document review. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Verification',
          onPress: async () => {
            setIncomeVerifying(true);
            setTimeout(async () => {
              const newVerification = {
                ...verification,
                income_verification: { verified: true, verifiedAt: new Date() },
              };
              await updateUser({
                verification: newVerification,
              });
              await syncVerificationToSupabase(newVerification);
              setIncomeVerifying(false);
              Alert.alert('Income Verified', 'Your income has been verified successfully.');
            }, 2000);
          },
        },
      ]
    );
  };

  const progressPercent = Math.round((level / 3) * 100);
  const progressColor = level >= 3 ? '#2563EB' : level >= 2 ? '#2563EB' : level >= 1 ? '#F59E0B' : theme.textSecondary;

  return (
    <ScreenKeyboardAwareScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ backgroundColor: '#111111' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={theme.text} />
          </Pressable>
          <ThemedText style={[Typography.h2]}>Identity Verification</ThemedText>
        </View>

        <View style={[styles.statusCard, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIconContainer, { backgroundColor: progressColor + '20' }]}>
              <Feather name="shield" size={28} color={progressColor} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[Typography.h3]}>{getVerificationLabel(level)}</ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                {level}/3 verifications completed
              </ThemedText>
            </View>
          </View>
          <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: progressColor }]} />
          </View>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            Verified profiles get up to 3x more matches and appear more trustworthy to other users.
          </ThemedText>
        </View>

        <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.verificationHeader}>
            <View style={[styles.verificationIcon, { backgroundColor: verification?.phone?.verified ? '#2563EB20' : '#222222' }]}>
              <Feather name="phone" size={22} color={verification?.phone?.verified ? '#2563EB' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Phone Number</ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                Verify your phone number via SMS code
              </ThemedText>
            </View>
            {verification?.phone?.verified ? (
              <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                <Feather name="check" size={14} color="#2563EB" />
                <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>Verified</ThemedText>
              </View>
            ) : null}
          </View>
          {!verification?.phone?.verified ? (
            <View style={styles.verificationAction}>
              {!phoneSent ? (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF', borderColor: '#333333' }]}
                    placeholder="Enter phone number"
                    placeholderTextColor={theme.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.primary }]}
                    onPress={handleSendPhoneCode}
                  >
                    <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>Send Code</ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF', borderColor: '#333333' }]}
                    placeholder="Enter verification code"
                    placeholderTextColor={theme.textSecondary}
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.primary }]}
                    onPress={handleVerifyPhone}
                  >
                    <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>Verify</ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.verificationHeader}>
            <View style={[styles.verificationIcon, { backgroundColor: verification?.government_id?.verified ? '#2563EB20' : '#222222' }]}>
              <Feather name="credit-card" size={22} color={verification?.government_id?.verified ? '#2563EB' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Government ID</ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                Upload a government-issued photo ID for review
              </ThemedText>
            </View>
            {verification?.government_id?.verified ? (
              <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                <Feather name="check" size={14} color="#2563EB" />
                <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>Verified</ThemedText>
              </View>
            ) : null}
          </View>
          {!verification?.government_id?.verified ? (
            <View style={styles.verificationAction}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.primary, opacity: idUploading ? 0.6 : 1 }]}
                onPress={handleVerifyId}
                disabled={idUploading}
              >
                <Feather name="upload" size={16} color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  {idUploading ? 'Verifying...' : 'Upload ID'}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.verificationHeader}>
            <View style={[styles.verificationIcon, { backgroundColor: verification?.social_media?.verified ? '#2563EB20' : '#222222' }]}>
              <Feather name="globe" size={22} color={verification?.social_media?.verified ? '#2563EB' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Social Media</ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                Link a social media account to verify your identity
              </ThemedText>
            </View>
            {verification?.social_media?.verified ? (
              <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                <Feather name="check" size={14} color="#2563EB" />
                <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>
                  {verification.social_media.platform ? verification.social_media.platform.charAt(0).toUpperCase() + verification.social_media.platform.slice(1) : 'Verified'}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {!verification?.social_media?.verified ? (
            <View style={styles.verificationAction}>
              <View style={styles.socialButtons}>
                <Pressable
                  style={[styles.socialButton, { backgroundColor: '#E1306C20', borderColor: '#E1306C' }]}
                  onPress={() => handleVerifySocial('instagram')}
                  disabled={socialPlatform !== null}
                >
                  <Feather name="instagram" size={18} color="#E1306C" />
                  <ThemedText style={[Typography.small, { color: '#E1306C', fontWeight: '600', marginLeft: 6 }]}>
                    {socialPlatform === 'instagram' ? 'Linking...' : 'Instagram'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.socialButton, { backgroundColor: '#0A66C220', borderColor: '#0A66C2' }]}
                  onPress={() => handleVerifySocial('linkedin')}
                  disabled={socialPlatform !== null}
                >
                  <Feather name="linkedin" size={18} color="#0A66C2" />
                  <ThemedText style={[Typography.small, { color: '#0A66C2', fontWeight: '600', marginLeft: 6 }]}>
                    {socialPlatform === 'linkedin' ? 'Linking...' : 'LinkedIn'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.socialButton, { backgroundColor: '#1877F220', borderColor: '#1877F2' }]}
                  onPress={() => handleVerifySocial('facebook')}
                  disabled={socialPlatform !== null}
                >
                  <Feather name="facebook" size={18} color="#1877F2" />
                  <ThemedText style={[Typography.small, { color: '#1877F2', fontWeight: '600', marginLeft: 6 }]}>
                    {socialPlatform === 'facebook' ? 'Linking...' : 'Facebook'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.verificationHeader}>
            <View style={[styles.verificationIcon, { backgroundColor: verification?.background_check?.verified ? '#2563EB20' : '#222222' }]}>
              <Feather name="search" size={22} color={verification?.background_check?.verified ? '#2563EB' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Background Check</ThemedText>
                {!isElite ? (
                  <View style={[styles.eliteBadge, { backgroundColor: '#7C3AED20' }]}>
                    <Feather name="lock" size={10} color="#7C3AED" />
                    <ThemedText style={[Typography.small, { color: '#7C3AED', fontWeight: '700', marginLeft: 4, fontSize: 10 }]}>Elite Only</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                Complete a background check to boost your trust score
              </ThemedText>
            </View>
            {verification?.background_check?.verified ? (
              <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                <Feather name="check" size={14} color="#2563EB" />
                <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>Verified</ThemedText>
              </View>
            ) : null}
          </View>
          {!verification?.background_check?.verified ? (
            <View style={styles.verificationAction}>
              {isElite ? (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary, opacity: backgroundChecking ? 0.6 : 1 }]}
                  onPress={handleVerifyBackground}
                  disabled={backgroundChecking}
                >
                  <Feather name="search" size={16} color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {backgroundChecking ? 'Checking...' : 'Start Verification'}
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={[styles.lockedOverlay, { backgroundColor: '#22222280' }]}>
                  <Feather name="lock" size={20} color="#7C3AED" />
                  <ThemedText style={[Typography.small, { color: '#7C3AED', fontWeight: '600', marginTop: 4 }]}>
                    Upgrade to Elite to unlock
                  </ThemedText>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <View style={styles.verificationHeader}>
            <View style={[styles.verificationIcon, { backgroundColor: verification?.income_verification?.verified ? '#2563EB20' : '#222222' }]}>
              <Feather name="dollar-sign" size={22} color={verification?.income_verification?.verified ? '#2563EB' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Income Verification</ThemedText>
                {!isElite ? (
                  <View style={[styles.eliteBadge, { backgroundColor: '#7C3AED20' }]}>
                    <Feather name="lock" size={10} color="#7C3AED" />
                    <ThemedText style={[Typography.small, { color: '#7C3AED', fontWeight: '700', marginLeft: 4, fontSize: 10 }]}>Elite Only</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                Verify your income to show financial readiness to hosts
              </ThemedText>
            </View>
            {verification?.income_verification?.verified ? (
              <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                <Feather name="check" size={14} color="#2563EB" />
                <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>Verified</ThemedText>
              </View>
            ) : null}
          </View>
          {!verification?.income_verification?.verified ? (
            <View style={styles.verificationAction}>
              {isElite ? (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary, opacity: incomeVerifying ? 0.6 : 1 }]}
                  onPress={handleVerifyIncome}
                  disabled={incomeVerifying}
                >
                  <Feather name="file-text" size={16} color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {incomeVerifying ? 'Verifying...' : 'Start Verification'}
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={[styles.lockedOverlay, { backgroundColor: '#22222280' }]}>
                  <Feather name="lock" size={20} color="#7C3AED" />
                  <ThemedText style={[Typography.small, { color: '#7C3AED', fontWeight: '600', marginTop: 4 }]}>
                    Upgrade to Elite to unlock
                  </ThemedText>
                </View>
              )}
            </View>
          ) : null}
        </View>

        {(hostVerificationPaid || hostVerificationBadge || fromHostPurchase) ? (
          <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: hostVerificationBadge ? '#2563EB' : '#78c0ff', borderWidth: 1.5 }]}>
            <View style={styles.verificationHeader}>
              <View style={[styles.verificationIcon, { backgroundColor: hostVerificationBadge ? '#2563EB20' : 'rgba(100,180,255,0.1)' }]}>
                <Feather name="shield" size={22} color={hostVerificationBadge ? '#2563EB' : '#78c0ff'} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Host Verification</ThemedText>
                  <View style={[styles.eliteBadge, { backgroundColor: 'rgba(100,180,255,0.1)' }]}>
                    <Feather name="award" size={10} color="#78c0ff" />
                    <ThemedText style={[Typography.small, { color: '#78c0ff', fontWeight: '700', marginLeft: 4, fontSize: 10 }]}>$9.99</ThemedText>
                  </View>
                </View>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {hostVerificationBadge
                    ? 'Your Host Verification Badge is active'
                    : 'Complete government ID verification to activate your badge'}
                </ThemedText>
              </View>
              {hostVerificationBadge ? (
                <View style={[styles.verifiedTag, { backgroundColor: '#2563EB20' }]}>
                  <Feather name="check" size={14} color="#2563EB" />
                  <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>Active</ThemedText>
                </View>
              ) : null}
            </View>
            {!hostVerificationBadge ? (
              <View style={styles.verificationAction}>
                {!govIdVerified ? (
                  <View style={{ gap: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                      <Feather name="alert-circle" size={16} color="#F59E0B" />
                      <ThemedText style={[Typography.small, { color: '#F59E0B', fontWeight: '600' }]}>
                        Government ID verification required first
                      </ThemedText>
                    </View>
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      Please complete the Government ID section above before activating your Host Verification Badge.
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: '#2563EB', opacity: hostIdUploading ? 0.6 : 1 }]}
                    onPress={handleCompleteHostVerification}
                    disabled={hostIdUploading}
                  >
                    <Feather name="shield" size={16} color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                    <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                      {hostIdUploading ? 'Activating Badge...' : 'Activate Host Verification Badge'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.infoCard, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
          <Feather name="info" size={18} color={theme.textSecondary} />
          <ThemedText style={[Typography.small, { color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }]}>
            Your verification data is securely stored and only used to confirm your identity. 
            Personal documents are not shared with other users.
          </ThemedText>
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  verificationItem: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verificationAction: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  lockedOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
  },
  eliteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
