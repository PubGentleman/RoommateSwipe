import { supabase } from '../lib/supabase';
import { calculateListingMatchScore, ListingMatchInput } from '../utils/listingMatchScore';
import { Property } from '../types/models';
import { createErrorHandler } from '../utils/errorLogger';

export interface RecommendedListing {
  listing: Property;
  score: number;
  reasons: RecommendationReason[];
  source: 'behavioral' | 'collaborative' | 'content' | 'trending';
}

export interface RecommendationReason {
  type: string;
  text: string;
  icon?: string;
}

export async function trackListingInteraction(
  userId: string,
  listingId: string,
  interactionType: string,
  context?: {
    source?: string;
    viewDurationSeconds?: number;
    listingSnapshot?: Record<string, any>;
  }
): Promise<void> {
  const { error } = await supabase.from('listing_interactions').insert({
    user_id: userId,
    listing_id: listingId,
    interaction_type: interactionType,
    source: context?.source,
    view_duration_seconds: context?.viewDurationSeconds,
    listing_snapshot: context?.listingSnapshot,
  });
  if (error) console.error('Failed to track interaction:', error);
}

interface UserBehaviorProfile {
  priceRange: { min: number; max: number; sweet_spot: number };
  preferred_neighborhoods: string[];
  preferredAmenities: string[];
  preferredListingTypes: string[];
  preferredBedrooms: number | null;
  avgViewDuration: number;
  interactionCount: number;
}

async function analyzeUserBehavior(userId: string): Promise<UserBehaviorProfile | null> {
  const { data: interactions, error } = await supabase
    .from('listing_interactions')
    .select('interaction_type, listing_snapshot, view_duration_seconds')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .in('interaction_type', ['view_long', 'save', 'inquiry', 'share', 'apply'])
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !interactions || interactions.length < 5) return null;

  const weights: Record<string, number> = {
    apply: 5, inquiry: 4, save: 3, share: 2, view_long: 1,
  };

  const prices: number[] = [];
  const neighborhoods: Record<string, number> = {};
  const amenities: Record<string, number> = {};
  const listingTypes: Record<string, number> = {};
  const bedrooms: Record<number, number> = {};
  let totalDuration = 0;
  let durationCount = 0;

  for (const interaction of interactions) {
    const w = weights[interaction.interaction_type] || 1;
    const snap = interaction.listing_snapshot as any;
    if (!snap) continue;

    if (snap.price) prices.push(snap.price);
    if (snap.neighborhood) {
      neighborhoods[snap.neighborhood] = (neighborhoods[snap.neighborhood] || 0) + w;
    }
    if (snap.amenities) {
      for (const a of snap.amenities) {
        amenities[a] = (amenities[a] || 0) + w;
      }
    }
    if (snap.listing_type) {
      listingTypes[snap.listing_type] = (listingTypes[snap.listing_type] || 0) + w;
    }
    if (snap.bedrooms) {
      bedrooms[snap.bedrooms] = (bedrooms[snap.bedrooms] || 0) + w;
    }
    if (interaction.view_duration_seconds) {
      totalDuration += interaction.view_duration_seconds;
      durationCount++;
    }
  }

  prices.sort((a, b) => a - b);

  const topNeighborhoods = Object.entries(neighborhoods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const topAmenities = Object.entries(amenities).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  const topListingTypes = Object.entries(listingTypes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const topBedroom = Object.entries(bedrooms).sort((a, b) => b[1] - a[1])[0];

  return {
    priceRange: {
      min: prices.length > 0 ? prices[Math.floor(prices.length * 0.1)] : 0,
      max: prices.length > 0 ? prices[Math.floor(prices.length * 0.9)] : 0,
      sweet_spot: prices.length > 0 ? prices[Math.floor(prices.length * 0.5)] : 0,
    },
    preferred_neighborhoods: topNeighborhoods,
    preferredAmenities: topAmenities,
    preferredListingTypes: topListingTypes,
    preferredBedrooms: topBedroom ? parseInt(topBedroom[0]) : null,
    avgViewDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    interactionCount: interactions.length,
  };
}

export async function getForYouListings(
  userId: string,
  user: any,
  limit: number = 20
): Promise<RecommendedListing[]> {
  const fetchLimit = Math.max(limit, 50);

  const { data: cached } = await supabase
    .from('user_recommendations')
    .select('listing_id, score, reasons, source')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('score', { ascending: false })
    .limit(fetchLimit);

  if (cached && cached.length > 0) {
    const listingIds = cached.map(c => c.listing_id);
    const { data: listings } = await supabase
      .from('listings')
      .select('*')
      .in('id', listingIds)
      .eq('status', 'active');

    if (listings && listings.length > 0) {
      const results = cached
        .map(c => {
          const listing = listings.find((l: any) => l.id === c.listing_id);
          if (!listing) return null;
          return {
            listing: listing as Property,
            score: c.score,
            reasons: c.reasons as RecommendationReason[],
            source: c.source as any,
          };
        })
        .filter(Boolean) as RecommendedListing[];
      if (results.length >= limit) return results;
    }
  }

  const behaviorProfile = await analyzeUserBehavior(userId);

  const { data: seenIds } = await supabase
    .from('listing_interactions')
    .select('listing_id')
    .eq('user_id', userId)
    .in('interaction_type', ['hide', 'report'])
    .limit(500);

  const excludeIds = new Set((seenIds || []).map((s: any) => s.listing_id));

  const { data: listings, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !listings) return [];

  const scored: RecommendedListing[] = [];

  for (const listing of listings) {
    if (excludeIds.has(listing.id)) continue;

    const reasons: RecommendationReason[] = [];
    let behaviorBonus = 0;

    const baseScore = calculateListingMatchScore(user, {
      price: listing.rent ?? listing.price,
      bedrooms: listing.bedrooms,
      neighborhood: listing.neighborhood,
      city: listing.city,
      amenities: listing.amenities || [],
      roomType: listing.room_type,
      availableFrom: listing.available_from,
      averageRating: listing.average_rating,
      reviewCount: listing.review_count,
      hostBadge: listing.host_badge,
      hostResponseRate: listing.host_response_rate,
      daysListed: listing.days_listed,
      photoCount: listing.photos?.length || 0,
    });

    if (behaviorProfile) {
      const price = listing.rent ?? listing.price ?? 0;
      if (price >= behaviorProfile.priceRange.min && price <= behaviorProfile.priceRange.max) {
        behaviorBonus += 10;
        const distFromSweet = Math.abs(price - behaviorProfile.priceRange.sweet_spot);
        if (distFromSweet < 200) {
          behaviorBonus += 5;
          reasons.push({ type: 'price_sweet_spot', text: 'In your price sweet spot', icon: 'dollar-sign' });
        }
      }

      if (listing.neighborhood && behaviorProfile.preferred_neighborhoods.includes(listing.neighborhood)) {
        behaviorBonus += 8;
        reasons.push({ type: 'preferred_area', text: `You browse ${listing.neighborhood} often`, icon: 'map-pin' });
      }

      const amenityOverlap = (listing.amenities || []).filter((a: string) => behaviorProfile.preferredAmenities.includes(a));
      if (amenityOverlap.length >= 3) {
        behaviorBonus += 5;
        reasons.push({ type: 'amenity_match', text: `Has ${amenityOverlap.length} amenities you look for`, icon: 'check-circle' });
      }

      if (listing.listing_type && behaviorProfile.preferredListingTypes.includes(listing.listing_type)) {
        behaviorBonus += 3;
      }
    }

    const daysOld = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 2) {
      behaviorBonus += 8;
      reasons.push({ type: 'new_listing', text: 'Just posted', icon: 'clock' });
    }

    if (listing.average_rating >= 4.5 && listing.review_count >= 3) {
      reasons.push({ type: 'top_rated', text: 'Top-rated host', icon: 'star' });
    }

    if (listing.host_verified) {
      reasons.push({ type: 'verified', text: 'Verified host', icon: 'shield' });
    }

    const behaviorNormalized = Math.min(100, behaviorBonus * 2.5);
    const finalScore = Math.min(100, Math.round(baseScore * 0.6 + behaviorNormalized * 0.4));

    scored.push({
      listing: listing as Property,
      score: finalScore,
      reasons: reasons.slice(0, 3),
      source: behaviorProfile ? 'behavioral' : 'content',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, fetchLimit);

  if (topResults.length > 0) {
    const cacheRows = topResults.map(r => ({
      user_id: userId,
      listing_id: r.listing.id,
      score: r.score,
      reasons: r.reasons,
      source: r.source,
    }));

    await supabase.from('user_recommendations').delete().eq('user_id', userId);
    await supabase.from('user_recommendations').insert(cacheRows).catch(createErrorHandler('recommendationService', 'cacheRecommendations'));
  }

  return topResults;
}

export function getForYouLimit(plan: string): number {
  switch (plan) {
    case 'free': return 5;
    case 'plus': return 20;
    case 'elite': return 50;
    default: return 5;
  }
}
