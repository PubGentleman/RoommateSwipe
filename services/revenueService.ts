import { supabase } from '../lib/supabase';

export interface RevenueSummary {
  period: string;
  totalSpent: number;
  subscriptionCost: number;
  boostSpend: number;
  otherSpend: number;
  bookingRevenue: number;
  transactionCount: number;
  previousPeriodSpent: number;
  spendTrend: 'up' | 'down' | 'flat';
  spendTrendPercent: number;
  costPerInquiry: number | null;
  costPerBooking: number | null;
}

export interface SpendingBreakdown {
  categories: {
    label: string;
    amountCents: number;
    percentage: number;
    color: string;
  }[];
  monthlyTrend: {
    month: string;
    subscription: number;
    boosts: number;
    other: number;
  }[];
}

export interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export async function getRevenueSummary(
  hostId: string,
  days: number = 30
): Promise<RevenueSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const previousSince = new Date(since);
  previousSince.setDate(previousSince.getDate() - days);

  const { data: current } = await supabase
    .from('host_transactions')
    .select('*')
    .eq('host_id', hostId)
    .gte('created_at', since.toISOString());

  const { data: previous } = await supabase
    .from('host_transactions')
    .select('type, amount_cents')
    .eq('host_id', hostId)
    .gte('created_at', previousSince.toISOString())
    .lt('created_at', since.toISOString());

  const rows = current || [];
  const prevRows = previous || [];

  const subscriptionCost = rows
    .filter(t => t.type === 'subscription_payment')
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const boostSpend = rows
    .filter(t => t.type === 'boost_purchase')
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const otherSpend = rows
    .filter(t => !['subscription_payment', 'boost_purchase', 'booking_confirmed'].includes(t.type))
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const bookingRevenue = rows
    .filter(t => t.type === 'booking_confirmed')
    .reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);

  const totalSpent = subscriptionCost + boostSpend + otherSpend;
  const previousPeriodSpent = prevRows
    .filter(t => t.type !== 'booking_confirmed')
    .reduce((sum, t) => sum + t.amount_cents, 0);

  const trendPercent = previousPeriodSpent > 0
    ? Math.round(((totalSpent - previousPeriodSpent) / previousPeriodSpent) * 100)
    : totalSpent > 0 ? 100 : 0;

  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .eq('host_id', hostId);
  const listingIds = (listings || []).map(l => l.id);

  let costPerInquiry: number | null = null;
  let costPerBooking: number | null = null;

  if (listingIds.length > 0 && totalSpent > 0) {
    const { count: inquiryCount } = await supabase
      .from('interest_cards')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', listingIds)
      .gte('created_at', since.toISOString());

    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', listingIds)
      .gte('created_at', since.toISOString());

    if (inquiryCount && inquiryCount > 0) costPerInquiry = Math.round(totalSpent / inquiryCount);
    if (bookingCount && bookingCount > 0) costPerBooking = Math.round(totalSpent / bookingCount);
  }

  return {
    period: `${days}d`,
    totalSpent,
    subscriptionCost,
    boostSpend,
    otherSpend,
    bookingRevenue,
    transactionCount: rows.length,
    previousPeriodSpent,
    spendTrend: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'flat',
    spendTrendPercent: trendPercent,
    costPerInquiry,
    costPerBooking,
  };
}

export async function getSpendingBreakdown(
  hostId: string,
  months: number = 6
): Promise<SpendingBreakdown> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data: transactions } = await supabase
    .from('host_transactions')
    .select('*')
    .eq('host_id', hostId)
    .gte('created_at', since.toISOString())
    .neq('type', 'booking_confirmed')
    .order('created_at', { ascending: true });

  const rows = transactions || [];
  const totalCents = rows.reduce((s, t) => s + t.amount_cents, 0);

  const subTotal = rows.filter(t => t.type === 'subscription_payment').reduce((s, t) => s + t.amount_cents, 0);
  const boostTotal = rows.filter(t => t.type === 'boost_purchase').reduce((s, t) => s + t.amount_cents, 0);
  const otherTotal = rows.filter(t => !['subscription_payment', 'boost_purchase'].includes(t.type)).reduce((s, t) => s + t.amount_cents, 0);

  const pct = (n: number) => totalCents > 0 ? Math.round((n / totalCents) * 100) : 0;

  const categories = [
    { label: 'Subscription', amountCents: subTotal, percentage: pct(subTotal), color: '#6C5CE7' },
    { label: 'Boosts', amountCents: boostTotal, percentage: pct(boostTotal), color: '#3ECF8E' },
    { label: 'Other', amountCents: otherTotal, percentage: pct(otherTotal), color: '#f59e0b' },
  ].filter(c => c.amountCents > 0);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap: Record<string, { subscription: number; boosts: number; other: number }> = {};

  rows.forEach(t => {
    const d = new Date(t.created_at);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    if (!monthlyMap[key]) monthlyMap[key] = { subscription: 0, boosts: 0, other: 0 };
    if (t.type === 'subscription_payment') monthlyMap[key].subscription += t.amount_cents;
    else if (t.type === 'boost_purchase') monthlyMap[key].boosts += t.amount_cents;
    else monthlyMap[key].other += t.amount_cents;
  });

  const monthlyTrend = Object.entries(monthlyMap).map(([month, data]) => ({
    month, ...data,
  }));

  return { categories, monthlyTrend };
}

export async function getRecentTransactions(
  hostId: string,
  limit: number = 20
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('host_transactions')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(t => ({
    id: t.id,
    type: t.type,
    amountCents: t.amount_cents,
    description: t.description,
    metadata: t.metadata,
    createdAt: t.created_at,
  }));
}

export function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}
