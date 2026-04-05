import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from './VectorIcons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const VerificationBanner: React.FC = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified === true) return null;

  const handleResend = async () => {
    if (sending || sent) return;
    setSending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email: user.email });
      setSent(true);
      setTimeout(() => setSent(false), 60000);
    } catch {}
    setSending(false);
  };

  return (
    <View style={styles.banner}>
      <View style={styles.bannerContent}>
        <View style={styles.iconWrap}>
          <Feather name="alert-circle" size={16} color="#ff6b5b" />
        </View>
        <Text style={styles.bannerText} numberOfLines={2}>
          Verify your email to unlock all features
        </Text>
        <Pressable onPress={handleResend} style={styles.resendBtn} disabled={sending || sent}>
          {sending ? (
            <ActivityIndicator size="small" color="#ff6b5b" />
          ) : (
            <Text style={styles.resendText}>
              {sent ? 'Sent' : 'Resend'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,107,91,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  resendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.15)',
  },
  resendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b5b',
  },
});
