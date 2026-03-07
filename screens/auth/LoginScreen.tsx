import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

export const LoginScreen = () => {
  const { theme } = useTheme();
  const { login, register } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('renter');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (isSignUp) {
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      if (!password.trim() || password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await register(email.trim(), password, name.trim(), selectedRole);
      } else {
        await login(email.trim() || 'demo@roomdr.com', password || 'password', selectedRole);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

  const roles: { value: UserRole; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
    { value: 'renter', label: 'Renter', icon: 'search', color: theme.renterBadge },
    { value: 'host', label: 'Host', icon: 'home', color: theme.hostBadge },
    { value: 'agent', label: 'Agent', icon: 'briefcase', color: theme.agentBadge },
  ];

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={[styles.header, { marginTop: insets.top + Spacing.xl }]}>
        <ThemedText style={[Typography.hero, styles.title]}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
          {isSignUp ? 'Sign up to find your perfect roommate' : 'Sign in to continue'}
        </ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText style={[Typography.caption, styles.label]}>I am a...</ThemedText>
        <View style={styles.roleContainer}>
          {roles.map((role) => (
            <Pressable
              key={role.value}
              style={[
                styles.roleButton,
                {
                  backgroundColor: selectedRole === role.value ? role.color : theme.backgroundDefault,
                  borderColor: selectedRole === role.value ? role.color : theme.border,
                },
              ]}
              onPress={() => setSelectedRole(role.value)}
            >
              <Feather
                name={role.icon}
                size={16}
                color={selectedRole === role.value ? '#FFFFFF' : theme.textSecondary}
                style={{ marginBottom: 4 }}
              />
              <ThemedText
                style={[
                  Typography.caption,
                  {
                    color: selectedRole === role.value ? '#FFFFFF' : theme.text,
                    fontWeight: selectedRole === role.value ? '600' : '400',
                  },
                ]}
              >
                {role.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {isSignUp ? (
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.caption, styles.label]}>Full Name</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Enter your full name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.caption, styles.label]}>Email</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Enter your email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.caption, styles.label]}>Password</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {isSignUp ? (
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.caption, styles.label]}>Confirm Password</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Confirm your password"
              placeholderTextColor={theme.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}>
            <Feather name="alert-circle" size={16} color={theme.error} />
            <ThemedText style={[Typography.caption, { color: theme.error, flex: 1 }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: theme.primary,
              opacity: isLoading ? 0.5 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            {isLoading
              ? (isSignUp ? 'Creating Account...' : 'Signing in...')
              : (isSignUp ? 'Create Account' : 'Sign In')}
          </ThemedText>
        </Pressable>

        <View style={styles.switchContainer}>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </ThemedText>
          <Pressable onPress={toggleMode} hitSlop={8}>
            <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  form: {
    gap: Spacing.lg,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  roleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    alignItems: 'center',
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.medium,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
