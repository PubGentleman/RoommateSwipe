import { supabase } from '../lib/supabase';
import { isDev } from '../utils/envUtils';
import { withTimeout } from '../utils/asyncHelpers';

export const createPaymentIntent = async (
  amount: number,
  currency: string = 'usd',
  metadata: Record<string, string> = {}
) => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('create-payment-intent', {
    body: { amount, currency, metadata }
  }),
    30000,
    'create-payment-intent'
  );
  if (error) throw error;
  return data;
};

export const processSubscription = async (
  priceId: string,
  customerId: string
) => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('create-subscription', {
    body: { priceId, customerId }
  }),
    30000,
    'create-subscription'
  );
  if (error) throw error;
  return data;
};

export const createVerificationSession = async (userId: string) => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('create-verification-session', {
    body: { userId }
  }),
    30000,
    'create-verification-session'
  );
  if (error) throw error;
  return data;
};

export const initiateBackgroundCheck = async (userId: string, email: string) => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('initiate-background-check', {
    body: { userId, email }
  }),
    30000,
    'initiate-background-check'
  );
  if (error) throw error;
  return data;
};

export const isDevMode = isDev;
