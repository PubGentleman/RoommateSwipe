import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export function StripeWrapper({ children }: { children: React.ReactNode }) {
  if (!STRIPE_PUBLISHABLE_KEY) {
    if (__DEV__) {
      console.warn('[StripeWrapper] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe payments will not work. Add your Stripe publishable key to environment variables.');
    }
    return <>{children}</>;
  }
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{children}</StripeProvider>;
}
