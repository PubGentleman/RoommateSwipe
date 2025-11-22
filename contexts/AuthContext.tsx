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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPlus: () => Promise<void>;
  upgradeToPriority: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  incrementMessageCount: () => Promise<void>;
  canSendMessage: () => boolean;
  activateBoost: () => Promise<{ success: boolean; message: string }>;
  canBoost: () => { canBoost: boolean; reason?: string };
  checkAndUpdateBoostStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      await StorageService.initializeWithMockData();
      let currentUser = await StorageService.getCurrentUser();
      if (currentUser) {
        if (currentUser.messageCount === undefined) {
          currentUser.messageCount = 0;
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
        
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, role: UserRole) => {
    const mockUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name: email.split('@')[0],
      role,
      subscription: {
        plan: 'basic',
        status: 'active',
      },
      messageCount: 0,
    };
    await StorageService.setCurrentUser(mockUser);
    await StorageService.addOrUpdateUser(mockUser);
    if (role === 'renter') {
      await StorageService.seedInitialMatches(mockUser.id);
    }
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
    };
    await StorageService.setCurrentUser(mockUser);
    await StorageService.addOrUpdateUser(mockUser);
    if (role === 'renter') {
      await StorageService.seedInitialMatches(mockUser.id);
    }
    setUser(mockUser);
  };

  const logout = async () => {
    await StorageService.clearUserData();
    await StorageService.clearSwipeHistory();
    setUser(null);
  };

  const upgradeToPlus = async () => {
    if (!user) return;
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'plus',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Plus:', updatedUser.subscription);
  };

  const upgradeToPriority = async () => {
    if (!user) return;
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'priority',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Priority:', updatedUser.subscription);
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

  const canBoost = (): { canBoost: boolean; reason?: string } => {
    if (!user) return { canBoost: false, reason: 'Not logged in' };
    
    const plan = user.subscription?.plan || 'basic';
    
    if (plan === 'basic') {
      return { canBoost: false, reason: 'Boost is available for Plus and Priority members only' };
    }
    
    if (user.boostData?.isBoosted && user.boostData.boostExpiresAt) {
      const now = new Date();
      if (user.boostData.boostExpiresAt > now) {
        return { canBoost: false, reason: 'Boost is already active' };
      }
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, upgradeToPlus, upgradeToPriority, updateUser, incrementMessageCount, canSendMessage, activateBoost, canBoost, checkAndUpdateBoostStatus }}>
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
