import { useConfirm } from '../contexts/ConfirmContext';

export function useStripePayment() {
  const { alert: showAlert } = useConfirm();

  const processPayment = async (
    _userId: string,
    _email: string,
    _plan: string,
    _billingCycle: 'monthly' | '3month' | 'annual',
    _planType?: 'renter' | 'host' | 'agent' | 'company'
  ): Promise<{ success: boolean; subscriptionId?: string }> => {
    await showAlert({ title: 'Payment Unavailable', message: 'Payment is available on the Rhome mobile app. Please use the iOS or Android app to subscribe.', variant: 'info' });
    return { success: false };
  };

  return { processPayment };
}
