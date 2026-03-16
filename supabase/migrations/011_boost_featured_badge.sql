ALTER TABLE listings ADD COLUMN IF NOT EXISTS boost_includes_featured_badge BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS boost_badge_label TEXT;
