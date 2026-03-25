import { Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PRODUCT_CATEGORY,
} from 'react-native-purchases';

const RC_TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY || '';
const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';

export const RC_ENTITLEMENTS = {
  PLUS: 'plus',
  ELITE: 'elite',
  HOST_STARTER: 'host_starter',
  HOST_PRO: 'host_pro',
  HOST_BUSINESS: 'host_business',
  HOST_AGENT_STARTER: 'host_agent_starter',
  HOST_AGENT_PRO: 'host_agent_pro',
  HOST_AGENT_BUSINESS: 'host_agent_business',
  HOST_COMPANY_STARTER: 'host_company_starter',
  HOST_COMPANY_PRO: 'host_company_pro',
} as const;

export const RC_OFFERING_KEYS = {
  RENTER: 'renter_plans',
  HOST: 'host_plans',
  AGENT: 'agent_plans',
  COMPANY: 'company_plans',
} as const;

const RC_PRODUCT_TO_PLAN: Record<string, { plan: string; billingCycle: 'monthly' | '3month' | 'annual'; planType: 'renter' | 'host' }> = {
  rhome_plus_monthly: { plan: 'plus', billingCycle: 'monthly', planType: 'renter' },
  rhome_plus_3month: { plan: 'plus', billingCycle: '3month', planType: 'renter' },
  rhome_plus_annual: { plan: 'plus', billingCycle: 'annual', planType: 'renter' },
  rhome_elite_monthly: { plan: 'elite', billingCycle: 'monthly', planType: 'renter' },
  rhome_elite_3month: { plan: 'elite', billingCycle: '3month', planType: 'renter' },
  rhome_elite_annual: { plan: 'elite', billingCycle: 'annual', planType: 'renter' },
  rhome_host_starter_monthly: { plan: 'starter', billingCycle: 'monthly', planType: 'host' },
  rhome_host_pro_monthly: { plan: 'pro', billingCycle: 'monthly', planType: 'host' },
  rhome_host_business_monthly: { plan: 'business', billingCycle: 'monthly', planType: 'host' },
  rhome_agent_starter_monthly: { plan: 'agent_starter', billingCycle: 'monthly', planType: 'host' },
  rhome_agent_pro_monthly: { plan: 'agent_pro', billingCycle: 'monthly', planType: 'host' },
  rhome_agent_business_monthly: { plan: 'agent_business', billingCycle: 'monthly', planType: 'host' },
  rhome_company_starter_monthly: { plan: 'company_starter', billingCycle: 'monthly', planType: 'host' },
  rhome_company_pro_monthly: { plan: 'company_pro', billingCycle: 'monthly', planType: 'host' },
};

function getApiKey(): string {
  if (__DEV__ || RC_TEST_KEY) return RC_TEST_KEY;
  if (Platform.OS === 'ios') return RC_IOS_KEY;
  if (Platform.OS === 'android') return RC_ANDROID_KEY;
  return RC_TEST_KEY;
}

let isConfigured = false;

export async function initRevenueCat(userId?: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] No API key found, skipping initialization');
    return;
  }
  try {
    if (!isConfigured) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey });
      isConfigured = true;
    }
    if (userId) {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn('[RevenueCat] Init error:', e);
  }
}

export async function identifyUser(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !isConfigured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[RevenueCat] Identify error:', e);
  }
}

export async function logoutRevenueCat(): Promise<void> {
  if (Platform.OS === 'web' || !isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('[RevenueCat] Logout error:', e);
  }
}

export async function getOfferings(): Promise<{ renter?: PurchasesOffering; host?: PurchasesOffering; agent?: PurchasesOffering; company?: PurchasesOffering }> {
  if (Platform.OS === 'web' || !isConfigured) return {};
  try {
    const offerings = await Purchases.getOfferings();
    return {
      renter: offerings.all[RC_OFFERING_KEYS.RENTER] || offerings.current || undefined,
      host: offerings.all[RC_OFFERING_KEYS.HOST] || undefined,
      agent: offerings.all[RC_OFFERING_KEYS.AGENT] || undefined,
      company: offerings.all[RC_OFFERING_KEYS.COMPANY] || undefined,
    };
  } catch (e) {
    console.warn('[RevenueCat] Get offerings error:', e);
    return {};
  }
}

export function findPackage(
  offering: PurchasesOffering | undefined,
  plan: string,
  billingCycle: 'monthly' | '3month' | 'annual'
): PurchasesPackage | undefined {
  if (!offering) return undefined;
  const productId = getProductIdentifier(plan, billingCycle);
  return offering.availablePackages.find(
    (pkg) => pkg.product.identifier === productId || pkg.identifier === productId
  );
}

function getProductIdentifier(plan: string, billingCycle: 'monthly' | '3month' | 'annual'): string {
  const hostPlans = ['starter', 'pro', 'business'];
  const agentPlans = ['agent_starter', 'agent_pro', 'agent_business'];
  const companyPlans = ['company_starter', 'company_pro'];
  if (agentPlans.includes(plan) || companyPlans.includes(plan)) {
    return `rhome_${plan}_${billingCycle}`;
  }
  if (hostPlans.includes(plan)) {
    return `rhome_host_${plan}_${billingCycle}`;
  }
  return `rhome_${plan}_${billingCycle}`;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  if (Platform.OS === 'web' || !isConfigured) {
    return { success: false, error: 'In-app purchases not available on web' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo };
  } catch (e: any) {
    if (e.userCancelled) {
      return { success: false };
    }
    return { success: false, error: e.message || 'Purchase failed' };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  if (Platform.OS === 'web' || !isConfigured) {
    return { success: false, error: 'Not available on web' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (e: any) {
    return { success: false, error: e.message || 'Restore failed' };
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web' || !isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[RevenueCat] Get customer info error:', e);
    return null;
  }
}

export function getActiveEntitlements(info: CustomerInfo): string[] {
  return Object.keys(info.entitlements.active);
}

export function hasEntitlement(info: CustomerInfo, entitlement: string): boolean {
  return !!info.entitlements.active[entitlement];
}

export function getActivePlanFromEntitlements(info: CustomerInfo): { plan: string; planType: 'renter' | 'host' } | null {
  if (hasEntitlement(info, RC_ENTITLEMENTS.ELITE)) return { plan: 'elite', planType: 'renter' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.PLUS)) return { plan: 'plus', planType: 'renter' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_AGENT_BUSINESS)) return { plan: 'agent_business', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_AGENT_PRO)) return { plan: 'agent_pro', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_AGENT_STARTER)) return { plan: 'agent_starter', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_COMPANY_PRO)) return { plan: 'company_pro', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_COMPANY_STARTER)) return { plan: 'company_starter', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_BUSINESS)) return { plan: 'business', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_PRO)) return { plan: 'pro', planType: 'host' };
  if (hasEntitlement(info, RC_ENTITLEMENTS.HOST_STARTER)) return { plan: 'starter', planType: 'host' };
  return null;
}

export function mapProductToPlan(productIdentifier: string): { plan: string; billingCycle: 'monthly' | '3month' | 'annual'; planType: 'renter' | 'host' } | null {
  const cleanId = productIdentifier.replace(/:.*$/, '');
  return RC_PRODUCT_TO_PLAN[cleanId] || null;
}
