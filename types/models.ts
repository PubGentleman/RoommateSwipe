export interface RoommateProfile {
  id: string;
  name: string;
  age: number;
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
  photos: string[];
  amenities: string[];
  description: string;
  available: boolean;
  availableDate?: Date;
  hostId: string;
  hostName: string;
  featured?: boolean;
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
  budget: number;
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
  role: 'renter' | 'host' | 'agent';
  profilePicture?: string;
  subscription?: {
    plan: 'basic' | 'plus' | 'priority';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: Date;
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
}
