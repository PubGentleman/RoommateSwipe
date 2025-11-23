export interface RoommateProfile {
  id: string;
  name: string;
  age: number;
  gender?: 'male' | 'female' | 'other';
  bio: string;
  occupation: string;
  budget: number;
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
  };
  compatibility?: number;
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

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: string[];
  pendingMembers: string[];
  maxMembers: number;
  budget: number; // Minimum monthly budget per person
  apartmentPrice?: number; // Total apartment price
  bedrooms?: number; // Number of bedrooms
  preferredLocation: string;
  createdAt: Date;
  createdBy: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId?: string;
  text?: string;
  content?: string;
  timestamp: Date;
  read?: boolean;
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
}

export interface Match {
  id: string;
  userId1: string;
  userId2: string;
  matchedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
  role: 'renter' | 'host' | 'agent';
  profilePicture?: string;
  subscription?: {
    plan: 'basic' | 'plus' | 'priority';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: Date;
    scheduledPlan?: 'basic' | 'plus' | 'priority';
    scheduledChangeDate?: Date;
  };
  paymentMethods?: Array<{
    id: string;
    type: 'card';
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  }>;
  messageCount?: number;
  boostData?: {
    boostsUsed: number;
    lastBoostDate?: Date;
    isBoosted: boolean;
    boostExpiresAt?: Date;
  };
  undoPassData?: {
    hasUndoPass: boolean;
    undoPassExpiresAt?: Date;
  };
  profileData?: {
    bio?: string;
    budget?: number;
    location?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    occupation?: string;
    interests?: string;
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
    };
  };
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'group_invite' | 'group_accepted' | 'property_update' | 'property_rented' | 'application_status' | 'system';
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
    fromUserId?: string;
    fromUserName?: string;
    fromUserPhoto?: string;
  };
}
