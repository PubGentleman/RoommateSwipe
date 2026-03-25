import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { RhomeLogo } from '../../components/RhomeLogo';
import { SignUpFlow } from './SignUpFlow';

export const LoginScreen = () => {
  const { login, resetPassword } = useAuth();
  const { alert: showAlert } = useConfirm();
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (isSignUp) {
    return <SignUpFlow onBackToLogin={() => setIsSignUp(false)} />;
  }

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      if (!email.trim()) { setError('Please enter your email address'); setIsLoading(false); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); setIsLoading(false); return; }
      if (!password || password.length < 6) { setError('Password must be at least 6 characters'); setIsLoading(false); return; }
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      style={{ backgroundColor: '#111111' }}
    >
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <RhomeLogo variant="horizontal" size="md" />
        </View>
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>Welcome back</Text>
          <Text style={styles.headingSub}>
            Sign in to continue finding your{'\n'}perfect roommate
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <View style={styles.inputWrap}>
            <Feather name="mail" size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={String.fromCharCode(8226).repeat(8)}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              passwordRules="minlength: 6;"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.forgotRow}>
          <Pressable hitSlop={8} onPress={async () => {
            if (!email.trim()) {
              await showAlert({ title: 'Enter Email', message: 'Please enter your email address first, then tap Forgot Password.', variant: 'info' });
              return;
            }
            try {
              await resetPassword(email.trim());
              await showAlert({ title: 'Check Your Email', message: 'A password reset link has been sent to your email address.', variant: 'success' });
            } catch (err: any) {
              await showAlert({ title: 'Error', message: err.message || 'Failed to send reset email. Please try again.', variant: 'warning' });
            }
          }}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ff6b5b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={handleSubmit} disabled={isLoading} style={{ opacity: isLoading ? 0.5 : 1 }}>
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
            {!isLoading ? (
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            ) : null}
          </LinearGradient>
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR CONTINUE WITH</Text>
          <View style={styles.orLine} />
        </View>

        <View style={styles.socialRow}>
          <Pressable style={styles.socialBtn} onPress={async () => await showAlert({ title: 'Google Sign In', message: 'Google authentication will be available in a future update.', variant: 'info' })}>
            <Feather name="globe" size={16} color="rgba(255,255,255,0.75)" />
            <Text style={styles.socialBtnText}>Google</Text>
          </Pressable>
          <Pressable style={styles.socialBtn} onPress={async () => await showAlert({ title: 'Apple Sign In', message: 'Apple authentication will be available in a future update.', variant: 'info' })}>
            <Feather name="smartphone" size={16} color="rgba(255,255,255,0.75)" />
            <Text style={styles.socialBtnText}>Apple</Text>
          </Pressable>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Don't have an account? </Text>
          <Pressable onPress={() => setIsSignUp(true)} hitSlop={8}>
            <Text style={styles.switchLink}>Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 32,
  },
  heading: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginBottom: 6,
    textAlign: 'center',
  },
  headingSub: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  field: {
    marginBottom: 13,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
    color: 'rgba(255,255,255,0.35)',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 42,
    paddingRight: 42,
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b5b',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  orText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 26,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b5b',
  },
});
