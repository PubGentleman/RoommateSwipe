import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';

export const PaymentScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { alert } = useConfirm();
  const navigation = useNavigation();

  const [setupLoading, setSetupLoading] = useState(false);

  const handleAddPaymentMethod = async () => {
    if (!user) return;

    if (Platform.OS === 'web') {
      await alert({ title: 'Not Available', message: 'Payment management is available on the Rhome mobile app. Please use the iOS or Android app.', variant: 'info' });
      return;
    }

    await alert({ title: 'Add Payment', message: 'Payment methods are managed through Stripe when you subscribe to a plan. Go to your subscription settings to manage payments.', variant: 'info' });
  };

  return (
    <ScreenScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ backgroundColor: '#111111' }}>
      <View style={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.h2]}>Payment Methods</ThemedText>
            <Pressable onPress={handleAddPaymentMethod} disabled={setupLoading}>
              <ThemedText style={[Typography.body, { color: theme.primary, fontWeight: '600', opacity: setupLoading ? 0.5 : 1 }]}>
                {setupLoading ? 'Setting up...' : 'Add Card'}
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
            Securely add and manage your payment cards via Stripe
          </ThemedText>

          {setupLoading ? (
            <View style={[styles.loadingState, { backgroundColor: '#1a1a1a' }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                Opening secure payment form...
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: '#1a1a1a' }]}>
              <Feather name="shield" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
                Payment methods are managed securely through Stripe when you subscribe to a plan
              </ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                Your card details are handled securely by Stripe and never stored on our servers
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyState: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  loadingState: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
});
