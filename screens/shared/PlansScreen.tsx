import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

type PlansScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Plans'>;

export const PlansScreen = () => {
  const { theme } = useTheme();
  const { user, upgradeToPlus, upgradeToPriority } = useAuth();
  const navigation = useNavigation<PlansScreenNavigationProp>();
  
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'priority' | null>(null);
  const [processing, setProcessing] = useState(false);

  const currentPlan = user?.subscription?.plan || 'basic';
  const isPlus = currentPlan === 'plus';
  const isPriority = currentPlan === 'priority';
  
  const PRICING = {
    plus: 14.99,
    priority: user?.role === 'renter' ? 49.99 : 99.00,
  };

  const handleUpgrade = (plan: 'plus' | 'priority') => {
    if (!user?.paymentMethods || user.paymentMethods.length === 0) {
      Alert.alert(
        'Payment Method Required',
        'Please add a payment method before upgrading.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Card', onPress: () => navigation.navigate('Payment') },
        ]
      );
      return;
    }

    setSelectedPlan(plan);
    setShowUpgradeConfirm(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) {
      setShowUpgradeConfirm(false);
      return;
    }

    if (selectedPlan === currentPlan) {
      Alert.alert('Error', 'You are already on this plan.');
      setShowUpgradeConfirm(false);
      setSelectedPlan(null);
      return;
    }

    setShowUpgradeConfirm(false);
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (selectedPlan === 'plus') {
      await upgradeToPlus();
    } else if (selectedPlan === 'priority') {
      await upgradeToPriority();
    }
    
    const planName = selectedPlan === 'plus' ? 'Plus' : 'Priority';
    Alert.alert(
      'Success!',
      `Welcome to ${planName}! You now have access to all ${planName} features.`,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
    setProcessing(false);
    setSelectedPlan(null);
  };

  const renderPlanCard = (
    planType: 'basic' | 'plus' | 'priority',
    price: string,
    features: string[],
    isCurrentPlan: boolean
  ) => {
    const planColors = {
      basic: theme.backgroundDefault,
      plus: theme.primary,
      priority: '#7C3AED',
    };
    const bgColor = isCurrentPlan ? planColors[planType] : theme.backgroundDefault;
    const textColor = isCurrentPlan && planType !== 'basic' ? '#FFFFFF' : theme.text;

    return (
      <View key={planType} style={[styles.planCard, { backgroundColor: bgColor, borderColor: theme.border, borderWidth: isCurrentPlan ? 0 : 1 }]}>
        <View style={styles.planHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
              <ThemedText style={[Typography.h2, { color: textColor }]}>
                {planType.charAt(0).toUpperCase() + planType.slice(1)}
              </ThemedText>
              {planType === 'priority' && <Feather name="award" size={20} color={isCurrentPlan ? '#FFD700' : '#7C3AED'} />}
            </View>
            <ThemedText style={[Typography.body, { color: isCurrentPlan && planType !== 'basic' ? 'rgba(255,255,255,0.9)' : theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.md }]}>
              {price}
            </ThemedText>
          </View>
        </View>

        <View style={styles.features}>
          {features.map((feature, index) => (
            <View key={index} style={styles.feature}>
              <Feather name="check" size={18} color={isCurrentPlan && planType !== 'basic' ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, color: textColor, flex: 1 }]}>
                {feature}
              </ThemedText>
            </View>
          ))}
        </View>

        {isCurrentPlan ? (
          <View style={[styles.activeSubscription, { backgroundColor: planType === 'basic' ? theme.primary + '20' : 'rgba(255, 255, 255, 0.2)' }]}>
            <Feather name="check-circle" size={18} color={planType === 'basic' ? theme.primary : '#FFFFFF'} />
            <ThemedText style={[Typography.small, { color: planType === 'basic' ? theme.primary : '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Current Plan
            </ThemedText>
          </View>
        ) : planType !== 'basic' ? (
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: planType === 'plus' ? theme.primary : '#7C3AED', opacity: (planType === 'plus' && isPriority) ? 0.5 : 1 }]}
            onPress={() => handleUpgrade(planType)}
            disabled={processing || (planType === 'plus' && isPriority)}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              {processing ? 'Processing...' : (planType === 'plus' && isPriority) ? 'Downgrade Not Available' : `Upgrade - ${price}`}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>Choose Your Plan</ThemedText>
        
        {renderPlanCard('basic', '$0/month', [
          'Create 1 group',
          'Join 1 group',
          'Basic messaging',
          'Browse listings',
        ], currentPlan === 'basic')}

        {renderPlanCard('plus', `$${PRICING.plus}/month`, [
          'Unlimited groups',
          'Unlimited messaging',
          'Full profile visibility',
          'Advanced filters',
          '1 boost per week',
        ], currentPlan === 'plus')}

        {renderPlanCard(
          'priority',
          `$${PRICING.priority}/month ${user?.role === 'renter' ? '(Seekers)' : '(Hosts/Agents)'}`,
          [
            'Everything in Plus',
            'Priority placement',
            'Priority badge',
            'Unlimited boosts',
            'Featured listings',
            'AI match assistant',
          ],
          currentPlan === 'priority'
        )}

        {(isPlus || isPriority) ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Billing History</ThemedText>
            <View style={[styles.billingItem, { backgroundColor: theme.backgroundDefault }]}>
              <View>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                  {isPriority ? 'Priority' : 'Plus'} Subscription
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {new Date().toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                ${isPriority ? PRICING.priority : PRICING.plus}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      <Modal
        visible={showUpgradeConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[Typography.h2, { marginBottom: Spacing.md }]}>
              Upgrade to {selectedPlan === 'plus' ? 'Plus' : 'Priority'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              {selectedPlan === 'plus' 
                ? `Unlock unlimited groups and advanced features for $${PRICING.plus}/month.`
                : `Get priority placement, Priority badge, and unlimited boosts for $${PRICING.priority}/month.`}
              {'\n\n'}Continue with upgrade?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => {
                  setShowUpgradeConfirm(false);
                  setSelectedPlan(null);
                }}
              >
                <ThemedText style={[Typography.body]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: selectedPlan === 'plus' ? theme.primary : '#7C3AED' }]}
                onPress={confirmUpgrade}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Upgrade
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  planCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.large,
    marginBottom: Spacing.xxl,
  },
  planHeader: {
    marginBottom: Spacing.lg,
  },
  features: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  activeSubscription: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  billingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.large,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
});
