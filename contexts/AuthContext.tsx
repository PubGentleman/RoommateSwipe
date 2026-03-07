import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageService } from '../utils/storage';
import { User } from '../types/models';

export type UserRole = 'renter' | 'host' | 'agent';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  upgradeToPlus: () => Promise<void>;
  upgradeToElite: () => Promise<void>;
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
  canRewind: () => { canRewind: boolean; remaining: number; limit: number; message?: string };
  useRewind: () => Promise<void>;
  canSuperLike: () => { canSuperLike: boolean; remaining: number; limit: number; message?: string };
  useSuperLike: () => Promise<void>;
  getActiveChatLimit: () => number;
  canStartNewChat: (conversationId: string) => Promise<{ canStart: boolean; limit: number; current: number; reason?: string }>;
  incrementActiveChatCount: (conversationId: string) => Promise<void>;
  watchAdForCredit: (creditType: 'rewinds' | 'superLikes' | 'boosts' | 'messages') => Promise<{ success: boolean; message: string }>;
  getAdCredits: () => { rewinds: number; superLikes: number; boosts: number; messages: number };
  useAdCredit: (creditType: 'rewinds' | 'superLikes' | 'boosts' | 'messages') => Promise<boolean>;
  isBasicUser: () => boolean;
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
        password,
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
    } else {
      if (mockUser.password && mockUser.password !== password) {
        throw new Error('Invalid password');
      }
      
      let needsUpdate = false;
      if (!mockUser.password) {
        mockUser = {
          ...mockUser,
          password,
        };
        needsUpdate = true;
      }
      if (role === 'renter' && !mockUser.profileData?.city) {
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
        needsUpdate = true;
      }
      if (needsUpdate) {
        await StorageService.addOrUpdateUser(mockUser);
      }
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
      password,
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

  const upgradeToElite = async () => {
    if (!user) return;
    
    const expiresAt = user.subscription?.expiresAt 
      ? new Date(user.subscription.expiresAt) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'elite',
        status: 'active',
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
      },
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Elite:', updatedUser.subscription);
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
    
    // Sync photos, zodiacSign, and profile data with RoommateProfile if user is a renter
    if (updatedUser.role === 'renter' && (updates.photos || updates.zodiacSign !== undefined || updates.profileData)) {
      const roommateProfiles = await StorageService.getRoommateProfiles();
      const profileIndex = roommateProfiles.findIndex(p => p.id === updatedUser.id);
      
      if (profileIndex >= 0) {
        console.log('[Auth] Syncing User data with RoommateProfile for user:', updatedUser.id);
        const updatedProfile = {
          ...roommateProfiles[profileIndex],
          ...(updates.photos && { photos: updates.photos }),
          ...(updates.zodiacSign !== undefined && { zodiacSign: updates.zodiacSign }),
          ...(updates.profileData?.bio && { bio: updates.profileData.bio }),
          ...(updates.profileData?.budget && { budget: updates.profileData.budget }),
          ...(updates.profileData?.lookingFor !== undefined && { lookingFor: updates.profileData.lookingFor }),
          ...(updates.profileData?.occupation && { occupation: updates.profileData.occupation }),
          ...(updates.profileData?.location && { 
            preferences: {
              ...roommateProfiles[profileIndex].preferences,
              location: updates.profileData.location,
            }
          }),
        };
        roommateProfiles[profileIndex] = updatedProfile;
        await StorageService.setRoommateProfiles(roommateProfiles);
        console.log('[Auth] RoommateProfile synced');
      }
    }
    
    setUser(updatedUser);
  };

  const incrementMessageCount = async () => {
    if (!user) return;
    
    const currentCount = user.messageCount || 0;
    const plan = user.subscription?.plan || 'basic';

    if (plan === 'basic' && currentCount >= 50 && user.adCredits && user.adCredits.messages > 0) {
      const updatedUser: User = {
        ...user,
        messageCount: currentCount + 1,
        adCredits: {
          ...user.adCredits,
          messages: user.adCredits.messages - 1,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      setUser(updatedUser);
      console.log('[Auth] Ad credit message consumed. Remaining:', updatedUser.adCredits!.messages);
      return;
    }

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
    if (plan === 'plus' || plan === 'elite') {
      return true;
    }
    
    const messageCount = user.messageCount || 0;
    if (messageCount < 50) return true;

    if (user.adCredits && user.adCredits.messages > 0) {
      return true;
    }

    return false;
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
    
    if (plan === 'elite') {
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
    if (userPlan === 'plus' || userPlan === 'elite') {
      return true;
    }
    
    if (!user.undoPassData?.hasUndoPass) return false;
    
    const now = new Date();
    const expiresAt = user.undoPassData.undoPassExpiresAt 
      ? new Date(user.undoPassData.undoPassExpiresAt)
      : null;
    
    return expiresAt ? expiresAt > now : false;
  };

  const getActiveChatLimit = (): number => {
    if (!user) return 3;
    
    const userPlan = user.subscription?.plan || 'basic';
    const userStatus = user.subscription?.status || 'active';
    
    if (userStatus !== 'active') return 3;
    
    if (userPlan === 'elite') return Infinity;
    if (userPlan === 'plus') return 10;
    return 3;
  };

  const canStartNewChat = async (conversationId: string): Promise<{ canStart: boolean; limit: number; current: number; reason?: string }> => {
    if (!user) {
      return { canStart: false, limit: 3, current: 0, reason: 'Not logged in' };
    }

    const limit = getActiveChatLimit();
    
    if (limit === Infinity) {
      return { canStart: true, limit, current: user.activeChatsCount || 0 };
    }

    const conversations = await StorageService.getConversations();
    const activeChats = conversations.filter(conv => {
      if (!conv.messages || conv.messages.length === 0) return false;
      
      const userSentMessage = conv.messages.some(msg => msg.senderId === user.id);
      return userSentMessage;
    });

    const current = activeChats.length;
    const isCurrentChatActive = activeChats.some(conv => conv.id === conversationId);
    
    if (isCurrentChatActive || current < limit) {
      return { canStart: true, limit, current };
    }

    const userPlan = user.subscription?.plan || 'basic';
    const planName = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);
    return { 
      canStart: false, 
      limit, 
      current,
      reason: `You've reached your active chat limit (${current}/${limit}). Upgrade to ${userPlan === 'basic' ? 'Plus (10 chats)' : 'Elite (unlimited)'} for more!` 
    };
  };

  const incrementActiveChatCount = async (conversationId: string): Promise<void> => {
    if (!user) return;

    const conversations = await StorageService.getConversations();
    const activeChats = conversations.filter(conv => {
      if (!conv.messages || conv.messages.length === 0) return false;
      return conv.messages.some(msg => msg.senderId === user.id);
    });

    const newCount = activeChats.length;
    
    const updatedUser: User = {
      ...user,
      activeChatsCount: newCount,
    };
    
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    
    console.log('[Auth] Active chats updated:', newCount);
  };

  const canRewind = (): { canRewind: boolean; remaining: number; limit: number; message?: string } => {
    if (!user) {
      return { canRewind: false, remaining: 0, limit: 0, message: 'Not logged in' };
    }

    const userPlan = user.subscription?.plan || 'basic';
    const userStatus = user.subscription?.status || 'active';
    
    if (userPlan === 'elite' && userStatus === 'active') {
      return { canRewind: true, remaining: Infinity, limit: Infinity };
    }

    if (userPlan === 'plus' && userStatus === 'active') {
      const now = new Date();
      const lastReset = user.rewindData?.lastRewindReset 
        ? new Date(user.rewindData.lastRewindReset)
        : null;
      
      let rewindsUsed = user.rewindData?.rewindsUsedToday || 0;
      
      if (!lastReset || !isSameDay(lastReset, now)) {
        rewindsUsed = 0;
      }
      
      const limit = 5;
      const remaining = Math.max(0, limit - rewindsUsed);
      
      if (remaining > 0) {
        return { canRewind: true, remaining, limit };
      } else {
        return { 
          canRewind: false, 
          remaining: 0, 
          limit,
          message: 'Daily rewind limit reached (5/5). Upgrade to Elite for unlimited rewinds or wait until tomorrow!'
        };
      }
    }

    if (userPlan === 'basic') {
      const now = new Date();
      const lastReset = user.rewindData?.lastRewindReset 
        ? new Date(user.rewindData.lastRewindReset)
        : null;
      
      let rewindsUsed = user.rewindData?.rewindsUsedToday || 0;
      
      if (!lastReset || !isSameDay(lastReset, now)) {
        rewindsUsed = 0;
      }
      
      const limit = 1;
      const remaining = Math.max(0, limit - rewindsUsed);
      
      if (remaining > 0) {
        return { canRewind: true, remaining, limit };
      }

      if (user.undoPassData?.hasUndoPass) {
        const expiresAt = user.undoPassData.undoPassExpiresAt 
          ? new Date(user.undoPassData.undoPassExpiresAt)
          : null;
        
        if (expiresAt && expiresAt > now) {
          return { canRewind: true, remaining: 1, limit: 1 };
        }
      }

      if (user.adCredits && user.adCredits.rewinds > 0) {
        return { canRewind: true, remaining: user.adCredits.rewinds, limit };
      }

      return { 
        canRewind: false, 
        remaining: 0, 
        limit,
        message: 'Daily rewind used (1/1). Watch an ad, purchase a 24h undo pass, or upgrade to Plus (5 rewinds/day)!'
      };
    }

    return { 
      canRewind: false, 
      remaining: 0, 
      limit: 0,
      message: 'Rewind not available.'
    };
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const useRewind = async (): Promise<void> => {
    if (!user) return;

    const userPlan = user.subscription?.plan || 'basic';
    const userStatus = user.subscription?.status || 'active';
    
    if (userPlan === 'elite' && userStatus === 'active') {
      return;
    }

    if (userPlan === 'plus' && userStatus === 'active') {
      const now = new Date();
      const lastReset = user.rewindData?.lastRewindReset 
        ? new Date(user.rewindData.lastRewindReset)
        : null;
      
      let rewindsUsed = user.rewindData?.rewindsUsedToday || 0;
      
      if (!lastReset || !isSameDay(lastReset, now)) {
        rewindsUsed = 0;
      }
      
      const updatedUser: User = {
        ...user,
        rewindData: {
          rewindsUsedToday: rewindsUsed + 1,
          lastRewindReset: now,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      setUser(updatedUser);
      
      console.log('[Auth] Rewind used. Total today:', rewindsUsed + 1);
      return;
    }

    if (userPlan === 'basic') {
      const now = new Date();
      const lastReset = user.rewindData?.lastRewindReset 
        ? new Date(user.rewindData.lastRewindReset)
        : null;
      
      let rewindsUsed = user.rewindData?.rewindsUsedToday || 0;
      
      if (!lastReset || !isSameDay(lastReset, now)) {
        rewindsUsed = 0;
      }

      if (rewindsUsed < 1) {
        const updatedUser: User = {
          ...user,
          rewindData: {
            rewindsUsedToday: rewindsUsed + 1,
            lastRewindReset: now,
          },
        };
        
        await StorageService.setCurrentUser(updatedUser);
        await StorageService.addOrUpdateUser(updatedUser);
        setUser(updatedUser);
        
        console.log('[Auth] Free daily rewind used (Basic tier)');
        return;
      }

      if (user.undoPassData?.hasUndoPass) {
        await StorageService.consumeUndoPass(user.id);
        
        const updatedUser: User = {
          ...user,
          undoPassData: {
            hasUndoPass: false,
            undoPassExpiresAt: null as any,
          },
        };
        
        setUser(updatedUser);
        console.log('[Auth] 24h undo pass consumed');
        return;
      }

      if (user.adCredits && user.adCredits.rewinds > 0) {
        const updatedUser: User = {
          ...user,
          adCredits: {
            ...user.adCredits,
            rewinds: user.adCredits.rewinds - 1,
          },
        };
        
        await StorageService.setCurrentUser(updatedUser);
        await StorageService.addOrUpdateUser(updatedUser);
        setUser(updatedUser);
        console.log('[Auth] Ad credit rewind consumed. Remaining:', updatedUser.adCredits!.rewinds);
      }
    }
  };

  const canSuperLike = (): { canSuperLike: boolean; remaining: number; limit: number; message?: string } => {
    if (!user) {
      return { canSuperLike: false, remaining: 0, limit: 0, message: 'Not logged in' };
    }

    const userPlan = user.subscription?.plan || 'basic';
    const userStatus = user.subscription?.status || 'active';
    
    if (userPlan === 'elite' && userStatus === 'active') {
      return { canSuperLike: true, remaining: Infinity, limit: Infinity };
    }

    const now = new Date();
    const lastReset = user.superLikeData?.lastSuperLikeReset 
      ? new Date(user.superLikeData.lastSuperLikeReset)
      : null;
    
    let superLikesUsed = user.superLikeData?.superLikesUsedToday || 0;
    
    if (!lastReset || !isSameDay(lastReset, now)) {
      superLikesUsed = 0;
    }
    
    const limit = userPlan === 'plus' && userStatus === 'active' ? 3 : 1;
    const remaining = Math.max(0, limit - superLikesUsed);
    
    if (remaining > 0) {
      return { canSuperLike: true, remaining, limit };
    }

    if (userPlan === 'basic' && user.adCredits && user.adCredits.superLikes > 0) {
      return { canSuperLike: true, remaining: user.adCredits.superLikes, limit };
    }
    
    return { 
      canSuperLike: false, 
      remaining: 0, 
      limit,
      message: `You've used all ${limit} Super Like${limit > 1 ? 's' : ''} today. ${userPlan === 'basic' ? 'Watch an ad, upgrade to Plus for 3/day, or Elite for unlimited!' : 'Upgrade to Elite for unlimited!'}` 
    };
  };

  const useSuperLike = async (): Promise<void> => {
    if (!user) return;

    const userPlan = user.subscription?.plan || 'basic';
    const userStatus = user.subscription?.status || 'active';
    
    if (userPlan === 'elite' && userStatus === 'active') {
      return;
    }

    const now = new Date();
    const lastReset = user.superLikeData?.lastSuperLikeReset 
      ? new Date(user.superLikeData.lastSuperLikeReset)
      : null;
    
    let superLikesUsed = user.superLikeData?.superLikesUsedToday || 0;
    
    if (!lastReset || !isSameDay(lastReset, now)) {
      superLikesUsed = 0;
    }

    const dailyLimit = userPlan === 'plus' && userStatus === 'active' ? 3 : 1;

    if (superLikesUsed < dailyLimit) {
      const updatedUser: User = {
        ...user,
        superLikeData: {
          superLikesUsedToday: superLikesUsed + 1,
          lastSuperLikeReset: now,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      setUser(updatedUser);
      
      console.log('[Auth] Super Like used:', { plan: userPlan, used: superLikesUsed + 1, limit: dailyLimit });
      return;
    }

    if (userPlan === 'basic' && user.adCredits && user.adCredits.superLikes > 0) {
      const updatedUser: User = {
        ...user,
        adCredits: {
          ...user.adCredits,
          superLikes: user.adCredits.superLikes - 1,
        },
      };
      
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      setUser(updatedUser);
      
      console.log('[Auth] Ad credit super like consumed. Remaining:', updatedUser.adCredits!.superLikes);
    }
  };

  const isBasicUser = (): boolean => {
    const plan = user?.subscription?.plan || 'basic';
    const status = user?.subscription?.status || 'active';
    return plan === 'basic' || status !== 'active';
  };

  const getAdCredits = (): { rewinds: number; superLikes: number; boosts: number; messages: number } => {
    return {
      rewinds: user?.adCredits?.rewinds || 0,
      superLikes: user?.adCredits?.superLikes || 0,
      boosts: user?.adCredits?.boosts || 0,
      messages: user?.adCredits?.messages || 0,
    };
  };

  const watchAdForCredit = async (creditType: 'rewinds' | 'superLikes' | 'boosts' | 'messages'): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Not logged in' };

    if (!isBasicUser()) {
      return { success: false, message: 'Ad rewards are for Basic plan users only' };
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentCredits = user.adCredits || { rewinds: 0, superLikes: 0, boosts: 0, messages: 0, totalAdsWatched: 0 };
    
    const creditRewards: Record<string, number> = {
      rewinds: 1,
      superLikes: 1,
      boosts: 1,
      messages: 5,
    };

    const updatedCredits = {
      ...currentCredits,
      [creditType]: (currentCredits[creditType] || 0) + creditRewards[creditType],
      totalAdsWatched: (currentCredits.totalAdsWatched || 0) + 1,
      lastAdWatched: new Date(),
    };

    const updatedUser: User = {
      ...user,
      adCredits: updatedCredits,
    };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);

    const creditLabels: Record<string, string> = {
      rewinds: `${creditRewards.rewinds} Rewind`,
      superLikes: `${creditRewards.superLikes} Super Like`,
      boosts: `${creditRewards.boosts} Boost`,
      messages: `${creditRewards.messages} Messages`,
    };

    console.log('[Auth] Ad credit earned:', creditType, updatedCredits);
    return { success: true, message: `You earned ${creditLabels[creditType]}!` };
  };

  const useAdCredit = async (creditType: 'rewinds' | 'superLikes' | 'boosts' | 'messages'): Promise<boolean> => {
    if (!user) return false;
    
    const currentCredits = user.adCredits || { rewinds: 0, superLikes: 0, boosts: 0, messages: 0, totalAdsWatched: 0 };
    if ((currentCredits[creditType] || 0) <= 0) return false;

    const updatedCredits = {
      ...currentCredits,
      [creditType]: currentCredits[creditType] - 1,
    };

    const updatedUser: User = {
      ...user,
      adCredits: updatedCredits,
    };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);

    console.log('[Auth] Ad credit used:', creditType, updatedCredits);
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscription, reactivateSubscription, updateUser, incrementMessageCount, canSendMessage, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, purchaseUndoPass, hasActiveUndoPass, getActiveChatLimit, canStartNewChat, incrementActiveChatCount, canRewind, useRewind, canSuperLike, useSuperLike, watchAdForCredit, getAdCredits, useAdCredit, isBasicUser }}>
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
