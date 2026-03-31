CREATE TABLE IF NOT EXISTS renter_activity_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  city TEXT,
  neighborhood TEXT,
  zip_code TEXT,
  state TEXT,
  listing_id UUID,
  bedrooms INTEGER,
  price NUMERIC,
  filter_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_rae_type_date ON renter_activity_events(event_type, event_date);
CREATE INDEX idx_rae_city_date ON renter_activity_events(city, event_date);
CREATE INDEX idx_rae_zip_date ON renter_activity_events(zip_code, event_date);
CREATE INDEX idx_rae_neighborhood ON renter_activity_events(neighborhood, event_date);
CREATE INDEX idx_rae_listing ON renter_activity_events(listing_id, event_date);

ALTER TABLE renter_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert events"
  ON renter_activity_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "No direct reads on raw events"
  ON renter_activity_events FOR SELECT
  USING (false);

CREATE TABLE IF NOT EXISTS neighborhood_demand (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  neighborhood TEXT,
  zip_code TEXT,
  state TEXT,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_searches INTEGER DEFAULT 0,
  total_listing_views INTEGER DEFAULT 0,
  total_saves INTEGER DEFAULT 0,
  total_interests INTEGER DEFAULT 0,
  unique_listings_viewed INTEGER DEFAULT 0,
  avg_budget_min NUMERIC,
  avg_budget_max NUMERIC,
  median_budget NUMERIC,
  most_wanted_bedrooms INTEGER,
  bedroom_distribution JSONB DEFAULT '{}',
  top_amenities JSONB DEFAULT '[]',
  amenity_demand JSONB DEFAULT '{}',
  active_listings_count INTEGER DEFAULT 0,
  avg_listing_price NUMERIC,
  median_listing_price NUMERIC,
  demand_supply_ratio NUMERIC,
  competition_level TEXT,
  price_gap NUMERIC,
  search_trend NUMERIC,
  price_trend NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city, neighborhood, zip_code, period_type, period_start)
);

CREATE INDEX idx_nd_city_period ON neighborhood_demand(city, period_type, period_start DESC);
CREATE INDEX idx_nd_zip ON neighborhood_demand(zip_code, period_type, period_start DESC);
CREATE INDEX idx_nd_competition ON neighborhood_demand(city, competition_level);

ALTER TABLE neighborhood_demand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read demand data"
  ON neighborhood_demand FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS listing_demand (
  id BIGSERIAL PRIMARY KEY,
  listing_id UUID NOT NULL,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  views INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  interests INTEGER DEFAULT 0,
  view_percentile INTEGER,
  save_rate NUMERIC,
  interest_rate NUMERIC,
  view_trend NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, period_type, period_start)
);

CREATE INDEX idx_ld_listing ON listing_demand(listing_id, period_type, period_start DESC);

ALTER TABLE listing_demand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can read their listing demand"
  ON listing_demand FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE host_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS area_preference_stats (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  neighborhood TEXT,
  zip_code TEXT,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  total_active_renters INTEGER DEFAULT 0,
  preference_rankings JSONB DEFAULT '[]',
  budget_percentiles JSONB DEFAULT '{}',
  bedroom_demand JSONB DEFAULT '{}',
  move_in_distribution JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city, neighborhood, zip_code, period_type, period_start)
);

CREATE INDEX idx_aps_city ON area_preference_stats(city, period_type, period_start DESC);

ALTER TABLE area_preference_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read preference stats"
  ON area_preference_stats FOR SELECT
  USING (true);
