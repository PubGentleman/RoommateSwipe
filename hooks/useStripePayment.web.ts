export function useStripePayment() {
  const processPayment = async (
    _userId: string,
    _email: string,
    _plan: string,
    _billingCycle: 'monthly' | '3month' | 'annual',
    _planType?: 'renter' | 'host' | 'agent' | 'company'
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> => {
    return { success: false, error: 'Payment is available on the Rhome mobile app. Please use the iOS or Android app to subscribe.' };
  };

  return { processPayment };
}
