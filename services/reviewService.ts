import { supabase } from '../lib/supabase';

export interface PropertyReview {
  id: string;
  listing_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  tags: string[];
  host_reply: string | null;
  host_replied_at: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  reviewer_photo?: string;
}

export interface HostReview {
  id: string;
  host_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  tags: string[];
  host_reply: string | null;
  host_replied_at: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  reviewer_photo?: string;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  starBreakdown: Record<number, number>;
}

export interface RenterReview {
  id: string;
  renter_id: string;
  reviewer_id: string;
  booking_id: string | null;
  match_id: string | null;
  rating: number;
  review_text: string | null;
  tags: string[];
  status: string;
  renter_reply: string | null;
  renter_replied_at: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  reviewer_photo?: string;
}

const REVIEW_TAGS = [
  'Clean',
  'Responsive host',
  'Great location',
  'Noisy',
  'Maintenance issues',
  'Good value',
  'Pet friendly',
  'Quiet building',
] as const;

const HOST_REVIEW_TAGS = [
  'Responsive',
  'Professional',
  'Transparent',
  'Helpful',
  'Trustworthy',
  'Knowledgeable',
  'Slow to respond',
  'Disorganized',
  'Flexible',
  'Great communicator',
] as const;

const RENTER_REVIEW_TAGS = [
  'Respectful', 'Clean', 'Communicative', 'Punctual', 'Honest',
  'Reliable', 'Friendly', 'Quiet',
  'Messy', 'Unresponsive', 'Late payments', 'Noisy', 'Difficult',
] as const;

export type ReviewTag = typeof REVIEW_TAGS[number];
export type HostReviewTag = typeof HOST_REVIEW_TAGS[number];
export type RenterReviewTag = typeof RENTER_REVIEW_TAGS[number];
export { REVIEW_TAGS, HOST_REVIEW_TAGS, RENTER_REVIEW_TAGS };

export async function getReviewsForListing(listingId: string): Promise<PropertyReview[]> {
  try {
    const { data, error } = await supabase
      .from('property_reviews')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getReviewSummary(listingId: string): Promise<ReviewSummary> {
  const reviews = await getReviewsForListing(listingId);
  const starBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;

  for (const review of reviews) {
    starBreakdown[review.rating] = (starBreakdown[review.rating] || 0) + 1;
    total += review.rating;
  }

  return {
    averageRating: reviews.length > 0 ? total / reviews.length : null,
    reviewCount: reviews.length,
    starBreakdown,
  };
}

export async function submitReview(params: {
  listingId: string;
  reviewerId: string;
  rating: number;
  reviewText?: string;
  tags?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const eligibility = await checkReviewEligibility(params.reviewerId, params.listingId);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: 'You can only review a listing after a confirmed stay or showing.',
      };
    }

    const { error } = await supabase.from('property_reviews').insert({
      listing_id: params.listingId,
      reviewer_id: params.reviewerId,
      rating: params.rating,
      review_text: params.reviewText || null,
      tags: params.tags || [],
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reviewed this listing.' };
      }
      throw error;
    }

    await recalculateRating(params.listingId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit review' };
  }
}

export async function checkReviewEligibility(
  userId: string,
  listingId: string
): Promise<{ eligible: boolean; reason: 'booking' | 'showing' | 'none' }> {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('renter_id', userId)
      .eq('listing_id', listingId)
      .eq('status', 'confirmed')
      .limit(1)
      .maybeSingle();

    if (booking) {
      return { eligible: true, reason: 'booking' };
    }

    const { data: matchIds } = await supabase
      .from('matches')
      .select('id')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (matchIds && matchIds.length > 0) {
      const ids = matchIds.map((m: any) => m.id);
      const { data: visitMessages } = await supabase
        .from('messages')
        .select('id, metadata')
        .in('match_id', ids)
        .eq('message_type', 'visit_request');

      const hasConfirmedVisit = (visitMessages || []).some(
        (msg: any) =>
          msg.metadata?.status === 'confirmed' &&
          msg.metadata?.listing_id === listingId
      );

      if (hasConfirmedVisit) {
        return { eligible: true, reason: 'showing' };
      }
    }

    return { eligible: false, reason: 'none' };
  } catch (e) {
    console.warn('[ReviewService] checkReviewEligibility error:', e);
    return { eligible: false, reason: 'none' };
  }
}

export async function submitHostReply(reviewId: string, replyText: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('property_reviews')
      .update({
        host_reply: replyText,
        host_replied_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit reply' };
  }
}

export async function incrementHelpful(reviewId: string): Promise<void> {
  try {
    await supabase.rpc('increment_helpful_count', { review_id: reviewId });
  } catch (err) {
    console.warn('Failed to increment helpful count:', err);
  }
}

async function recalculateRating(listingId: string): Promise<void> {
  try {
    const { data: reviews } = await supabase
      .from('property_reviews')
      .select('rating')
      .eq('listing_id', listingId);

    if (!reviews || reviews.length === 0) return;

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await supabase
      .from('listings')
      .update({
        average_rating: Math.round(avg * 10) / 10,
        review_count: reviews.length,
      })
      .eq('id', listingId);
  } catch {}
}

export async function getHostReviews(hostId: string): Promise<HostReview[]> {
  try {
    const { data, error } = await supabase
      .from('host_reviews')
      .select('*')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getHostReviewSummary(hostId: string): Promise<ReviewSummary> {
  const reviews = await getHostReviews(hostId);
  const starBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;

  for (const review of reviews) {
    starBreakdown[review.rating] = (starBreakdown[review.rating] || 0) + 1;
    total += review.rating;
  }

  return {
    averageRating: reviews.length > 0 ? total / reviews.length : null,
    reviewCount: reviews.length,
    starBreakdown,
  };
}

export async function submitHostReview(params: {
  hostId: string;
  reviewerId: string;
  rating: number;
  reviewText?: string;
  tags?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const eligibility = await checkHostReviewEligibility(params.reviewerId, params.hostId);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason === 'self'
          ? 'You cannot review yourself.'
          : 'You can only review a host after an accepted inquiry, confirmed booking, or showing.',
      };
    }

    const { error } = await supabase.from('host_reviews').insert({
      host_id: params.hostId,
      reviewer_id: params.reviewerId,
      rating: params.rating,
      review_text: params.reviewText || null,
      tags: params.tags || [],
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reviewed this host.' };
      }
      throw error;
    }

    await recalculateHostRating(params.hostId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit review' };
  }
}

export async function checkHostReviewEligibility(
  userId: string,
  hostId: string
): Promise<{ eligible: boolean; reason: 'accepted_inquiry' | 'booking' | 'showing' | 'self' | 'none' }> {
  try {
    if (userId === hostId) {
      return { eligible: false, reason: 'self' };
    }

    const { data: acceptedInquiry } = await supabase
      .from('interest_cards')
      .select('id')
      .eq('sender_id', userId)
      .eq('recipient_id', hostId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (acceptedInquiry) {
      return { eligible: true, reason: 'accepted_inquiry' };
    }

    const { data: hostListings } = await supabase
      .from('listings')
      .select('id')
      .eq('created_by', hostId);

    if (hostListings && hostListings.length > 0) {
      const listingIds = hostListings.map(l => l.id);

      const { data: booking } = await supabase
        .from('bookings')
        .select('id')
        .eq('renter_id', userId)
        .in('listing_id', listingIds)
        .eq('status', 'confirmed')
        .limit(1)
        .maybeSingle();

      if (booking) {
        return { eligible: true, reason: 'booking' };
      }
    }

    const { data: matchIds } = await supabase
      .from('matches')
      .select('id')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (matchIds && matchIds.length > 0) {
      const ids = matchIds.map((m: any) => m.id);
      const { data: visitMessages } = await supabase
        .from('messages')
        .select('id, metadata')
        .in('match_id', ids)
        .eq('message_type', 'visit_request');

      const hasConfirmedVisit = (visitMessages || []).some(
        (msg: any) => msg.metadata?.status === 'confirmed'
      );

      if (hasConfirmedVisit) {
        return { eligible: true, reason: 'showing' };
      }
    }

    return { eligible: false, reason: 'none' };
  } catch (e) {
    console.warn('[ReviewService] checkHostReviewEligibility error:', e);
    return { eligible: false, reason: 'none' };
  }
}

export async function submitHostReviewReply(reviewId: string, replyText: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('host_reviews')
      .update({
        host_reply: replyText,
        host_replied_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit reply' };
  }
}

export async function incrementHostReviewHelpful(reviewId: string): Promise<void> {
  try {
    await supabase.rpc('increment_host_review_helpful', { review_id: reviewId });
  } catch (err) {
    console.warn('Failed to increment host review helpful count:', err);
  }
}

export async function getRenterReviews(
  renterId: string,
  limit: number = 20
): Promise<{ reviews: RenterReview[]; summary: ReviewSummary }> {
  const { data, error } = await supabase
    .from('renter_reviews')
    .select('*')
    .eq('renter_id', renterId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const reviews: RenterReview[] = (data || []).map(r => ({
    ...r,
    reviewer_name: r.reviewer_name || undefined,
    reviewer_photo: r.reviewer_photo || undefined,
  }));

  const ratings = reviews.map(r => r.rating);
  const summary: ReviewSummary = {
    averageRating: ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null,
    reviewCount: ratings.length,
    starBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  ratings.forEach(r => { summary.starBreakdown[r]++; });

  return { reviews, summary };
}

export async function submitRenterReview(
  reviewerId: string,
  renterId: string,
  rating: number,
  reviewText: string | null,
  tags: string[],
  bookingId?: string,
  matchId?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('renter_reviews').insert({
    reviewer_id: reviewerId,
    renter_id: renterId,
    booking_id: bookingId || null,
    match_id: matchId || null,
    rating,
    review_text: reviewText,
    tags,
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'You already reviewed this renter' };
    return { success: false, error: error.message };
  }

  await updateRenterRatingCache(renterId);
  return { success: true };
}

async function updateRenterRatingCache(renterId: string) {
  try {
    const { data } = await supabase
      .from('renter_reviews')
      .select('rating')
      .eq('renter_id', renterId)
      .eq('status', 'published');

    if (data && data.length > 0) {
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      await supabase
        .from('users')
        .update({
          renter_avg_rating: Math.round(avg * 10) / 10,
          renter_review_count: data.length,
        })
        .eq('id', renterId);
    }
  } catch {}
}

export async function submitRenterReply(
  reviewId: string,
  renterId: string,
  reply: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('renter_reviews')
    .update({
      renter_reply: reply,
      renter_replied_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('renter_id', renterId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function incrementRenterReviewHelpful(reviewId: string): Promise<void> {
  try {
    await supabase.rpc('increment_helpful_count', { review_id: reviewId });
  } catch (err) {
    console.warn('Failed to increment renter review helpful count:', err);
  }
}

export async function reportReview(
  reviewId: string,
  reviewType: 'property' | 'host' | 'renter',
  reporterId: string,
  reason: string,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('review_reports').insert({
    review_id: reviewId,
    review_type: reviewType,
    reporter_id: reporterId,
    reason,
    details,
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'You already reported this review' };
    return { success: false, error: error.message };
  }

  const { count } = await supabase
    .from('review_reports')
    .select('id', { count: 'exact', head: true })
    .eq('review_id', reviewId)
    .eq('status', 'pending');

  if (count && count >= 3) {
    const table = reviewType === 'property' ? 'property_reviews'
      : reviewType === 'host' ? 'host_reviews'
      : 'renter_reviews';
    await supabase.from(table).update({ status: 'flagged' }).eq('id', reviewId);
  }

  return { success: true };
}

async function recalculateHostRating(hostId: string): Promise<void> {
  try {
    const { data: reviews } = await supabase
      .from('host_reviews')
      .select('rating')
      .eq('host_id', hostId);

    if (!reviews || reviews.length === 0) return;

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await supabase
      .from('users')
      .update({
        host_avg_rating: Math.round(avg * 10) / 10,
        host_review_count: reviews.length,
      })
      .eq('id', hostId);
  } catch {}
}
