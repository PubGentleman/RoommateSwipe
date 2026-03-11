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

export const OCCUPATION_TAGS = {
  tech: {
    label: 'Tech & Engineering',
    icon: 'monitor',
    tags: [
      { id: 'software_engineer', label: 'Software Engineer' },
      { id: 'data_scientist', label: 'Data Scientist' },
      { id: 'product_manager', label: 'Product Manager' },
      { id: 'ux_designer', label: 'UX / UI Designer' },
      { id: 'it_support', label: 'IT Support' },
      { id: 'devops', label: 'DevOps / SysAdmin' },
    ],
  },
  business: {
    label: 'Business & Finance',
    icon: 'briefcase',
    tags: [
      { id: 'finance', label: 'Finance / Banking' },
      { id: 'consulting', label: 'Consulting' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'sales', label: 'Sales' },
      { id: 'accounting', label: 'Accounting' },
      { id: 'entrepreneur', label: 'Entrepreneur' },
      { id: 'real_estate', label: 'Real Estate' },
    ],
  },
  creative: {
    label: 'Creative & Media',
    icon: 'camera',
    tags: [
      { id: 'graphic_designer', label: 'Graphic Designer' },
      { id: 'writer', label: 'Writer / Journalist' },
      { id: 'photographer_pro', label: 'Photographer' },
      { id: 'musician_pro', label: 'Musician' },
      { id: 'filmmaker', label: 'Filmmaker' },
      { id: 'content_creator', label: 'Content Creator' },
    ],
  },
  health: {
    label: 'Healthcare & Science',
    icon: 'activity',
    tags: [
      { id: 'nurse', label: 'Nurse' },
      { id: 'doctor', label: 'Doctor' },
      { id: 'therapist', label: 'Therapist / Counselor' },
      { id: 'researcher', label: 'Researcher' },
      { id: 'pharmacist', label: 'Pharmacist' },
      { id: 'lab_tech', label: 'Lab Technician' },
    ],
  },
  service: {
    label: 'Service & Trades',
    icon: 'tool',
    tags: [
      { id: 'teacher', label: 'Teacher / Professor' },
      { id: 'social_worker', label: 'Social Worker' },
      { id: 'chef', label: 'Chef / Culinary' },
      { id: 'tradesperson', label: 'Trades / Construction' },
      { id: 'retail', label: 'Retail' },
      { id: 'hospitality', label: 'Hospitality' },
      { id: 'government', label: 'Government / Public Sector' },
    ],
  },
  other: {
    label: 'Other',
    icon: 'grid',
    tags: [
      { id: 'student_occ', label: 'Student' },
      { id: 'freelancer', label: 'Freelancer' },
      { id: 'between_jobs', label: 'Between Jobs' },
      { id: 'military', label: 'Military / Veteran' },
      { id: 'retired', label: 'Retired' },
      { id: 'other_occupation', label: 'Other' },
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
  for (const category of Object.values(OCCUPATION_TAGS)) {
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
