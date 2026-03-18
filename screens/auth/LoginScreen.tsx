import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { RoomdrLogo } from '../../components/RoomdrLogo';

export const LoginScreen = () => {
  const { login, register, resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('renter');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      if (!email.trim() && !password) {
        await login('demo@roomdr.com', 'demo123', selectedRole);
      } else if (isSignUp) {
        if (!name.trim()) { setError('Please enter your name'); setIsLoading(false); return; }
        if (!email.trim()) { setError('Please enter your email address'); setIsLoading(false); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); setIsLoading(false); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); setIsLoading(false); return; }
        if (password !== confirmPassword) { setError('Passwords do not match'); setIsLoading(false); return; }
        await register(email.trim(), password, name.trim(), selectedRole);
      } else {
        if (!email.trim()) { setError('Please enter your email address'); setIsLoading(false); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); setIsLoading(false); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); setIsLoading(false); return; }
        await login(email.trim(), password, selectedRole);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => { setIsSignUp(!isSignUp); setError(''); };

  const roles: { value: UserRole; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { value: 'renter', label: 'Renter', icon: 'search' },
    { value: 'host', label: 'Host', icon: 'home' },
  ];

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      style={{ backgroundColor: '#111111' }}
    >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <RoomdrLogo variant="horizontal" size="md" />
          </View>
          <View style={styles.heading}>
            <Text style={styles.headingTitle}>
              {isSignUp ? 'Create Account' : 'Welcome back'}
            </Text>
            <Text style={styles.headingSub}>
              {isSignUp
                ? 'Sign up to start finding your\nperfect roommate'
                : 'Sign in to continue finding your\nperfect roommate'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.roleLabel}>I AM A</Text>
          <View style={styles.roleSelector}>
            {roles.map((role) => {
              const isActive = selectedRole === role.value;
              return (
                <Pressable
                  key={role.value}
                  style={styles.roleBtnWrap}
                  onPress={() => setSelectedRole(role.value)}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#ff6b5b', '#e83a2a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.roleBtn}
                    >
                      <Feather name={role.icon} size={14} color="#FFFFFF" />
                      <Text style={[styles.roleBtnText, { color: '#FFFFFF' }]}>{role.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.roleBtn}>
                      <Feather name={role.icon} size={14} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.roleBtnText}>{role.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          {isSignUp ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <View style={styles.inputWrap}>
                <Feather name="user" size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          ) : null}

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
                placeholder={isSignUp ? 'Create a password' : String.fromCharCode(8226).repeat(8)}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'password'}
                passwordRules="minlength: 6;"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.35)" />
              </Pressable>
            </View>
          </View>

          {isSignUp ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.35)" />
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isSignUp ? (
            <View style={styles.forgotRow}>
              <Pressable hitSlop={8} onPress={async () => {
                if (!email.trim()) {
                  Alert.alert('Enter Email', 'Please enter your email address first, then tap Forgot Password.');
                  return;
                }
                try {
                  await resetPassword(email.trim());
                  Alert.alert('Check Your Email', 'A password reset link has been sent to your email address.');
                } catch (err: any) {
                  Alert.alert('Error', err.message || 'Failed to send reset email. Please try again.');
                }
              }}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          ) : null}

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
                {isLoading
                  ? (isSignUp ? 'Creating Account...' : 'Signing In...')
                  : (isSignUp ? 'Create Account' : 'Sign In')}
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
            <Pressable style={styles.socialBtn} onPress={() => Alert.alert('Google Sign In', 'Google authentication will be available in a future update.', [{ text: 'OK' }])}>
              <Feather name="globe" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.socialBtnText}>Google</Text>
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={() => Alert.alert('Apple Sign In', 'Apple authentication will be available in a future update.', [{ text: 'OK' }])}>
              <Feather name="smartphone" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.socialBtnText}>Apple</Text>
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <Pressable onPress={toggleMode} hitSlop={8}>
              <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
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
  roleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 9,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 5,
    marginBottom: 22,
  },
  roleBtnWrap: {
    flex: 1,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 22,
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
