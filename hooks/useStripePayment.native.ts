import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { getPriceId } from '../constants/stripePrices';
import { useConfirm } from '../contexts/ConfirmContext';

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { alert: showAlert } = useConfirm();

  const processPayment = async (
    userId: string,
    email: string,
    plan: string,
    billingCycle: 'monthly' | '3month' | 'annual'
  ): Promise<{ success: boolean; subscriptionId?: string }> => {
    const priceId = getPriceId(plan, billingCycle);
    if (!priceId) {
      await showAlert({ title: 'Error', message: 'Could not find pricing for this plan.', variant: 'warning' });
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
        merchantDisplayName: 'Rhome',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) throw new Error(initError.message);

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          await showAlert({ title: 'Payment Failed', message: paymentError.message, variant: 'warning' });
        }
        return { success: false };
      }

      return { success: true, subscriptionId: data.subscriptionId };
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message || 'Something went wrong. Please try again.', variant: 'warning' });
      return { success: false };
    }
  };

  return { processPayment };
}
