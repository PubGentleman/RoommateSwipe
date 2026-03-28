import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
      await login(email.trim().toLowerCase(), password);
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
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
            <Feather name="mail" size={16} color={emailFocused ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
            <Feather name="lock" size={16} color={passwordFocused ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              passwordRules="minlength: 6;"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.4)" />
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
              await resetPassword(email.trim().toLowerCase());
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
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <View style={styles.socialRow}>
          <Pressable style={styles.socialIconBtn} onPress={async () => await showAlert({ title: 'Google Sign In', message: 'Google authentication will be available in a future update.', variant: 'info' })}>
            <Image source={require('../../assets/icons/google.png')} style={styles.googleIcon} resizeMode="contain" />
          </Pressable>
          {Platform.OS !== 'android' ? (
            <Pressable style={styles.socialIconBtn} onPress={async () => await showAlert({ title: 'Apple Sign In', message: 'Apple authentication will be available in a future update.', variant: 'info' })}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FFFFFF">
                <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z" />
              </Svg>
            </Pressable>
          ) : null}
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: '#F06464',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  eyeBtn: {
    padding: 4,
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
    marginVertical: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 26,
  },
  socialIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
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
