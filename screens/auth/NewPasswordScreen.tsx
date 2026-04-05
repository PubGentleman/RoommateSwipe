import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { supabase } from '../../lib/supabase';

interface Props {
  onComplete: () => void;
}

export const NewPasswordScreen: React.FC<Props> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwFocused, setPwFocused] = useState(false);
  const [cfFocused, setCfFocused] = useState(false);

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = hasMinLength && passwordsMatch && !isLoading;

  const handleReset = async () => {
    setError('');
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Could not update password. The reset link may have expired.');
        setIsLoading(false);
        return;
      }
      await supabase.auth.signOut();
      Alert.alert('Password Updated', 'Your password has been reset. You can now log in with your new password.');
      onComplete();
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
      style={{ backgroundColor: '#111111' }}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create New Password</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>New password</Text>
          <View style={[styles.inputWrap, pwFocused && styles.inputWrapFocused]}>
            <TextInput
              style={[styles.input, { paddingRight: 44 }]}
              placeholder="Enter new password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
            />
            <View style={styles.inputIconLeft} pointerEvents="none">
              <Feather name="lock" size={16} color={pwFocused ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} />
            </View>
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.inputIconRight} hitSlop={8}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Confirm password</Text>
          <View style={[styles.inputWrap, cfFocused && styles.inputWrapFocused]}>
            <TextInput
              style={[styles.input, { paddingRight: 44 }]}
              placeholder="Confirm new password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              onFocus={() => setCfFocused(true)}
              onBlur={() => setCfFocused(false)}
            />
            <View style={styles.inputIconLeft} pointerEvents="none">
              <Feather name="lock" size={16} color={cfFocused ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} />
            </View>
            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.inputIconRight} hitSlop={8}>
              <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.reqRow}>
          <Feather
            name={hasMinLength ? 'check-circle' : 'circle'}
            size={14}
            color={hasMinLength ? '#4CAF50' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[styles.reqText, hasMinLength && styles.reqMet]}>At least 8 characters</Text>
        </View>
        <View style={styles.reqRow}>
          <Feather
            name={passwordsMatch ? 'check-circle' : 'circle'}
            size={14}
            color={passwordsMatch ? '#4CAF50' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[styles.reqText, passwordsMatch && styles.reqMet]}>Passwords match</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ff6b5b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={handleReset} disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.4 }}>
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>
              {isLoading ? 'Updating...' : 'Reset Password'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 28,
    textAlign: 'center',
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
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  inputWrapFocused: {
    borderColor: '#F06464',
  },
  input: {
    width: '100%' as const,
    paddingVertical: 14,
    paddingLeft: 40,
    paddingRight: 12,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: '#242538',
    borderRadius: 14,
  },
  inputIconLeft: {
    position: 'absolute' as const,
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
  },
  inputIconRight: {
    position: 'absolute' as const,
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    padding: 4,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reqText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  reqMet: {
    color: '#4CAF50',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
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
    marginTop: 24,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
