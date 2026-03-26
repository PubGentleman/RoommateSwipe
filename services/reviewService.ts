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

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  starBreakdown: Record<number, number>;
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

export type ReviewTag = typeof REVIEW_TAGS[number];
export { REVIEW_TAGS };

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
