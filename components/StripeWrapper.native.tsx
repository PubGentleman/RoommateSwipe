import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export function StripeWrapper({ children }: { children: React.ReactNode }) {
  if (!STRIPE_PUBLISHABLE_KEY) return <>{children}</>;
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{children}</StripeProvider>;
}
