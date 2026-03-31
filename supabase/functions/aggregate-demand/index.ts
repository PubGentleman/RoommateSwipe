import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const { data: cities } = await supabase
      .from('renter_activity_events')
      .select('city')
      .eq('event_date', dateStr)
      .not('city', 'is', null);

    const uniqueCities = [...new Set((cities || []).map((c: any) => c.city).filter(Boolean))];

    for (const city of uniqueCities) {
      const { data: events } = await supabase
        .from('renter_activity_events')
        .select('event_type, neighborhood, zip_code, bedrooms, price, filter_data, listing_id')
        .eq('city', city)
        .eq('event_date', dateStr);

      if (!events || events.length === 0) continue;

      const neighborhoods = [...new Set(events.map((e: any) => e.neighborhood).filter(Boolean))];

      for (const neighborhood of [...neighborhoods, null]) {
        const filtered = neighborhood
          ? events.filter((e: any) => e.neighborhood === neighborhood)
          : events;

        const searches = filtered.filter((e: any) => e.event_type === 'neighborhood_search').length;
        const views = filtered.filter((e: any) => e.event_type === 'listing_view').length;
        const saves = filtered.filter((e: any) => e.event_type === 'listing_save').length;
        const interests = filtered.filter((e: any) => e.event_type === 'listing_interest').length;

        const filterEvents = filtered.filter((e: any) => e.event_type === 'search_filter');
        const budgets = filterEvents
          .map((e: any) => e.filter_data?.price_max || e.filter_data?.priceMax)
          .filter(Boolean)
          .sort((a: number, b: number) => a - b);

        const medianBudget = budgets.length > 0
          ? budgets[Math.floor(budgets.length / 2)]
          : null;

        const bedroomCounts: Record<number, number> = {};
        filtered.filter((e: any) => e.bedrooms != null).forEach((e: any) => {
          bedroomCounts[e.bedrooms] = (bedroomCounts[e.bedrooms] || 0) + 1;
        });

        const amenityCounts: Record<string, number> = {};
        filterEvents.forEach((e: any) => {
          const amenities = e.filter_data?.amenities || [];
          amenities.forEach((a: string) => {
            amenityCounts[a] = (amenityCounts[a] || 0) + 1;
          });
        });

        const totalFilterEvents = Math.max(filterEvents.length, 1);
        const amenityDemand: Record<string, number> = {};
        Object.entries(amenityCounts).forEach(([k, v]) => {
          amenityDemand[k] = Math.round((v / totalFilterEvents) * 100);
        });

        const topAmenities = Object.entries(amenityDemand)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name]) => name);

        let listingQuery = supabase
          .from('listings')
          .select('rent', { count: 'exact' })
          .eq('city', city)
          .eq('status', 'active');

        if (neighborhood) {
          listingQuery = listingQuery.eq('neighborhood', neighborhood);
        }

        const { data: activeListings, count: listingCount } = await listingQuery;
        const activeCount = listingCount || 0;

        const listingPrices = (activeListings || [])
          .map((l: any) => l.rent)
          .filter(Boolean)
          .sort((a: number, b: number) => a - b);

        const medianListingPrice = listingPrices.length > 0
          ? listingPrices[Math.floor(listingPrices.length / 2)]
          : null;

        const dsr = activeCount > 0 ? (searches + views) / activeCount : 999;
        let competitionLevel = 'moderate';
        if (dsr > 20) competitionLevel = 'very_high';
        else if (dsr > 10) competitionLevel = 'high';
        else if (dsr > 5) competitionLevel = 'moderate';
        else if (dsr > 2) competitionLevel = 'low';
        else competitionLevel = 'very_low';

        const zipCode = neighborhood
          ? (filtered.find((e: any) => e.zip_code)?.zip_code || null)
          : null;
        const viewedListingIds = new Set(
          filtered.filter((e: any) => e.event_type === 'listing_view' && e.listing_id).map((e: any) => e.listing_id)
        );

        const topBedroomEntry = Object.entries(bedroomCounts).sort(([, a], [, b]) => b - a)[0];

        await supabase.from('neighborhood_demand').upsert({
          city,
          neighborhood: neighborhood || null,
          zip_code: zipCode,
          period_type: 'daily',
          period_start: dateStr,
          period_end: dateStr,
          total_searches: searches,
          total_listing_views: views,
          total_saves: saves,
          total_interests: interests,
          unique_listings_viewed: viewedListingIds.size,
          median_budget: medianBudget,
          most_wanted_bedrooms: topBedroomEntry ? Number(topBedroomEntry[0]) : null,
          bedroom_distribution: bedroomCounts,
          top_amenities: topAmenities,
          amenity_demand: amenityDemand,
          active_listings_count: activeCount,
          median_listing_price: medianListingPrice,
          demand_supply_ratio: Math.round(dsr * 100) / 100,
          competition_level: competitionLevel,
          price_gap: medianBudget && medianListingPrice ? medianBudget - medianListingPrice : null,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'city,neighborhood,zip_code,period_type,period_start' });
      }

      const listingViewEvents = events.filter((e: any) => e.event_type === 'listing_view' && e.listing_id);
      const listingSaveEvents = events.filter((e: any) => e.event_type === 'listing_save' && e.listing_id);
      const listingInterestEvents = events.filter((e: any) => e.event_type === 'listing_interest' && e.listing_id);

      const listingIds = [...new Set([
        ...listingViewEvents.map((e: any) => e.listing_id),
        ...listingSaveEvents.map((e: any) => e.listing_id),
        ...listingInterestEvents.map((e: any) => e.listing_id),
      ].filter(Boolean))];

      for (const listingId of listingIds) {
        const lViews = listingViewEvents.filter((e: any) => e.listing_id === listingId).length;
        const lSaves = listingSaveEvents.filter((e: any) => e.listing_id === listingId).length;
        const lInterests = listingInterestEvents.filter((e: any) => e.listing_id === listingId).length;

        await supabase.from('listing_demand').upsert({
          listing_id: listingId,
          period_type: 'daily',
          period_start: dateStr,
          period_end: dateStr,
          views: lViews,
          saves: lSaves,
          interests: lInterests,
          save_rate: lViews > 0 ? Math.round((lSaves / lViews) * 100) / 100 : 0,
          interest_rate: lViews > 0 ? Math.round((lInterests / lViews) * 100) / 100 : 0,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'listing_id,period_type,period_start' });
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await supabase
      .from('renter_activity_events')
      .delete()
      .lt('event_date', cutoff.toISOString().split('T')[0]);

    return new Response(
      JSON.stringify({ success: true, cities: uniqueCities.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Aggregation error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
