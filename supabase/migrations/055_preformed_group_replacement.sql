ALTER TABLE preformed_groups
ADD COLUMN IF NOT EXISTS needs_replacement boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS replacement_slots integer DEFAULT 0;
