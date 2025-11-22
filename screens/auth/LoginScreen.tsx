import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useAuth, UserRole } from '../../contexts/AuthContext';

export const LoginScreen = () => {
  const { theme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('renter');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    try {
      await login(email, password, selectedRole);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const roles: { value: UserRole; label: string; color: string }[] = [
    { value: 'renter', label: 'Renter', color: theme.renterBadge },
    { value: 'host', label: 'Host', color: theme.hostBadge },
    { value: 'agent', label: 'Agent', color: theme.agentBadge },
  ];

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText style={[Typography.hero, styles.title]}>Welcome Back</ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
          Sign in to continue
        </ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText style={[Typography.caption, styles.label]}>Select Your Role</ThemedText>
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
              <ThemedText
                style={[
                  Typography.body,
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
            placeholder="Enter your password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: theme.primary,
              opacity: !email || !password || isLoading ? 0.5 : 1,
            },
          ]}
          onPress={handleLogin}
          disabled={!email || !password || isLoading}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
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
    paddingHorizontal: Spacing.lg,
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
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
});
