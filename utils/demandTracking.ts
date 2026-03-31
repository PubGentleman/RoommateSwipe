import { supabase } from '../lib/supabase';

interface TrackingEvent {
  event_type: string;
  city?: string;
  neighborhood?: string;
  zip_code?: string;
  state?: string;
  listing_id?: string;
  bedrooms?: number;
  price?: number;
  filter_data?: Record<string, any>;
}

export function trackDemandEvent(event: TrackingEvent) {
  supabase
    .from('renter_activity_events')
    .insert({
      event_type: event.event_type,
      city: event.city || null,
      neighborhood: event.neighborhood || null,
      zip_code: event.zip_code || null,
      state: event.state || null,
      listing_id: event.listing_id || null,
      bedrooms: event.bedrooms || null,
      price: event.price || null,
      filter_data: event.filter_data || {},
    })
    .then(() => {})
    .catch(err => console.warn('[DemandTracking] Event failed:', err));
}

export function trackListingView(listing: { id: string; city?: string; neighborhood?: string; zip_code?: string; bedrooms?: number; rent?: number; price?: number }) {
  trackDemandEvent({
    event_type: 'listing_view',
    city: listing.city,
    neighborhood: listing.neighborhood,
    zip_code: listing.zip_code,
    listing_id: listing.id,
    bedrooms: listing.bedrooms,
    price: listing.rent ?? listing.price,
  });
}

export function trackListingSave(listing: { id: string; city?: string; neighborhood?: string; zip_code?: string; bedrooms?: number; rent?: number; price?: number }) {
  trackDemandEvent({
    event_type: 'listing_save',
    city: listing.city,
    neighborhood: listing.neighborhood,
    zip_code: listing.zip_code,
    listing_id: listing.id,
    bedrooms: listing.bedrooms,
    price: listing.rent ?? listing.price,
  });
}

export function trackInterestSent(listing: { id: string; city?: string; zip_code?: string; bedrooms?: number; rent?: number; price?: number }) {
  trackDemandEvent({
    event_type: 'listing_interest',
    city: listing.city,
    zip_code: listing.zip_code,
    listing_id: listing.id,
    bedrooms: listing.bedrooms,
    price: listing.rent ?? listing.price,
  });
}

export function trackSearchFilter(filters: { city?: string; neighborhood?: string; bedrooms?: number; priceMin?: number; priceMax?: number; amenities?: string[] }) {
  trackDemandEvent({
    event_type: 'search_filter',
    city: filters.city,
    neighborhood: filters.neighborhood,
    filter_data: {
      bedrooms: filters.bedrooms,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      price_max: filters.priceMax,
      amenities: filters.amenities,
    },
  });
}

export function trackNeighborhoodSearch(city: string, neighborhood?: string) {
  trackDemandEvent({
    event_type: 'neighborhood_search',
    city,
    neighborhood,
  });
}

export function trackPriceFilter(city: string, priceMin: number, priceMax: number) {
  trackDemandEvent({
    event_type: 'price_filter',
    city,
    filter_data: { min: priceMin, max: priceMax },
  });
}

export function trackBedroomFilter(city: string, bedrooms: number) {
  trackDemandEvent({
    event_type: 'bedroom_filter',
    city,
    filter_data: { bedrooms },
  });
}
