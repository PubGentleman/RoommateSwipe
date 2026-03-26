import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { applyForAffiliate, getAffiliateForUser } from '../../services/affiliateService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export const AffiliateApplyScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { alert } = useConfirm();
  const [paypalEmail, setPaypalEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fullName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  useEffect(() => {
    if (!user) return;
    getAffiliateForUser(user.id).then((aff) => {
      if (aff) {
        navigation.replace('AffiliateDashboard');
      }
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!paypalEmail.trim() || !paypalEmail.includes('@')) {
      await alert({ title: 'Missing Info', message: 'Please enter a valid PayPal email address.', variant: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      await applyForAffiliate(user.id, paypalEmail.trim());
      await alert({
        title: 'Application Approved',
        message: 'You are now a Rhome affiliate! Your unique referral code has been generated. Share it with friends and earn commissions.',
        variant: 'info',
      });
      navigation.replace('AffiliateDashboard');
    } catch (err: any) {
      await alert({ title: 'Error', message: err?.message || 'Failed to submit application.', variant: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Become an Affiliate</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Feather name="users" size={28} color="#ff6b5b" />
          </View>
          <Text style={styles.heroTitle}>Earn with Rhome</Text>
          <Text style={styles.heroDesc}>
            Share your referral code and earn $10 for every Plus signup and $20 for every Elite signup.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <View style={[styles.inputWrap, styles.inputDisabled]}>
              <Feather name="user" size={16} color="rgba(255,255,255,0.35)" />
              <Text style={styles.inputReadonly}>{fullName}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PAYPAL EMAIL</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color="rgba(255,255,255,0.35)" />
              <TextInput
                style={styles.input}
                placeholder="your@paypal.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WHY DO YOU WANT TO BE AN AFFILIATE? (OPTIONAL)</Text>
            <View style={[styles.inputWrap, { minHeight: 60, alignItems: 'flex-start', paddingTop: 12 }]}>
              <TextInput
                style={[styles.input, { minHeight: 40, textAlignVertical: 'top' }]}
                placeholder="Tell us briefly..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={200}
              />
            </View>
          </View>
        </View>

        <Pressable onPress={handleSubmit} disabled={isSubmitting}>
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.submitBtn, isSubmitting ? { opacity: 0.6 } : null]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Submit Application</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 28 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  heroCard: { backgroundColor: 'rgba(255,107,91,0.08)', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)' },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,107,91,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 },
  formCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 14, height: 48, gap: 10 },
  inputDisabled: { opacity: 0.6 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  inputReadonly: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  submitBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
