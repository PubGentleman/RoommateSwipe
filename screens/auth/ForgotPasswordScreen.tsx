import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { supabase } from '../../lib/supabase';

interface Props {
  onResetSent: (email: string) => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<Props> = ({ onResetSent, onBackToLogin }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [error, setError] = useState('');

  const handleSendReset = async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'rhome://auth/reset-password',
      });
    } catch {}
    setIsLoading(false);
    onResetSent(trimmed);
  };

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      style={{ backgroundColor: '#111111' }}
    >
      <View style={styles.header}>
        <Pressable onPress={onBackToLogin} hitSlop={12} style={styles.backRow}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Reset Password</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Enter the email address you signed up with and we'll send you a link to reset your password.
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
            <View style={{ paddingLeft: 12 }}>
              <Feather name="mail" size={16} color={emailFocused ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ff6b5b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={handleSendReset} disabled={isLoading} style={{ opacity: isLoading ? 0.5 : 1 }}>
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={onBackToLogin} hitSlop={8} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to Login</Text>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    marginBottom: 28,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242538',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  inputWrapFocused: {
    borderColor: '#F06464',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#ff6b5b',
    flex: 1,
  },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  backLink: {
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
