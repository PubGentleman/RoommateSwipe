import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  initRevenueCat,
  identifyUser,
  logoutRevenueCat,
  getOfferings,
  getCustomerInfo,
  restorePurchases as rcRestore,
  purchasePackage as rcPurchase,
  findPackage,
  getActivePlanFromEntitlements,
  getActiveEntitlements,
  RC_ENTITLEMENTS,
} from '../lib/revenueCat';
import type { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';

interface RevenueCatContextType {
  isReady: boolean;
  customerInfo: CustomerInfo | null;
  renterOffering: PurchasesOffering | null;
  hostOffering: PurchasesOffering | null;
  agentOffering: PurchasesOffering | null;
  companyOffering: PurchasesOffering | null;
  purchase: (plan: string, billingCycle: 'monthly' | '3month' | 'annual', planType: 'renter' | 'host' | 'agent' | 'company') => Promise<{ success: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; error?: string }>;
  refreshCustomerInfo: () => Promise<void>;
  identifyRevenueCatUser: (userId: string) => Promise<void>;
  logoutRevenueCatUser: () => Promise<void>;
  getActiveRenterPlan: () => 'free' | 'plus' | 'elite';
  getActiveHostPlan: () => string;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export const RevenueCatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(Platform.OS === 'web');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [renterOffering, setRenterOffering] = useState<PurchasesOffering | null>(null);
  const [hostOffering, setHostOffering] = useState<PurchasesOffering | null>(null);
  const [agentOffering, setAgentOffering] = useState<PurchasesOffering | null>(null);
  const [companyOffering, setCompanyOffering] = useState<PurchasesOffering | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      await initRevenueCat();
      await loadOfferings();
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const info = await getCustomerInfo();
        if (info) setCustomerInfo(info);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const loadOfferings = async () => {
    const offerings = await getOfferings();
    if (offerings.renter) setRenterOffering(offerings.renter);
    if (offerings.host) setHostOffering(offerings.host);
    if (offerings.agent) setAgentOffering(offerings.agent);
    if (offerings.company) setCompanyOffering(offerings.company);
  };

  const identifyRevenueCatUser = useCallback(async (userId: string) => {
    if (Platform.OS === 'web') return;
    await identifyUser(userId);
    const info = await getCustomerInfo();
    if (info) setCustomerInfo(info);
  }, []);

  const logoutRevenueCatUser = useCallback(async () => {
    if (Platform.OS === 'web') return;
    await logoutRevenueCat();
    setCustomerInfo(null);
  }, []);

  const purchase = useCallback(async (
    plan: string,
    billingCycle: 'monthly' | '3month' | 'annual',
    planType: 'renter' | 'host' | 'agent' | 'company'
  ): Promise<{ success: boolean; error?: string }> => {
    if (Platform.OS === 'web') {
      return { success: false, error: 'In-app purchases not available on web' };
    }
    const offeringMap: Record<string, PurchasesOffering | null> = {
      renter: renterOffering,
      host: hostOffering,
      agent: agentOffering,
      company: companyOffering,
    };
    const offering = offeringMap[planType] || null;
    if (!offering) {
      return { success: false, error: 'Subscription plans are loading. Please close this screen and try again in a moment.' };
    }
    const pkg = findPackage(offering, plan, billingCycle);
    if (!pkg) {
      return { success: false, error: `The ${plan} plan (${billingCycle}) is not currently available. Please try again later.` };
    }
    try {
      const purchasePromise = rcPurchase(pkg);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Purchase timed out. Please try again.')), 60000)
      );
      const result = await Promise.race([purchasePromise, timeoutPromise]);
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
      }
      return { success: result.success, error: result.error };
    } catch (err: any) {
      return { success: false, error: err.message || 'Purchase failed. Please try again.' };
    }
  }, [renterOffering, hostOffering, agentOffering, companyOffering]);

  const restore = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (Platform.OS === 'web') {
      return { success: false, error: 'Not available on web' };
    }
    const result = await rcRestore();
    if (result.success && result.customerInfo) {
      setCustomerInfo(result.customerInfo);
    }
    return { success: result.success, error: result.error };
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const info = await getCustomerInfo();
    if (info) setCustomerInfo(info);
  }, []);

  const getActiveRenterPlan = useCallback((): 'free' | 'plus' | 'elite' => {
    if (!customerInfo) return 'free';
    const active = getActivePlanFromEntitlements(customerInfo);
    if (active && active.planType === 'renter') {
      return active.plan as 'plus' | 'elite';
    }
    return 'free';
  }, [customerInfo]);

  const getActiveHostPlan = useCallback((): string => {
    if (!customerInfo) return 'free';
    const active = getActivePlanFromEntitlements(customerInfo);
    if (active && active.planType === 'host') {
      return active.plan;
    }
    return 'free';
  }, [customerInfo]);

  return (
    <RevenueCatContext.Provider value={{
      isReady,
      customerInfo,
      renterOffering,
      hostOffering,
      agentOffering,
      companyOffering,
      purchase,
      restore,
      refreshCustomerInfo,
      identifyRevenueCatUser,
      logoutRevenueCatUser,
      getActiveRenterPlan,
      getActiveHostPlan,
    }}>
      {children}
    </RevenueCatContext.Provider>
  );
};

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (!context) throw new Error('useRevenueCat must be used within RevenueCatProvider');
  return context;
}
