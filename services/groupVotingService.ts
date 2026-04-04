import { supabase } from '../lib/supabase';

export interface ShortlistItemWithVotes {
  id: string;
  listingId: string;
  listing: any;
  addedBy: string;
  addedByName?: string;
  voteCount: number;
  upvotes: number;
  downvotes: number;
  myVote: number | null;
  voters: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    vote: number;
  }>;
  createdAt: string;
}

export async function getShortlistWithVotes(
  groupId: string,
  currentUserId: string
): Promise<ShortlistItemWithVotes[]> {
  const { data: items, error } = await supabase
    .from('group_shortlist')
    .select(`
      id,
      listing_id,
      added_by,
      vote_count,
      created_at,
      listing:listings!listing_id(
        id, title, rent, photos, neighborhood, city, state,
        bedrooms, bathrooms, amenities, transit_info,
        average_rating, review_count, host_badge,
        available_date, rooms_available
      ),
      added_by_user:users!added_by(full_name, avatar_url),
      votes:group_shortlist_votes(
        id, user_id, vote, voted_at,
        voter:users!user_id(full_name, avatar_url)
      )
    `)
    .eq('preformed_group_id', groupId)
    .order('vote_count', { ascending: false });

  if (error || !items) return [];

  return items.map((item: any) => {
    const votes = item.votes || [];
    const upvotes = votes.filter((v: any) => v.vote === 1).length;
    const downvotes = votes.filter((v: any) => v.vote === -1).length;
    const myVoteRecord = votes.find((v: any) => v.user_id === currentUserId);
    const listing = item.listing;
    if (listing && listing.rent !== undefined && listing.price === undefined) {
      listing.price = listing.rent;
    }

    return {
      id: item.id,
      listingId: item.listing_id,
      listing,
      addedBy: item.added_by,
      addedByName: item.added_by_user?.full_name,
      voteCount: item.vote_count || 0,
      upvotes,
      downvotes,
      myVote: myVoteRecord?.vote || null,
      voters: votes.map((v: any) => ({
        userId: v.user_id,
        userName: v.voter?.full_name || 'Unknown',
        avatarUrl: v.voter?.avatar_url,
        vote: v.vote,
      })),
      createdAt: item.created_at,
    };
  });
}

export async function castVote(
  shortlistItemId: string,
  userId: string,
  vote: 1 | -1
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('group_shortlist_votes')
    .select('id, vote')
    .eq('shortlist_item_id', shortlistItemId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    if (existing.vote === vote) {
      await supabase
        .from('group_shortlist_votes')
        .delete()
        .eq('id', existing.id);

      await supabase.rpc('increment_vote_count', {
        item_id: shortlistItemId,
        delta: -vote,
      });
    } else {
      await supabase
        .from('group_shortlist_votes')
        .update({ vote, voted_at: new Date().toISOString() })
        .eq('id', existing.id);

      await supabase.rpc('increment_vote_count', {
        item_id: shortlistItemId,
        delta: vote - existing.vote,
      });
    }
  } else {
    await supabase
      .from('group_shortlist_votes')
      .insert({
        shortlist_item_id: shortlistItemId,
        user_id: userId,
        vote,
      });

    await supabase.rpc('increment_vote_count', {
      item_id: shortlistItemId,
      delta: vote,
    });
  }

  return true;
}
