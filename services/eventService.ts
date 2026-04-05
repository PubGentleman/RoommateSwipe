import { supabase } from '../lib/supabase';

export interface EventData {
  title: string;
  description?: string;
  eventType: string;
  locationName?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  startsAt: string;
  endsAt?: string;
  maxAttendees?: number;
  isPublic: boolean;
  coverPhoto?: string;
  groupId?: string;
  listingId?: string;
}

export interface RhomeEvent {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto?: string;
  groupId?: string;
  groupName?: string;
  title: string;
  description?: string;
  eventType: string;
  locationName?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  startsAt: string;
  endsAt?: string;
  maxAttendees?: number;
  isPublic: boolean;
  coverPhoto?: string;
  listingId?: string;
  status: string;
  attendeeCount: number;
  myRsvp?: string;
  createdAt: string;
}

export const EVENT_TYPES = [
  { key: 'apartment_viewing', label: 'Apartment Viewing', icon: 'home' as const, color: '#ff6b5b' },
  { key: 'roommate_meetup', label: 'Roommate Meetup', icon: 'coffee' as const, color: '#6C5CE7' },
  { key: 'neighborhood_tour', label: 'Neighborhood Tour', icon: 'map' as const, color: '#22C55E' },
  { key: 'social_hangout', label: 'Social Hangout', icon: 'music' as const, color: '#FCCC0A' },
  { key: 'open_house', label: 'Open House', icon: 'key' as const, color: '#3b82f6' },
  { key: 'move_in_help', label: 'Move-in Help', icon: 'package' as const, color: '#FF6319' },
  { key: 'community_event', label: 'Community Event', icon: 'star' as const, color: '#14b8a6' },
] as const;

export function getEventTypeInfo(eventType: string) {
  return EVENT_TYPES.find(t => t.key === eventType) || EVENT_TYPES[6];
}

export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const minStr = minutes < 10 ? '0' + minutes : String(minutes);
  return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ' · ' + h12 + ':' + minStr + ' ' + ampm;
}

export function formatEventDateLong(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const minStr = minutes < 10 ? '0' + minutes : String(minutes);
  return h12 + ':' + minStr + ' ' + ampm;
}

const EVENT_SELECT = '*, creator:users!creator_id(id, full_name, avatar_url), group:groups(id, name), rsvps:event_rsvps(id, user_id, status)';
const EVENT_SELECT_NO_GROUP = '*, creator:users!creator_id(id, full_name, avatar_url), rsvps:event_rsvps(id, user_id, status)';

export async function createEvent(userId: string, data: EventData): Promise<RhomeEvent> {
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      creator_id: userId,
      title: data.title,
      description: data.description,
      event_type: data.eventType,
      location_name: data.locationName,
      location_address: data.locationAddress,
      location_lat: data.locationLat,
      location_lng: data.locationLng,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      max_attendees: data.maxAttendees,
      is_public: data.isPublic,
      cover_photo: data.coverPhoto,
      group_id: data.groupId,
      listing_id: data.listingId,
    })
    .select()
    .single();
  if (error) throw error;

  await rsvpToEvent(event.id, userId, 'going');
  return mapEvent(event, userId);
}

export async function getUpcomingEvents(
  userId: string,
  city?: string,
  eventType?: string,
  limit = 20,
  offset = 0
): Promise<RhomeEvent[]> {
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'active')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (city) {
    query = query.ilike('location_address', '%' + city + '%');
  }
  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(e => mapEvent(e, userId));
}

export async function getMyEvents(userId: string): Promise<{
  hosting: RhomeEvent[];
  attending: RhomeEvent[];
  past: RhomeEvent[];
}> {
  const now = new Date().toISOString();

  const { data: hosted } = await supabase
    .from('events')
    .select(EVENT_SELECT_NO_GROUP)
    .eq('creator_id', userId)
    .eq('status', 'active')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true });

  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('event_id')
    .eq('user_id', userId)
    .eq('status', 'going');

  const rsvpEventIds = (rsvps || []).map((r: any) => r.event_id);

  let attending: any[] = [];
  if (rsvpEventIds.length > 0) {
    const { data } = await supabase
      .from('events')
      .select(EVENT_SELECT_NO_GROUP)
      .in('id', rsvpEventIds)
      .neq('creator_id', userId)
      .eq('status', 'active')
      .gte('starts_at', now)
      .order('starts_at', { ascending: true });
    attending = data || [];
  }

  const hostedIds = new Set((hosted || []).map((e: any) => e.id));

  const { data: pastHosted } = await supabase
    .from('events')
    .select(EVENT_SELECT_NO_GROUP)
    .eq('creator_id', userId)
    .lt('starts_at', now)
    .order('starts_at', { ascending: false })
    .limit(10);

  const pastAll: any[] = [...(pastHosted || [])];
  const pastIds = new Set(pastAll.map(e => e.id));

  const pastAttendedIds = rsvpEventIds.filter((id: string) => !pastIds.has(id) && !hostedIds.has(id));
  if (pastAttendedIds.length > 0) {
    const { data: pastAttended } = await supabase
      .from('events')
      .select(EVENT_SELECT_NO_GROUP)
      .in('id', pastAttendedIds)
      .lt('starts_at', now)
      .order('starts_at', { ascending: false })
      .limit(10);
    (pastAttended || []).forEach(e => pastAll.push(e));
  }

  pastAll.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return {
    hosting: (hosted || []).map(e => mapEvent(e, userId)),
    attending: attending.map(e => mapEvent(e, userId)),
    past: pastAll.slice(0, 10).map(e => mapEvent(e, userId)),
  };
}

export async function getGroupEvents(groupId: string, userId: string): Promise<RhomeEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT_NO_GROUP)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(e => mapEvent(e, userId));
}

export async function getEventById(eventId: string, userId: string): Promise<RhomeEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .single();
  if (error) return null;
  return mapEvent(data, userId);
}

export async function rsvpToEvent(eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going') {
  const { error } = await supabase
    .from('event_rsvps')
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export async function getEventAttendees(eventId: string) {
  const { data } = await supabase
    .from('event_rsvps')
    .select('status, user:users!user_id(id, full_name, avatar_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function cancelEvent(eventId: string, userId: string) {
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
    .eq('creator_id', userId);
  if (error) throw error;
}

export async function getEventComments(eventId: string) {
  const { data } = await supabase
    .from('event_comments')
    .select('*, user:users!user_id(id, full_name, avatar_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function postEventComment(eventId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from('event_comments')
    .insert({ event_id: eventId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function mapEvent(row: any, currentUserId: string): RhomeEvent {
  const rsvps = row.rsvps || [];
  const goingCount = rsvps.filter((r: any) => r.status === 'going').length;
  const myRsvp = rsvps.find((r: any) => r.user_id === currentUserId);

  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator?.full_name || 'Unknown',
    creatorPhoto: row.creator?.avatar_url,
    groupId: row.group_id,
    groupName: row.group?.name,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    locationName: row.location_name,
    locationAddress: row.location_address,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxAttendees: row.max_attendees,
    isPublic: row.is_public,
    coverPhoto: row.cover_photo,
    listingId: row.listing_id,
    status: row.status,
    attendeeCount: goingCount,
    myRsvp: myRsvp?.status,
    createdAt: row.created_at,
  };
}
