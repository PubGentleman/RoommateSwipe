import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { isDev } from '../../utils/envUtils';

export const PaymentScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);

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
      id: isDev ? `pm_dev_${Date.now().toString(36)}` : `pm_${Date.now().toString(36)}`,
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
    <ScreenKeyboardAwareScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ backgroundColor: '#111111' }}>
      <View style={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.h2]}>Payment Methods</ThemedText>
            {!showAddCard ? (
              <Pressable onPress={() => setShowAddCard(true)}>
                <ThemedText style={[Typography.body, { color: theme.primary, fontWeight: '600' }]}>
                  Add Card
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
            Add and manage your payment cards
          </ThemedText>

          {showAddCard ? (
            <View style={[styles.addCardForm, { backgroundColor: '#1a1a1a' }]}>
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.lg }]}>Add New Card</ThemedText>
              
              <View style={styles.inputGroup}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                  Card Number
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF' }]}
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
                    style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF' }]}
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
                    style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF' }]}
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
                  style={[styles.button, styles.cancelButton, { borderColor: '#333333' }]}
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
                style={[styles.paymentMethod, { backgroundColor: '#1a1a1a' }]}
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
            <View style={[styles.emptyState, { backgroundColor: '#1a1a1a' }]}>
              <Feather name="credit-card" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                No payment methods added
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
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
});
