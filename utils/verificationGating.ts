import { Alert } from 'react-native';
import { User } from '../types/models';
import { supabase } from '../lib/supabase';

export function isEmailVerified(user: User | null): boolean {
  if (!user) return false;
  return user.emailVerified === true;
}

export type GatedFeature =
  | 'send_message'
  | 'swipe'
  | 'create_listing'
  | 'boost_listing'
  | 'join_group'
  | 'create_group'
  | 'send_cold_message'
  | 'submit_application';

export function checkVerificationGate(
  user: User | null,
  feature: GatedFeature
): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: 'Not logged in' };

  if (!isEmailVerified(user)) {
    return {
      allowed: false,
      reason: 'Please verify your email to use this feature.',
    };
  }

  return { allowed: true };
}

export function requireVerification(
  emailVerified: boolean | undefined,
  actionName: string = 'this feature'
): boolean {
  if (emailVerified !== false) return true;

  Alert.alert(
    'Email Verification Required',
    `Please verify your email to use ${actionName}. Check your inbox for the verification link.`,
    [
      { text: 'OK', style: 'default' },
      {
        text: 'Resend Email',
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              await supabase.auth.resend({ type: 'signup', email: user.email });
              Alert.alert('Sent', 'Verification email resent. Check your inbox.');
            }
          } catch {}
        },
      },
    ]
  );
  return false;
}
