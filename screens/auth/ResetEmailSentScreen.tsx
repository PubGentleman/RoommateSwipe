import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking as RNLinking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { supabase } from '../../lib/supabase';

interface Props {
  email: string;
  onBackToLogin: () => void;
}

export const ResetEmailSentScreen: React.FC<Props> = ({ email, onBackToLogin }) => {
  const insets = useSafeAreaInsets();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'rhome://auth/reset-password',
      });
      setResendMessage('Reset email sent!');
      setResendCooldown(60);
    } catch {
      setResendMessage('Could not resend. Please try again.');
    }
    setTimeout(() => setResendMessage(''), 4000);
  };

  const handleOpenEmail = () => {
    RNLinking.openURL('mailto:');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.iconCircle}>
        <Feather name="mail" size={40} color="#ff6b5b" />
      </View>

      <Text style={styles.title}>Check Your Email</Text>
      <Text style={styles.subtitle}>If an account exists for</Text>
      <Text style={styles.emailText}>{email}</Text>
      <Text style={styles.subtitle}>we sent a password reset link.</Text>

      {resendMessage ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{resendMessage}</Text>
        </View>
      ) : null}

      <Pressable onPress={handleOpenEmail} style={{ width: '100%' }}>
        <LinearGradient
          colors={['#ff6b5b', '#e83a2a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryBtn}
        >
          <Feather name="external-link" size={16} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Open Email App</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={handleResend}
        disabled={resendCooldown > 0}
        style={[styles.secondaryBtn, { opacity: resendCooldown > 0 ? 0.5 : 1 }]}
      >
        <Feather name="send" size={16} color="#ff6b5b" />
        <Text style={styles.secondaryBtnText}>
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Reset Email'}
        </Text>
      </Pressable>

      <Text style={styles.hintText}>
        {"Didn't get it? Check spam"}
      </Text>

      <Pressable onPress={onBackToLogin} style={styles.backBtn} hitSlop={8}>
        <Feather name="arrow-left" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.backBtnText}>Back to Login</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(240,100,100,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  messageBox: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  messageText: {
    fontSize: 13,
    color: '#ff6b5b',
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
    marginTop: 12,
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 24,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  backBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
