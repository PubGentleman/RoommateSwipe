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
  const { user, upgradeToPremium, updateUser } = useAuth();
  const navigation = useNavigation();
  
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  const isPremium = user?.subscription?.plan === 'premium';
  const monthlyPrice = 9.99;

  const handleUpgrade = () => {
    if (!user?.paymentMethods || user.paymentMethods.length === 0) {
      Alert.alert(
        'Payment Method Required',
        'Please add a payment method before upgrading to Premium.',
        [{ text: 'OK' }]
      );
      setShowAddCard(true);
      return;
    }

    setShowUpgradeConfirm(true);
  };

  const confirmUpgrade = async () => {
    setShowUpgradeConfirm(false);
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await upgradeToPremium();
    
    Alert.alert(
      'Success!',
      'Welcome to Premium! You can now create and join unlimited groups.',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
    setProcessing(false);
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

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.container}>
        <View style={[styles.planCard, { backgroundColor: isPremium ? theme.primary : theme.backgroundDefault }]}>
          <View style={styles.planHeader}>
            <View>
              <ThemedText style={[Typography.h2, { color: isPremium ? '#FFFFFF' : theme.text }]}>
                {isPremium ? 'Premium' : 'Free'} Plan
              </ThemedText>
              {isPremium ? (
                <ThemedText style={[Typography.body, { color: '#FFFFFF', opacity: 0.9, marginTop: Spacing.xs }]}>
                  ${monthlyPrice}/month
                </ThemedText>
              ) : (
                <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                  $0/month
                </ThemedText>
              )}
            </View>
            {isPremium ? (
              <View style={styles.premiumBadge}>
                <Feather name="star" size={24} color="#FFD700" />
              </View>
            ) : null}
          </View>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Feather name="check" size={20} color={isPremium ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: isPremium ? '#FFFFFF' : theme.text }]}>
                {isPremium ? 'Unlimited' : 'Create 1'} group creation
              </ThemedText>
            </View>
            <View style={styles.feature}>
              <Feather name="check" size={20} color={isPremium ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: isPremium ? '#FFFFFF' : theme.text }]}>
                {isPremium ? 'Unlimited' : 'Join 1'} group joining
              </ThemedText>
            </View>
            <View style={styles.feature}>
              <Feather name="check" size={20} color={isPremium ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: isPremium ? '#FFFFFF' : theme.text }]}>
                Unlimited messaging
              </ThemedText>
            </View>
            <View style={styles.feature}>
              <Feather name="check" size={20} color={isPremium ? '#FFFFFF' : theme.primary} />
              <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: isPremium ? '#FFFFFF' : theme.text }]}>
                Priority support
              </ThemedText>
            </View>
          </View>

          {!isPremium ? (
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
              onPress={handleUpgrade}
              disabled={processing}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                {processing ? 'Processing...' : `Upgrade to Premium - $${monthlyPrice}/mo`}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.activeSubscription, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <Feather name="check-circle" size={20} color="#FFFFFF" />
              <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
                Active Subscription
              </ThemedText>
            </View>
          )}
        </View>

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

        {isPremium ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Billing History</ThemedText>
            <View style={[styles.billingItem, { backgroundColor: theme.backgroundDefault }]}>
              <View>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Premium Subscription</ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {new Date().toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>${monthlyPrice}</ThemedText>
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
              Upgrade to Premium
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
              Unlock unlimited group creation and joining for ${monthlyPrice}/month.{'\n\n'}Continue with upgrade?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setShowUpgradeConfirm(false)}
              >
                <ThemedText style={[Typography.body]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: theme.primary }]}
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
