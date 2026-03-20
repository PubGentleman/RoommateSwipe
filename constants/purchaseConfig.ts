export type PurchaseType = 'subscription' | 'one_time' | 'credits';

export interface PurchaseConfig {
  id: string;
  type: PurchaseType;
  title: string;
  targetLabel: string;
  price: string;
  priceNote: string;
  icon: string;
  iconColor: string;
  confirmLabel: string;
  disclaimer: string;
  perks?: string[];
}

export const HOST_PLAN_CONFIGS: Record<string, PurchaseConfig> = {
  starter: {
    id: 'host_starter',
    type: 'subscription',
    title: 'Confirm Plan Change',
    targetLabel: 'Host Starter',
    price: '$19.99/mo',
    priceNote: 'billed monthly',
    icon: 'zap',
    iconColor: '#FF6B6B',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $19.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Proactive outreach to 3 groups per day',
      'List up to 5 properties',
      'Priority listing placement',
      'Full renter group profiles',
    ],
  },
  pro: {
    id: 'host_pro',
    type: 'subscription',
    title: 'Confirm Plan Change',
    targetLabel: 'Host Pro',
    price: '$49.99/mo',
    priceNote: 'billed monthly',
    icon: 'trending-up',
    iconColor: '#6C63FF',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $49.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Proactive outreach to 5 groups per day',
      'Unlimited property listings',
      'Top listing placement',
      'Basic analytics dashboard',
      'Full renter group profiles',
    ],
  },
  business: {
    id: 'host_business',
    type: 'subscription',
    title: 'Confirm Plan Change',
    targetLabel: 'Host Business',
    price: '$99.99/mo',
    priceNote: 'billed monthly',
    icon: 'briefcase',
    iconColor: '#F59E0B',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $99.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Proactive outreach to 10 groups per day',
      'Unlimited property listings',
      'Featured listing badge',
      'Advanced analytics dashboard',
      'Company/Agent profile branding',
      'Dedicated support',
    ],
  },
};

export const OUTREACH_PACKAGE_CONFIGS: Record<string, PurchaseConfig> = {
  single: {
    id: 'outreach_single',
    type: 'one_time',
    title: 'Reach Out to Groups',
    targetLabel: '1 Group',
    price: '$2.99',
    priceNote: 'one-time \u00B7 1 group message',
    icon: 'message-circle',
    iconColor: '#FF6B6B',
    confirmLabel: 'Pay Now',
    disclaimer: 'One-time charge of $2.99.\nNo recurring fees. Message sent immediately after payment.',
    perks: [
      'Send 1 message to a renter group',
      'Introduce your next available listing',
    ],
  },
  triple: {
    id: 'outreach_triple',
    type: 'one_time',
    title: 'Reach Out to Groups',
    targetLabel: '3 Groups',
    price: '$6.99',
    priceNote: 'one-time \u00B7 3 group messages',
    icon: 'message-circle',
    iconColor: '#FF6B6B',
    confirmLabel: 'Pay Now',
    disclaimer: 'One-time charge of $6.99.\nNo recurring fees. Messages sent immediately after payment.',
    perks: [
      'Send messages to up to 3 renter groups',
      'Best value for active hosts',
      'Introduce your next available listing',
    ],
  },
  all: {
    id: 'outreach_all',
    type: 'one_time',
    title: 'Reach Out to Groups',
    targetLabel: 'All Groups',
    price: '$9.99',
    priceNote: 'one-time \u00B7 unlimited group messages',
    icon: 'send',
    iconColor: '#FF6B6B',
    confirmLabel: 'Pay Now',
    disclaimer: 'One-time charge of $9.99.\nNo recurring fees. Messages sent immediately after payment.',
    perks: [
      'Message every discoverable renter group',
      'Maximum reach for your listing',
      'Best value if 4+ groups match',
    ],
  },
};

export const RENTER_PLAN_CONFIGS: Record<string, PurchaseConfig> = {
  plus: {
    id: 'renter_plus',
    type: 'subscription',
    title: 'Upgrade Your Search',
    targetLabel: 'Plus',
    price: '$14.99/mo',
    priceNote: 'billed monthly',
    icon: 'star',
    iconColor: '#6C63FF',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $14.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Unlimited daily swipes',
      'Join up to 3 groups',
      'Advanced search filters',
      'See who liked your profile',
      'Verified profile badge',
    ],
  },
  elite: {
    id: 'renter_elite',
    type: 'subscription',
    title: 'Upgrade Your Search',
    targetLabel: 'Elite',
    price: '$29.99/mo',
    priceNote: 'billed monthly',
    icon: 'zap',
    iconColor: '#F59E0B',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $29.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Unlimited swipes + unlimited groups',
      'Full match breakdown details',
      'Profile boost — appear higher in searches',
      'Read receipts on messages',
      'Incognito mode — browse without being seen',
      'Dedicated support',
    ],
  },
};

export const OUTREACH_CREDIT_CONFIGS: Record<string, PurchaseConfig> = {
  small: {
    id: 'outreach_credits_small',
    type: 'credits',
    title: 'Unlock More Outreach',
    targetLabel: '+3 Extra Sends',
    price: '$4.99',
    priceNote: 'valid today only \u00B7 expires midnight',
    icon: 'unlock',
    iconColor: '#22C55E',
    confirmLabel: 'Unlock Now',
    disclaimer: 'One-time charge of $4.99.\nCredits expire at midnight tonight and do not roll over.',
    perks: [
      'Send 3 additional group messages today',
      'Credits added instantly after payment',
    ],
  },
  large: {
    id: 'outreach_credits_large',
    type: 'credits',
    title: 'Unlock More Outreach',
    targetLabel: '+10 Extra Sends',
    price: '$12.99',
    priceNote: 'valid today only \u00B7 expires midnight',
    icon: 'unlock',
    iconColor: '#22C55E',
    confirmLabel: 'Unlock Now',
    disclaimer: 'One-time charge of $12.99.\nCredits expire at midnight tonight and do not roll over.',
    perks: [
      'Send 10 additional group messages today',
      'Best value for high-volume outreach days',
      'Credits added instantly after payment',
    ],
  },
};
