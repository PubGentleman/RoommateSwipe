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
    .eq('listing_id', listingId)
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

export interface FunnelData {
  views: number;
  saves: number;
  inquiries: number;
  accepted: number;
  booked: number;
  conversionRates: {
    viewToSave: number;
    saveToInquiry: number;
    viewToInquiry: number;
    inquiryToAccept: number;
    acceptToBook: number;
    overallConversion: number;
  };
}

export interface InquiryTrendData {
  dailyCounts: { date: string; pending: number; accepted: number; passed: number; expired: number }[];
  statusBreakdown: { status: string; count: number; color: string }[];
  avgResponseTimeByDay: { date: string; hours: number }[];
  superInterestRate: number;
  topInquiryListings: { listingId: string; title: string; count: number }[];
}

export async function getConversionFunnel(
  hostId: string,
  days: number = 30,
  listingId?: string
): Promise<FunnelData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  let listingIds: string[];
  if (listingId) {
    listingIds = [listingId];
  } else {
    const { data: listings } = await supabase
      .from('properties')
      .select('id')
      .or(`host_id.eq.${hostId},assigned_agent_id.eq.${hostId}`);
    listingIds = (listings || []).map(l => l.id);
  }

  if (listingIds.length === 0) {
    return {
      views: 0, saves: 0, inquiries: 0, accepted: 0, booked: 0,
      conversionRates: {
        viewToSave: 0, saveToInquiry: 0, viewToInquiry: 0,
        inquiryToAccept: 0, acceptToBook: 0, overallConversion: 0,
      },
    };
  }

  const { data: events } = await supabase
    .from('listing_events')
    .select('event_type')
    .in('listing_id', listingIds)
    .gte('created_at', sinceISO);

  const views = (events || []).filter(e => e.event_type === 'view').length;
  const saves = (events || []).filter(e => e.event_type === 'save').length;

  const { data: cards } = await supabase
    .from('interest_cards')
    .select('status')
    .in('listing_id', listingIds)
    .gte('created_at', sinceISO);

  const allCards = cards || [];
  const inquiries = allCards.length;
  const accepted = allCards.filter(c => c.status === 'accepted').length;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .in('listing_id', listingIds)
    .gte('created_at', sinceISO)
    .eq('status', 'confirmed');

  const booked = (bookings || []).length;

  const safe = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

  return {
    views, saves, inquiries, accepted, booked,
    conversionRates: {
      viewToSave: safe(saves, views),
      saveToInquiry: safe(inquiries, saves),
      viewToInquiry: safe(inquiries, views),
      inquiryToAccept: safe(accepted, inquiries),
      acceptToBook: safe(booked, accepted),
      overallConversion: safe(booked, views),
    },
  };
}

export async function getInquiryTrends(
  hostId: string,
  days: number = 30
): Promise<InquiryTrendData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const { data: listings } = await supabase
    .from('properties')
    .select('id, title')
    .or(`host_id.eq.${hostId},assigned_agent_id.eq.${hostId}`);
  const listingIds = (listings || []).map(l => l.id);

  if (listingIds.length === 0) {
    return {
      dailyCounts: [], statusBreakdown: [], avgResponseTimeByDay: [],
      superInterestRate: 0, topInquiryListings: [],
    };
  }

  const { data: cards } = await supabase
    .from('interest_cards')
    .select('*')
    .in('listing_id', listingIds)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });

  const allCards = cards || [];

  const dailyMap: Record<string, { pending: number; accepted: number; passed: number; expired: number }> = {};
  const cursor = new Date(sinceISO);
  const today = new Date();
  while (cursor <= today) {
    const key = cursor.toISOString().substring(0, 10);
    dailyMap[key] = { pending: 0, accepted: 0, passed: 0, expired: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }
  allCards.forEach(card => {
    const day = card.created_at.substring(0, 10);
    if (dailyMap[day]) {
      const status = card.status as 'pending' | 'accepted' | 'passed' | 'expired';
      if (dailyMap[day][status] !== undefined) dailyMap[day][status]++;
    }
  });
  const dailyCounts = Object.entries(dailyMap).map(([date, counts]) => ({ date, ...counts }));

  const statusBreakdown = [
    { status: 'Pending', count: allCards.filter(c => c.status === 'pending').length, color: '#F39C12' },
    { status: 'Accepted', count: allCards.filter(c => c.status === 'accepted').length, color: '#27AE60' },
    { status: 'Passed', count: allCards.filter(c => c.status === 'passed').length, color: '#E74C3C' },
    { status: 'Expired', count: allCards.filter(c => c.status === 'expired').length, color: '#95A5A6' },
  ];

  const respondedCards = allCards.filter(c => c.responded_at);
  const responseByDay: Record<string, { total: number; count: number }> = {};
  respondedCards.forEach(card => {
    const day = card.responded_at.substring(0, 10);
    const hours = (new Date(card.responded_at).getTime() - new Date(card.created_at).getTime()) / 3600000;
    if (!responseByDay[day]) responseByDay[day] = { total: 0, count: 0 };
    responseByDay[day].total += hours;
    responseByDay[day].count++;
  });
  const avgResponseTimeByDay = Object.entries(responseByDay).map(([date, d]) => ({
    date,
    hours: Math.round((d.total / d.count) * 10) / 10,
  }));

  const superCount = allCards.filter(c => c.is_super_interest).length;
  const superInterestRate = allCards.length > 0 ? Math.round((superCount / allCards.length) * 100) : 0;

  const listingCounts: Record<string, number> = {};
  allCards.forEach(c => {
    listingCounts[c.listing_id] = (listingCounts[c.listing_id] || 0) + 1;
  });
  const topInquiryListings = Object.entries(listingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      listingId: id,
      title: (listings || []).find(l => l.id === id)?.title || 'Unknown',
      count,
    }));

  return {
    dailyCounts,
    statusBreakdown,
    avgResponseTimeByDay,
    superInterestRate,
    topInquiryListings,
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
