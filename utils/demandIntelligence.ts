import { supabase } from '../lib/supabase';

export interface AreaDemandContext {
  city: string;
  neighborhood?: string;
  competitionLevel: string;
  demandSupplyRatio: number;
  totalSearches: number;
  activeListings: number;
  medianBudget: number | null;
  medianListingPrice: number | null;
  priceGap: number | null;
  topAmenities: string[];
  amenityDemand: Record<string, number>;
  bedroomDemand: Record<string, number>;
  searchTrend: number | null;
  summary: string;
}

export async function getAreaDemand(city: string, neighborhood?: string): Promise<AreaDemandContext | null> {
  let query = supabase
    .from('neighborhood_demand')
    .select('*')
    .eq('city', city)
    .eq('period_type', 'daily')
    .order('period_start', { ascending: false })
    .limit(7);

  if (neighborhood) {
    query = query.eq('neighborhood', neighborhood);
  } else {
    query = query.is('neighborhood', null);
  }

  const { data } = await query;
  if (!data || data.length === 0) return null;

  const totalSearches = data.reduce((sum: number, d: any) => sum + (d.total_searches || 0), 0);
  const latest = data[0];

  let summary = '';

  if (latest.competition_level === 'very_high' || latest.competition_level === 'high') {
    summary += `${neighborhood || city} is a high-demand area right now. `;
    summary += `There have been ${totalSearches} searches in the past week with only ${latest.active_listings_count} active listings — competition is ${(latest.competition_level || '').replace('_', ' ')}. `;
  } else if (latest.competition_level === 'low' || latest.competition_level === 'very_low') {
    summary += `${neighborhood || city} has relatively low competition right now. `;
    summary += `${latest.active_listings_count} active listings with only ${totalSearches} searches this week — good odds for renters. `;
  } else {
    summary += `${neighborhood || city} has moderate demand — ${totalSearches} searches this week across ${latest.active_listings_count} listings. `;
  }

  if (latest.median_budget && latest.median_listing_price) {
    const gap = latest.median_budget - latest.median_listing_price;
    if (gap < -200) {
      summary += `Most renters here are budgeting around $${Number(latest.median_budget).toLocaleString()}, but the median listing price is $${Number(latest.median_listing_price).toLocaleString()} — many listings are above what people want to pay. `;
    } else if (gap > 200) {
      summary += `Renters here typically budget $${Number(latest.median_budget).toLocaleString()}, and the median listing is $${Number(latest.median_listing_price).toLocaleString()} — there are options within most budgets. `;
    }
  }

  if (latest.top_amenities && latest.top_amenities.length > 0) {
    const top3 = latest.top_amenities.slice(0, 3).join(', ');
    summary += `Most-wanted features: ${top3}. `;
  }

  return {
    city,
    neighborhood: neighborhood || undefined,
    competitionLevel: latest.competition_level || 'unknown',
    demandSupplyRatio: latest.demand_supply_ratio || 0,
    totalSearches,
    activeListings: latest.active_listings_count || 0,
    medianBudget: latest.median_budget,
    medianListingPrice: latest.median_listing_price,
    priceGap: latest.price_gap,
    topAmenities: latest.top_amenities || [],
    amenityDemand: latest.amenity_demand || {},
    bedroomDemand: latest.bedroom_distribution || {},
    searchTrend: latest.search_trend,
    summary,
  };
}

export async function getLowerCompetitionAreas(city: string, maxResults: number = 3): Promise<{
  neighborhood: string;
  competitionLevel: string;
  activeListings: number;
  medianPrice: number | null;
}[]> {
  const { data } = await supabase
    .from('neighborhood_demand')
    .select('neighborhood, competition_level, active_listings_count, median_listing_price')
    .eq('city', city)
    .eq('period_type', 'daily')
    .not('neighborhood', 'is', null)
    .in('competition_level', ['low', 'very_low', 'moderate'])
    .order('demand_supply_ratio', { ascending: true })
    .limit(maxResults);

  return (data || []).map((d: any) => ({
    neighborhood: d.neighborhood,
    competitionLevel: d.competition_level,
    activeListings: d.active_listings_count,
    medianPrice: d.median_listing_price,
  }));
}

export async function getCompetitionScores(listingIds: string[]): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {};

  const { data } = await supabase
    .from('listing_demand')
    .select('listing_id, views, saves, interests')
    .in('listing_id', listingIds)
    .eq('period_type', 'daily')
    .order('period_start', { ascending: false });

  const scores: Record<string, number> = {};
  const grouped: Record<string, { views: number; saves: number }> = {};

  (data || []).forEach((d: any) => {
    if (!grouped[d.listing_id]) grouped[d.listing_id] = { views: 0, saves: 0 };
    grouped[d.listing_id].views += d.views || 0;
    grouped[d.listing_id].saves += d.saves || 0;
  });

  Object.entries(grouped).forEach(([listingId, stats]) => {
    const competitionScore = Math.max(0, 100 - Math.min(stats.views, 100));
    scores[listingId] = competitionScore;
  });

  listingIds.forEach(id => {
    if (!scores[id]) scores[id] = 50;
  });

  return scores;
}

export async function getHostDemandContext(listingId: string, city: string, neighborhood?: string): Promise<string> {
  const { data: listingDemand } = await supabase
    .from('listing_demand')
    .select('*')
    .eq('listing_id', listingId)
    .eq('period_type', 'daily')
    .order('period_start', { ascending: false })
    .limit(7);

  const areaDemand = await getAreaDemand(city, neighborhood);

  let context = '';

  if (listingDemand && listingDemand.length > 0) {
    const totalViews = listingDemand.reduce((sum: number, d: any) => sum + (d.views || 0), 0);
    const totalSaves = listingDemand.reduce((sum: number, d: any) => sum + (d.saves || 0), 0);
    const totalInterests = listingDemand.reduce((sum: number, d: any) => sum + (d.interests || 0), 0);
    const latest = listingDemand[0];

    context += `\nYOUR LISTING PERFORMANCE (last 7 days):\n`;
    context += `- Views: ${totalViews}\n`;
    context += `- Saves: ${totalSaves} (${totalViews > 0 ? Math.round((totalSaves / totalViews) * 100) : 0}% save rate)\n`;
    context += `- Interests received: ${totalInterests}\n`;
    if (latest.view_percentile) {
      context += `- Compared to area: Top ${100 - latest.view_percentile}% in views\n`;
    }
  }

  if (areaDemand) {
    context += `\nWHAT RENTERS IN YOUR AREA WANT:\n`;
    context += areaDemand.summary + '\n';
    context += `\nTop demanded features (% of searchers who want this):\n`;
    areaDemand.topAmenities.slice(0, 5).forEach(a => {
      context += `- ${a}: ${areaDemand.amenityDemand[a] || '?'}% of renters\n`;
    });
    const topBedroom = Object.entries(areaDemand.bedroomDemand)
      .sort(([, a], [, b]) => Number(b) - Number(a))[0];
    if (topBedroom) {
      context += `\nMost searched bedroom count: ${topBedroom[0]}\n`;
    }
    if (areaDemand.medianBudget) {
      context += `Renter median budget: $${areaDemand.medianBudget}\n`;
    }
    context += `\nUse this to advise the host on how to improve their listing — what to highlight, what to add, and whether their price is competitive.\n`;
  }

  return context;
}
