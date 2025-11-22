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
    plan: 'free' | 'premium';
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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
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
      const currentUser = await StorageService.getCurrentUser();
      if (currentUser) {
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
        plan: 'free',
        status: 'active',
      },
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
        plan: 'free',
        status: 'active',
      },
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

  const upgradeToPremium = async () => {
    if (!user) return;
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'premium',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, upgradeToPremium, updateUser }}>
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
