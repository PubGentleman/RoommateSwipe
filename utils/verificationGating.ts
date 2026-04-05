import { User } from '../types/models';

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
