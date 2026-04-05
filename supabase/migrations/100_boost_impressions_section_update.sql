ALTER TABLE boost_impressions DROP CONSTRAINT IF EXISTS boost_impressions_section_check;
ALTER TABLE boost_impressions ADD CONSTRAINT boost_impressions_section_check
  CHECK (section IN ('main_feed', 'top_picks', 'boosted_carousel', 'search', 'group_suggestions', 'roommate_card'));
