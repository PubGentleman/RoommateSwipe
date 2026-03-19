import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { getPriceId } from '../constants/stripePrices';

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const processPayment = async (
    userId: string,
    email: string,
    plan: string,
    billingCycle: 'monthly' | '3month' | 'annual'
  ): Promise<{ success: boolean; subscriptionId?: string }> => {
    const priceId = getPriceId(plan, billingCycle);
    if (!priceId) {
      Alert.alert('Error', 'Could not find pricing for this plan.');
      return { success: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { priceId },
      });

      if (error || !data?.clientSecret) {
        throw new Error(error?.message || 'Failed to initialize payment');
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
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

      return { success: true, subscriptionId: data.subscriptionId };
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
      return { success: false };
    }
  };

  return { processPayment };
}
