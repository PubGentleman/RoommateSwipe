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
  hostId: string;
  hostName: string;
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
  recipientId: string;
  content: string;
  timestamp: Date;
  read: boolean;
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
