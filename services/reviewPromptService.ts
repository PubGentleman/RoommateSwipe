import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface ReviewPrompt {
  type: 'property' | 'host' | 'renter';
  targetId: string;
  targetName: string;
  bookingId?: string;
  matchId?: string;
  listingTitle?: string;
}

const DISMISSED_KEY = 'review_prompts_dismissed';

export async function getPendingReviewPrompts(userId: string): Promise<ReviewPrompt[]> {
  const prompts: ReviewPrompt[] = [];

  const dismissedRaw = await AsyncStorage.getItem(DISMISSED_KEY);
  const dismissed: string[] = dismissedRaw ? JSON.parse(dismissedRaw) : [];

  try {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, listing_id, host_id, renter_id, created_at')
      .or(`host_id.eq.${userId},renter_id.eq.${userId}`)
      .eq('status', 'confirmed')
      .lt('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

    for (const booking of bookings || []) {
      const promptKey = `booking_${booking.id}_${userId}`;
      if (dismissed.includes(promptKey)) continue;

      if (booking.renter_id === userId) {
        const { count: existingReview } = await supabase
          .from('property_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', booking.listing_id)
          .eq('reviewer_id', userId);

        if (!existingReview || existingReview === 0) {
          const { data: listing } = await supabase
            .from('listings')
            .select('title, host_id')
            .eq('id', booking.listing_id)
            .single();

          if (listing) {
            prompts.push({
              type: 'property',
              targetId: booking.listing_id,
              targetName: listing.title,
              bookingId: booking.id,
              listingTitle: listing.title,
            });
          }
        }
      }

      if (booking.host_id === userId) {
        const { count: existingReview } = await supabase
          .from('renter_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('renter_id', booking.renter_id)
          .eq('reviewer_id', userId);

        if (!existingReview || existingReview === 0) {
          const { data: renter } = await supabase
            .from('users')
            .select('name')
            .eq('id', booking.renter_id)
            .single();

          if (renter) {
            prompts.push({
              type: 'renter',
              targetId: booking.renter_id,
              targetName: renter.name,
              bookingId: booking.id,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ReviewPromptService] Error loading prompts:', err);
  }

  return prompts;
}

export async function dismissReviewPrompt(promptKey: string): Promise<void> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY);
  const dismissed: string[] = raw ? JSON.parse(raw) : [];
  dismissed.push(promptKey);
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
}
