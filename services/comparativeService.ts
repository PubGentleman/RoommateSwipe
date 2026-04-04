import { supabase } from '../lib/supabase';

export interface MarketPosition {
  listingId: string;
  listingTitle: string;
  neighborhood: string;
  yourPrice: number;
  areaMedianPrice: number;
  areaPriceRange: { min: number; max: number };
  pricePercentile: number;
  priceVerdict: 'below_market' | 'at_market' | 'above_market';
  yourViewsPerDay: number;
  areaAvgViewsPerDay: number;
  engagementPercentile: number;
  yourResponseHours: number | null;
  areaAvgResponseHours: number;
  responsePercentile: number;
  yourInquiryRate: number;
  areaAvgInquiryRate: number;
  inquiryRatePercentile: number;
  overallScore: number;
  overallRank: string;
}

export interface AreaSnapshot {
  neighborhood: string;
  totalActiveListings: number;
  medianPrice: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  avgViewsPerDay: number;
  avgResponseHours: number;
  avgInquiryRate: number;
  topAmenities: string[];
  avgPhotosCount: number;
}

export interface ImprovementTip {
  category: 'price' | 'photos' | 'response' | 'description' | 'amenities' | 'boost';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: string;
}

export async function getMarketPosition(
  listingId: string,
  hostId: string
): Promise<MarketPosition | null> {
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (!listing) return null;

  const neighborhood = listing.neighborhood || listing.city || 'Unknown';

  const { data: comps } = await supabase
    .from('listings')
    .select('id, rent, neighborhood, city')
    .eq('is_active', true)
    .eq('is_rented', false)
    .or(`neighborhood.eq.${neighborhood},city.eq.${listing.city}`)
    .neq('id', listingId);

  const compListings = comps || [];
  if (compListings.length === 0) return null;

  const prices = compListings.map(c => c.rent).filter(Boolean).sort((a, b) => a - b);
  if (prices.length === 0) return null;

  const medianPrice = prices[Math.floor(prices.length / 2)];
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];

  const belowCount = prices.filter(p => p < listing.rent).length;
  const pricePercentile = Math.round((belowCount / prices.length) * 100);

  let priceVerdict: 'below_market' | 'at_market' | 'above_market' = 'at_market';
  if (listing.rent < medianPrice * 0.9) priceVerdict = 'below_market';
  else if (listing.rent > medianPrice * 1.1) priceVerdict = 'above_market';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceISO = thirtyDaysAgo.toISOString();

  const allIds = [listingId, ...compListings.map(c => c.id)];

  const { data: viewEvents } = await supabase
    .from('listing_events')
    .select('listing_id, event_type')
    .in('listing_id', allIds)
    .eq('event_type', 'view')
    .gte('created_at', sinceISO);

  const viewCounts: Record<string, number> = {};
  (viewEvents || []).forEach(e => {
    viewCounts[e.listing_id] = (viewCounts[e.listing_id] || 0) + 1;
  });

  const yourViews = viewCounts[listingId] || 0;
  const yourViewsPerDay = yourViews / 30;
  const compViews = compListings.map(c => (viewCounts[c.id] || 0) / 30);
  const areaAvgViewsPerDay = compViews.length > 0
    ? compViews.reduce((s, v) => s + v, 0) / compViews.length : 0;
  const belowViewCount = compViews.filter(v => v < yourViewsPerDay).length;
  const engagementPercentile = compViews.length > 0
    ? Math.round((belowViewCount / compViews.length) * 100) : 50;

  const { data: myCards } = await supabase
    .from('interest_cards')
    .select('created_at, responded_at')
    .eq('listing_id', listingId)
    .not('responded_at', 'is', null)
    .gte('created_at', sinceISO);

  let yourResponseHours: number | null = null;
  if (myCards && myCards.length > 0) {
    const totalMs = myCards.reduce((sum, c) =>
      sum + (new Date(c.responded_at).getTime() - new Date(c.created_at).getTime()), 0);
    yourResponseHours = Math.round((totalMs / myCards.length / 3600000) * 10) / 10;
  }

  const compIds = compListings.map(c => c.id);
  const { data: areaCards } = await supabase
    .from('interest_cards')
    .select('created_at, responded_at')
    .in('listing_id', compIds)
    .not('responded_at', 'is', null)
    .gte('created_at', sinceISO);

  let areaAvgResponseHours = 4;
  if (areaCards && areaCards.length > 0) {
    const totalMs = areaCards.reduce((sum, c) =>
      sum + (new Date(c.responded_at).getTime() - new Date(c.created_at).getTime()), 0);
    areaAvgResponseHours = Math.round((totalMs / areaCards.length / 3600000) * 10) / 10;
  }
  const responsePercentile = yourResponseHours !== null && areaAvgResponseHours > 0
    ? Math.min(100, Math.round(((areaAvgResponseHours - yourResponseHours) / areaAvgResponseHours + 0.5) * 100))
    : 50;

  const { count: myInqCount } = await supabase
    .from('interest_cards')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .gte('created_at', sinceISO);

  const yourInquiryRate = yourViews > 0
    ? Math.round(((myInqCount || 0) / yourViews) * 1000) / 10 : 0;

  const { data: areaInquiries } = await supabase
    .from('interest_cards')
    .select('listing_id')
    .in('listing_id', compIds)
    .gte('created_at', sinceISO);

  const areaInqTotal = (areaInquiries || []).length;
  const areaViewsTotal = compViews.reduce((s, v) => s + v * 30, 0);
  const areaAvgInquiryRate = areaViewsTotal > 0
    ? Math.round((areaInqTotal / areaViewsTotal) * 1000) / 10 : 0;

  const inquiryRatePercentile = areaAvgInquiryRate > 0 && yourInquiryRate > 0
    ? Math.min(100, Math.round((yourInquiryRate / areaAvgInquiryRate) * 50)) : 50;

  const overallScore = Math.round(
    engagementPercentile * 0.3 +
    responsePercentile * 0.25 +
    inquiryRatePercentile * 0.25 +
    (100 - pricePercentile) * 0.2
  );

  let overallRank = 'Average';
  if (overallScore >= 90) overallRank = 'Top 10%';
  else if (overallScore >= 75) overallRank = 'Top 25%';
  else if (overallScore >= 50) overallRank = 'Top 50%';
  else overallRank = 'Below Average';

  return {
    listingId,
    listingTitle: listing.title,
    neighborhood,
    yourPrice: listing.rent,
    areaMedianPrice: medianPrice,
    areaPriceRange: { min: minPrice, max: maxPrice },
    pricePercentile,
    priceVerdict,
    yourViewsPerDay,
    areaAvgViewsPerDay,
    engagementPercentile,
    yourResponseHours,
    areaAvgResponseHours,
    responsePercentile,
    yourInquiryRate,
    areaAvgInquiryRate,
    inquiryRatePercentile,
    overallScore,
    overallRank,
  };
}

export async function getAreaSnapshot(
  neighborhood: string,
  city: string
): Promise<AreaSnapshot> {
  const { data: listings } = await supabase
    .from('listings')
    .select('rent, amenities, photos, neighborhood')
    .eq('is_active', true)
    .eq('is_rented', false)
    .or(`neighborhood.eq.${neighborhood},city.eq.${city}`);

  const all = listings || [];
  const prices = all.map(l => l.rent).filter(Boolean).sort((a, b) => a - b);

  const amenityCount: Record<string, number> = {};
  all.forEach(l => {
    (l.amenities || []).forEach((a: string) => {
      amenityCount[a] = (amenityCount[a] || 0) + 1;
    });
  });
  const topAmenities = Object.entries(amenityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([a]) => a);

  const avgPhotos = all.length > 0
    ? Math.round(all.reduce((s, l) => s + (l.photos?.length || 0), 0) / all.length) : 0;

  return {
    neighborhood,
    totalActiveListings: all.length,
    medianPrice: prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0,
    avgPrice: prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0,
    priceRange: { min: prices[0] || 0, max: prices[prices.length - 1] || 0 },
    avgViewsPerDay: 0,
    avgResponseHours: 0,
    avgInquiryRate: 0,
    topAmenities,
    avgPhotosCount: avgPhotos,
  };
}

export function getImprovementTips(position: MarketPosition): ImprovementTip[] {
  const tips: ImprovementTip[] = [];

  if (position.priceVerdict === 'above_market') {
    tips.push({
      category: 'price',
      title: 'Consider adjusting your price',
      description: `Your listing is priced at $${position.yourPrice.toLocaleString()}/mo, above the area median of $${position.areaMedianPrice.toLocaleString()}/mo. Lowering your price could attract more inquiries.`,
      impact: 'high',
      icon: 'tag',
    });
  }

  if (position.yourResponseHours !== null && position.yourResponseHours > 4) {
    tips.push({
      category: 'response',
      title: 'Speed up your response time',
      description: `Your average response time is ${position.yourResponseHours}h. Area average is ${position.areaAvgResponseHours}h. Faster responses lead to more bookings.`,
      impact: 'high',
      icon: 'clock',
    });
  }

  if (position.engagementPercentile < 30) {
    tips.push({
      category: 'photos',
      title: 'Improve your listing photos',
      description: 'Your listing gets fewer views than most in the area. Better photos and a compelling title can dramatically increase visibility.',
      impact: 'medium',
      icon: 'camera',
    });
  }

  if (position.inquiryRatePercentile < 30) {
    tips.push({
      category: 'description',
      title: 'Enhance your listing description',
      description: 'People view your listing but don\'t inquire as often as the area average. Add more details about the space and neighborhood.',
      impact: 'medium',
      icon: 'edit-3',
    });
  }

  if (position.engagementPercentile < 50) {
    tips.push({
      category: 'boost',
      title: 'Try boosting your listing',
      description: 'A boost can increase your visibility by 40-60% and help you compete with higher-ranked listings.',
      impact: 'medium',
      icon: 'zap',
    });
  }

  if (tips.length === 0) {
    tips.push({
      category: 'amenities',
      title: 'You\'re doing great!',
      description: 'Your listing is performing well compared to the area. Keep maintaining fast response times and updated photos.',
      impact: 'low',
      icon: 'award',
    });
  }

  return tips;
}
