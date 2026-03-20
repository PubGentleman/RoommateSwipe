import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export function useOutreachPayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const presentOutreachPayment = async (
    clientSecret: string
  ): Promise<{ success: boolean }> => {
    try {
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Roomdr',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) throw new Error(initError.message);

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
        return { success: false };
      }

      return { success: true };
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
      return { success: false };
    }
  };

  return { presentOutreachPayment };
}
