import { Platform } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { getPriceId } from '../constants/stripePrices';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { withTimeout } from '../utils/asyncHelpers';

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { purchase } = useRevenueCat();

  const processPayment = async (
    userId: string,
    email: string,
    plan: string,
    billingCycle: 'monthly' | '3month' | 'annual',
    planType?: 'renter' | 'host' | 'agent' | 'company'
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Payment timed out. Please try again.')), 30000)
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

        let subscriptionId: string | undefined;
        if (result.success) {
          const ci = result.customerInfo;
          const activeEntitlements = ci?.entitlements?.active;
          const firstEntitlementKey = activeEntitlements ? Object.keys(activeEntitlements)[0] : undefined;
          subscriptionId =
            ci?.activeSubscriptions?.[0] ||
            (firstEntitlementKey ? activeEntitlements![firstEntitlementKey]?.productIdentifier : undefined) ||
            undefined;

          if (!subscriptionId) {
            console.warn('[useStripePayment] Could not extract real subscription ID from RevenueCat result, using fallback');
            subscriptionId = `rc_${plan}_${billingCycle}`;
          }
        }

        return {
          success: result.success,
          subscriptionId,
          error: result.success ? undefined : (result.error || 'Purchase could not be completed.'),
        };
      } catch (err: any) {
        const msg = err.message?.includes('timed out') ? 'Payment timed out. Please try again.' : (err.message || 'Something went wrong. Please try again.');
        return { success: false, error: msg };
      }
    }

    const priceId = getPriceId(plan, billingCycle);
    if (!priceId) {
      return { success: false, error: 'Could not find pricing for this plan.' };
    }

    try {
      const stripeFlow = async () => {
        const { data, error } = await withTimeout(
    supabase.functions.invoke('create-subscription', {
          body: { priceId, plan, billingCycle, planType },
        }),
    30000,
    'create-subscription'
  );

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
          if (paymentError.code === 'Canceled') {
            return { success: false as const, error: 'Payment was canceled.' };
          }
          return { success: false as const, error: paymentError.message };
        }

        return { success: true as const, subscriptionId: data.subscriptionId };
      };

      return await Promise.race([stripeFlow(), timeoutPromise]);
    } catch (err: any) {
      const msg = err.message?.includes('timed out') ? 'Payment timed out. Please try again.' : (err.message || 'Something went wrong. Please try again.');
      return { success: false, error: msg };
    }
  };

  return { processPayment };
}
