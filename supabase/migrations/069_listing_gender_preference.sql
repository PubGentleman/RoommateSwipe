ALTER TABLE listings ADD COLUMN IF NOT EXISTS preferred_tenant_gender text DEFAULT 'any';

ALTER TABLE listings ADD CONSTRAINT gender_pref_valid_values
  CHECK (preferred_tenant_gender IN ('any', 'female_only', 'male_only'));

ALTER TABLE listings ADD CONSTRAINT gender_pref_room_only
  CHECK (
    preferred_tenant_gender = 'any'
    OR listing_type IN ('room', 'private_room', 'shared_room', 'roommate')
  );
