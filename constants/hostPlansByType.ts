import { Linking } from 'react-native';

export type HostType = 'individual' | 'agent' | 'company';

export interface HostPlanFeature {
  label: string;
  included: boolean;
}

export interface HostPlanTier {
  id: string;
  name: string;
  monthlyPrice: number;
  threeMonthPrice: number;
  annualPrice: number;
  recommended?: boolean;
  features: HostPlanFeature[];
  monthlyNote: string;
  isContactSales?: boolean;
}

export interface HostPlanDisplayInfo {
  id: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  ctaLabel: string;
  isPopular: boolean;
  ctaStyle: 'outline' | 'primary' | 'gold';
  icon: 'user' | 'home' | 'trending-up' | 'briefcase' | 'shield' | 'building';
  featuresLabel: string;
}

export const HOST_TYPE_LABELS: Record<HostType, string> = {
  individual: 'Individual Landlord',
  agent: 'Real Estate Agent',
  company: 'Property Management Company',
};

const INDIVIDUAL_PLANS: HostPlanTier[] = [
  {
    id: 'free',
    name: 'Host Free',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    monthlyNote: 'No credit card required',
    features: [
      { label: '1 active listing', included: true },
      { label: 'Basic inquiry management', included: true },
      { label: 'Standard placement in search', included: true },
      { label: 'Renter group browsing', included: false },
      { label: 'AI assistant', included: false },
      { label: 'Listing boosts', included: false },
      { label: 'Compatibility scores', included: false },
      { label: 'Verified host badge', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Host Starter',
    monthlyPrice: 19.99,
    threeMonthPrice: 53.97,
    annualPrice: 191.88,
    monthlyNote: 'Renter groups, AI assistant & verified badge',
    features: [
      { label: '1 active listing', included: true },
      { label: 'Renter group browsing', included: true },
      { label: 'AI assistant (host modes)', included: true },
      { label: '1 free 24-hr boost per month', included: true },
      { label: 'Verified host badge', included: true },
      { label: 'Inquiry management', included: true },
      { label: '1 simultaneous boost', included: true },
    ],
  },
  {
    id: 'pro',
    name: 'Host Pro',
    monthlyPrice: 49.99,
    threeMonthPrice: 134.97,
    annualPrice: 479.88,
    recommended: true,
    monthlyNote: 'Up to 5 listings, priority placement & advanced analytics',
    features: [
      { label: 'Up to 5 active listings', included: true },
      { label: 'Priority placement in search', included: true },
      { label: '2 free 72-hr boosts per month', included: true },
      { label: 'Up to 3 simultaneous boosts', included: true },
      { label: 'Advanced analytics dashboard', included: true },
      { label: 'Renter group messaging', included: true },
      { label: 'Response rate tracking', included: true },
    ],
  },
  {
    id: 'business',
    name: 'Host Business',
    monthlyPrice: 99,
    threeMonthPrice: 267.30,
    annualPrice: 948.00,
    monthlyNote: 'Up to 15 listings, bulk tools & priority support',
    features: [
      { label: 'Up to 15 active listings', included: true },
      { label: '2 free 7-day boosts per month', included: true },
      { label: 'Up to 10 simultaneous boosts', included: true },
      { label: 'Bulk boost across listings', included: true },
      { label: 'Full analytics suite', included: true },
      { label: 'Bulk messaging tools', included: true },
      { label: 'Agent verification badge (add-on)', included: true },
      { label: 'Priority support', included: true },
    ],
  },
];

const AGENT_PLANS: HostPlanTier[] = [
  {
    id: 'free',
    name: 'Host Free',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    monthlyNote: 'No credit card required',
    features: [
      { label: '1 active listing', included: true },
      { label: 'Basic inquiry management', included: true },
      { label: 'Standard placement in search', included: true },
      { label: 'Client management tools', included: false },
      { label: 'AI-powered renter matching', included: false },
      { label: 'Agent profile badge', included: false },
    ],
  },
  {
    id: 'agent_starter',
    name: 'Agent Starter',
    monthlyPrice: 79,
    threeMonthPrice: 213.30,
    annualPrice: 758.40,
    monthlyNote: 'For new agents building their rental portfolio',
    features: [
      { label: 'Up to 10 active listings', included: true },
      { label: 'Client management tools', included: true },
      { label: 'AI-powered renter matching', included: true },
      { label: 'Background check access', included: true },
      { label: 'Agent profile badge', included: true },
      { label: 'Inquiry management', included: true },
    ],
  },
  {
    id: 'agent_pro',
    name: 'Agent Pro',
    monthlyPrice: 149,
    threeMonthPrice: 402.30,
    annualPrice: 1430.40,
    recommended: true,
    monthlyNote: 'For established agents with active rosters',
    features: [
      { label: 'Up to 30 active listings', included: true },
      { label: 'Advanced client management', included: true },
      { label: 'Priority listing placement', included: true },
      { label: 'Bulk background checks', included: true },
      { label: 'Leads & referral tracking', included: true },
      { label: 'Priority support', included: true },
    ],
  },
  {
    id: 'agent_business',
    name: 'Agent Business',
    monthlyPrice: 249,
    threeMonthPrice: 672.30,
    annualPrice: 2390.40,
    monthlyNote: 'High-volume agents and brokers',
    features: [
      { label: 'Unlimited active listings', included: true },
      { label: 'Full CRM integration', included: true },
      { label: 'Maximum listing visibility', included: true },
      { label: 'Unlimited background checks', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Dedicated account manager', included: true },
    ],
  },
];

const COMPANY_PLANS: HostPlanTier[] = [
  {
    id: 'free',
    name: 'Host Free',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    monthlyNote: 'No credit card required',
    features: [
      { label: '1 active listing', included: true },
      { label: 'Basic inquiry management', included: true },
      { label: 'Standard placement in search', included: true },
      { label: 'Team member access', included: false },
      { label: 'Company profile & branding', included: false },
      { label: 'Analytics dashboard', included: false },
    ],
  },
  {
    id: 'company_starter',
    name: 'Company Starter',
    monthlyPrice: 199,
    threeMonthPrice: 537.30,
    annualPrice: 1910.40,
    monthlyNote: 'For small property management companies',
    features: [
      { label: 'Up to 25 active listings', included: true },
      { label: 'Team member access (3 users)', included: true },
      { label: 'AI-powered renter matching', included: true },
      { label: 'Background check access', included: true },
      { label: 'Company profile & branding', included: true },
      { label: 'Analytics dashboard', included: true },
    ],
  },
  {
    id: 'company_pro',
    name: 'Company Pro',
    monthlyPrice: 399,
    threeMonthPrice: 1077.30,
    annualPrice: 3830.40,
    recommended: true,
    monthlyNote: 'For growing property management firms',
    features: [
      { label: 'Up to 100 active listings', included: true },
      { label: 'Team member access (10 users)', included: true },
      { label: 'Priority listing placement', included: true },
      { label: 'Bulk background checks', included: true },
      { label: 'Advanced analytics & reporting', included: true },
      { label: 'Priority support', included: true },
    ],
  },
  {
    id: 'company_enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    isContactSales: true,
    monthlyNote: 'Custom pricing for large portfolios',
    features: [
      { label: 'Unlimited active listings', included: true },
      { label: 'Unlimited team members', included: true },
      { label: 'Dedicated onboarding', included: true },
      { label: 'Custom API access', included: true },
      { label: 'SLA & compliance support', included: true },
      { label: 'Dedicated account manager', included: true },
    ],
  },
];

export const HOST_PLANS_BY_TYPE: Record<HostType, HostPlanTier[]> = {
  individual: INDIVIDUAL_PLANS,
  agent: AGENT_PLANS,
  company: COMPANY_PLANS,
};

const INDIVIDUAL_DISPLAY: HostPlanDisplayInfo[] = [
  {
    id: 'free',
    subtitle: 'Just getting started',
    badge: 'Free',
    badgeColor: '#888888',
    ctaLabel: 'Get Started Free',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'user',
    featuresLabel: "What's included",
  },
  {
    id: 'starter',
    subtitle: 'Homeowner with 1 room to fill',
    badge: 'Individual',
    badgeColor: '#60A5FA',
    ctaLabel: 'Get Started',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'home',
    featuresLabel: "What's included",
  },
  {
    id: 'pro',
    subtitle: 'Own 2-5 units or rooms',
    badge: 'Small Landlord',
    badgeColor: '#A78BFA',
    ctaLabel: 'Get Started',
    isPopular: true,
    ctaStyle: 'primary',
    icon: 'trending-up',
    featuresLabel: 'Everything in Starter, plus',
  },
  {
    id: 'business',
    subtitle: 'Landlord or property manager',
    badge: 'Professional',
    badgeColor: '#FBBF24',
    ctaLabel: 'Get Started',
    isPopular: false,
    ctaStyle: 'gold',
    icon: 'briefcase',
    featuresLabel: 'Everything in Pro, plus',
  },
];

const AGENT_DISPLAY: HostPlanDisplayInfo[] = [
  {
    id: 'free',
    subtitle: 'Try before you commit',
    badge: 'Free',
    badgeColor: '#888888',
    ctaLabel: 'Get Started Free',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'user',
    featuresLabel: "What's included",
  },
  {
    id: 'agent_starter',
    subtitle: 'Building your rental portfolio',
    badge: 'Agent',
    badgeColor: '#34D399',
    ctaLabel: 'Start as Agent',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'shield',
    featuresLabel: "What's included",
  },
  {
    id: 'agent_pro',
    subtitle: 'Established agent with active roster',
    badge: 'Agent Pro',
    badgeColor: '#A78BFA',
    ctaLabel: 'Go Agent Pro',
    isPopular: true,
    ctaStyle: 'primary',
    icon: 'trending-up',
    featuresLabel: 'Everything in Agent Starter, plus',
  },
  {
    id: 'agent_business',
    subtitle: 'High-volume agents and brokers',
    badge: 'Agent Business',
    badgeColor: '#FBBF24',
    ctaLabel: 'Go Agent Business',
    isPopular: false,
    ctaStyle: 'gold',
    icon: 'briefcase',
    featuresLabel: 'Everything in Agent Pro, plus',
  },
];

const COMPANY_DISPLAY: HostPlanDisplayInfo[] = [
  {
    id: 'free',
    subtitle: 'Try before you commit',
    badge: 'Free',
    badgeColor: '#888888',
    ctaLabel: 'Get Started Free',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'user',
    featuresLabel: "What's included",
  },
  {
    id: 'company_starter',
    subtitle: 'Small property management team',
    badge: 'Company',
    badgeColor: '#60A5FA',
    ctaLabel: 'Start for Company',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'building',
    featuresLabel: "What's included",
  },
  {
    id: 'company_pro',
    subtitle: 'Growing property management firm',
    badge: 'Company Pro',
    badgeColor: '#A78BFA',
    ctaLabel: 'Go Company Pro',
    isPopular: true,
    ctaStyle: 'primary',
    icon: 'trending-up',
    featuresLabel: 'Everything in Company Starter, plus',
  },
  {
    id: 'company_enterprise',
    subtitle: 'Large portfolios and enterprise firms',
    badge: 'Enterprise',
    badgeColor: '#FBBF24',
    ctaLabel: 'Contact Sales',
    isPopular: false,
    ctaStyle: 'gold',
    icon: 'briefcase',
    featuresLabel: 'Everything in Company Pro, plus',
  },
];

export const HOST_DISPLAY_BY_TYPE: Record<HostType, HostPlanDisplayInfo[]> = {
  individual: INDIVIDUAL_DISPLAY,
  agent: AGENT_DISPLAY,
  company: COMPANY_DISPLAY,
};

export const PLAN_ORDER: Record<string, number> = {
  free: 0,
  none: 0,
  starter: 1,
  pro: 2,
  business: 3,
  agent_starter: 1,
  agent_pro: 2,
  agent_business: 3,
  company_starter: 1,
  company_pro: 2,
  company_enterprise: 3,
};

export const HOST_STRIPE_PRICE_IDS: Record<string, string> = {
  starter_monthly: 'price_host_starter_monthly',
  starter_3month: 'price_host_starter_3month',
  starter_annual: 'price_host_starter_annual',
  pro_monthly: 'price_host_pro_monthly',
  pro_3month: 'price_host_pro_3month',
  pro_annual: 'price_host_pro_annual',
  biz_monthly: 'price_host_biz_monthly',
  biz_3month: 'price_host_biz_3month',
  biz_annual: 'price_host_biz_annual',
  agent_starter_monthly: 'price_agent_starter_monthly',
  agent_starter_3month: 'price_agent_starter_3month',
  agent_starter_annual: 'price_agent_starter_annual',
  agent_pro_monthly: 'price_agent_pro_monthly',
  agent_pro_3month: 'price_agent_pro_3month',
  agent_pro_annual: 'price_agent_pro_annual',
  agent_business_monthly: 'price_agent_business_monthly',
  agent_business_3month: 'price_agent_business_3month',
  agent_business_annual: 'price_agent_business_annual',
  company_starter_monthly: 'price_company_starter_monthly',
  company_starter_3month: 'price_company_starter_3month',
  company_starter_annual: 'price_company_starter_annual',
  company_pro_monthly: 'price_company_pro_monthly',
  company_pro_3month: 'price_company_pro_3month',
  company_pro_annual: 'price_company_pro_annual',
};

export function openEnterpriseSalesContact() {
  Linking.openURL('mailto:hello@rhomeapp.io?subject=Enterprise%20Plan%20Inquiry');
}

export function getHostPlans(hostType: HostType): HostPlanTier[] {
  return HOST_PLANS_BY_TYPE[hostType] ?? HOST_PLANS_BY_TYPE.individual;
}

export function getHostPlanDisplay(hostType: HostType): HostPlanDisplayInfo[] {
  return HOST_DISPLAY_BY_TYPE[hostType] ?? HOST_DISPLAY_BY_TYPE.individual;
}

export function getPlanOrder(planId: string): number {
  return PLAN_ORDER[planId] ?? 0;
}
