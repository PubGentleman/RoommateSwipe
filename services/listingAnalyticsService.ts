import { supabase } from '../lib/supabase';

export interface ListingPerformanceData {
  listingId: string;
  totalViews: number;
  uniqueViews: number;
  totalSaves: number;
  totalInquiries: number;
  totalShares: number;
  avgResponseTimeHours: number | null;
  viewsByDay: { date: string; count: number }[];
  inquiriesByDay: { date: string; count: number }[];
  savesByDay: { date: string; count: number }[];
  viewsBySource: { source: string; count: number }[];
  boostImpact: {
    viewsDuringBoost: number;
    viewsBeforeBoost: number;
    inquiriesDuringBoost: number;
    inquiriesBeforeBoost: number;
    liftPercentage: number;
  } | null;
}

export interface PortfolioSummary {
  totalViews: number;
  totalInquiries: number;
  totalSaves: number;
  avgResponseTimeHours: number | null;
  topPerformingListing: { id: string; title: string; views: number } | null;
  viewsTrend: 'up' | 'down' | 'flat';
  viewsTrendPercent: number;
}

export async function trackListingEvent(
  listingId: string,
  eventType: 'view' | 'save' | 'unsave' | 'inquiry' | 'share' | 'boost_impression',
  viewerId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('listing_events').insert({
      listing_id: listingId,
      event_type: eventType,
      viewer_id: viewerId || null,
      metadata: metadata || {},
    });
  } catch (_) {}
}

export async function getListingPerformance(
  listingId: string,
  days: number = 30
): Promise<ListingPerformanceData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const { data: events, error } = await supabase
    .from('listing_events')
    .select('*')
    .eq('listing_id', listingId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = events || [];

  const views = rows.filter(e => e.event_type === 'view');
  const saves = rows.filter(e => e.event_type === 'save');
  const inquiries = rows.filter(e => e.event_type === 'inquiry');
  const shares = rows.filter(e => e.event_type === 'share');

  const uniqueViewerIds = new Set(views.filter(v => v.viewer_id).map(v => v.viewer_id));

  const groupByDay = (items: any[]): { date: string; count: number }[] => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      const day = item.created_at.substring(0, 10);
      map[day] = (map[day] || 0) + 1;
    });
    const result: { date: string; count: number }[] = [];
    const cursor = new Date(sinceISO);
    const today = new Date();
    while (cursor <= today) {
      const key = cursor.toISOString().substring(0, 10);
      result.push({ date: key, count: map[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  };

  const { data: cards } = await supabase
    .from('interest_cards')
    .select('created_at, responded_at')
    .eq('property_id', listingId)
    .not('responded_at', 'is', null)
    .gte('created_at', sinceISO);

  let avgResponseTimeHours: number | null = null;
  if (cards && cards.length > 0) {
    const totalMs = cards.reduce((sum, c) => {
      return sum + (new Date(c.responded_at).getTime() - new Date(c.created_at).getTime());
    }, 0);
    avgResponseTimeHours = Math.round((totalMs / cards.length / 3600000) * 10) / 10;
  }

  let boostImpact = null;
  const { data: boosts } = await supabase
    .from('listing_boosts')
    .select('*')
    .eq('listing_id', listingId)
    .order('started_at', { ascending: false })
    .limit(1);

  if (boosts && boosts.length > 0) {
    const boost = boosts[0];
    const boostStart = new Date(boost.started_at);
    const boostEnd = new Date(boost.expires_at);
    const preBoostStart = new Date(boostStart);
    preBoostStart.setDate(preBoostStart.getDate() - 7);

    const { data: boostEvents } = await supabase
      .from('listing_events')
      .select('*')
      .eq('listing_id', listingId)
      .gte('created_at', preBoostStart.toISOString())
      .lte('created_at', boostEnd.toISOString());

    const allBoostEvents = boostEvents || [];

    const duringBoost = allBoostEvents.filter(e => {
      const t = new Date(e.created_at);
      return t >= boostStart && t <= boostEnd;
    });
    const beforeBoost = allBoostEvents.filter(e => {
      const t = new Date(e.created_at);
      return t >= preBoostStart && t < boostStart;
    });

    const viewsDuring = duringBoost.filter(e => e.event_type === 'view').length;
    const viewsBefore = beforeBoost.filter(e => e.event_type === 'view').length;
    const inquiriesDuring = duringBoost.filter(e => e.event_type === 'inquiry').length;
    const inquiriesBefore = beforeBoost.filter(e => e.event_type === 'inquiry').length;

    boostImpact = {
      viewsDuringBoost: viewsDuring,
      viewsBeforeBoost: viewsBefore,
      inquiriesDuringBoost: inquiriesDuring,
      inquiriesBeforeBoost: inquiriesBefore,
      liftPercentage: viewsBefore > 0
        ? Math.round(((viewsDuring - viewsBefore) / viewsBefore) * 100)
        : viewsDuring > 0 ? 100 : 0,
    };
  }

  return {
    listingId,
    totalViews: views.length,
    uniqueViews: uniqueViewerIds.size,
    totalSaves: saves.length,
    totalInquiries: inquiries.length,
    totalShares: shares.length,
    avgResponseTimeHours,
    viewsByDay: groupByDay(views),
    inquiriesByDay: groupByDay(inquiries),
    savesByDay: groupByDay(saves),
    viewsBySource: [],
    boostImpact,
  };
}

export async function getPortfolioSummary(
  hostId: string,
  days: number = 30
): Promise<PortfolioSummary> {
  const { data: listings } = await supabase
    .from('properties')
    .select('id, title')
    .or(`host_id.eq.${hostId},assigned_agent_id.eq.${hostId}`);

  if (!listings || listings.length === 0) {
    return {
      totalViews: 0, totalInquiries: 0, totalSaves: 0,
      avgResponseTimeHours: null, topPerformingListing: null,
      viewsTrend: 'flat', viewsTrendPercent: 0,
    };
  }

  const listingIds = listings.map(l => l.id);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const previousSince = new Date(since);
  previousSince.setDate(previousSince.getDate() - days);

  const { data: currentEvents } = await supabase
    .from('listing_events')
    .select('listing_id, event_type')
    .in('listing_id', listingIds)
    .gte('created_at', since.toISOString());

  const { data: prevEvents } = await supabase
    .from('listing_events')
    .select('listing_id, event_type')
    .in('listing_id', listingIds)
    .gte('created_at', previousSince.toISOString())
    .lt('created_at', since.toISOString());

  const current = currentEvents || [];
  const prev = prevEvents || [];

  const currentViews = current.filter(e => e.event_type === 'view').length;
  const prevViews = prev.filter(e => e.event_type === 'view').length;

  const viewsByListing: Record<string, number> = {};
  current.filter(e => e.event_type === 'view').forEach(e => {
    viewsByListing[e.listing_id] = (viewsByListing[e.listing_id] || 0) + 1;
  });
  const topEntry = Object.entries(viewsByListing).sort((a, b) => b[1] - a[1])[0];
  const topListing = topEntry
    ? { id: topEntry[0], title: listings.find(l => l.id === topEntry[0])?.title || '', views: topEntry[1] }
    : null;

  const trendPercent = prevViews > 0
    ? Math.round(((currentViews - prevViews) / prevViews) * 100)
    : currentViews > 0 ? 100 : 0;

  return {
    totalViews: currentViews,
    totalInquiries: current.filter(e => e.event_type === 'inquiry').length,
    totalSaves: current.filter(e => e.event_type === 'save').length,
    avgResponseTimeHours: null,
    topPerformingListing: topListing,
    viewsTrend: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'flat',
    viewsTrendPercent: trendPercent,
  };
}
