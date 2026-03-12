import { supabase } from '../lib/supabase';
import { isDev } from '../utils/envUtils';

export const createPaymentIntent = async (
  amount: number,
  currency: string = 'usd',
  metadata: Record<string, string> = {}
) => {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { amount, currency, metadata }
  });
  if (error) throw error;
  return data;
};

export const processSubscription = async (
  priceId: string,
  customerId: string
) => {
  const { data, error } = await supabase.functions.invoke('create-subscription', {
    body: { priceId, customerId }
  });
  if (error) throw error;
  return data;
};

export const createVerificationSession = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('create-verification-session', {
    body: { userId }
  });
  if (error) throw error;
  return data;
};

export const initiateBackgroundCheck = async (userId: string, email: string) => {
  const { data, error } = await supabase.functions.invoke('initiate-background-check', {
    body: { userId, email }
  });
  if (error) throw error;
  return data;
};

export const isDevMode = isDev;
