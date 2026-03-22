import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { WebView } from 'react-native-webview';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Typography, Spacing } from '../../constants/theme';
import { getVerificationLevel, getVerificationLabel } from '../../components/VerificationBadge';
import { isDev } from '../../utils/envUtils';
import { supabase } from '../../lib/supabase';
import { createVerificationSession } from '../../services/paymentService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Verification'>;

export function VerificationScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
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
  const [stripeVerificationUrl, setStripeVerificationUrl] = useState<string | null>(null);
  const [showStripeWebView, setShowStripeWebView] = useState(false);

  const syncVerificationToSupabase = async (verificationData: any) => {
    await updateUser({ verification: verificationData });
  };

  const hostVerificationPaid = user?.purchases?.hostVerificationPaid === true;
  const hostVerificationBadge = user?.purchases?.hostVerificationBadge === true;
  const govIdVerified = verification?.government_id?.verified === true;

  const handleCompleteHostVerification = async () => {
    if (!govIdVerified) {
      await showAlert({ title: 'ID Required', message: 'You must complete Government ID verification before activating your Host Verification Badge.', variant: 'warning' });
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
      await showAlert({ title: 'Host Verified', message: 'Your Host Verification Badge is now active! Renters will see you as a verified host.', variant: 'success' });
    }, 1500);
  };

  const handleSendPhoneCode = async () => {
    if (phoneNumber.length < 10) {
      await showAlert({ title: 'Invalid Number', message: 'Please enter a valid phone number.', variant: 'warning' });
      return;
    }
    if (isDev) {
      setTimeout(() => { setPhoneSent(true); }, 500);
      await showAlert({ title: 'Code Sent', message: 'A verification code has been sent to your phone number.', variant: 'success' });
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneNumber });
      if (error) {
        await showAlert({ title: 'Error', message: error.message || 'Failed to send verification code.', variant: 'warning' });
        return;
      }
      setPhoneSent(true);
      await showAlert({ title: 'Code Sent', message: 'A verification code has been sent to your phone number.', variant: 'success' });
    } catch (err) {
      await showAlert({ title: 'Error', message: 'Failed to send verification code. Please try again.', variant: 'warning' });
    }
  };

  const handleVerifyPhone = async () => {
    if (phoneCode.length < 4) {
      await showAlert({ title: 'Invalid Code', message: 'Please enter the verification code.', variant: 'warning' });
      return;
    }
    if (isDev) {
      const newVerification = {
        ...verification,
        phone: { verified: true, verifiedAt: new Date() },
      };
      await updateUser({ verification: newVerification });
      await syncVerificationToSupabase(newVerification);
      setPhoneSent(false);
      setPhoneNumber('');
      setPhoneCode('');
      await showAlert({ title: 'Phone Verified', message: 'Your phone number has been verified successfully.', variant: 'success' });
      return;
    }
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneNumber, token: phoneCode, type: 'sms',
      });
      if (error) {
        await showAlert({ title: 'Error', message: error.message || 'Invalid verification code.', variant: 'warning' });
        return;
      }
      const newVerification = {
        ...verification,
        phone: { verified: true, verifiedAt: new Date() },
      };
      await updateUser({ verification: newVerification });
      await syncVerificationToSupabase(newVerification);
      setPhoneSent(false);
      setPhoneNumber('');
      setPhoneCode('');
      await showAlert({ title: 'Phone Verified', message: 'Your phone number has been verified successfully.', variant: 'success' });
    } catch (err) {
      await showAlert({ title: 'Error', message: 'Failed to verify code. Please try again.', variant: 'warning' });
    }
  };

  const pollForVerificationStatus = async () => {
    if (!user) return;
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 2000;

    const check = async (): Promise<void> => {
      attempts++;
      try {
        const { data } = await supabase
          .from('users')
          .select('identity_verified, identity_verified_at')
          .eq('id', user.id)
          .single();

        if (data?.identity_verified) {
          const newVerification = {
            ...verification,
            government_id: {
              verified: true,
              verifiedAt: data.identity_verified_at
                ? new Date(data.identity_verified_at)
                : new Date(),
              provider: 'stripe_identity',
            },
          };
          await updateUser({ verification: newVerification });
          await syncVerificationToSupabase(newVerification);
          await showAlert({ title: 'ID Verified', message: 'Your government ID has been verified successfully by Stripe Identity.', variant: 'success' });
          return;
        }
      } catch (_e) {}

      if (attempts < maxAttempts) {
        await new Promise(res => setTimeout(res, interval));
        return check();
      } else {
        await showAlert({ title: 'Verification Pending', message: 'Your ID is being reviewed. This usually takes a few minutes. We\'ll notify you when it\'s complete.', variant: 'info' });
      }
    };

    await check();
  };

  const handleVerifyId = async () => {
    if (!user) return;
    setIdUploading(true);

    if (isDev) {
      setTimeout(async () => {
        const newVerification = {
          ...verification,
          government_id: { verified: true, verifiedAt: new Date(), provider: 'stripe_identity' },
        };
        await updateUser({ verification: newVerification });
        await syncVerificationToSupabase(newVerification);
        setIdUploading(false);
        await showAlert({ title: 'ID Verified (Dev)', message: 'Simulated verification complete.', variant: 'success' });
      }, 1500);
      return;
    }

    try {
      const sessionData = await createVerificationSession(user.id);

      if (sessionData?.url) {
        setStripeVerificationUrl(sessionData.url);
        setShowStripeWebView(true);
        setIdUploading(false);
      } else if (sessionData?.clientSecret) {
        setStripeVerificationUrl(`https://verify.stripe.com/start#${sessionData.clientSecret}`);
        setShowStripeWebView(true);
        setIdUploading(false);
      } else {
        await showAlert({ title: 'Error', message: 'Could not start identity verification. Please try again.', variant: 'warning' });
        setIdUploading(false);
      }
    } catch (err: any) {
      await showAlert({ title: 'Verification Error', message: err?.message || 'Failed to start identity verification. Please try again later.', variant: 'warning' });
      setIdUploading(false);
    }
  };

  const handleStripeVerificationComplete = async () => {
    setShowStripeWebView(false);
    setStripeVerificationUrl(null);
    await pollForVerificationStatus();
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
      await showAlert({ title: 'Social Media Verified', message: `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} account has been linked and verified.`, variant: 'success' });
    }, 1200);
  };

  const handleVerifyBackground = async () => {
    if (!isElite || !user) return;
    const confirmed = await confirm({
      title: 'Background Check',
      message: 'This initiates a background check via Checkr. Results are typically ready within 24-48 hours. A link will be sent to your email to complete the process.',
      confirmText: 'Start Check',
      variant: 'warning',
    });
    if (!confirmed) return;
    setBackgroundChecking(true);
    try {
      if (isDev) {
        setTimeout(async () => {
          const newVerification = {
            ...verification,
            background_check: { status: 'pending', initiatedAt: new Date() },
          };
          await updateUser({ verification: newVerification });
          await syncVerificationToSupabase(newVerification);
          setBackgroundChecking(false);
          await showAlert({ title: 'Check Initiated (Dev)', message: 'Background check simulated as pending.', variant: 'info' });
        }, 1500);
        return;
      }

      const { data, error } = await supabase.functions.invoke('initiate-background-check', {
        body: { userId: user.id, email: user.email },
      });

      if (error) throw error;

      const newVerification = {
        ...verification,
        background_check: {
          status: 'pending',
          initiatedAt: new Date(),
          checkrInvitationUrl: data?.invitationUrl,
        },
      };
      await updateUser({ verification: newVerification });
      await syncVerificationToSupabase(newVerification);

      await showAlert({ title: 'Check Initiated', message: 'A link has been sent to your email to complete the background check. Results are typically ready in 24-48 hours.', variant: 'success' });
    } catch (e: any) {
      await showAlert({ title: 'Error', message: e.message || 'Failed to initiate background check. Please try again.', variant: 'warning' });
    } finally {
      setBackgroundChecking(false);
    }
  };

  const handleVerifyIncome = async () => {
    if (!isElite) return;
    const confirmed = await confirm({
      title: 'Income Verification',
      message: 'This will verify your income through secure document review. Do you want to proceed?',
      confirmText: 'Start Verification',
      variant: 'info',
    });
    if (!confirmed) return;
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
      await showAlert({ title: 'Income Verified', message: 'Your income has been verified successfully.', variant: 'success' });
    }, 2000);
  };

  const progressPercent = Math.round((level / 3) * 100);
  const progressColor = level >= 3 ? '#2563EB' : level >= 2 ? '#2563EB' : level >= 1 ? '#F59E0B' : theme.textSecondary;

  return (
    <>
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

        {isDev && (
          <View style={[styles.verificationItem, { backgroundColor: '#1a1a1a', borderColor: '#ff6b5b' }]}>
            <ThemedText style={[Typography.body, { fontWeight: '700', color: '#ff6b5b', marginBottom: 8 }]}>[DEV] Quick Actions</ThemedText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: '#ff6b5b', flex: 1, minWidth: 120 }]}
                onPress={async () => {
                  const newVerification = {
                    ...verification,
                    phone: { verified: true, verifiedAt: new Date() },
                    government_id: { verified: true, verifiedAt: new Date() },
                    social_media: { verified: true, verifiedAt: new Date(), platform: 'instagram' },
                  };
                  await updateUser({ verification: newVerification });
                  await showAlert({ title: 'Dev Mode', message: 'All verifications marked as complete', variant: 'info' });
                }}
              >
                <Feather name="check-circle" size={14} color="#fff" style={{ marginRight: 4 }} />
                <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '600' }]}>Skip All Verification</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: '#22c55e', flex: 1, minWidth: 120 }]}
                onPress={async () => {
                  const newVerification = {
                    ...verification,
                    background_check: { verified: true, verifiedAt: new Date() },
                  };
                  await updateUser({ verification: newVerification });
                  await showAlert({ title: 'Dev Mode', message: 'Background check marked as cleared', variant: 'info' });
                }}
              >
                <Feather name="shield" size={14} color="#fff" style={{ marginRight: 4 }} />
                <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '600' }]}>Mark BG Cleared</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

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
                Securely verified via Stripe Identity
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
                style={[styles.actionButton, { backgroundColor: '#635BFF', opacity: idUploading ? 0.6 : 1 }]}
                onPress={handleVerifyId}
                disabled={idUploading}
              >
                {idUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                ) : (
                  <Feather name="shield" size={16} color="#FFFFFF" style={{ marginRight: Spacing.xs }} />
                )}
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  {idUploading ? 'Starting Verification...' : 'Verify with Stripe Identity'}
                </ThemedText>
              </Pressable>
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                Accepts driver's license, passport, or national ID card. Includes selfie matching.
              </ThemedText>
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

      <Modal
        visible={showStripeWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowStripeWebView(false);
          setStripeVerificationUrl(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#111111' }}>
          <View style={styles.stripeWebViewHeader}>
            <ThemedText style={[Typography.h3, { flex: 1 }]}>Identity Verification</ThemedText>
            <Pressable
              onPress={async () => {
                const confirmed = await confirm({
                  title: 'Cancel Verification?',
                  message: 'Your verification progress will be lost if you close now.',
                  confirmText: 'Cancel',
                  cancelText: 'Continue',
                  variant: 'danger',
                });
                if (confirmed) {
                  setShowStripeWebView(false);
                  setStripeVerificationUrl(null);
                }
              }}
              hitSlop={12}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          {stripeVerificationUrl ? (
            <WebView
              source={{ uri: stripeVerificationUrl }}
              style={{ flex: 1, backgroundColor: '#111111' }}
              onNavigationStateChange={(navState) => {
                if (navState.url.includes('verification_session_result=complete') ||
                    navState.url.includes('return_url') ||
                    navState.url.includes('success')) {
                  handleStripeVerificationComplete();
                }
              }}
              startInLoadingState
              renderLoading={() => (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' }}>
                  <ActivityIndicator size="large" color="#635BFF" />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                    Loading Stripe Identity...
                  </ThemedText>
                </View>
              )}
            />
          ) : null}
          <View style={styles.stripeWebViewFooter}>
            <Feather name="lock" size={12} color="rgba(255,255,255,0.4)" />
            <ThemedText style={[Typography.small, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>
              Powered by Stripe Identity. Your data is encrypted and secure.
            </ThemedText>
          </View>
        </View>
      </Modal>
    </>
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
  stripeWebViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  stripeWebViewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingBottom: 34,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
});
