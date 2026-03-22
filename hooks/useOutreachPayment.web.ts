import { useConfirm } from '../contexts/ConfirmContext';

export function useOutreachPayment() {
  const { alert: showAlert } = useConfirm();

  const presentOutreachPayment = async (
    _clientSecret: string
  ): Promise<{ success: boolean }> => {
    await showAlert({ title: 'Payment Unavailable', message: 'Payment is available on the Roomdr mobile app. Please use the iOS or Android app to complete this purchase.', variant: 'info' });
    return { success: false };
  };

  return { presentOutreachPayment };
}
