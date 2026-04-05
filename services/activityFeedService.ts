import { supabase } from '../lib/supabase';

export interface FeedEvent {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  body?: string;
  metadata: Record<string, any>;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export async function getFeedEvents(
  userId: string,
  limit = 30,
  offset = 0,
  filter?: 'all' | 'matches' | 'groups' | 'listings' | 'social'
): Promise<FeedEvent[]> {
  let query = supabase
    .from('activity_feed')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === 'matches') {
    query = query.in('event_type', ['new_match', 'super_interest_received', 'match_milestone', 'compatibility_update']);
  } else if (filter === 'groups') {
    query = query.in('event_type', ['group_joined', 'group_member_added', 'group_formed', 'group_property_linked']);
  } else if (filter === 'listings') {
    query = query.in('event_type', ['listing_saved', 'listing_price_drop', 'listing_new_in_area']);
  } else if (filter === 'social') {
    query = query.in('event_type', ['profile_view', 'roommate_moved']);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapFeedEvent);
}

export async function getUnreadFeedCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('activity_feed')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

export async function markFeedRead(userId: string, eventIds?: string[]) {
  let query = supabase
    .from('activity_feed')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (eventIds && eventIds.length > 0) {
    query = query.in('id', eventIds);
  }

  await query;
}

export function subscribeToFeed(userId: string, onNewEvent: (event: FeedEvent) => void) {
  const channel = supabase
    .channel(`feed-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewEvent(mapFeedEvent(payload.new as any));
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function createFeedEvent(
  userId: string,
  eventType: string,
  title: string,
  body: string | null,
  metadata: Record<string, any>,
  actionUrl?: string
) {
  const { error } = await supabase
    .from('activity_feed')
    .insert({
      user_id: userId,
      event_type: eventType,
      title,
      body,
      metadata,
      action_url: actionUrl,
    });
  if (error) console.warn('[ActivityFeed] Insert failed:', error);
}

export async function createPriceDropEvents(
  listingId: string,
  listingTitle: string,
  oldPrice: number,
  newPrice: number,
  listingPhoto?: string
) {
  const { data: saves } = await supabase
    .from('saved_listings')
    .select('user_id')
    .eq('listing_id', listingId);

  if (!saves || saves.length === 0) return;

  const events = saves.map((save: any) => ({
    user_id: save.user_id,
    event_type: 'listing_price_drop',
    title: `Price dropped on ${listingTitle}`,
    body: `$${oldPrice.toLocaleString()} \u2192 $${newPrice.toLocaleString()}/mo`,
    metadata: { listingId, listingTitle, oldPrice, newPrice, photo: listingPhoto },
    action_url: `/listing/${listingId}`,
  }));

  await supabase.from('activity_feed').insert(events);
}

export async function createProfileViewSummary(userId: string, viewCount: number) {
  if (viewCount <= 0) return;
  await createFeedEvent(
    userId,
    'profile_view',
    `${viewCount} people viewed your profile`,
    'See who checked you out',
    { viewCount },
    '/profile-views'
  );
}

export async function checkMatchMilestones(matchId: string, userId: string, messageCount: number) {
  const milestones = [
    { count: 10, label: '10 messages' },
    { count: 50, label: '50 messages' },
    { count: 100, label: '100 messages' },
  ];

  for (const milestone of milestones) {
    if (messageCount === milestone.count) {
      await createFeedEvent(
        userId,
        'match_milestone',
        `${milestone.label} milestone!`,
        'Your conversation is going strong',
        { matchId, milestone: milestone.label, messageCount },
        `/match/${matchId}`
      );
    }
  }
}

function mapFeedEvent(row: any): FeedEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    metadata: row.metadata || {},
    read: row.read,
    actionUrl: row.action_url,
    createdAt: row.created_at,
  };
}
