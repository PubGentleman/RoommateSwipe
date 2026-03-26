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
  personalityAnswers?: Record<string, string>;
  profileData?: {
    interests?: string[];
    preferences?: Record<string, any>;
    profileNote?: string;
    [key: string]: any;
  };
  references?: Reference[];
  apartmentPrefs?: ApartmentPreferences;
  instagram_verified?: boolean;
  instagram_handle?: string;
}

export interface ApartmentPreferences {
  desiredBedrooms: number;
  budgetPerPersonMin: number;
  budgetPerPersonMax: number;
  preferredTrains: string[];
  preferredNeighborhoods: string[];
  amenityMustHaves: string[];
  moveInDate: string;
  locationFlexible: boolean;
  wfh: boolean;
  apartmentPrefsComplete: boolean;
}

export interface GroupApartmentVote {
  id: string;
  groupId: string;
  listingId: string;
  userId: string;
  vote: 'yes' | 'no' | 'maybe';
  createdAt: string;
}

export type HostPlanType = 'free' | 'none' | 'starter' | 'pro' | 'business';
export type AgentPlanType = 'pay_per_use' | 'starter' | 'pro' | 'business';
export type AgentGroupStatus = 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved';

export interface HostSubscriptionData {
  plan: HostPlanType;
  listingsIncluded: number;
  activeListingCount: number;
  overagePerListing: number;
  monthlyPrice: number;
  freeBoostsRemaining: number;
  freeBoostDuration: '6h' | '12h' | '24h' | '72h' | '7d' | null;
  isVerifiedAgent: boolean;
  agentVerificationPaid: boolean;
  renewalDate?: string;
}

export interface ListingBoost {
  listingId: string;
  duration: '6h' | '12h' | '24h' | '72h' | '7d';
  price: number;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  usedFreeboost: boolean;
  includesFeaturedBadge: boolean;
  badgeLabel: string | null;
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
  hostLivesIn?: boolean;
  existingRoommatesCount?: number;
  rooms_available?: number;
  hostProfileId?: string;
  hostType?: 'individual' | 'company' | 'agent';
  walkScore?: number;
  walkScoreLabel?: string;
  transitScore?: number;
  transitScoreLabel?: string;
  createdAt?: string;
  listingBoost?: ListingBoost;
  transitInfo?: {
    stops: Array<{
      name: string;
      type: 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'other';
      distanceMiles: number;
    }>;
    noTransitNearby?: boolean;
    manualOverride?: string;
    fetchedAt: string;
  };
  average_rating?: number | null;
  review_count?: number;
}

export interface PropertyFilter {
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  amenities?: string[];
  availableFrom?: Date;
  listingType?: 'any' | 'room' | 'entire' | 'sublet';
}

export type GroupType = 'roommate' | 'listing_inquiry';

export type GroupMemberRole = 'admin' | 'member';
export type GroupMemberStatus = 'active' | 'left' | 'removed';

export interface GroupMember {
  id?: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  isHost: boolean;
  status: GroupMemberStatus;
  joinedAt?: string;
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    age?: number;
    occupation?: string;
    role?: string;
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
  city?: string;
  state?: string;
  budgetMin?: number;
  budgetMax?: number;
  budget: number;
  moveInDate?: string;
  photoUrl?: string;
  preferredLocation: string;
  createdAt: Date;
  createdBy: string;
  listingId?: string;
  hostId?: string;
  listingAddress?: string;
  isArchived: boolean;
  is_visible_to_hosts?: boolean;
  hostName?: string;
  memberCount?: number;
  inquiryStatus?: 'pending' | 'accepted' | 'declined';
  addressRevealed?: boolean;
  listingPhoto?: string;
  createdByAgent?: string;
  agentAssembled?: boolean;
  targetListingId?: string;
  groupStatus?: AgentGroupStatus;
}

export interface AgentShortlist {
  id: string;
  agentId: string;
  renterId: string;
  listingId?: string;
  notes?: string;
  createdAt: string;
}

export interface AgentGroupInvite {
  id: string;
  agentId: string;
  renterId: string;
  groupId: string;
  listingId?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
  sentAt: string;
  respondedAt?: string;
  agentName?: string;
  listingTitle?: string;
  listingRent?: number;
  listingBedrooms?: number;
  listingNeighborhood?: string;
  listingAvailableDate?: string;
  groupMembers?: Array<{ id: string; name: string; photo?: string; compatibility?: number }>;
}

export interface AgentPlacement {
  id: string;
  agentId: string;
  groupId: string;
  listingId: string;
  placementFeeCents: number;
  stripePaymentIntentId?: string;
  placedAt: string;
  billingStatus: 'pending' | 'charged' | 'failed' | 'waived';
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
  message_type?: string;
  metadata?: Record<string, any>;
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
  isInquiryThread?: boolean;
  inquiryStatus?: 'pending' | 'accepted' | 'declined';
  inquiryId?: string;
  listingTitle?: string;
  listingPhoto?: string;
  listingPrice?: number;
  hostName?: string;
  hostId?: string;
  propertyId?: string;
  groupId?: string;
  isSoloInquiry?: boolean;
  isSuperInterest?: boolean;
  matchId?: string;
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
  firstName?: string;
  lastName?: string;
  age?: number;
  birthday?: string;
  zodiacSign?: ZodiacSign;
  role: 'renter' | 'host';
  onboardingStep?: 'profile' | 'hostType' | 'plan' | 'complete';
  hostType?: 'individual' | 'company' | 'agent';
  companyName?: string;
  companyLogoUrl?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseDocumentUrl?: string;
  licenseVerified?: boolean;
  licenseVerifiedAt?: string;
  licenseVerificationStatus?: 'unverified' | 'pending' | 'verified' | 'failed' | 'manual_review';
  agencyName?: string;
  unitsManaged?: number;
  verifiedBusiness?: boolean;
  verifiedBusinessAt?: string;
  avgResponseHours?: number;
  hostTypeLockedAt?: string;
  hostTypeChangeRequested?: boolean;
  activeMode?: 'renter' | 'host';
  hasCompletedHostOnboarding?: boolean;
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
    plan: 'free' | 'starter' | 'pro' | 'business';
    status: 'active' | 'cancelled' | 'cancelling' | 'expired';
    expiresAt?: Date;
    scheduledPlan?: 'free' | 'starter' | 'pro' | 'business';
    scheduledChangeDate?: Date;
    billingCycle?: 'monthly' | 'annual';
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    inquiryResponsesUsed?: number;
    lastInquiryResetDate?: string;
    billingHistory?: Array<{ date: string; amount: number; description: string }>;
  };
  agentPlan?: AgentPlanType;
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
  messagingData?: {
    dailyMessageCount: number;
    dailyMessageResetDate: string;
    activeChatsCount: number;
    coldMessagesUsedThisMonth: number;
    coldMessagesResetDate: string;
  };
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
    boostDurationHours: 6 | 12 | 24 | 48;
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
    personalityAnswers?: Record<string, string>;
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
    profileNote?: string;
  };
  personalityAnswers?: Record<string, string>;
  references?: Reference[];
  identity_verified?: boolean;
  identity_verified_at?: string;
  background_check_status?: 'none' | 'pending' | 'clear' | 'flagged';
  safetyModeEnabled?: boolean;
  background_check_completed_at?: string;
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
  lastActiveAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
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
  groupId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'group_invite' | 'group_accepted' | 'group_complete' | 'group_match' | 'company_group_invite' | 'meetup_suggestion' | 'property_update' | 'property_rented' | 'application_status' | 'system' | 'super_like' | 'interest_received' | 'interest_accepted' | 'interest_passed' | 'interest_expired' | 'agent_invite' | 'ai_group_suggestion' | 'background_check';
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
    agentInviteId?: string;
    agentName?: string;
    listingTitle?: string;
    listingRent?: number;
    groupMembers?: Array<{ id: string; name: string; photo?: string; compatibility?: number }>;
  };
}

export interface Reference {
  id: string;
  recipientId: string;
  authorName: string;
  authorEmail: string;
  authorRelationship: 'past_roommate' | 'landlord' | 'colleague' | 'friend';
  rating: number;
  review?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface DailyQuestionOption {
  value: string;
  label: string;
  icon?: string;
}

export interface TeamMember {
  id: string;
  companyUserId: string;
  memberUserId?: string;
  email: string;
  fullName?: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'active' | 'removed';
  invitedAt: string;
  joinedAt?: string;
}

export interface DailyQuestion {
  id: string;
  user_id: string;
  question_text: string;
  question_category: string;
  options: DailyQuestionOption[];
  selected_value: string | null;
  generated_at: string;
  expires_at: string;
}
