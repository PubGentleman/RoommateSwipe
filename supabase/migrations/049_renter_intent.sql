ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS listing_type_preference TEXT DEFAULT 'any'
    CHECK (listing_type_preference IN ('room', 'entire_apartment', 'any')),
  ADD COLUMN IF NOT EXISTS apartment_search_type TEXT DEFAULT NULL
    CHECK (apartment_search_type IN ('solo', 'with_partner', 'with_roommates', 'have_group'));
