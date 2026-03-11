export const INTEREST_TAGS = {
  lifestyle: {
    label: 'Lifestyle',
    icon: 'sun',
    tags: [
      { id: 'early_bird', label: 'Early Bird' },
      { id: 'night_owl', label: 'Night Owl' },
      { id: 'homebody', label: 'Homebody' },
      { id: 'social_butterfly', label: 'Social Butterfly' },
      { id: 'introvert', label: 'Introvert' },
      { id: 'extrovert', label: 'Extrovert' },
      { id: 'remote_worker', label: 'Remote Worker' },
      { id: 'student', label: 'Student' },
      { id: 'fitness_lover', label: 'Fitness Lover' },
      { id: 'foodie', label: 'Foodie' },
      { id: 'minimalist', label: 'Minimalist' },
      { id: 'plant_parent', label: 'Plant Parent' },
    ],
  },
  habits: {
    label: 'Habits',
    icon: 'clock',
    tags: [
      { id: 'super_clean', label: 'Super Clean' },
      { id: 'pretty_clean', label: 'Pretty Clean' },
      { id: 'relaxed_clean', label: 'Relaxed' },
      { id: 'no_shoes_inside', label: 'No Shoes Inside' },
      { id: 'early_sleeper', label: 'Early Sleeper' },
      { id: 'late_sleeper', label: 'Late Sleeper' },
      { id: 'quiet_hours', label: 'Quiet Hours' },
      { id: 'open_door', label: 'Open Door Policy' },
    ],
  },
  hobbies: {
    label: 'Hobbies',
    icon: 'heart',
    tags: [
      { id: 'gaming', label: 'Gaming' },
      { id: 'cooking', label: 'Cooking' },
      { id: 'music', label: 'Music' },
      { id: 'reading', label: 'Reading' },
      { id: 'art', label: 'Art' },
      { id: 'photography', label: 'Photography' },
      { id: 'travel', label: 'Travel' },
      { id: 'yoga', label: 'Yoga' },
      { id: 'hiking', label: 'Hiking' },
      { id: 'movies', label: 'Movies' },
      { id: 'sports', label: 'Sports' },
      { id: 'podcasts', label: 'Podcasts' },
    ],
  },
  social: {
    label: 'Social',
    icon: 'users',
    tags: [
      { id: 'host_gatherings', label: 'Host Gatherings' },
      { id: 'rarely_guests', label: 'Rarely Have Guests' },
      { id: 'occasional_guests', label: 'Occasional Guests' },
      { id: 'pet_friendly', label: 'Pet Friendly' },
      { id: 'no_pets_tag', label: 'No Pets' },
      { id: 'smoker', label: 'Smoker' },
      { id: 'non_smoker', label: 'Non-Smoker' },
      { id: 'cannabis_friendly', label: '420 Friendly' },
    ],
  },
  diet: {
    label: 'Diet',
    icon: 'coffee',
    tags: [
      { id: 'vegan', label: 'Vegan' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'halal', label: 'Halal' },
      { id: 'kosher', label: 'Kosher' },
      { id: 'gluten_free', label: 'Gluten Free' },
      { id: 'no_diet_preference', label: 'No Preference' },
    ],
  },
};

export type TagCategory = keyof typeof INTEREST_TAGS;
export type TagId = string;
export const MIN_TAGS = 3;
export const MAX_TAGS = 10;

export const getTagLabel = (tagId: string): string => {
  for (const category of Object.values(INTEREST_TAGS)) {
    const tag = category.tags.find((t) => t.id === tagId);
    if (tag) return tag.label;
  }
  return tagId;
};

export const getTagCategory = (tagId: string): string | null => {
  for (const [key, category] of Object.entries(INTEREST_TAGS)) {
    if (category.tags.some((t) => t.id === tagId)) return key;
  }
  return null;
};
