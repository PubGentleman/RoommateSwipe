import { Platform } from 'react-native';

export function useOutreachPayment() {
  const presentOutreachPayment = async (
    _clientSecret: string
  ): Promise<{ success: boolean }> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.alert('Payment is available on the Roomdr mobile app. Please use the iOS or Android app to complete this purchase.');
      }
    }
    return { success: false };
  };

  return { presentOutreachPayment };
}
