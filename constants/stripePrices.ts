export const STRIPE_PRICES: Record<string, string> = {
  'plus_monthly':  'price_plus_monthly',
  'plus_3month':   'price_plus_3month',
  'plus_annual':   'price_plus_annual',
  'elite_monthly': 'price_elite_monthly',
  'elite_3month':  'price_elite_3month',
  'elite_annual':  'price_elite_annual',
  'host_starter_monthly':  'price_host_starter_monthly',
  'host_pro_monthly':      'price_host_pro_monthly',
  'host_business_monthly': 'price_host_business_monthly',
  'host_starter_3month':   'price_host_starter_3month',
  'host_pro_3month':       'price_host_pro_3month',
  'host_business_3month':  'price_host_business_3month',
  'host_starter_annual':   'price_host_starter_annual',
  'host_pro_annual':       'price_host_pro_annual',
  'host_business_annual':  'price_host_business_annual',
};

export function getPriceId(plan: string, billingCycle: string): string | null {
  const key = `${plan}_${billingCycle}`;
  return STRIPE_PRICES[key] || null;
}
