export interface AmenityItem {
  id: string;
  label: string;
  category: AmenityCategory;
  icon: string;
  searchTerms: string[];
}

export type AmenityCategory =
  | 'unit_features'
  | 'kitchen_bath'
  | 'building_amenities'
  | 'outdoor_spaces'
  | 'utilities_services'
  | 'accessibility_safety';

export const AMENITY_CATEGORIES: { key: AmenityCategory; label: string; icon: string }[] = [
  { key: 'unit_features', label: 'Unit Features', icon: 'home' },
  { key: 'kitchen_bath', label: 'Kitchen & Bath', icon: 'coffee' },
  { key: 'building_amenities', label: 'Building Amenities', icon: 'layers' },
  { key: 'outdoor_spaces', label: 'Outdoor & Spaces', icon: 'sun' },
  { key: 'utilities_services', label: 'Utilities & Services', icon: 'zap' },
  { key: 'accessibility_safety', label: 'Accessibility & Safety', icon: 'shield' },
];

export const ALL_AMENITIES: AmenityItem[] = [
  { id: 'in_unit_laundry', label: 'In-Unit Laundry', category: 'unit_features', icon: 'wind', searchTerms: ['washer', 'dryer', 'laundry', 'w/d'] },
  { id: 'washer_dryer_hookup', label: 'W/D Hookup', category: 'unit_features', icon: 'wind', searchTerms: ['hookup', 'washer hookup', 'dryer hookup'] },
  { id: 'dishwasher', label: 'Dishwasher', category: 'unit_features', icon: 'circle', searchTerms: ['dishwasher'] },
  { id: 'air_conditioning', label: 'Air Conditioning', category: 'unit_features', icon: 'wind', searchTerms: ['ac', 'a/c', 'air conditioning', 'central air', 'window unit'] },
  { id: 'heating', label: 'Heating', category: 'unit_features', icon: 'sun', searchTerms: ['heat', 'heating', 'radiator', 'central heat'] },
  { id: 'hardwood_floors', label: 'Hardwood Floors', category: 'unit_features', icon: 'grid', searchTerms: ['hardwood', 'wood floors', 'wood flooring'] },
  { id: 'high_ceilings', label: 'High Ceilings', category: 'unit_features', icon: 'arrow-up', searchTerms: ['high ceiling', 'tall ceiling', 'loft'] },
  { id: 'walk_in_closet', label: 'Walk-In Closet', category: 'unit_features', icon: 'archive', searchTerms: ['walk-in', 'walk in closet', 'large closet'] },
  { id: 'storage', label: 'Storage Space', category: 'unit_features', icon: 'archive', searchTerms: ['storage', 'closet', 'cabinet'] },
  { id: 'natural_light', label: 'Natural Light', category: 'unit_features', icon: 'sun', searchTerms: ['natural light', 'sunlight', 'bright', 'sunny', 'large windows'] },
  { id: 'furnished', label: 'Furnished', category: 'unit_features', icon: 'box', searchTerms: ['furnished', 'furniture included'] },
  { id: 'unfurnished', label: 'Unfurnished', category: 'unit_features', icon: 'box', searchTerms: ['unfurnished', 'empty'] },

  { id: 'stainless_appliances', label: 'Stainless Appliances', category: 'kitchen_bath', icon: 'star', searchTerms: ['stainless steel', 'stainless'] },
  { id: 'granite_counters', label: 'Granite/Quartz Counters', category: 'kitchen_bath', icon: 'grid', searchTerms: ['granite', 'quartz', 'marble', 'stone counter'] },
  { id: 'modern_kitchen', label: 'Modern Kitchen', category: 'kitchen_bath', icon: 'coffee', searchTerms: ['modern kitchen', 'renovated kitchen', 'updated kitchen'] },
  { id: 'gas_stove', label: 'Gas Stove', category: 'kitchen_bath', icon: 'zap', searchTerms: ['gas stove', 'gas range', 'gas cooking'] },
  { id: 'microwave', label: 'Microwave', category: 'kitchen_bath', icon: 'circle', searchTerms: ['microwave'] },
  { id: 'updated_bathroom', label: 'Updated Bathroom', category: 'kitchen_bath', icon: 'droplet', searchTerms: ['renovated bathroom', 'modern bathroom', 'new bathroom'] },
  { id: 'bathtub', label: 'Bathtub', category: 'kitchen_bath', icon: 'droplet', searchTerms: ['tub', 'bathtub', 'soaking tub'] },

  { id: 'elevator', label: 'Elevator', category: 'building_amenities', icon: 'arrow-up', searchTerms: ['elevator', 'lift'] },
  { id: 'doorman', label: 'Doorman / Concierge', category: 'building_amenities', icon: 'shield', searchTerms: ['doorman', 'concierge', 'front desk', 'attended lobby'] },
  { id: 'gym', label: 'Gym / Fitness Center', category: 'building_amenities', icon: 'zap', searchTerms: ['gym', 'fitness', 'workout', 'exercise room'] },
  { id: 'pool', label: 'Pool', category: 'building_amenities', icon: 'droplet', searchTerms: ['pool', 'swimming'] },
  { id: 'in_building_laundry', label: 'In-Building Laundry', category: 'building_amenities', icon: 'wind', searchTerms: ['laundry room', 'shared laundry', 'building laundry'] },
  { id: 'package_room', label: 'Package Room', category: 'building_amenities', icon: 'box', searchTerms: ['package room', 'mail room', 'package locker', 'amazon locker'] },
  { id: 'bike_storage', label: 'Bike Storage', category: 'building_amenities', icon: 'navigation', searchTerms: ['bike room', 'bike storage', 'bicycle'] },
  { id: 'coworking_space', label: 'Co-Working Space', category: 'building_amenities', icon: 'briefcase', searchTerms: ['coworking', 'co-working', 'work space', 'business center'] },
  { id: 'live_in_super', label: 'Live-In Super', category: 'building_amenities', icon: 'settings', searchTerms: ['super', 'superintendent', 'maintenance on-site'] },
  { id: 'wifi', label: 'WiFi Included', category: 'building_amenities', icon: 'globe', searchTerms: ['wifi', 'wi-fi', 'internet'] },

  { id: 'balcony', label: 'Balcony', category: 'outdoor_spaces', icon: 'maximize', searchTerms: ['balcony', 'terrace', 'juliet balcony'] },
  { id: 'patio', label: 'Patio / Yard', category: 'outdoor_spaces', icon: 'sun', searchTerms: ['patio', 'yard', 'backyard', 'garden'] },
  { id: 'rooftop', label: 'Rooftop Access', category: 'outdoor_spaces', icon: 'layers', searchTerms: ['rooftop', 'roof deck', 'roof access'] },
  { id: 'parking', label: 'Parking', category: 'outdoor_spaces', icon: 'map-pin', searchTerms: ['parking', 'garage', 'driveway', 'car'] },
  { id: 'ev_charging', label: 'EV Charging', category: 'outdoor_spaces', icon: 'zap', searchTerms: ['ev charging', 'electric vehicle', 'charger'] },

  { id: 'utilities_included', label: 'Utilities Included', category: 'utilities_services', icon: 'zap', searchTerms: ['utilities included', 'all utilities', 'heat included', 'electric included'] },
  { id: 'heat_included', label: 'Heat Included', category: 'utilities_services', icon: 'sun', searchTerms: ['heat included', 'heating included'] },
  { id: 'hot_water_included', label: 'Hot Water Included', category: 'utilities_services', icon: 'droplet', searchTerms: ['hot water included'] },
  { id: 'no_fee', label: 'No Broker Fee', category: 'utilities_services', icon: 'dollar-sign', searchTerms: ['no fee', 'no broker', 'broker free', 'no broker fee'] },
  { id: 'pet_friendly', label: 'Pet Friendly', category: 'utilities_services', icon: 'heart', searchTerms: ['pet', 'pets', 'dog', 'cat', 'pet friendly', 'pets allowed'] },
  { id: 'smoke_free', label: 'Smoke-Free', category: 'utilities_services', icon: 'slash', searchTerms: ['no smoking', 'smoke free', 'non-smoking'] },

  { id: 'wheelchair_accessible', label: 'Wheelchair Accessible', category: 'accessibility_safety', icon: 'circle', searchTerms: ['wheelchair', 'accessible', 'ada', 'handicap'] },
  { id: 'security_system', label: 'Security System', category: 'accessibility_safety', icon: 'shield', searchTerms: ['security', 'alarm', 'camera', 'intercom'] },
  { id: 'fire_escape', label: 'Fire Escape', category: 'accessibility_safety', icon: 'alert-triangle', searchTerms: ['fire escape', 'fire exit'] },
  { id: 'laundry_on_floor', label: 'Laundry on Floor', category: 'accessibility_safety', icon: 'wind', searchTerms: ['laundry on floor', 'same floor laundry'] },
];

export function getAmenitiesByCategory(): Map<AmenityCategory, AmenityItem[]> {
  const map = new Map<AmenityCategory, AmenityItem[]>();
  AMENITY_CATEGORIES.forEach(cat => map.set(cat.key, []));
  ALL_AMENITIES.forEach(a => {
    const list = map.get(a.category) || [];
    list.push(a);
    map.set(a.category, list);
  });
  return map;
}

export function getAmenityById(id: string): AmenityItem | undefined {
  return ALL_AMENITIES.find(a => a.id === id);
}

export function getAmenityLabel(id: string): string {
  return ALL_AMENITIES.find(a => a.id === id)?.label || id;
}

export function matchAmenityText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return null;
  for (const amenity of ALL_AMENITIES) {
    if (amenity.label.toLowerCase() === lower) return amenity.id;
    if (amenity.id === lower) return amenity.id;
  }
  for (const amenity of ALL_AMENITIES) {
    if (amenity.searchTerms.some(t => lower === t || lower.includes(t))) return amenity.id;
  }
  return null;
}

export function getFilterAmenities(): AmenityItem[] {
  return ALL_AMENITIES;
}

export function getHostAmenities(): AmenityItem[] {
  return ALL_AMENITIES.filter(a =>
    a.id !== 'no_fee' &&
    a.id !== 'wheelchair_accessible' &&
    a.id !== 'fire_escape'
  );
}

export function getRenterPreferenceAmenities(): AmenityItem[] {
  const preferenceIds = [
    'in_unit_laundry', 'dishwasher', 'air_conditioning', 'hardwood_floors',
    'natural_light', 'elevator', 'doorman', 'parking', 'gym', 'pet_friendly',
    'furnished', 'balcony', 'no_fee', 'utilities_included', 'walk_in_closet',
    'rooftop', 'in_building_laundry',
  ];
  return preferenceIds.map(id => ALL_AMENITIES.find(a => a.id === id)).filter(Boolean) as AmenityItem[];
}

export function normalizeLegacyAmenity(legacy: unknown): string {
  if (!legacy || typeof legacy !== 'string') return '';
  const mapping: Record<string, string> = {
    'In-unit Laundry': 'in_unit_laundry',
    'In-unit laundry': 'in_unit_laundry',
    'In-building Laundry': 'in_building_laundry',
    'Laundry in building': 'in_building_laundry',
    'Pet Friendly': 'pet_friendly',
    'Pet friendly': 'pet_friendly',
    'Air Conditioning': 'air_conditioning',
    'Air conditioning': 'air_conditioning',
    'AC': 'air_conditioning',
    'Parking': 'parking',
    'Gym': 'gym',
    'Pool': 'pool',
    'Dishwasher': 'dishwasher',
    'Balcony': 'balcony',
    'WiFi': 'wifi',
    'Heating': 'heating',
    'Furnished': 'furnished',
    'Storage': 'storage',
    'Elevator': 'elevator',
    'Doorman / Security': 'doorman',
    'Outdoor space': 'patio',
    'No fee': 'no_fee',
  };
  return mapping[legacy] || matchAmenityText(legacy) || legacy.toLowerCase().replace(/\s+/g, '_');
}
