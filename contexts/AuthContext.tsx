import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageService } from '../utils/storage';

export type UserRole = 'renter' | 'host' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
    age?: number;
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPlus: () => Promise<void>;
  upgradeToPriority: () => Promise<void>;
  downgradeToPlan: (plan: 'basic' | 'plus') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  incrementMessageCount: () => Promise<void>;
  canSendMessage: () => boolean;
  activateBoost: () => Promise<{ success: boolean; message: string }>;
  canBoost: () => { canBoost: boolean; reason?: string; requiresPayment?: boolean };
  checkAndUpdateBoostStatus: () => Promise<void>;
  purchaseBoost: () => Promise<{ success: boolean; message: string }>;
  purchaseUndoPass: () => Promise<{ success: boolean; message: string }>;
  hasActiveUndoPass: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const checkAndApplyScheduledChanges = async (user: User): Promise<User> => {
    if (!user.subscription?.scheduledPlan || !user.subscription?.scheduledChangeDate) {
      return user;
    }

    const now = new Date();
    const changeDate = user.subscription.scheduledChangeDate instanceof Date 
      ? user.subscription.scheduledChangeDate 
      : new Date(user.subscription.scheduledChangeDate);

    if (isNaN(changeDate.getTime())) {
      console.error('[Auth] Invalid scheduledChangeDate:', user.subscription.scheduledChangeDate);
      return user;
    }

    if (changeDate.getTime() <= now.getTime()) {
      const newExpiresAt = new Date(changeDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const updatedUser: User = {
        ...user,
        subscription: {
          plan: user.subscription.scheduledPlan,
          status: 'active',
          expiresAt: newExpiresAt,
          scheduledPlan: undefined,
          scheduledChangeDate: undefined,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      console.log(`[Auth] Applied scheduled change to ${updatedUser.subscription?.plan}, new expiry: ${newExpiresAt.toISOString()}`);
      
      return updatedUser;
    }

    return user;
  };

  const loadUser = async () => {
    try {
      await StorageService.initializeWithMockData();
      let currentUser = await StorageService.getCurrentUser();
      if (currentUser) {
        if (currentUser.messageCount === undefined) {
          currentUser.messageCount = 0;
        }
        
        if (currentUser.subscription) {
          currentUser.subscription = {
            ...currentUser.subscription,
            expiresAt: currentUser.subscription.expiresAt 
              ? new Date(currentUser.subscription.expiresAt) 
              : undefined,
            scheduledChangeDate: currentUser.subscription.scheduledChangeDate 
              ? new Date(currentUser.subscription.scheduledChangeDate) 
              : undefined,
          };
        }
        
        if (currentUser.boostData) {
          currentUser.boostData = {
            ...currentUser.boostData,
            lastBoostDate: currentUser.boostData.lastBoostDate 
              ? new Date(currentUser.boostData.lastBoostDate) 
              : undefined,
            boostExpiresAt: currentUser.boostData.boostExpiresAt 
              ? new Date(currentUser.boostData.boostExpiresAt) 
              : undefined,
          };
          
          if (currentUser.boostData.isBoosted && currentUser.boostData.boostExpiresAt) {
            const now = new Date();
            if (currentUser.boostData.boostExpiresAt <= now) {
              currentUser = {
                ...currentUser,
                boostData: {
                  ...currentUser.boostData,
                  isBoosted: false,
                },
              };
              await StorageService.setCurrentUser(currentUser);
              await StorageService.addOrUpdateUser(currentUser);
            }
          }
        }

        if (currentUser.role === 'renter' && !currentUser.profileData?.city) {
          currentUser = {
            ...currentUser,
            profileData: {
              ...currentUser.profileData,
              neighborhood: 'Williamsburg',
              city: 'New York',
              state: 'NY',
              coordinates: { lat: 40.7081, lng: -73.9571 },
            },
          };
          await StorageService.setCurrentUser(currentUser);
          await StorageService.addOrUpdateUser(currentUser);
        }

        currentUser = await checkAndApplyScheduledChanges(currentUser);
        
        await StorageService.seedMockNotifications(currentUser.id);
        
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, role: UserRole) => {
    const users = await StorageService.getUsers();
    let mockUser = users.find(u => u.email === email || u.email === email.replace('@example.com', '@email.com'));
    
    if (!mockUser) {
      mockUser = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name: email.split('@')[0],
        role,
        subscription: {
          plan: 'basic',
          status: 'active',
        },
        messageCount: 0,
        profileData: role === 'renter' ? {
          neighborhood: 'Williamsburg',
          city: 'New York',
          state: 'NY',
          coordinates: { lat: 40.7081, lng: -73.9571 },
        } : undefined,
      };
      await StorageService.addOrUpdateUser(mockUser);
    } else if (role === 'renter' && !mockUser.profileData?.city) {
      mockUser = {
        ...mockUser,
        profileData: {
          ...mockUser.profileData,
          neighborhood: 'Williamsburg',
          city: 'New York',
          state: 'NY',
          coordinates: { lat: 40.7081, lng: -73.9571 },
        },
      };
      await StorageService.addOrUpdateUser(mockUser);
    }
    
    await StorageService.setCurrentUser(mockUser);
    if (role === 'renter' && mockUser.id) {
      await StorageService.seedInitialMatches(mockUser.id);
    }
    await StorageService.seedMockNotifications(mockUser.id);
    setUser(mockUser);
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const mockUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      role,
      subscription: {
        plan: 'basic',
        status: 'active',
      },
      messageCount: 0,
      profileData: role === 'renter' ? {
        neighborhood: 'Williamsburg',
        city: 'New York',
        state: 'NY',
        coordinates: { lat: 40.7081, lng: -73.9571 },
      } : undefined,
    };
    await StorageService.setCurrentUser(mockUser);
    await StorageService.addOrUpdateUser(mockUser);
    if (role === 'renter') {
      await StorageService.seedInitialMatches(mockUser.id);
    }
    await StorageService.seedMockNotifications(mockUser.id);
    setUser(mockUser);
  };

  const logout = async () => {
    await StorageService.clearUserData();
    await StorageService.clearSwipeHistory();
    setUser(null);
  };

  const upgradeToPlus = async () => {
    if (!user) return;
    
    const expiresAt = user.subscription?.expiresAt 
      ? new Date(user.subscription.expiresAt) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'plus',
        status: 'active',
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Plus:', updatedUser.subscription);
  };

  const upgradeToPriority = async () => {
    if (!user) return;
    
    const expiresAt = user.subscription?.expiresAt 
      ? new Date(user.subscription.expiresAt) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'priority',
        status: 'active',
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Priority:', updatedUser.subscription);
  };

  const downgradeToPlan = async (targetPlan: 'basic' | 'plus') => {
    if (!user || !user.subscription) return;
    
    const currentPlan = user.subscription.plan;
    let expiresAt = user.subscription.expiresAt 
      ? new Date(user.subscription.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    if (!user.subscription.expiresAt) {
      const tempUser: User = {
        ...user,
        subscription: {
          ...user.subscription,
          expiresAt,
        },
      };
      await StorageService.setCurrentUser(tempUser);
      await StorageService.addOrUpdateUser(tempUser);
    }
    
    const updatedUser: User = {
      ...user,
      subscription: {
        ...user.subscription,
        expiresAt,
        scheduledPlan: targetPlan,
        scheduledChangeDate: expiresAt,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log(`[Auth] Scheduled downgrade from ${currentPlan} to ${targetPlan} on ${expiresAt}`);
  };

  const cancelSubscription = async () => {
    if (!user || !user.subscription) return;
    
    const currentPlan = user.subscription.plan;
    if (currentPlan === 'basic') {
      return;
    }
    
    let expiresAt = user.subscription.expiresAt 
      ? new Date(user.subscription.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    if (!user.subscription.expiresAt) {
      const tempUser: User = {
        ...user,
        subscription: {
          ...user.subscription,
          expiresAt,
        },
      };
      await StorageService.setCurrentUser(tempUser);
      await StorageService.addOrUpdateUser(tempUser);
    }
    
    const updatedUser: User = {
      ...user,
      subscription: {
        ...user.subscription,
        expiresAt,
        status: 'cancelled',
        scheduledPlan: 'basic',
        scheduledChangeDate: expiresAt,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log(`[Auth] Cancelled ${currentPlan} subscription. Access until ${expiresAt}`);
  };

  const reactivateSubscription = async () => {
    if (!user || !user.subscription) return;
    
    const updatedUser: User = {
      ...user,
      subscription: {
        ...user.subscription,
        status: 'active',
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log(`[Auth] Reactivated subscription for ${user.subscription.plan}`);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    
    const updatedUser: User = {
      ...user,
      ...updates,
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
  };

  const incrementMessageCount = async () => {
    if (!user) return;
    
    const currentCount = user.messageCount || 0;
    const updatedUser: User = {
      ...user,
      messageCount: currentCount + 1,
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
  };

  const canSendMessage = (): boolean => {
    if (!user) return false;
    
    const plan = user.subscription?.plan || 'basic';
    if (plan === 'plus' || plan === 'priority') {
      return true;
    }
    
    const messageCount = user.messageCount || 0;
    return messageCount < 50;
  };

  const canBoost = (): { canBoost: boolean; reason?: string; requiresPayment?: boolean } => {
    if (!user) return { canBoost: false, reason: 'Not logged in' };
    
    const plan = user.subscription?.plan || 'basic';
    
    if (user.boostData?.isBoosted && user.boostData.boostExpiresAt) {
      const now = new Date();
      if (user.boostData.boostExpiresAt > now) {
        return { canBoost: false, reason: 'Boost is already active' };
      }
    }
    
    if (plan === 'basic') {
      return { canBoost: true, requiresPayment: true };
    }
    
    if (plan === 'priority') {
      return { canBoost: true };
    }
    
    if (plan === 'plus') {
      const lastBoostDate = user.boostData?.lastBoostDate;
      if (lastBoostDate) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (lastBoostDate > weekAgo) {
          const nextBoostDate = new Date(lastBoostDate);
          nextBoostDate.setDate(nextBoostDate.getDate() + 7);
          return { 
            canBoost: false, 
            reason: `Next boost available on ${nextBoostDate.toLocaleDateString()}` 
          };
        }
      }
      return { canBoost: true };
    }
    
    return { canBoost: false };
  };

  const activateBoost = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not logged in' };
    }
    
    const boostCheck = canBoost();
    if (!boostCheck.canBoost) {
      return { success: false, message: boostCheck.reason || 'Cannot boost' };
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      boostData: {
        boostsUsed: (user.boostData?.boostsUsed || 0) + 1,
        lastBoostDate: now,
        isBoosted: true,
        boostExpiresAt: expiresAt,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    
    return { success: true, message: 'Boost activated! Your profile will be prioritized for 24 hours.' };
  };

  const purchaseBoost = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not logged in' };
    }

    if (!user.paymentMethods || user.paymentMethods.length === 0) {
      return { success: false, message: 'Please add a payment method first' };
    }

    const boostCheck = canBoost();
    if (!boostCheck.canBoost) {
      return { success: false, message: boostCheck.reason || 'Cannot purchase boost' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      boostData: {
        boostsUsed: (user.boostData?.boostsUsed || 0) + 1,
        lastBoostDate: now,
        isBoosted: true,
        boostExpiresAt: expiresAt,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    
    return { success: true, message: 'Boost purchased and activated! Your profile will be prioritized for 24 hours.' };
  };

  const checkAndUpdateBoostStatus = async () => {
    if (!user || !user.boostData?.isBoosted) return;
    
    const now = new Date();
    const expiresAt = user.boostData.boostExpiresAt 
      ? new Date(user.boostData.boostExpiresAt)
      : null;
    
    if (expiresAt && expiresAt <= now) {
      const updatedUser: User = {
        ...user,
        boostData: {
          ...user.boostData,
          lastBoostDate: user.boostData.lastBoostDate 
            ? new Date(user.boostData.lastBoostDate)
            : undefined,
          boostExpiresAt: expiresAt,
          isBoosted: false,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      setUser(updatedUser);
    }
  };

  const purchaseUndoPass = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not logged in' };
    }

    if (!user.paymentMethods || user.paymentMethods.length === 0) {
      return { success: false, message: 'Please add a payment method first' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      undoPassData: {
        hasUndoPass: true,
        undoPassExpiresAt: expiresAt,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    
    return { success: true, message: 'Undo Pass activated! You can now undo swipes for 24 hours.' };
  };

  const hasActiveUndoPass = (): boolean => {
    if (!user) return false;
    
    const userPlan = user.subscription?.plan || 'basic';
    if (userPlan === 'plus' || userPlan === 'priority') {
      return true;
    }
    
    if (!user.undoPassData?.hasUndoPass) return false;
    
    const now = new Date();
    const expiresAt = user.undoPassData.undoPassExpiresAt 
      ? new Date(user.undoPassData.undoPassExpiresAt)
      : null;
    
    return expiresAt ? expiresAt > now : false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, upgradeToPlus, upgradeToPriority, downgradeToPlan, cancelSubscription, reactivateSubscription, updateUser, incrementMessageCount, canSendMessage, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, purchaseUndoPass, hasActiveUndoPass }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
