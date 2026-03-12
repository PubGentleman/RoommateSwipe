export interface RoommateProfile {
  id: string;
  name: string;
  age: number;
  zodiacSign?: ZodiacSign;
  gender?: 'male' | 'female' | 'other';
  bio: string;
  occupation: string;
  budget: number;
  lookingFor?: 'room' | 'entire_apartment';
  photos: string[];
  lifestyle: {
    cleanliness: number;
    socialLevel: number;
    workSchedule: string;
    pets: boolean;
    smoking: boolean;
  };
  preferences: {
    location: string;
    moveInDate: string;
    bedrooms: number;
    sharedExpenses?: {
      utilities?: 'split_equally' | 'usage_based' | 'included_in_rent';
      groceries?: 'split_equally' | 'buy_own' | 'shared_basics';
      internet?: 'split_equally' | 'one_pays' | 'included_in_rent';
      cleaning?: 'split_equally' | 'take_turns' | 'hire_cleaner';
    };
  };
  verification?: VerificationStatus;
  compatibility?: number;
  profileData?: {
    interests?: string[];
    preferences?: Record<string, any>;
    [key: string]: any;
  };
}

export interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  address: string;
  city: string;
  state: string;
  neighborhood?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  photos: string[];
  amenities: string[];
  description: string;
  available: boolean;
  availableDate?: Date;
  rentedDate?: Date;
  hostId: string;
  hostName: string;
  featured?: boolean;
  propertyType: 'lease' | 'sublet';
  roomType: 'room' | 'entire';
  existingRoommates?: Array<{
    gender: 'male' | 'female' | 'other';
    onApp: boolean;
    userId?: string;
  }>;
  hostProfileId?: string;
  walkScore?: number;
}

export interface PropertyFilter {
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  amenities?: string[];
  availableFrom?: Date;
}

export type GroupType = 'roommate' | 'listing_inquiry';

export interface GroupMember {
  userId: string;
  role: 'renter' | 'host';
  joinedAt: string;
  isHost: boolean;
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    age?: number;
    occupation?: string;
  };
}

export interface Group {
  id: string;
  type: GroupType;
  name: string;
  description?: string;
  members: string[] | GroupMember[];
  pendingMembers: string[];
  maxMembers: number;
  budget: number;
  apartmentPrice?: number;
  bedrooms?: number;
  preferredLocation: string;
  createdAt: Date;
  createdBy: string;
  listingId?: string;
  hostId?: string;
  listingAddress?: string;
  isArchived: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId?: string;
  text?: string;
  content?: string;
  timestamp: Date;
  read?: boolean;
  readAt?: Date;
}

export interface Conversation {
  id: string;
  participant: {
    id: string;
    name: string;
    photo?: string;
    online: boolean;
  };
  lastMessage: string;
  timestamp: Date;
  unread: number;
  messages: Message[];
  matchType?: 'mutual' | 'super_interest' | 'cold';
}

export interface Application {
  id: string;
  propertyId: string;
  propertyTitle: string;
  applicantId: string;
  applicantName: string;
  applicantPhoto?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: Date;
  message: string;
  notes?: string;
}

export interface Match {
  id: string;
  userId1: string;
  userId2: string;
  matchedAt: Date;
  isSuperLike?: boolean;
  superLiker?: string;
  matchType?: 'mutual' | 'super_interest' | 'cold';
}

export type ZodiacSign = 
  | 'Aries' 
  | 'Taurus' 
  | 'Gemini' 
  | 'Cancer' 
  | 'Leo' 
  | 'Virgo' 
  | 'Libra' 
  | 'Scorpio' 
  | 'Sagittarius' 
  | 'Capricorn' 
  | 'Aquarius' 
  | 'Pisces';

export type VerificationType = 'phone' | 'government_id' | 'social_media';

export interface VerificationStatus {
  phone?: {
    verified: boolean;
    verifiedAt?: Date;
  };
  government_id?: {
    verified: boolean;
    verifiedAt?: Date;
  };
  social_media?: {
    verified: boolean;
    verifiedAt?: Date;
    platform?: 'instagram' | 'linkedin' | 'facebook';
  };
  background_check?: {
    verified: boolean;
    verifiedAt?: Date;
  };
  income_verification?: {
    verified: boolean;
    verifiedAt?: Date;
  };
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  age?: number;
  birthday?: string;
  zodiacSign?: ZodiacSign;
  role: 'renter' | 'host';
  onboardingStep?: 'profile' | 'plan' | 'complete';
  profilePicture?: string;
  verification?: VerificationStatus;
  photos?: string[];
  stripeCustomerId?: string;
  subscription?: {
    plan: 'basic' | 'plus' | 'elite';
    status: 'active' | 'cancelled' | 'cancelling' | 'expired';
    expiresAt?: Date;
    scheduledPlan?: 'basic' | 'plus' | 'elite';
    scheduledChangeDate?: Date;
    billingCycle?: 'monthly' | '3month' | 'annual';
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    billingHistory?: Array<{ date: string; amount: number; description: string }>;
  };
  hostSubscription?: {
    plan: 'starter' | 'pro' | 'business';
    status: 'active' | 'cancelled' | 'cancelling' | 'expired';
    expiresAt?: Date;
    scheduledPlan?: 'starter' | 'pro' | 'business';
    scheduledChangeDate?: Date;
    billingCycle?: 'monthly' | '3month' | 'annual';
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    inquiryResponsesUsed?: number;
    lastInquiryResetDate?: string;
    billingHistory?: Array<{ date: string; amount: number; description: string }>;
  };
  purchases?: {
    listingBoosts?: Array<{ propertyId: string; expiresAt: string }>;
    hostVerificationBadge?: boolean;
    hostVerificationPaid?: boolean;
    superInterestsRemaining?: number;
  };
  paymentMethods?: Array<{
    id: string;
    type: 'card';
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  }>;
  privacySettings?: {
    profileVisible: boolean;
    showOnlineStatus: boolean;
    showLastActive: boolean;
    twoFactorEnabled: boolean;
  };
  messageCount?: number;
  coldMessagesUsedThisMonth?: number;
  coldMessagesResetDate?: string;
  superInterestData?: {
    usedThisMonth: number;
    lastResetDate: string;
    monthlyResetDate?: string;
    totalSent?: number;
  };
  boostData?: {
    isBoosted: boolean;
    boostExpiresAt?: string;
    lastBoostActivatedAt?: string;
    nextFreeBoostAvailableAt?: string;
    boostDurationHours: 12 | 24 | 48;
    boostsUsed: number;
    lastBoostDate?: Date;
  };
  undoPassData?: {
    hasUndoPass: boolean;
    undoPassExpiresAt?: Date;
  };
  activeChatsCount?: number;
  listingViewData?: {
    viewsToday: number;
    lastViewReset: Date;
  };
  rewindData?: {
    rewindsUsedToday: number;
    lastRewindReset: Date;
  };
  superLikeData?: {
    superLikesUsedToday: number;
    lastSuperLikeReset: Date;
  };
  profileViews?: Array<{
    viewerId: string;
    viewerName: string;
    viewerPhoto?: string;
    viewedAt: Date;
  }>;
  receivedLikes?: Array<{
    likerId: string;
    likerName: string;
    likerPhoto?: string;
    likedAt: Date;
    isSuperLike?: boolean;
  }>;
  receivedSuperLikes?: Array<{
    superLikerId: string;
    superLikerName: string;
    superLikerPhoto?: string;
    superLikedAt: Date;
  }>;
  adCredits?: {
    rewinds: number;
    superLikes: number;
    boosts: number;
    messages: number;
    totalAdsWatched: number;
    lastAdWatched?: Date;
  };
  profileData?: {
    bio?: string;
    budget?: number;
    lookingFor?: 'room' | 'entire_apartment';
    location?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    occupation?: string;
    interests?: string[];
    gender?: 'male' | 'female' | 'other';
    preferences?: {
      sleepSchedule?: 'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular';
      cleanliness?: 'very_tidy' | 'moderately_tidy' | 'relaxed';
      guestPolicy?: 'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests';
      noiseTolerance?: 'prefer_quiet' | 'normal_noise' | 'loud_environments';
      smoking?: 'yes' | 'no' | 'only_outside';
      workLocation?: 'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular';
      roommateRelationship?: 'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction';
      pets?: 'have_pets' | 'open_to_pets' | 'no_pets';
      lifestyle?: Array<'active_gym' | 'homebody' | 'nightlife_social' | 'quiet_introverted' | 'creative_artistic' | 'professional_focused'>;
      moveInDate?: string;
      bedrooms?: number;
      bathrooms?: number;
      privateBathroom?: boolean;
      sharedExpenses?: {
        utilities?: 'split_equally' | 'usage_based' | 'included_in_rent';
        groceries?: 'split_equally' | 'buy_own' | 'shared_basics';
        internet?: 'split_equally' | 'one_pays' | 'included_in_rent';
        cleaning?: 'split_equally' | 'take_turns' | 'hire_cleaner';
      };
    };
  };
  notificationPreferences?: {
    matches: boolean;
    superLikes: boolean;
    messages: boolean;
    groupInvites: boolean;
    groupUpdates: boolean;
    propertyUpdates: boolean;
    boostReminders: boolean;
    systemAlerts: boolean;
  };
  blockedUsers?: string[];
  reportedUsers?: Array<{
    userId: string;
    reason: string;
    reportedAt: Date;
  }>;
  aiAssistantData?: {
    lastMicroQuestionDate?: Date;
    questionsAsked?: string[];
    microQuestionPreferences?: {
      privacyImportance?: string;
      cookingFrequency?: string;
      cleaningPreference?: string;
      furnishedPreference?: string;
      stayLength?: string;
      morningRoutine?: string;
      temperaturePreference?: string;
      kitchenSharing?: string;
      parkingNeed?: string;
      commonAreaUsage?: string;
      communicationStyle?: string;
      allergiesRestrictions?: string;
    };
  };
}

export interface InterestCard {
  id: string;
  renterId: string;
  renterName: string;
  renterPhoto?: string;
  hostId: string;
  propertyId: string;
  propertyTitle: string;
  compatibilityScore: number;
  budgetRange: string;
  moveInDate: string;
  lifestyleTags: string[];
  personalNote: string;
  status: 'pending' | 'accepted' | 'passed' | 'expired';
  isSuperInterest: boolean;
  createdAt: string;
  respondedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'group_invite' | 'group_accepted' | 'property_update' | 'property_rented' | 'application_status' | 'system' | 'super_like' | 'interest_received' | 'interest_accepted' | 'interest_passed' | 'interest_expired';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data?: {
    matchId?: string;
    conversationId?: string;
    groupId?: string;
    propertyId?: string;
    applicationId?: string;
    interestCardId?: string;
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
  };
}
