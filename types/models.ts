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
  preferredNeighborhoods?: string[];
  zip_code?: string;
  ideal_roommate_text?: string;
  pi_parsed_preferences?: PiParsedPreferences;
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
    preferred_neighborhoods?: string[];
    zip_code?: string;
    ideal_roommate_text?: string;
    pi_parsed_preferences?: PiParsedPreferences;
    desired_roommate_count?: number;
    desired_bedroom_count?: number;
    household_gender_preference?: GenderPreference;
    pi_auto_match_enabled?: boolean;
    pi_last_match_attempt?: string;
    listing_type_preference?: 'room' | 'entire_apartment' | 'any';
    apartment_search_type?: 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | null;
    [key: string]: any;
  };
  references?: Reference[];
  apartmentPrefs?: ApartmentPreferences;
  instagram_verified?: boolean;
  instagram_handle?: string;
  desired_roommate_count?: number;
  desired_bedroom_count?: number;
  household_gender_preference?: GenderPreference;
  pi_auto_match_enabled?: boolean;
  pi_last_match_attempt?: string;
  is_group_lead?: boolean;
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
  zip_code?: string;
}

export interface GroupApartmentVote {
  id: string;
  groupId: string;
  listingId: string;
  userId: string;
  vote: 'yes' | 'no' | 'maybe';
  createdAt: string;
}

export type HostPlanType = 'free' | 'none' | 'starter' | 'pro' | 'business' | 'enterprise' | 'agent_starter' | 'agent_pro' | 'agent_business' | 'company_starter' | 'company_pro' | 'company_enterprise';
export type AgentPlanType = 'pay_per_use' | 'starter' | 'pro' | 'business';
export type AgentGroupStatus = 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved';

export interface BoostCredits {
  quick: number;
  standard: number;
  extended: number;
}

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
  boostCredits?: BoostCredits;
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
  includesViewCount: boolean;
  includesTopPicks: boolean;
  includesAnalytics: boolean;
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
  listing_type?: 'room' | 'entire_apartment';
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
  zip_code?: string;
  average_rating?: number | null;
  review_count?: number;
  assigned_agent_id?: string;
  hostType?: 'individual' | 'company' | 'agent';
  host_badge?: 'rhome_select' | 'top_agent' | 'top_company' | null;
  preferred_tenant_gender?: 'any' | 'female_only' | 'male_only';
  isArchived?: boolean;
  archivedAt?: string;
}

export interface PropertyFilter {
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  amenities?: string[];
  availableFrom?: Date;
  listingTypes?: string[];
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
  isCouple?: boolean;
  partnerUserId?: string;
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
  last_renter_message_at?: string;
  last_agent_response_at?: string;
  response_status?: 'active' | 'delayed' | 'unresponsive' | 'critical';
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
  emailVerified?: boolean;
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
  brokerageName?: string;
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
  acceptAgentOffers?: boolean;
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
  piAdvisorData?: {
    questionsToday: number;
    lastResetDate: string;
  };
  piMatchingData?: {
    matchesToday: number;
    lastResetDate: string;
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
  freeMessageUnlockUsed?: boolean;
  freeMessageUnlockConversationId?: string;
  freeMessageUnlockUsedAt?: string;
  typeOnboardingComplete?: boolean;
  preferredNeighborhoods?: string[];
  preferredBedrooms?: number | null;
  amenityPreferences?: string[];
  niceToHaveAmenities?: string[];
  moveInTimeline?: string;
  zip_code?: string;
  ideal_roommate_text?: string;
  pi_parsed_preferences?: PiParsedPreferences;
  desired_roommate_count?: number;
  desired_bedroom_count?: number;
  household_gender_preference?: GenderPreference;
  pi_auto_match_enabled?: boolean;
  pi_last_match_attempt?: string;
  responseRate?: number;
  hostAvgRating?: number;
  hostReviewCount?: number;
  profileData?: {
    bio?: string;
    budget?: number;
    lookingFor?: 'room' | 'entire_apartment';
    listing_type_preference?: 'room' | 'entire_apartment' | 'any';
    apartment_search_type?: 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | null;
    location?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    preferred_neighborhoods?: string[];
    zip_code?: string;
    occupation?: string;
    interests?: string[];
    gender?: 'male' | 'female' | 'other';
    personalityAnswers?: Record<string, string>;
    ideal_roommate_text?: string;
    pi_parsed_preferences?: PiParsedPreferences;
    desired_roommate_count?: number;
    desired_bedroom_count?: number;
    household_gender_preference?: GenderPreference;
    pi_auto_match_enabled?: boolean;
    pi_last_match_attempt?: string;
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
    desired_roommate_count?: number;
    desired_bedroom_count?: number;
    household_gender_preference?: GenderPreference;
    pi_auto_match_enabled?: boolean;
  };
  personalityAnswers?: Record<string, string>;
  references?: Reference[];
  identity_verified?: boolean;
  identity_verified_at?: string;
  background_check_status?: 'none' | 'pending' | 'clear' | 'flagged';
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
  type: 'match' | 'message' | 'group_invite' | 'group_accepted' | 'group_complete' | 'group_match' | 'company_group_invite' | 'meetup_suggestion' | 'property_update' | 'property_rented' | 'application_status' | 'system' | 'super_like' | 'interest_received' | 'interest_accepted' | 'interest_passed' | 'interest_expired' | 'agent_invite' | 'ai_group_suggestion' | 'background_check' | 'activity_nudge' | 'movein_checkin' | 'pi_group_assembled' | 'pi_member_accepted' | 'pi_group_confirmed' | 'pi_member_declined' | 'pi_group_expired' | 'pi_replacement_found';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data?: {
    matchId?: string;
    conversationId?: string;
    groupId?: string;
    group_id?: string;
    propertyId?: string;
    applicationId?: string;
    interestCardId?: string;
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
    agentInviteId?: string;
    agentName?: string;
    listingId?: string;
    listing_id?: string;
    listingTitle?: string;
    listingRent?: number;
    bookingId?: string;
    companyId?: string;
    companyName?: string;
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

export interface PiParsedPreferences {
  vibe?: string;
  schedule_hints?: string[];
  social_style?: string;
  hard_nos?: string[];
  soft_preferences?: string[];
  personality_signals?: string[];
  cleanliness_hints?: string;
  noise_hints?: string;
  guest_hints?: string;
  budget_hints?: string;
  location_hints?: string[];
}

export interface PiMatchInsight {
  id: string;
  user_id: string;
  target_user_id: string;
  match_score?: number;
  summary: string;
  highlights: string[];
  warnings: string[];
  confidence: 'strong' | 'good' | 'moderate' | 'low';
  model_used?: string;
  generated_at: string;
  expires_at: string;
}

export interface PiDeckRanking {
  id: string;
  user_id: string;
  ranked_user_ids: string[];
  adjustments: Array<{
    user_id: string;
    reason: string;
    direction: 'up' | 'down';
  }>;
  model_used?: string;
  generated_at: string;
  expires_at: string;
  swiped_count: number;
}

export interface PiHostRecommendation {
  id: string;
  host_id: string;
  listing_id: string;
  recommendations: Array<{
    type: 'renter' | 'group';
    target_id: string;
    name: string;
    photo?: string;
    match_strength: 'strong' | 'good' | 'moderate';
    reason: string;
    suggested_action: string;
  }>;
  market_insight?: string;
  model_used?: string;
  generated_at: string;
  expires_at: string;
}

export type PiFeature = 'match_insight' | 'deck_rerank' | 'parse_preferences' | 'host_matchmaker' | 'auto_match';

export interface PiUsageLog {
  id: string;
  user_id: string;
  feature: PiFeature;
  tokens_used: number;
  model_used?: string;
  created_at: string;
}

export type GenderPreference = 'any' | 'male_only' | 'female_only' | 'same_gender';

export type PiAutoMatchStatus = 'forming' | 'pending_acceptance' | 'partial' | 'awaiting_replacement_vote' | 'ready' | 'invited' | 'claimed' | 'placed' | 'expired' | 'dissolved' | 'active';

export interface PiAutoGroup {
  id: string;
  status: PiAutoMatchStatus;
  match_score: number;
  member_count: number;
  max_members: number;
  desired_bedrooms: number;
  budget_min: number;
  budget_max: number;
  city?: string;
  state?: string;
  neighborhoods?: string[];
  gender_composition?: string;
  move_in_window_start?: string;
  move_in_window_end?: string;
  pi_rationale?: string;
  model_used?: string;
  created_at: string;
  ready_at?: string;
  expires_at?: string;
  acceptance_deadline?: string;
  open_to_requests?: boolean;
  is_preformed?: boolean;
  dissolved_at?: string;
  deadline_extended?: boolean;
  anchor_user_id?: string;
  amenity_preferences?: string[];
  location_preferences?: string[];
}

export interface PiAutoGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'member' | 'anchor';
  compatibility_score?: number;
  pi_reason?: string;
  invited_at: string;
  responded_at?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'left' | 'removed';
  reminder_sent?: boolean;
  is_replacement?: boolean;
  replacement_approved_by?: string[];
  replacement_passed_by?: string[];
  compatibility_with_group?: number;
  pi_member_insight?: string;
}

export interface PiGroupClaim {
  id: string;
  group_id: string;
  host_id: string;
  listing_id: string;
  status: 'pending' | 'accepted' | 'expired' | 'withdrawn';
  claim_price_cents: number;
  is_free_claim: boolean;
  message?: string;
  created_at: string;
  responded_at?: string;
  expires_at: string;
}

export interface PreformedGroup {
  id: string;
  name?: string;
  group_lead_id: string;
  group_size: number;
  status: 'forming' | 'ready' | 'searching' | 'applied' | 'placed';
  invite_code: string;
  city?: string;
  preferred_neighborhoods?: string[];
  combined_budget_min?: number;
  combined_budget_max?: number;
  desired_bedroom_count?: number;
  move_in_date?: string;
  created_at: string;
  converted_group_id?: string;
  open_to_requests?: boolean;
  needs_replacement?: boolean;
  replacement_slots?: number;
}

export interface PreformedGroupMember {
  id: string;
  preformed_group_id: string;
  user_id?: string;
  name: string;
  status: 'invited' | 'joined' | 'declined';
  invited_at: string;
  joined_at?: string;
  invite_link?: string;
}

export interface GroupShortlistItem {
  id: string;
  preformed_group_id: string;
  listing_id: string;
  added_by: string;
  notes?: string;
  vote_count: number;
  created_at: string;
  listing?: Property;
}

export interface GroupJoinRequest {
  id: string;
  pi_auto_group_id?: string;
  preformed_group_id?: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'declined' | 'expired' | 'withdrawn';
  compatibility_score?: number;
  pi_take?: string;
  approved_by?: string[];
  declined_by?: string[];
  decided_by?: string;
  created_at: string;
  decided_at?: string;
  expires_at?: string;
  requester_message?: string;
  requester?: User;
}

export interface OpenGroupListing {
  id: string;
  groupType: 'pi_auto' | 'preformed';
  groupName?: string;
  members: Array<{
    user_id: string;
    name: string;
    age?: number;
    photo?: string;
    occupation?: string;
  }>;
  spotsOpen: number;
  maxSize: number;
  compatibility?: number;
  piTake?: string;
  city?: string;
  neighborhoods?: string[];
  budgetMin?: number;
  budgetMax?: number;
  desiredBedrooms?: number;
  createdAt: string;
  needsReplacement?: boolean;
}
