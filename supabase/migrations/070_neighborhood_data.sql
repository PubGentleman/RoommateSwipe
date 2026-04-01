CREATE TABLE IF NOT EXISTS neighborhood_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood text NOT NULL,
  borough text NOT NULL,

  safety_score integer,
  total_incidents_yearly integer,
  violent_crime_count integer,
  property_crime_count integer,
  crime_trend text,
  crime_trend_percent numeric,
  safety_summary text,
  safety_tips text,
  comparison_to_borough_avg numeric,

  nearby_subway_lines text[],
  subway_stations text[],
  avg_commute_midtown_min integer,
  avg_commute_downtown_min integer,
  bus_lines text[],
  transit_score integer,
  transit_summary text,

  grocery_stores text[],
  parks text[],
  gyms text[],
  nightlife_rating integer,
  restaurant_density text,
  coffee_shops integer,
  laundromats integer,
  amenity_summary text,

  vibe_tags text[],
  avg_age_range text,
  median_rent_1br integer,
  median_rent_2br integer,
  median_rent_3br integer,
  walkability_score integer,
  noise_level text,
  vibe_summary text,

  last_updated timestamptz DEFAULT now(),
  data_source text DEFAULT 'nyc_open_data',

  UNIQUE(neighborhood, borough)
);

CREATE INDEX idx_neighborhood_name ON neighborhood_data(neighborhood);
CREATE INDEX idx_neighborhood_borough ON neighborhood_data(borough);

ALTER TABLE neighborhood_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read neighborhood data"
  ON neighborhood_data FOR SELECT
  USING (true);
