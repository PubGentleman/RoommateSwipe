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
  const { user, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscription, reactivateSubscription } = useAuth();
  const navigation = useNavigation<PlansScreenNavigationProp>();
  
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'elite' | null>(null);
  const [downgradeTo, setDowngradeTo] = useState<'basic' | 'plus' | null>(null);
  const [processing, setProcessing] = useState(false);

  const currentPlan = user?.subscription?.plan || 'basic';
  const subscriptionStatus = user?.subscription?.status || 'active';
  const scheduledPlan = user?.subscription?.scheduledPlan;
  const scheduledChangeDate = user?.subscription?.scheduledChangeDate;
  const isPlus = currentPlan === 'plus';
  const isElite = currentPlan === 'elite';
  
  const PRICING = {
    plus: 14.99,
    elite: user?.role === 'renter' ? 49.99 : 99.00,
  };

  const handleUpgrade = (plan: 'plus' | 'elite') => {
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
    } else if (selectedPlan === 'elite') {
      await upgradeToElite();
    }
    
    const planName = selectedPlan === 'plus' ? 'Plus' : 'Elite';
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

  const handleDowngrade = (targetPlan: 'basic' | 'plus') => {
    setDowngradeTo(targetPlan);
    setShowDowngradeConfirm(true);
  };

  const confirmDowngrade = async () => {
    if (!downgradeTo) {
      setShowDowngradeConfirm(false);
      return;
    }

    setShowDowngradeConfirm(false);
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await downgradeToPlan(downgradeTo);
    
    const expiryDate = user?.subscription?.expiresAt 
      ? new Date(user.subscription.expiresAt).toLocaleDateString()
      : 'the end of your billing period';
    
    const targetPlanName = downgradeTo.charAt(0).toUpperCase() + downgradeTo.slice(1);
    Alert.alert(
      'Downgrade Scheduled',
      `Your plan will change to ${targetPlanName} on ${expiryDate}. You'll keep your current ${currentPlan === 'plus' ? 'Plus' : 'Elite'} features until then.`,
      [{ text: 'OK' }]
    );
    
    setProcessing(false);
    setDowngradeTo(null);
  };

  const confirmCancellation = async () => {
    setShowCancelConfirm(false);
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await cancelSubscription();
    
    const expiryDate = user?.subscription?.expiresAt 
      ? new Date(user.subscription.expiresAt).toLocaleDateString()
      : 'the end of your billing period';
    
    Alert.alert(
      'Subscription Cancelled',
      `Your subscription has been cancelled. You'll keep your current ${currentPlan === 'plus' ? 'Plus' : 'Elite'} features until ${expiryDate}.`,
      [{ text: 'OK' }]
    );
    
    setProcessing(false);
  };

  const renderPlanCard = (
    planType: 'basic' | 'plus' | 'elite',
    price: string,
    features: string[],
    isCurrentPlan: boolean
  ) => {
    const planColors = {
      basic: theme.backgroundDefault,
      plus: theme.primary,
      elite: '#7C3AED',
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
              {planType === 'elite' && <Feather name="award" size={20} color={isCurrentPlan ? '#FFD700' : '#7C3AED'} />}
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
          <>
            <View style={[styles.activeSubscription, { backgroundColor: planType === 'basic' ? theme.primary + '20' : 'rgba(255, 255, 255, 0.2)' }]}>
              <Feather name="check-circle" size={18} color={planType === 'basic' ? theme.primary : '#FFFFFF'} />
              <ThemedText style={[Typography.small, { color: planType === 'basic' ? theme.primary : '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
                Current Plan
              </ThemedText>
            </View>
            
            {planType !== 'basic' && subscriptionStatus === 'active' && !scheduledPlan ? (
              <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                {planType === 'elite' ? (
                  <>
                    <Pressable
                      style={[styles.downgradeButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
                      onPress={() => handleDowngrade('plus')}
                      disabled={processing}
                    >
                      <ThemedText style={[Typography.small, { color: textColor }]}>
                        Downgrade to Plus
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.downgradeButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
                      onPress={() => handleDowngrade('basic')}
                      disabled={processing}
                    >
                      <ThemedText style={[Typography.small, { color: textColor }]}>
                        Downgrade to Basic
                      </ThemedText>
                    </Pressable>
                  </>
                ) : planType === 'plus' ? (
                  <Pressable
                    style={[styles.downgradeButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
                    onPress={() => handleDowngrade('basic')}
                    disabled={processing}
                  >
                    <ThemedText style={[Typography.small, { color: textColor }]}>
                      Downgrade to Basic
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.cancelButton, { borderColor: '#EF4444' }]}
                  onPress={() => setShowCancelConfirm(true)}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.small, { color: '#EF4444' }]}>
                    Cancel Subscription
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : planType !== 'basic' ? (
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: planType === 'plus' ? theme.primary : '#7C3AED', opacity: (planType === 'plus' && isElite) ? 0.5 : 1 }]}
            onPress={() => handleUpgrade(planType)}
            disabled={processing || (planType === 'plus' && isElite)}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              {processing ? 'Processing...' : (planType === 'plus' && isElite) ? 'Downgrade Not Available' : `Upgrade - ${price}`}
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
          'Unlimited messages (must match first)',
          '3 active chats maximum',
          'Create 1 group',
          'Join 1 group',
          'Browse listings',
        ], currentPlan === 'basic')}

        {renderPlanCard('plus', `$${PRICING.plus}/month`, [
          'Unlimited messages',
          '10 active chats',
          '5 rewinds per day',
          'See who viewed your profile',
          'Unlimited groups',
          'Advanced filters',
          'Walk Score access',
          'Online status visibility',
          'AI match assistant',
          '1 boost per week',
        ], currentPlan === 'plus')}

        {renderPlanCard(
          'elite',
          `$${PRICING.elite}/month ${user?.role === 'renter' ? '(Seekers)' : '(Hosts/Agents)'}`,
          [
            'Everything in Plus',
            'Unlimited messages',
            'Unlimited chats',
            'Unlimited rewinds',
            'See who liked you',
            'Priority visibility boost',
            'Boosted matching',
            'Priority messaging (no match needed)',
            'Featured listings',
            'AI match assistant',
          ],
          currentPlan === 'elite'
        )}

        {scheduledPlan && scheduledChangeDate ? (
          <View style={[styles.section, styles.scheduledChangeBanner, { backgroundColor: subscriptionStatus === 'cancelled' ? '#FEF2F2' : '#FFF7ED', borderColor: subscriptionStatus === 'cancelled' ? '#EF4444' : '#F97316' }]}>
            <Feather name="info" size={20} color={subscriptionStatus === 'cancelled' ? '#EF4444' : '#F97316'} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[Typography.body, { fontWeight: '600', color: subscriptionStatus === 'cancelled' ? '#DC2626' : '#EA580C' }]}>
                {subscriptionStatus === 'cancelled' ? 'Subscription Cancelled' : 'Plan Change Scheduled'}
              </ThemedText>
              <ThemedText style={[Typography.small, { color: subscriptionStatus === 'cancelled' ? '#991B1B' : '#9A3412', marginBottom: Spacing.sm }]}>
                {subscriptionStatus === 'cancelled' 
                  ? `Your subscription will end on ${new Date(scheduledChangeDate).toLocaleDateString()}. You'll keep your current features until then.`
                  : `Your plan will change to ${scheduledPlan.charAt(0).toUpperCase() + scheduledPlan.slice(1)} on ${new Date(scheduledChangeDate).toLocaleDateString()}.`
                }
              </ThemedText>
              <Pressable
                style={[styles.reactivateButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  await reactivateSubscription();
                  Alert.alert(
                    'Subscription Reactivated',
                    'Your subscription will continue on the current plan.',
                    [{ text: 'OK' }]
                  );
                }}
                disabled={processing}
              >
                <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                  {subscriptionStatus === 'cancelled' ? 'Reactivate Subscription' : 'Cancel Scheduled Change'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {(isPlus || isElite) ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Billing History</ThemedText>
            <View style={[styles.billingItem, { backgroundColor: theme.backgroundDefault }]}>
              <View>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                  {isElite ? 'Elite' : 'Plus'} Subscription
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {new Date().toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                ${isElite ? PRICING.elite : PRICING.plus}
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
              Upgrade to {selectedPlan === 'plus' ? 'Plus' : 'Elite'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              {selectedPlan === 'plus' 
                ? `Unlock unlimited groups and advanced features for $${PRICING.plus}/month.`
                : `Get priority visibility, unlimited rewinds, and premium features for $${PRICING.elite}/month.`}
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

      <Modal
        visible={showDowngradeConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDowngradeConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[Typography.h2, { marginBottom: Spacing.md }]}>
              Downgrade to {downgradeTo === 'basic' ? 'Basic' : 'Plus'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              Your plan will change to {downgradeTo === 'basic' ? 'Basic' : 'Plus'} at the end of your current billing period. 
              {'\n\n'}You'll keep your current {currentPlan === 'plus' ? 'Plus' : 'Elite'} features until {user?.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : 'the end of your billing period'}.
              {'\n\n'}Continue with downgrade?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => {
                  setShowDowngradeConfirm(false);
                  setDowngradeTo(null);
                }}
              >
                <ThemedText style={[Typography.body]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: '#F97316' }]}
                onPress={confirmDowngrade}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Downgrade
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[Typography.h2, { marginBottom: Spacing.md }]}>
              Cancel Subscription
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              Are you sure you want to cancel your {currentPlan === 'plus' ? 'Plus' : 'Elite'} subscription?
              {'\n\n'}You'll keep your current features until {user?.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : 'the end of your billing period'}, then your plan will revert to Basic.
              {'\n\n'}You can re-subscribe at any time.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setShowCancelConfirm(false)}
              >
                <ThemedText style={[Typography.body]}>Keep Plan</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: '#EF4444' }]}
                onPress={confirmCancellation}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Cancel Subscription
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
  downgradeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    borderWidth: 1,
  },
  scheduledChangeBanner: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  reactivateButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
