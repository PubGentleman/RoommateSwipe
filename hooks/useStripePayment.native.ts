import { Platform } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { getPriceId } from '../constants/stripePrices';
import { useConfirm } from '../contexts/ConfirmContext';
import { useRevenueCat } from '../contexts/RevenueCatContext';

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { alert: showAlert } = useConfirm();
  const { purchase } = useRevenueCat();

  const processPayment = async (
    userId: string,
    email: string,
    plan: string,
    billingCycle: 'monthly' | '3month' | 'annual',
    planType?: 'renter' | 'host' | 'agent' | 'company'
  ): Promise<{ success: boolean; subscriptionId?: string }> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Payment timed out. Please try again.')), 90000)
    );

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const effectivePlanType = planType === 'agent' || planType === 'company' ? 'host' : (planType || 'renter');
      let rcPlan = plan;
      if (plan.startsWith('host_')) {
        rcPlan = plan.replace('host_', '');
      }
      try {
        const result = await Promise.race([
          purchase(rcPlan, billingCycle, effectivePlanType as 'renter' | 'host'),
          timeoutPromise,
        ]);
        if (!result.success) {
          const errorMsg = result.error || 'Purchase could not be completed. Please try again.';
          await showAlert({ title: 'Purchase Failed', message: errorMsg, variant: 'warning' });
        }
        return { success: result.success, subscriptionId: result.success ? `rc_${plan}_${billingCycle}` : undefined };
      } catch (err: any) {
        const msg = err.message?.includes('timed out') ? 'Payment timed out. Please try again.' : (err.message || 'Something went wrong. Please try again.');
        await showAlert({ title: 'Purchase Failed', message: msg, variant: 'warning' });
        return { success: false };
      }
    }

    const priceId = getPriceId(plan, billingCycle);
    if (!priceId) {
      await showAlert({ title: 'Error', message: 'Could not find pricing for this plan.', variant: 'warning' });
      return { success: false };
    }

    try {
      const stripeFlow = async () => {
        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: { priceId, plan, billingCycle, planType },
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
          return { success: false } as const;
        }

        return { success: true as const, subscriptionId: data.subscriptionId };
      };

      return await Promise.race([stripeFlow(), timeoutPromise]);
    } catch (err: any) {
      const msg = err.message?.includes('timed out') ? 'Payment timed out. Please try again.' : (err.message || 'Something went wrong. Please try again.');
      await showAlert({ title: 'Error', message: msg, variant: 'warning' });
      return { success: false };
    }
  };

  return { processPayment };
}
