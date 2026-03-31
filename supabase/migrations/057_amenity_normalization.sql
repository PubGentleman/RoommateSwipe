CREATE OR REPLACE FUNCTION normalize_amenity(raw_amenity TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  IF raw_amenity IS NULL OR trim(raw_amenity) = '' THEN
    RETURN '';
  END IF;

  result := CASE lower(trim(raw_amenity))
    WHEN 'in-unit laundry' THEN 'in_unit_laundry'
    WHEN 'in-building laundry' THEN 'in_building_laundry'
    WHEN 'laundry in building' THEN 'in_building_laundry'
    WHEN 'pet friendly' THEN 'pet_friendly'
    WHEN 'air conditioning' THEN 'air_conditioning'
    WHEN 'ac' THEN 'air_conditioning'
    WHEN 'parking' THEN 'parking'
    WHEN 'gym' THEN 'gym'
    WHEN 'pool' THEN 'pool'
    WHEN 'dishwasher' THEN 'dishwasher'
    WHEN 'balcony' THEN 'balcony'
    WHEN 'wifi' THEN 'wifi'
    WHEN 'heating' THEN 'heating'
    WHEN 'furnished' THEN 'furnished'
    WHEN 'storage' THEN 'storage'
    WHEN 'elevator' THEN 'elevator'
    WHEN 'doorman / security' THEN 'doorman'
    WHEN 'outdoor space' THEN 'patio'
    WHEN 'no fee' THEN 'no_fee'
    ELSE lower(regexp_replace(trim(raw_amenity), '\s+', '_', 'g'))
  END;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE listings
SET amenities = (
  SELECT array_agg(normalize_amenity(a))
  FROM unnest(amenities) AS a
  WHERE normalize_amenity(a) <> ''
)
WHERE amenities IS NOT NULL AND array_length(amenities, 1) > 0;
