-- Migration: Add professional host listing fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS unit_number TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lease_term TEXT DEFAULT '12_months'
  CHECK (lease_term IN ('month_to_month', '6_months', '12_months', '24_months'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pet_policy TEXT DEFAULT 'no_pets'
  CHECK (pet_policy IN ('no_pets', 'cats_only', 'dogs_only', 'cats_and_dogs', 'all_pets'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS parking_type TEXT DEFAULT 'none'
  CHECK (parking_type IN ('none', 'street', 'lot', 'garage', 'covered'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS mls_number TEXT;
