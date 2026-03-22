import { useStripe } from '@stripe/stripe-react-native';
import { useConfirm } from '../contexts/ConfirmContext';

export function useOutreachPayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { alert: showAlert } = useConfirm();

  const presentOutreachPayment = async (
    clientSecret: string
  ): Promise<{ success: boolean }> => {
    try {
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
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

      return { success: true };
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message || 'Something went wrong. Please try again.', variant: 'warning' });
      return { success: false };
    }
  };

  return { presentOutreachPayment };
}
