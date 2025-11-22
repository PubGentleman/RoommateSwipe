import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

export const PaymentScreen = () => {
  const { theme } = useTheme();
  const { user, upgradeToPremium, upgradeToVIP, updateUser } = useAuth();
  const navigation = useNavigation();
  
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'vip' | null>(null);

  const currentPlan = user?.subscription?.plan || 'free';
  const isPremium = currentPlan === 'premium';
  const isVIP = currentPlan === 'vip';
  
  const PRICING = {
    premium: 14.99,
    vip: user?.role === 'renter' ? 49.99 : 99.00,
  };

  const handleUpgrade = (plan: 'premium' | 'vip') => {
    if (!user?.paymentMethods || user.paymentMethods.length === 0) {
      Alert.alert(
        'Payment Method Required',
        'Please add a payment method before upgrading.',
        [{ text: 'OK' }]
      );
      setShowAddCard(true);
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
    
    if (selectedPlan === 'premium') {
      await upgradeToPremium();
    } else if (selectedPlan === 'vip') {
      await upgradeToVIP();
    }
    
    const planName = selectedPlan === 'premium' ? 'Premium' : 'VIP';
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

  const handleAddPaymentMethod = async () => {
    if (!cardNumber || !expiryDate || !cvv) {
      Alert.alert('Error', 'Please fill in all card details');
      return;
    }

    if (cardNumber.replace(/\s/g, '').length !== 16) {
      Alert.alert('Error', 'Please enter a valid 16-digit card number');
      return;
    }

    if (cvv.length !== 3) {
      Alert.alert('Error', 'Please enter a valid 3-digit CVV');
      return;
    }

    const expiryParts = expiryDate.split('/');
    if (expiryParts.length !== 2) {
      Alert.alert('Error', 'Please enter a valid expiry date (MM/YY)');
      return;
    }

    const month = parseInt(expiryParts[0]);
    const year = parseInt(expiryParts[1]);

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      Alert.alert('Error', 'Please enter a valid expiry date');
      return;
    }

    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      Alert.alert('Error', 'Card has expired. Please enter a valid expiry date');
      return;
    }

    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const cardFirstDigit = cardNumber.replace(/\s/g, '')[0];
    const brand = cardFirstDigit === '4' ? 'Visa' : cardFirstDigit === '5' ? 'Mastercard' : 'Card';

    const newPaymentMethod = {
      id: `pm_${Math.random().toString(36).substr(2, 9)}`,
      type: 'card' as const,
      last4,
      brand,
      expiryMonth: month,
      expiryYear: 2000 + year,
    };

    await updateUser({
      paymentMethods: [...(user?.paymentMethods || []), newPaymentMethod],
    });

    setCardNumber('');
    setExpiryDate('');
    setCvv('');
    setShowAddCard(false);
    setProcessing(false);

    Alert.alert('Success', 'Payment method added successfully');
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      const month = cleaned.slice(0, 2);
      const year = cleaned.slice(2, 4);
      if (parseInt(month) > 12) return '12/' + year;
      return month + '/' + year;
    }
    return cleaned;
  };

  const renderPlanCard = (
    planType: 'free' | 'premium' | 'vip',
    price: string,
    features: string[],
    isCurrentPlan: boolean
  ) => {
    const planColors = {
      free: theme.backgroundDefault,
      premium: theme.primary,
      vip: '#7C3AED',
    };
    const bgColor = isCurrentPlan ? planColors[planType] : theme.backgroundDefault;
    const textColor = isCurrentPlan && planType !== 'free' ? '#FFFFFF' : theme.text;

    return (
      <View key={planType} style={[styles.planCard, { backgroundColor: bgColor, borderColor: theme.border, borderWidth: isCurrentPlan ? 0 : 1 }]}>
        <View style={styles.planHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <ThemedText style={[Typography.h2, { color: textColor }]}>
                {planType.charAt(0).toUpperCase() + planType.slice(1)}
              </ThemedText>
              {planType === 'vip' && <Feather name="award" size={20} color={isCurrentPlan ? '#FFD700' : '#7C3AED'} />}
            </View>
            <ThemedText style={[Typography.body, { color: isCurrentPlan && planType !== 'free' ? 'rgba(255,255,255,0.9)' : theme.textSecondary, marginTop: Spacing.xs }]}>
              {price}
            </ThemedText>
          </View>
        </View>

        <View style={styles.features}>
          {features.map((feature, index) => (
            <View key={index} style={styles.feature}>
              <Feather name="check" size={18} color={isCurrentPlan && planType !== 'free' ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, color: textColor, flex: 1 }]}>
                {feature}
              </ThemedText>
            </View>
          ))}
        </View>

        {isCurrentPlan ? (
          <View style={[styles.activeSubscription, { backgroundColor: planType === 'free' ? theme.primary + '20' : 'rgba(255, 255, 255, 0.2)' }]}>
            <Feather name="check-circle" size={18} color={planType === 'free' ? theme.primary : '#FFFFFF'} />
            <ThemedText style={[Typography.small, { color: planType === 'free' ? theme.primary : '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Current Plan
            </ThemedText>
          </View>
        ) : planType !== 'free' ? (
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: planType === 'premium' ? theme.primary : '#7C3AED', opacity: (planType === 'premium' && isVIP) ? 0.5 : 1 }]}
            onPress={() => handleUpgrade(planType)}
            disabled={processing || (planType === 'premium' && isVIP)}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              {processing ? 'Processing...' : (planType === 'premium' && isVIP) ? 'Downgrade Not Available' : `Upgrade - ${price}`}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.container}>
        <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>Choose Your Plan</ThemedText>
        
        {renderPlanCard('free', '$0/month', [
          'Create 1 group',
          'Join 1 group',
          'Basic messaging',
          'Browse listings',
        ], currentPlan === 'free')}

        {renderPlanCard('premium', `$${PRICING.premium}/month`, [
          'Unlimited groups',
          'Unlimited messaging',
          'Full profile visibility',
          'Advanced filters',
          '1 boost per week',
        ], currentPlan === 'premium')}

        {renderPlanCard(
          'vip',
          `$${PRICING.vip}/month ${user?.role === 'renter' ? '(Seekers)' : '(Hosts/Agents)'}`,
          [
            'Everything in Premium',
            'Priority placement',
            'VIP badge',
            'Unlimited boosts',
            'Featured listings',
            'AI match assistant',
          ],
          currentPlan === 'vip'
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.h3]}>Payment Methods</ThemedText>
            {!showAddCard ? (
              <Pressable onPress={() => setShowAddCard(true)}>
                <ThemedText style={[Typography.body, { color: theme.primary, fontWeight: '600' }]}>
                  Add Card
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {showAddCard ? (
            <View style={[styles.addCardForm, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.lg }]}>Add New Card</ThemedText>
              
              <View style={styles.inputGroup}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                  Card Number
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={theme.textSecondary}
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.md }]}>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                    Expiry Date
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="MM/YY"
                    placeholderTextColor={theme.textSecondary}
                    value={expiryDate}
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                    CVV
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="123"
                    placeholderTextColor={theme.textSecondary}
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={3}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setShowAddCard(false);
                    setCardNumber('');
                    setExpiryDate('');
                    setCvv('');
                  }}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.body, { color: theme.text }]}>Cancel</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.button, styles.addButton, { backgroundColor: theme.primary }]}
                  onPress={handleAddPaymentMethod}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {processing ? 'Adding...' : 'Add Card'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {user?.paymentMethods && user.paymentMethods.length > 0 ? (
            user.paymentMethods.map((method) => (
              <View
                key={method.id}
                style={[styles.paymentMethod, { backgroundColor: theme.backgroundDefault }]}
              >
                <View style={styles.cardInfo}>
                  <Feather name="credit-card" size={24} color={theme.text} />
                  <View style={{ marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                      {method.brand} •••• {method.last4}
                    </ThemedText>
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.defaultBadge, { backgroundColor: theme.primary + '20' }]}>
                  <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
                    Default
                  </ThemedText>
                </View>
              </View>
            ))
          ) : !showAddCard ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="credit-card" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                No payment methods added
              </ThemedText>
            </View>
          ) : null}
        </View>

        {(isPremium || isVIP) ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Billing History</ThemedText>
            <View style={[styles.billingItem, { backgroundColor: theme.backgroundDefault }]}>
              <View>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                  {isVIP ? 'VIP' : 'Premium'} Subscription
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {new Date().toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                ${isVIP ? PRICING.vip : PRICING.premium}
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
              Upgrade to {selectedPlan === 'premium' ? 'Premium' : 'VIP'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              {selectedPlan === 'premium' 
                ? `Unlock unlimited groups and advanced features for $${PRICING.premium}/month.`
                : `Get priority placement, VIP badge, and unlimited boosts for $${PRICING.vip}/month.`}
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
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: selectedPlan === 'premium' ? theme.primary : '#7C3AED' }]}
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
    </ScreenKeyboardAwareScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  premiumBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  addCardForm: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  button: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  addButton: {},
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  emptyState: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
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
