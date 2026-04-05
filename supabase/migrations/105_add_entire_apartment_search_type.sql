ALTER TABLE users DROP CONSTRAINT IF EXISTS users_apartment_search_type_check;
ALTER TABLE users ADD CONSTRAINT users_apartment_search_type_check
  CHECK (apartment_search_type IN ('solo', 'with_partner', 'with_roommates', 'have_group', 'entire_apartment'));
