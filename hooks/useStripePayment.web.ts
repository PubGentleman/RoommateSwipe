import { Alert, Platform } from 'react-native';

export function useStripePayment() {
  const processPayment = async (
    _userId: string,
    _email: string,
    _plan: string,
    _billingCycle: 'monthly' | '3month' | 'annual'
  ): Promise<{ success: boolean; subscriptionId?: string }> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.alert('Payment is available on the Roomdr mobile app. Please use the iOS or Android app to subscribe.');
      }
    } else {
      Alert.alert('Payment Unavailable', 'Please use the Roomdr mobile app to subscribe.');
    }
    return { success: false };
  };

  return { processPayment };
}
