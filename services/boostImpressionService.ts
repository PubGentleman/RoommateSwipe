import { supabase } from '../lib/supabase';

const FLUSH_INTERVAL = 15000;
const MAX_BATCH_SIZE = 25;

interface ImpressionEvent {
  listing_id: string;
  viewer_id: string;
  impression_type: 'card_view' | 'detail_view' | 'search_result' | 'carousel_view';
  boost_type?: 'quick' | 'standard' | 'extended';
  section?: 'main_feed' | 'top_picks' | 'boosted_carousel' | 'search';
  created_at: string;
}

let queue: ImpressionEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let currentViewerId: string | null = null;

export function initImpressionTracking(viewerId: string) {
  currentViewerId = viewerId;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushImpressions, FLUSH_INTERVAL);
}

export function stopImpressionTracking() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushImpressions();
}

export function trackImpression(
  listingId: string,
  impressionType: ImpressionEvent['impression_type'] = 'card_view',
  options?: {
    boostType?: ImpressionEvent['boost_type'];
    section?: ImpressionEvent['section'];
  }
) {
  if (!currentViewerId) return;

  queue.push({
    listing_id: listingId,
    viewer_id: currentViewerId,
    impression_type: impressionType,
    boost_type: options?.boostType,
    section: options?.section,
    created_at: new Date().toISOString(),
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    flushImpressions();
  }
}

export async function flushImpressions() {
  if (queue.length === 0) return;

  const batch = [...queue];
  queue = [];

  try {
    const { error } = await supabase
      .from('boost_impressions')
      .insert(batch);

    if (error) {
      console.error('Failed to flush impressions:', error);
      if (queue.length + batch.length < 500) {
        queue.unshift(...batch);
      }
    }
  } catch (err) {
    console.error('Impression flush error:', err);
    if (queue.length + batch.length < 500) {
      queue.unshift(...batch);
    }
  }
}

export async function getImpressionStats(listingId: string, since?: string): Promise<{
  totalImpressions: number;
  cardViews: number;
  detailViews: number;
  searchResults: number;
  carouselViews: number;
  uniqueViewers: number;
  bySection: Record<string, number>;
}> {
  let query = supabase
    .from('boost_impressions')
    .select('impression_type, section, viewer_id')
    .eq('listing_id', listingId);

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      totalImpressions: 0, cardViews: 0, detailViews: 0,
      searchResults: 0, carouselViews: 0, uniqueViewers: 0,
      bySection: {},
    };
  }

  const uniqueViewerIds = new Set(data.map(d => d.viewer_id));
  const bySection: Record<string, number> = {};
  data.forEach(d => {
    if (d.section) {
      bySection[d.section] = (bySection[d.section] || 0) + 1;
    }
  });

  return {
    totalImpressions: data.length,
    cardViews: data.filter(d => d.impression_type === 'card_view').length,
    detailViews: data.filter(d => d.impression_type === 'detail_view').length,
    searchResults: data.filter(d => d.impression_type === 'search_result').length,
    carouselViews: data.filter(d => d.impression_type === 'carousel_view').length,
    uniqueViewers: uniqueViewerIds.size,
    bySection,
  };
}

export async function getBoostComparison(listingId: string, boostStartedAt: string, boostDurationHours: number): Promise<{
  duringBoost: { impressions: number; uniqueViewers: number };
  beforeBoost: { impressions: number; uniqueViewers: number };
  multiplier: number;
}> {
  const boostStart = new Date(boostStartedAt);
  const boostEnd = new Date(boostStart.getTime() + boostDurationHours * 60 * 60 * 1000);
  const preBoostStart = new Date(boostStart.getTime() - boostDurationHours * 60 * 60 * 1000);

  const { data: duringData } = await supabase
    .from('boost_impressions')
    .select('viewer_id')
    .eq('listing_id', listingId)
    .gte('created_at', boostStart.toISOString())
    .lte('created_at', boostEnd.toISOString());

  const { data: beforeData } = await supabase
    .from('boost_impressions')
    .select('viewer_id')
    .eq('listing_id', listingId)
    .gte('created_at', preBoostStart.toISOString())
    .lt('created_at', boostStart.toISOString());

  const during = {
    impressions: duringData?.length || 0,
    uniqueViewers: new Set(duringData?.map(d => d.viewer_id) || []).size,
  };
  const before = {
    impressions: beforeData?.length || 0,
    uniqueViewers: new Set(beforeData?.map(d => d.viewer_id) || []).size,
  };

  return {
    duringBoost: during,
    beforeBoost: before,
    multiplier: before.impressions > 0
      ? Math.round((during.impressions / before.impressions) * 10) / 10
      : during.impressions > 0 ? during.impressions : 1,
  };
}
