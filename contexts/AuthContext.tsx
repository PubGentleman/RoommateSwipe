import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../utils/storage';
import { getDailyColdMessageLimit, getDailyColdMessageCount } from '../utils/messagingUtils';
import { User, Notification, TeamMember } from '../types/models';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { activateBoost as boostServiceActivateBoost, deactivateExpiredBoosts } from '../services/boostService';
import { getAgentPlanLimits, getAgentListingLimitMessage, type AgentPlan } from '../constants/planLimits';
import { identifyUser as rcIdentifyUser, logoutRevenueCat as rcLogout } from '../lib/revenueCat';
import { setSentryUser, clearSentryUser } from '../lib/sentry';
import { processReferralCommission } from '../services/affiliateService';
import { registerForPushNotifications, removePushToken } from '../services/pushNotificationService';
import { createErrorHandler } from '../utils/errorLogger';
import { navigationRef } from '../navigation/navigationRef';
import { withTimeout } from '../utils/asyncHelpers';

export type UserRole = 'renter' | 'host';

export function getInitialRoute(user: User): 'HostTabs' | 'RenterTabs' {
  if (user.hostType === 'agent' || user.hostType === 'company') {
    return 'HostTabs';
  }
  if (user.role === 'host') {
    const mode = user.activeMode ?? 'host';
    return mode === 'renter' ? 'RenterTabs' : 'HostTabs';
  }
  return 'RenterTabs';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole, hostType?: 'individual' | 'agent' | 'company' | null, companyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  abandonSignup: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  passwordRecoveryMode: boolean;
  clearPasswordRecovery: () => void;
  upgradeToPlus: (billingCycle?: 'monthly' | '3month' | 'annual', stripeSubscriptionId?: string) => Promise<void>;
  upgradeToElite: (billingCycle?: 'monthly' | '3month' | 'annual', stripeSubscriptionId?: string) => Promise<void>;
  downgradeToPlan: (plan: 'basic' | 'plus') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  cancelSubscriptionAtPeriodEnd: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  getSubscriptionDetails: () => { nextRenewalDate: string; renewalAmount: number; billingCycle: string; billingHistory: Array<{ date: string; amount: number; description: string }> };
  updateUser: (updates: Partial<User>) => Promise<void>;
  blockUser: (blockedUserId: string) => Promise<void>;
  unblockUser: (blockedUserId: string) => Promise<void>;
  reportUser: (reportedUserId: string, reason: string) => Promise<void>;
  isUserBlocked: (otherUserId: string) => boolean;
  incrementMessageCount: () => Promise<void>;
  canSendMessage: () => boolean;
  activateBoost: (durationHours?: number) => Promise<{ success: boolean; message: string }>;
  canBoost: () => { canBoost: boolean; reason?: string; requiresPayment?: boolean; nextAvailableAt?: string; hasFreeBoost?: boolean };
  checkAndUpdateBoostStatus: () => Promise<void>;
  purchaseBoost: (price?: number, durationHours?: number) => Promise<{ success: boolean; message: string }>;
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
  isPlaceSeeker: () => boolean;
  canViewListing: () => { canView: boolean; remaining: number; limit: number; message?: string };
  useListingView: () => Promise<void>;
  canSendInterest: () => Promise<{ canSend: boolean; remaining: number; reason?: string }>;
  canSendSuperInterest: () => { canSend: boolean; remaining: number; reason?: string };
  useSuperInterestCredit: () => Promise<void>;
  canSendColdMessage: () => Promise<{ canSend: boolean; remaining: number; reason?: string }>;
  useColdMessage: () => Promise<void>;
  canAskPi: (mode: 'general' | 'listing_advisor' | 'price_analysis' | 'photo_analysis' | 'compatibility') => { canAsk: boolean; remaining: number; limit: number; message?: string };
  incrementPiUsage: (mode: 'listing_advisor' | 'price_analysis' | 'photo_analysis' | 'compatibility') => Promise<void>;
  getSuperInterestCount: () => number;
  upgradeHostPlan: (plan: string, billingCycle?: 'monthly' | '3month' | 'annual') => Promise<void>;
  downgradeHostPlan: (plan: string) => Promise<void>;
  getHostPlan: () => string;
  canAddListing: (currentCount: number) => { allowed: boolean; limit: number; reason?: string };
  canRespondToInquiry: () => Promise<{ allowed: boolean; remaining: number; limit: number; reason?: string }>;
  useInquiryResponse: () => Promise<void>;
  purchaseListingBoost: (propertyId: string) => Promise<{ success: boolean; message: string }>;
  purchaseHostVerification: () => Promise<{ success: boolean; message: string }>;
  purchaseSuperInterest: () => Promise<{ success: boolean; message: string }>;
  completeOnboardingStep: (step: 'profile' | 'hostType' | 'plan' | 'complete') => Promise<void>;
  cancelHostSubscriptionAtPeriodEnd: () => Promise<void>;
  reactivateHostSubscription: () => Promise<void>;
  softDeleteAccount: () => Promise<void>;
  recoverDeletedAccount: () => Promise<void>;
  updateLastActive: () => Promise<void>;
  activeMode: 'renter' | 'host';
  canSwitchMode: boolean;
  isFirstTimeHost: boolean;
  switchMode: (mode: 'renter' | 'host') => Promise<void>;
  completeHostOnboarding: () => Promise<void>;
  getTeamMembers: () => Promise<TeamMember[]>;
  inviteTeamMember: (email: string, name: string, role: 'admin' | 'member' | 'agent', agentLicenseNumber?: string) => Promise<void>;
  resendTeamInvite: (member: TeamMember) => Promise<void>;
  removeTeamMember: (memberId: string) => Promise<void>;
  updateTeamMemberRole: (memberId: string, role: 'admin' | 'member' | 'agent') => Promise<void>;
  getTeamSeatLimit: () => number;
  teamRole: 'owner' | 'admin' | 'member' | 'agent' | null;
  canInviteMembers: boolean;
  canManageBilling: boolean;
  canDeleteListings: boolean;
  canRespondToInquiries: boolean;
  refreshSession: (session: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    loadUser().finally(() => {
      initialLoadDoneRef.current = true;
    });

    if (!isSupabaseConfigured) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
          if (!initialLoadDoneRef.current) return;
          await loadUserFromSupabase(session);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecoveryMode(true);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      registerForPushNotifications(user.id).catch((e) =>
        console.warn('[Auth] Push registration failed:', e)
      );
    }
  }, [user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkAndUpdateBoostStatus();
        updateLastActive();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [user]);

  const checkAndApplyScheduledChanges = async (user: User): Promise<User> => {
    let updated = { ...user };
    const now = new Date();

    if (user.subscription?.scheduledPlan && user.subscription?.scheduledChangeDate) {
      const changeDate = new Date(user.subscription.scheduledChangeDate);
      if (!isNaN(changeDate.getTime()) && changeDate.getTime() <= now.getTime()) {
        const newExpiresAt = new Date(changeDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        updated = {
          ...updated,
          subscription: {
            plan: user.subscription.scheduledPlan,
            status: 'active',
            expiresAt: newExpiresAt,
            scheduledPlan: undefined,
            scheduledChangeDate: undefined,
          },
        };
        console.log(`[Auth] Applied renter scheduled change to ${updated.subscription?.plan}`);
      }
    }

    if (user.hostSubscription?.scheduledPlan && user.hostSubscription?.scheduledChangeDate) {
      const changeDate = new Date(user.hostSubscription.scheduledChangeDate);
      if (!isNaN(changeDate.getTime()) && changeDate.getTime() <= now.getTime()) {
        updated = {
          ...updated,
          hostSubscription: {
            plan: user.hostSubscription.scheduledPlan,
            status: 'active',
            expiresAt: new Date(changeDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            scheduledPlan: undefined,
            scheduledChangeDate: undefined,
            billingCycle: user.hostSubscription.billingCycle || 'monthly',
            inquiryResponsesUsed: 0,
            lastInquiryResetDate: now.toISOString(),
          },
        };
        console.log(`[Auth] Applied host scheduled change to ${updated.hostSubscription?.plan}`);
      }
    }

    if (updated !== user) {
      await StorageService.setCurrentUser(updated);
      await StorageService.addOrUpdateUser(updated);
    }
    return updated;
  };

  const normalizeCoordinates = (coords: any): { lat: number; lng: number } | undefined => {
    if (!coords) return undefined;
    if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      return { lat: coords.lat, lng: coords.lng };
    }
    if (typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      return { lat: coords.latitude, lng: coords.longitude };
    }
    return undefined;
  };

  const mapSupabaseToUser = (supabaseUser: any, profile: any, subscription: any): User => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.full_name || supabaseUser.email?.split('@')[0] || '',
      firstName: supabaseUser.first_name || undefined,
      lastName: supabaseUser.last_name || undefined,
      role: supabaseUser.role || 'renter',
      onboardingStep: supabaseUser.onboarding_step || 'profile',
      profilePicture: supabaseUser.avatar_url,
      age: supabaseUser.age,
      birthday: supabaseUser.birthday,
      zodiacSign: supabaseUser.zodiac_sign,
      subscription: {
        plan: subscription?.plan || 'basic',
        status: subscription?.status || 'active',
        expiresAt: subscription?.current_period_end || undefined,
        billingCycle: subscription?.billing_cycle || 'monthly',
        billingHistory: [],
      },
      hostSubscription: (supabaseUser.role === 'host' || supabaseUser.host_type) ? {
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'active',
        billingCycle: subscription?.billing_cycle || 'monthly',
        inquiryResponsesUsed: 0,
      } : undefined,
      profileData: profile ? {
        bio: supabaseUser.bio,
        budget: profile.budget_max,
        budgetMin: profile.budget_min,
        budgetMax: profile.budget_max,
        lookingFor: profile.looking_for,
        location: supabaseUser.location,
        neighborhood: supabaseUser.neighborhood,
        city: supabaseUser.city,
        state: supabaseUser.state,
        coordinates: normalizeCoordinates(profile.coordinates),
        occupation: supabaseUser.occupation,
        interests: profile.interests,
        gender: supabaseUser.gender,
        photos: profile.photos,
        preferences: {
          sleepSchedule: profile.sleep_schedule,
          cleanliness: profile.cleanliness,
          noiseTolerance: profile.noise_tolerance,
          smoking: profile.smoking,
          pets: profile.pets,
          drinking: profile.drinking,
          guests: profile.guests,
          wakeTime: profile.wake_time,
          sleepTime: profile.sleep_time,
          privateBathroom: profile.private_bathroom,
          bathrooms: profile.bathrooms,
        },
        moveInDate: profile.move_in_date,
        roomType: profile.room_type,
        leaseDuration: profile.lease_duration,
        profileNote: profile.profile_note || undefined,
        max_roommates: profile.max_roommates ?? undefined,
        instagram_verified: profile.instagram_verified || false,
        instagram_handle: profile.instagram_handle || undefined,
        listing_type_preference: profile.listing_type_preference || supabaseUser.listing_type_preference || 'any',
        apartment_search_type: supabaseUser.apartment_search_type || profile.apartment_search_type || null,
      } : {
        bio: supabaseUser.bio || undefined,
        occupation: supabaseUser.occupation || undefined,
        neighborhood: supabaseUser.neighborhood || 'Williamsburg',
        city: supabaseUser.city || 'New York',
        state: supabaseUser.state || 'NY',
        coordinates: { lat: 40.7081, lng: -73.9571 },
        apartment_search_type: null,
        listing_type_preference: 'any',
      },
      messageCount: 0,
      photos: profile?.photos || [],
      verification: (() => {
        const existing = supabaseUser.verification || {};
        return {
          ...existing,
          government_id: supabaseUser.identity_verified
            ? { verified: true, verifiedAt: supabaseUser.identity_verified_at, provider: 'stripe_identity' }
            : existing?.government_id || { verified: false },
          background_check: supabaseUser.background_check_status
            ? {
                verified: supabaseUser.background_check_status === 'clear',
                status: supabaseUser.background_check_status,
                initiatedAt: supabaseUser.background_check_initiated_at,
              }
            : existing?.background_check,
        };
      })(),
      acceptAgentOffers: supabaseUser.accept_agent_offers ?? true,
      privacySettings: supabaseUser.privacy_settings || undefined,
      hostType: supabaseUser.host_type || undefined,
      companyName: supabaseUser.company_name || undefined,
      licenseNumber: supabaseUser.license_number || undefined,
      licenseState: supabaseUser.license_state || undefined,
      licenseDocumentUrl: supabaseUser.license_document_url || undefined,
      licenseVerified: supabaseUser.license_verified || false,
      licenseVerifiedAt: supabaseUser.license_verified_at || undefined,
      licenseVerificationStatus: supabaseUser.license_verification_status || 'unverified',
      agencyName: supabaseUser.agency_name || undefined,
      unitsManaged: supabaseUser.units_managed || undefined,
      verifiedBusiness: supabaseUser.verified_business || false,
      avgResponseHours: supabaseUser.avg_response_hours || undefined,
      hostTypeLockedAt: supabaseUser.host_type_locked_at || undefined,
      hostTypeChangeRequested: supabaseUser.host_type_change_requested || false,
      activeMode: profile?.active_mode || 'renter',
      hasCompletedHostOnboarding: profile?.has_completed_host_onboarding || false,
      agentPlan: supabaseUser.agent_plan || 'pay_per_use',
      freeMessageUnlockUsed: supabaseUser.free_message_unlock_used || false,
      freeMessageUnlockConversationId: supabaseUser.free_message_unlock_conversation_id || undefined,
      freeMessageUnlockUsedAt: supabaseUser.free_message_unlock_used_at || undefined,
      typeOnboardingComplete: supabaseUser.type_onboarding_complete || false,
      preferred_neighborhoods: supabaseUser.preferred_neighborhoods || [],
      preferredBedrooms: supabaseUser.preferred_bedrooms ?? null,
      amenityPreferences: supabaseUser.amenity_preferences || [],
      niceToHaveAmenities: supabaseUser.nice_to_have_amenities || [],
      moveInTimeline: supabaseUser.move_in_timeline || undefined,
      zip_code: profile?.zip_code || supabaseUser.zip_code || undefined,
      ideal_roommate_text: profile?.ideal_roommate_text || undefined,
      pi_parsed_preferences: profile?.pi_parsed_preferences || undefined,
      desired_roommate_count: profile?.desired_roommate_count ?? undefined,
      desired_bedroom_count: profile?.desired_bedroom_count ?? undefined,
      household_gender_preference: profile?.household_gender_preference || undefined,
      pi_auto_match_enabled: profile?.pi_auto_match_enabled ?? undefined,
      pi_last_match_attempt: profile?.pi_last_match_attempt || undefined,
      createdAt: supabaseUser.created_at || undefined,
      responseRate: supabaseUser.response_rate ?? undefined,
      emailVerified: false,
    };
  };

  const loadUserFromSupabase = async (session: Session | null) => {
    try {
      if (!session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const [userResult, profileResult, subscriptionResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', session.user.id).single(),
        supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('user_id', session.user.id).maybeSingle(),
      ]);

      const userData = userResult.data;

      if (!userData) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const profileData = profileResult.data;
      const subscriptionData = subscriptionResult.data;

      if (userData.onboarding_step === 'abandoned') {
        await supabase.from('users').update({ onboarding_step: 'profile' }).eq('id', session.user.id);
        userData.onboarding_step = 'profile';
      }

      const authMeta = session.user.user_metadata || {};
      if (!userData.host_type && authMeta.host_type) {
        userData.host_type = authMeta.host_type;
        try {
          const patch: Record<string, any> = { host_type: authMeta.host_type };
          if (authMeta.company_name) patch.company_name = authMeta.company_name;
          if (authMeta.first_name) patch.first_name = authMeta.first_name;
          if (authMeta.last_name) patch.last_name = authMeta.last_name;
          if (userData.onboarding_step === 'hostType') {
            patch.onboarding_step = 'plan';
            userData.onboarding_step = 'plan';
          }
          await supabase.from('users').update(patch).eq('id', session.user.id);
        } catch (e) {
          console.warn('[Auth] Failed to patch host_type from auth metadata:', e);
        }
      }

      let mappedUser = mapSupabaseToUser(userData, profileData, subscriptionData);
      mappedUser = await checkAndApplyScheduledChanges(mappedUser);
      mappedUser.lastActiveAt = new Date();
      mappedUser.emailVerified = !!session.user.email_confirmed_at;

      if (mappedUser.role === 'renter' && mappedUser.onboardingStep === 'profile') {
        mappedUser.onboardingStep = 'complete';
        supabase.from('users').update({ onboarding_step: 'complete' }).eq('id', session.user.id).catch(createErrorHandler('AuthContext', 'updateOnboardingStep'));
      }

      if (userData.is_deleted) {
        const deletedAt = userData.deleted_at ? new Date(userData.deleted_at) : null;
        const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
        const isWithinRecoveryWindow = !deletedAt || (Date.now() - deletedAt.getTime() < RECOVERY_WINDOW_MS);

        if (isWithinRecoveryWindow) {
          mappedUser.isDeleted = false;
          mappedUser.deletedAt = undefined;
          try {
            await supabase.from('users').update({ is_deleted: false, deleted_at: null, last_active_at: new Date().toISOString() }).eq('id', session.user.id);
          } catch (e) {}
          console.log('[Auth] Recovered previously deleted account (within 30-day window)');
        } else {
          console.log('[Auth] Account deletion is past 30-day recovery window — cannot recover');
          await supabase.auth.signOut();
          setUser(null);
          setIsLoading(false);
          return;
        }
      } else {
        supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', session.user.id).then(() => {}).catch(createErrorHandler('AuthContext', 'updateLastActive'));
      }

      const localUser = await StorageService.getCurrentUser();

      if (localUser?.id === mappedUser.id) {
        const supabasePlan = mappedUser.hostSubscription?.plan;
        const supabaseBase = (supabasePlan || '').replace(/^(agent_|company_)/, '');
        const needsRestore = !supabaseBase || supabaseBase === 'free' || supabaseBase === 'basic' || supabaseBase === 'pay_per_use';

        if (needsRestore) {
          let restoredFromLocal = false;
          if (localUser.hostSubscription && localUser.hostSubscription.plan && localUser.hostSubscription.plan !== 'free') {
            const localBase = (localUser.hostSubscription.plan || '').replace(/^(agent_|company_)/, '');
            if (localBase && localBase !== 'free' && localBase !== 'basic' && localBase !== 'pay_per_use') {
              mappedUser = {
                ...mappedUser,
                hostSubscription: localUser.hostSubscription,
                agentPlan: localUser.agentPlan || mappedUser.agentPlan,
              };
              if ('companyPlan' in localUser && localUser.companyPlan) {
                (mappedUser as User & { companyPlan?: string }).companyPlan = localUser.companyPlan as string;
              }
              console.log(`[Auth] Restored host plan from local user: ${localUser.hostSubscription.plan}`);
              restoredFromLocal = true;
            }
          }

          if (!restoredFromLocal && mappedUser.hostType) {
            try {
              const savedHostSub = await StorageService.getHostSubscription(mappedUser.id);
              if (savedHostSub && savedHostSub.plan) {
                const savedBase = (savedHostSub.plan || '').replace(/^(agent_|company_)/, '');
                if (savedBase && savedBase !== 'free' && savedBase !== 'basic' && savedBase !== 'pay_per_use') {
                  mappedUser = {
                    ...mappedUser,
                    hostSubscription: { ...mappedUser.hostSubscription, ...savedHostSub },
                    agentPlan: mappedUser.hostType === 'agent' ? savedHostSub.plan : mappedUser.agentPlan,
                  };
                  if (mappedUser.hostType === 'company') {
                    (mappedUser as User & { companyPlan?: string }).companyPlan = savedBase;
                  }
                  console.log(`[Auth] Restored host plan from HOST_SUBSCRIPTIONS: ${savedHostSub.plan}`);
                }
              }
            } catch (e) { console.warn('[Auth] Failed to restore host subscription:', e); }
          }
        }
      }

      if (mappedUser.profileData) {
        const intentOverrides: Record<string, string> = {};

        if (localUser?.id === mappedUser.id && localUser?.profileData) {
          if (!mappedUser.profileData.apartment_search_type && localUser.profileData.apartment_search_type) {
            intentOverrides.apartment_search_type = localUser.profileData.apartment_search_type;
          }
          if (!mappedUser.profileData.listing_type_preference && localUser.profileData.listing_type_preference) {
            intentOverrides.listing_type_preference = localUser.profileData.listing_type_preference;
          }
        }

        if (!intentOverrides.apartment_search_type) {
          try {
            const savedIntent = await AsyncStorage.getItem('@rhome/renter_intent');
            if (savedIntent) {
              const parsed = JSON.parse(savedIntent);
              if (!mappedUser.profileData.apartment_search_type && parsed.apartment_search_type) {
                intentOverrides.apartment_search_type = parsed.apartment_search_type;
              }
              if (!mappedUser.profileData.listing_type_preference && parsed.listing_type_preference) {
                intentOverrides.listing_type_preference = parsed.listing_type_preference;
              }
            }
          } catch (e) { console.warn('[Auth] Failed to parse renter intent:', e); }
        }

        if (Object.keys(intentOverrides).length > 0) {
          mappedUser = {
            ...mappedUser,
            profileData: { ...mappedUser.profileData, ...intentOverrides },
          };

          if (session?.user?.id) {
            Promise.allSettled([
              supabase.from('users').update(intentOverrides).eq('id', session.user.id),
              supabase.from('profiles').update(intentOverrides).eq('user_id', session.user.id),
            ]).then((results) => {
              const usersOk = results[0].status === 'fulfilled' && !results[0].value.error;
              const profilesOk = results[1].status === 'fulfilled' && !results[1].value.error;
              if (!usersOk && !profilesOk) {
                console.warn('[Auth] Failed to sync intent overrides to both tables');
              } else {
                console.log('[Auth] Synced intent overrides:', { usersOk, profilesOk, keys: Object.keys(intentOverrides) });
              }
            });
          }
        }
      }

      setUser(mappedUser);

      StorageService.setCurrentUser(mappedUser).catch(createErrorHandler('AuthContext', 'setCurrentUser'));
      StorageService.addOrUpdateUser(mappedUser).catch(createErrorHandler('AuthContext', 'addOrUpdateUser'));

      rcIdentifyUser(mappedUser.id).catch(createErrorHandler('AuthContext', 'rcIdentifyUser'));

      StorageService.seedUserSpecificMockData(mappedUser.id, mappedUser.name, mappedUser.role, mappedUser.hostType).catch(createErrorHandler('AuthContext', 'seedUserSpecificMockData'));
    } catch (error) {
      console.error('Error loading user from Supabase:', error);
      try {
        await StorageService.initializeWithMockData();
        const fallbackUser = await StorageService.getCurrentUser();
        if (fallbackUser) {
          StorageService.seedUserSpecificMockData(fallbackUser.id, fallbackUser.name, fallbackUser.role, fallbackUser.hostType).catch(createErrorHandler('AuthContext', 'seedUserSpecificMockData'));
          if (fallbackUser.hostType === 'agent' && !fallbackUser.licenseNumber) {
            fallbackUser.licenseNumber = 'NY-10987654';
            fallbackUser.agencyName = 'Premier Realty Group';
            fallbackUser.licenseState = 'NY';
            await StorageService.setCurrentUser(fallbackUser);
          }

          if (fallbackUser.profileData && !fallbackUser.profileData.apartment_search_type) {
            try {
              const savedIntent = await AsyncStorage.getItem('@rhome/renter_intent');
              if (savedIntent) {
                const parsed = JSON.parse(savedIntent);
                if (parsed.apartment_search_type) {
                  fallbackUser.profileData = {
                    ...fallbackUser.profileData,
                    apartment_search_type: parsed.apartment_search_type,
                    listing_type_preference: parsed.listing_type_preference || fallbackUser.profileData.listing_type_preference,
                  };
                  await StorageService.setCurrentUser(fallbackUser);
                }
              }
            } catch (_) {}
          }

          fallbackUser.emailVerified = true;
          setUser(fallbackUser);
        }
      } catch {
        console.error('Fallback to local storage also failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserFromStorage = async () => {
    const [, currentUser] = await Promise.all([
      StorageService.initializeWithMockData(),
      StorageService.getCurrentUser(),
    ]);
    if (currentUser && currentUser.profileData && !currentUser.profileData.apartment_search_type) {
      try {
        const savedIntentRaw = await AsyncStorage.getItem('@rhome/renter_intent');
        if (savedIntentRaw) {
          const parsed = JSON.parse(savedIntentRaw);
          if (parsed.apartment_search_type) {
            currentUser.profileData.apartment_search_type = parsed.apartment_search_type;
          }
          if (parsed.listing_type_preference) {
            currentUser.profileData.listing_type_preference = parsed.listing_type_preference;
          }
        }
      } catch (e) { console.warn('[Auth] Failed to restore renter intent:', e); }
    }
    if (currentUser?.profileData?.apartment_search_type) {
      await StorageService.setCurrentUser(currentUser);
    }
    if (currentUser) {
      if (currentUser.hostType && currentUser.id) {
        try {
          const savedHostSub = await StorageService.getHostSubscription(currentUser.id);
          if (savedHostSub && savedHostSub.plan && savedHostSub.plan !== 'free') {
            const currentPlan = currentUser.hostSubscription?.plan || '';
            const currentBase = currentPlan.replace(/^(agent_|company_)/, '');
            const savedBase = (savedHostSub.plan || '').replace(/^(agent_|company_)/, '');
            if (!currentBase || currentBase === 'free' || currentBase === 'basic' || currentBase === 'pay_per_use') {
              currentUser.hostSubscription = { ...currentUser.hostSubscription, ...savedHostSub };
              if (currentUser.hostType === 'agent') {
                currentUser.agentPlan = savedBase || currentUser.agentPlan;
              }
              if (currentUser.hostType === 'company') {
                (currentUser as User & { companyPlan?: string }).companyPlan = savedBase || (currentUser as User & { companyPlan?: string }).companyPlan;
              }
              await StorageService.setCurrentUser(currentUser);
              console.log(`[Auth] Restored host plan from HOST_SUBSCRIPTIONS: ${savedHostSub.plan}`);
            }
          }
        } catch (e) { console.warn('[Auth] Failed to restore host subscription on focus:', e); }
      }
      if (currentUser.hostType === 'company' && !currentUser.companyName) {
        currentUser.companyName = currentUser.name || 'Company';
        await StorageService.setCurrentUser(currentUser);
      }
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
            ? String(currentUser.boostData.boostExpiresAt)
            : undefined,
        };
      }
      if (currentUser.emailVerified === undefined) {
        currentUser.emailVerified = true;
      }
      const resetUser = await resetDailyMessagesIfNeeded(currentUser);
      StorageService.seedUserSpecificMockData(resetUser.id, resetUser.name, resetUser.role, resetUser.hostType).catch(createErrorHandler('AuthContext', 'seedUserSpecificMockData'));
      setUser(resetUser);
    }
    setIsLoading(false);
  };

  const loadUser = async () => {
    try {
      const [_, sessionResult] = await Promise.all([
        loadUserFromStorage(),
        isSupabaseConfigured ? supabase.auth.getSession() : Promise.resolve(null),
      ]);

      const session = (sessionResult as any)?.data?.session ?? null;
      if (session) {
        loadUserFromSupabase(session).catch((err) => {
          console.warn('[Auth] Background Supabase sync failed:', err);
        });
      }
    } catch (error) {
      console.error('Error loading user:', error);
      await loadUserFromStorage();
    }
  };

  const login = async (email: string, password: string) => {
    const sanitizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      await loadUserFromSupabase(data.session);
      if (data.session.user?.id) {
        setSentryUser(data.session.user.id);
      }
    }
  };

  const checkWeeklySummary = async (loginUser: User): Promise<User | null> => {
    const lastSummary = (loginUser as User & { lastAISummaryDate?: string }).lastAISummaryDate;
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (!lastSummary || new Date(lastSummary) <= weekAgo) {
      const likesCount = Math.floor(Math.random() * 12) + 3;
      const responseRate = Math.floor(Math.random() * 25) + 65;
      await StorageService.addNotification({
        id: `notif-ai-weekly-${Date.now()}`,
        userId: loginUser.id,
        type: 'system',
        title: 'Your Rhome Weekly',
        body: `${likesCount} new likes, ${responseRate}% response rate. Tap to see your AI insights.`,
        isRead: false,
        createdAt: now,
        data: {},
      });
      const updatedUser = { ...loginUser, lastAISummaryDate: now.toISOString() };
      await StorageService.setCurrentUser(updatedUser);
      await StorageService.addOrUpdateUser(updatedUser);
      return updatedUser;
    }
    return null;
  };

  const register = async (email: string, password: string, name: string, role: UserRole, hostType?: 'individual' | 'agent' | 'company' | null, companyName?: string, firstName?: string, lastName?: string) => {
    const sanitizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        data: {
          full_name: name,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          role,
          host_type: hostType ?? null,
          company_name: companyName ?? null,
          city: 'New York',
          state: 'NY',
          neighborhood: 'Williamsburg',
        },
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw new Error(error.message);
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    if (!data.user) {
      throw new Error('Sign up failed. Please try again.');
    }

    if (data.user) {
      try {
        await supabase.from('profiles').upsert(
          {
            user_id: data.user.id,
            budget_min: 0,
            budget_max: 0,
            cleanliness: 3,
            noise_tolerance: 3,
            sleep_schedule: 'flexible',
            smoking: 'no',
            pets: 'no_pets',
            drinking: 'sometimes',
            guests: 'sometimes',
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      } catch (profileErr) {
        console.warn('Failed to create initial profile row:', profileErr);
      }

      try {
        const pendingCode = await AsyncStorage.getItem('pending_referral_code');
        if (pendingCode) {
          const { processReferralSignup } = await import('../services/referralService');
          await processReferralSignup(data.user.id, pendingCode);
          await AsyncStorage.removeItem('pending_referral_code');
        }
      } catch (refErr) {
        console.warn('Failed to process referral code:', refErr);
      }

      if (role === 'host' && hostType) {
        try {
          const userUpdate: Record<string, any> = {
            host_type: hostType,
            first_name: firstName ?? null,
            last_name: lastName ?? null,
          };
          if (hostType) {
            userUpdate.onboarding_step = 'profile';
          }
          if (companyName) {
            userUpdate.company_name = companyName;
          }
          await supabase.from('users').update(userUpdate).eq('id', data.user.id);
        } catch (e) {
          console.warn('Failed to update host_type on users table:', e);
        }
      }

      if (data.session) {
        await loadUserFromSupabase(data.session);
      } else {
        const isVerified = !!data.user.email_confirmed_at;
        const nextStep = role === 'host' ? (hostType ? 'profile' : 'hostType') : 'complete';
        const agentOccupation = hostType === 'agent' ? 'Real Estate Agent' : undefined;
        const newUser: User = {
          id: data.user.id,
          email,
          name,
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          role,
          emailVerified: isVerified,
          onboardingStep: nextStep,
          hostType: hostType ?? undefined,
          companyName: companyName ?? undefined,
          subscription: { plan: 'basic', status: 'active' },
          messageCount: 0,
          profileData: {
            neighborhood: 'Williamsburg',
            city: 'New York',
            state: 'NY',
            coordinates: { lat: 40.7081, lng: -73.9571 },
            ...(agentOccupation ? { occupation: agentOccupation } : {}),
          },
        };
        await StorageService.setCurrentUser(newUser);
        await StorageService.addOrUpdateUser(newUser);
        setUser(newUser);
      }
    }
  };

  const completeOnboardingStep = async (step: 'profile' | 'hostType' | 'plan' | 'complete') => {
    if (!user) return;
    const latest = await StorageService.getCurrentUser() || user;
    const updated = { ...latest, onboardingStep: step };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);

    try {
      await supabase
        .from('users')
        .update({ onboarding_step: step })
        .eq('id', user.id);
    } catch (e) {
      console.warn('[Auth] Supabase onboarding step sync failed:', e);
    }

    if (step === 'complete') {
      try {
        const { updateReferralProgress } = await import('../services/referralService');
        await updateReferralProgress(user.id, 'onboarded');
      } catch {}
    }

    setUser(updated);
  };

  const cancelHostSubscriptionAtPeriodEnd = async () => {
    if (!user || !user.hostSubscription || user.hostSubscription.plan === 'free') return;
    const expiresAt = user.hostSubscription.expiresAt
      ? new Date(user.hostSubscription.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updatedUser: User = {
      ...user,
      hostSubscription: {
        ...user.hostSubscription,
        status: 'cancelling',
        scheduledPlan: 'free',
        scheduledChangeDate: expiresAt,
      },
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    try {
      await supabase.from('subscriptions').update({
        host_status: 'cancelling',
        host_scheduled_plan: 'free',
        host_scheduled_change_date: expiresAt.toISOString(),
      }).eq('user_id', user.id);
    } catch (e) {
      console.log('[Auth] Supabase host cancel sync failed:', e);
    }
    console.log(`[Auth] Host subscription set to cancel at period end: ${expiresAt}`);
  };

  const reactivateHostSubscription = async () => {
    if (!user || !user.hostSubscription) return;
    const updatedUser: User = {
      ...user,
      hostSubscription: {
        ...user.hostSubscription,
        status: 'active',
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
      },
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    try {
      await supabase.from('subscriptions').update({
        host_status: 'active',
        host_scheduled_plan: null,
        host_scheduled_change_date: null,
      }).eq('user_id', user.id);
    } catch (e) {
      console.log('[Auth] Supabase host reactivate sync failed:', e);
    }
  };

  const cleanupAgentData = async (userId: string) => {
    try {
      await Promise.allSettled([
        supabase.from('agent_shortlists').delete().eq('agent_id', userId),
        supabase.from('groups').update({ group_status: 'dissolved' }).eq('created_by_agent', userId),
        supabase.from('agent_group_invites').update({ status: 'cancelled' }).eq('invited_by', userId).eq('status', 'pending'),
        supabase.from('listings').update({ assigned_agent_id: null }).eq('assigned_agent_id', userId),
        supabase.from('company_team_members').delete().eq('user_id', userId),
      ]);
    } catch (e) {
      console.warn('[Auth] Agent data cleanup partial failure:', e);
    }
  };

  const softDeleteAccount = async () => {
    if (!user) return;

    if (user.hostType === 'agent' || user.hostType === 'company') {
      await cleanupAgentData(user.id);
    }

    const updatedUser: User = {
      ...user,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    try {
      await supabase.from('users').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', user.id);
    } catch (e) {
      console.log('[Auth] Supabase soft-delete update failed:', e);
    }
    await supabase.auth.signOut();
    await StorageService.logoutAndReset();
    setUser(null);
  };

  const recoverDeletedAccount = async () => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      isDeleted: false,
      deletedAt: undefined,
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    try {
      await supabase.from('users').update({ is_deleted: false, deleted_at: null }).eq('id', user.id);
    } catch (e) {
      console.log('[Auth] Supabase account recovery failed:', e);
    }
    setUser(updatedUser);
  };

  const updateLastActive = async () => {
    if (!user) return;
    const now = new Date();
    const updatedUser: User = { ...user, lastActiveAt: now };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    try {
      await supabase.from('users').update({ last_active_at: now.toISOString() }).eq('id', user.id);
    } catch (e) {}
  };

  const logout = async () => {
    if (user?.id) {
      removePushToken(user.id).catch((e) => console.warn('[Auth] Push token removal failed:', e));
    }
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (e) {
      console.log('[Auth] Supabase signOut error (non-blocking):', e);
    }
    await StorageService.logoutAndReset();
    rcLogout().catch((e) => console.warn('[Auth] RevenueCat logout failed:', e));
    clearSentryUser();
    setUser(null);
  };

  const abandonSignup = async () => {
    try {
      const userId = user?.id;
      if (userId) {
        const { error: profileErr } = await supabase.from('profiles').delete().eq('user_id', userId);
        if (profileErr) console.log('[abandonSignup] Profile cleanup failed:', profileErr.message);

        const { error: userErr } = await supabase.from('users').update({ onboarding_step: 'abandoned' }).eq('id', userId);
        if (userErr) console.log('[abandonSignup] User update failed:', userErr.message);
      }
    } catch (err) {
      console.log('[abandonSignup] Cleanup error:', err);
    }
    await supabase.auth.signOut();
    await StorageService.logoutAndReset();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const sanitizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: 'rhome://auth/reset-password',
    });
    if (error) throw error;
  };

  const clearPasswordRecovery = () => setPasswordRecoveryMode(false);

  const getExpiryForCycle = (cycle: 'monthly' | '3month' | 'annual') => {
    const d = new Date();
    if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (cycle === '3month') d.setMonth(d.getMonth() + 3);
    else d.setMonth(d.getMonth() + 1);
    return d;
  };

  const getBillingAmount = (plan: 'plus' | 'elite', cycle: 'monthly' | '3month' | 'annual') => {
    const prices = {
      plus: { monthly: 14.99, '3month': 40.47, annual: 149.30 },
      elite: { monthly: 29.99, '3month': 80.97, annual: 298.70 },
    };
    return prices[plan][cycle];
  };

  const upgradeToPlus = async (billingCycle: 'monthly' | '3month' | 'annual' = 'monthly', stripeSubscriptionId?: string) => {
    if (!user) return;
    const expiresAt = getExpiryForCycle(billingCycle);
    const amount = getBillingAmount('plus', billingCycle);
    const prevHistory = user.subscription?.billingHistory || [];
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'plus',
        status: 'active',
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
        billingCycle,
        billingHistory: [{ date: new Date().toISOString(), amount, description: `Plus - ${billingCycle}` }, ...prevHistory].slice(0, 10),
      },
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    const updatePayload: Record<string, string | boolean> = { plan: 'plus', billing_cycle: billingCycle, status: 'active', current_period_end: expiresAt.toISOString(), cancel_at_period_end: false };
    if (stripeSubscriptionId) updatePayload.stripe_subscription_id = stripeSubscriptionId;
    await supabase.from('subscriptions').update(updatePayload).eq('user_id', user.id);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Plus:', updatedUser.subscription);
    processReferralCommission(user.id, 'plus').catch(createErrorHandler('AuthContext', 'processReferralCommission'));
  };

  const upgradeToElite = async (billingCycle: 'monthly' | '3month' | 'annual' = 'monthly', stripeSubscriptionId?: string) => {
    if (!user) return;
    const expiresAt = getExpiryForCycle(billingCycle);
    const amount = getBillingAmount('elite', billingCycle);
    const prevHistory = user.subscription?.billingHistory || [];
    const updatedUser: User = {
      ...user,
      subscription: {
        plan: 'elite',
        status: 'active',
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
        billingCycle,
        billingHistory: [{ date: new Date().toISOString(), amount, description: `Elite - ${billingCycle}` }, ...prevHistory].slice(0, 10),
      },
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    const updatePayload: Record<string, string | boolean> = { plan: 'elite', billing_cycle: billingCycle, status: 'active', current_period_end: expiresAt.toISOString(), cancel_at_period_end: false };
    if (stripeSubscriptionId) updatePayload.stripe_subscription_id = stripeSubscriptionId;
    await supabase.from('subscriptions').update(updatePayload).eq('user_id', user.id);
    setUser(updatedUser);
    console.log('[Auth] Upgraded to Elite:', updatedUser.subscription);
    processReferralCommission(user.id, 'elite').catch(createErrorHandler('AuthContext', 'processReferralCommission'));
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

  const cancelSubscriptionAtPeriodEnd = async () => {
    if (!user || !user.subscription || user.subscription.plan === 'basic') return;
    const expiresAt = user.subscription.expiresAt
      ? new Date(user.subscription.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updatedUser: User = {
      ...user,
      subscription: {
        ...user.subscription,
        status: 'cancelling',
        expiresAt,
        scheduledPlan: 'basic',
        scheduledChangeDate: expiresAt,
      },
    };
    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
    console.log(`[Auth] Subscription set to cancel at period end: ${expiresAt}`);
  };

  const getSubscriptionDetails = () => {
    const sub = user?.subscription;
    const cycle = sub?.billingCycle || 'monthly';
    const plan = sub?.plan || 'basic';
    const expiresAt = sub?.expiresAt ? new Date(sub.expiresAt) : new Date();
    const nextRenewalDate = expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    let renewalAmount = 0;
    if (plan === 'plus' || plan === 'elite') {
      renewalAmount = getBillingAmount(plan, cycle as 'monthly' | '3month' | 'annual');
    }
    const billingHistory = sub?.billingHistory || [];
    return { nextRenewalDate, renewalAmount, billingCycle: cycle, billingHistory };
  };

  const SAFE_UPDATE_FIELDS = new Set([
    'name', 'firstName', 'lastName', 'bio', 'profilePicture', 'coverPhoto', 'photos',
    'occupation', 'company', 'school', 'aboutMe', 'zodiacSign',
    'brokerageName', 'brokerageLicense', 'licenseNumber', 'licenseState', 'licensingState',
    'agencyName', 'companyName', 'unitsManaged',
    'hostType', 'hostTypeLockedAt', 'hostTypeChangeRequested',
    'licenseVerificationStatus', 'licenseVerified', 'licenseVerifiedAt',
    'licenseDocumentUrl',
    'preferred_neighborhoods', 'interestTags', 'profileData',
    'zip_code', 'ideal_roommate_text', 'pi_parsed_preferences',
    'desired_roommate_count', 'desired_bedroom_count',
    'household_gender_preference', 'pi_auto_match_enabled', 'pi_last_match_attempt',
    'notificationPreferences', 'privacySettings', 'verification', 'acceptAgentOffers',
    'searchPaused', 'searchPausedAt',
    'hostSubscription', 'subscription', 'agentPlan', 'companyPlan',
    'purchases',
  ]);

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;

    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => SAFE_UPDATE_FIELDS.has(key))
    ) as Partial<User>;

    if (Object.keys(safeUpdates).length === 0) {
      console.warn('[Auth] No safe fields in update request, ignoring:', Object.keys(updates));
      return;
    }

    const updatedUser: User = {
      ...user,
      ...safeUpdates,
      profileData: safeUpdates.profileData
        ? { ...user.profileData, ...safeUpdates.profileData }
        : user.profileData,
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

    const supabaseFields: Record<string, any> = {};
    if (updates.verification !== undefined) supabaseFields.verification = updates.verification;
    if (updates.acceptAgentOffers !== undefined) supabaseFields.accept_agent_offers = updates.acceptAgentOffers;
    if (updates.privacySettings !== undefined) supabaseFields.privacy_settings = updates.privacySettings;
    if (updates.name !== undefined) supabaseFields.full_name = updates.name;
    if (updates.profilePicture !== undefined) supabaseFields.avatar_url = updates.profilePicture;
    if (updates.profileData?.bio !== undefined) supabaseFields.bio = updates.profileData.bio;
    if (updates.profileData?.occupation !== undefined) supabaseFields.occupation = updates.profileData.occupation;
    if (updates.profileData?.location !== undefined) supabaseFields.location = updates.profileData.location;
    if (updates.profileData?.neighborhood !== undefined) supabaseFields.neighborhood = updates.profileData.neighborhood;
    if (updates.profileData?.city !== undefined) supabaseFields.city = updates.profileData.city;
    if (updates.profileData?.state !== undefined) supabaseFields.state = updates.profileData.state;
    if (updates.age !== undefined) supabaseFields.age = updates.age;
    if (updates.birthday !== undefined) supabaseFields.birthday = updates.birthday;
    if (updates.zodiacSign !== undefined) supabaseFields.zodiac_sign = updates.zodiacSign;
    if (updates.gender !== undefined) supabaseFields.gender = updates.gender;
    if (updates.role !== undefined) supabaseFields.role = updates.role;
    if (updates.hostType !== undefined) supabaseFields.host_type = updates.hostType;
    if (updates.hostTypeLockedAt !== undefined) supabaseFields.host_type_locked_at = updates.hostTypeLockedAt;
    if (updates.hostTypeChangeRequested !== undefined) supabaseFields.host_type_change_requested = updates.hostTypeChangeRequested;
    if (updates.licenseNumber !== undefined) supabaseFields.license_number = updates.licenseNumber;
    if (updates.licenseState !== undefined) supabaseFields.license_state = updates.licenseState;
    if (updates.licenseDocumentUrl !== undefined) supabaseFields.license_document_url = updates.licenseDocumentUrl;
    if (updates.licenseVerified !== undefined) supabaseFields.license_verified = updates.licenseVerified;
    if (updates.licenseVerifiedAt !== undefined) supabaseFields.license_verified_at = updates.licenseVerifiedAt;
    if (updates.licenseVerificationStatus !== undefined) supabaseFields.license_verification_status = updates.licenseVerificationStatus;
    if (updates.agencyName !== undefined) supabaseFields.agency_name = updates.agencyName;
    if (updates.companyName !== undefined) supabaseFields.company_name = updates.companyName;
    if (updates.brokerageLicense !== undefined) supabaseFields.brokerage_license = updates.brokerageLicense;
    if (updates.licensingState !== undefined) supabaseFields.licensing_state = updates.licensingState;
    if (updates.unitsManaged !== undefined) supabaseFields.units_managed = updates.unitsManaged;

    if (Object.keys(supabaseFields).length > 0) {
      supabaseFields.updated_at = new Date().toISOString();
      try {
        const { error } = await supabase
          .from('users')
          .update(supabaseFields)
          .eq('id', user.id);
        if (error) {
          console.log('[Auth] Supabase user sync failed:', error.message);
        } else {
          console.log('[Auth] Synced to Supabase:', Object.keys(supabaseFields).join(', '));
        }
      } catch (err) {
        console.log('[Auth] Supabase user sync error:', err);
      }
    }

    if (updates.profileData?.profileNote !== undefined) {
      try {
        const noteValue = updates.profileData.profileNote?.trim() || null;
        await supabase
          .from('profiles')
          .update({
            profile_note: noteValue,
            profile_note_updated_at: noteValue ? new Date().toISOString() : null,
          })
          .eq('user_id', user.id);
        console.log('[Auth] Synced profile_note to Supabase');
      } catch (err) {
        console.log('[Auth] profile_note sync error:', err);
      }
    }

    if (updates.ideal_roommate_text !== undefined) {
      try {
        const textValue = updates.ideal_roommate_text?.trim() || null;
        await supabase
          .from('profiles')
          .update({ ideal_roommate_text: textValue })
          .eq('user_id', user.id);
        console.log('[Auth] Synced ideal_roommate_text to Supabase');
      } catch (err) {
        console.log('[Auth] ideal_roommate_text sync error:', err);
      }
    }
  };

  const resetDailyMessagesIfNeeded = async (u: User): Promise<User> => {
    const today = new Date().toISOString().split('T')[0];
    const resetDate = u.messagingData?.dailyMessageResetDate?.split('T')[0];
    if (resetDate !== today) {
      const updated: User = {
        ...u,
        messagingData: {
          dailyMessageCount: 0,
          dailyMessageResetDate: new Date().toISOString(),
          activeChatsCount: u.messagingData?.activeChatsCount ?? 0,
          coldMessagesUsedThisMonth: u.messagingData?.coldMessagesUsedThisMonth ?? 0,
          coldMessagesResetDate: u.messagingData?.coldMessagesResetDate ?? new Date().toISOString(),
        },
      };
      await StorageService.setCurrentUser(updated);
      await StorageService.addOrUpdateUser(updated);
      return updated;
    }
    return u;
  };

  const incrementMessageCount = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const resetDate = user.messagingData?.dailyMessageResetDate?.split('T')[0];
    const currentDaily = resetDate === today ? (user.messagingData?.dailyMessageCount ?? 0) : 0;

    const updatedUser: User = {
      ...user,
      messageCount: (user.messageCount || 0) + 1,
      messagingData: {
        dailyMessageCount: currentDaily + 1,
        dailyMessageResetDate: new Date().toISOString(),
        activeChatsCount: user.messagingData?.activeChatsCount ?? 0,
        coldMessagesUsedThisMonth: user.messagingData?.coldMessagesUsedThisMonth ?? 0,
        coldMessagesResetDate: user.messagingData?.coldMessagesResetDate ?? new Date().toISOString(),
      },
    };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
  };

  const canSendMessage = (): boolean => {
    if (!user) return false;

    const plan = user.subscription?.plan || 'basic';
    if (plan === 'elite') return true;

    const today = new Date().toISOString().split('T')[0];
    const resetDate = user.messagingData?.dailyMessageResetDate?.split('T')[0];
    const dailyCount = resetDate === today ? (user.messagingData?.dailyMessageCount ?? 0) : 0;

    const limit = plan === 'plus' ? 200 : 20;
    return dailyCount < limit;
  };

  const canBoost = (): { canBoost: boolean; reason?: string; requiresPayment?: boolean; nextAvailableAt?: string; hasFreeBoost?: boolean } => {
    if (!user) return { canBoost: false, reason: 'Not logged in' };

    const plan = user.subscription?.plan || 'basic';

    if (user.boostData?.isBoosted && user.boostData.boostExpiresAt) {
      if (new Date().getTime() < new Date(user.boostData.boostExpiresAt).getTime()) {
        return { canBoost: false, reason: 'Boost is already active' };
      }
    }

    if (plan === 'basic') {
      return { canBoost: true, requiresPayment: true, hasFreeBoost: false };
    }

    if (plan === 'elite') {
      return { canBoost: true, hasFreeBoost: true };
    }

    if (plan === 'plus') {
      const nextFree = user.boostData?.nextFreeBoostAvailableAt;
      if (nextFree && new Date() < new Date(nextFree)) {
        return {
          canBoost: true,
          requiresPayment: true,
          hasFreeBoost: false,
          nextAvailableAt: nextFree,
          reason: `Next free boost available on ${new Date(nextFree).toLocaleDateString()}`,
        };
      }
      return { canBoost: true, hasFreeBoost: true };
    }

    return { canBoost: false };
  };

  const activateBoost = async (durationHoursParam?: number): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not logged in' };
    }

    const isHostMode = !!user.hostType && (user.activeMode === 'host' || user.hostType === 'agent' || user.hostType === 'company');
    const hostPlan = user.hostSubscription?.plan || 'free';
    const renterPlan = user.subscription?.plan || 'basic';
    const plan = isHostMode ? hostPlan : renterPlan;
    const defaultDuration = isHostMode
      ? (plan.includes('business') || plan.includes('enterprise') ? 48 : plan.includes('pro') ? 24 : plan.includes('starter') ? 12 : 6)
      : (renterPlan === 'elite' ? 24 : renterPlan === 'plus' ? 12 : 6);
    const durationHours = durationHoursParam || defaultDuration;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

    const boostData = {
      ...(user.boostData || { boostsUsed: 0, boostDurationHours: durationHours as 6 | 12 | 24 | 48 }),
      isBoosted: true,
      boostExpiresAt: expiresAt,
      lastBoostActivatedAt: now.toISOString(),
      boostDurationHours: durationHours as 6 | 12 | 24 | 48,
      boostsUsed: (user.boostData?.boostsUsed || 0) + 1,
      lastBoostDate: now,
    };

    const isFreeBoost = (plan === 'plus' || plan === 'elite') && durationHours === defaultDuration;
    if (plan === 'plus' && isFreeBoost) {
      const nextFree = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      boostData.nextFreeBoostAvailableAt = nextFree.toISOString();
    }

    const updatedUser: User = { ...user, boostData };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);

    try {
      await boostServiceActivateBoost(user.id, durationHours);
      console.log('[Auth] Boost synced to Supabase');
    } catch (err) {
      console.log('[Auth] Supabase boost sync failed, local state updated:', err);
    }

    return { success: true, message: `Boost activated! Your profile will be prioritized for ${durationHours} hours.` };
  };

  const purchaseBoost = async (price: number = 4.99, durationHours: number = 12): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not logged in' };
    }

    return activateBoost(durationHours);
  };

  const checkAndUpdateBoostStatus = async () => {
    if (!user) return;

    if (user.boostData?.isBoosted && user.boostData.boostExpiresAt) {
      if (new Date().getTime() >= new Date(user.boostData.boostExpiresAt).getTime()) {
        const plan = user.subscription?.plan || 'basic';
        let notifBody = 'Boost again starting at $2.99 to stay at the top';
        if (plan === 'plus') {
          const nextFree = user.boostData.nextFreeBoostAvailableAt;
          notifBody = nextFree
            ? `Boost again — your next free boost is available ${new Date(nextFree).toLocaleDateString()}`
            : 'Boost again — your next free boost is available now';
        } else if (plan === 'elite') {
          notifBody = 'Activate a new boost anytime from your profile';
        }

        const notification: Notification = {
          id: `boost-expired-${Date.now()}`,
          userId: user.id,
          type: 'system',
          title: 'Your Profile Boost Expired',
          body: notifBody,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        await StorageService.addNotification(notification);

        const updatedUser: User = {
          ...user,
          boostData: {
            ...user.boostData,
            isBoosted: false,
          },
        };

        await StorageService.setCurrentUser(updatedUser);
        await StorageService.addOrUpdateUser(updatedUser);
        setUser(updatedUser);

        try {
          await deactivateExpiredBoosts(user.id);
          console.log('[Auth] Expired boosts deactivated in Supabase');
        } catch (err) {
          console.log('[Auth] Supabase deactivate expired boosts failed:', err);
        }
      }
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
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

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
    if (userPlan === 'elite') return Infinity;
    if (userPlan === 'plus') return 10;
    if (isPlaceSeeker()) return 10;
    return 3;
  };

  const canStartNewChat = async (conversationId: string): Promise<{ canStart: boolean; limit: number; current: number; reason?: string }> => {
    if (!user) {
      return { canStart: false, limit: 3, current: 0, reason: 'Not logged in' };
    }

    const limit = getActiveChatLimit();
    if (limit === Infinity) {
      return { canStart: true, limit, current: user.messagingData?.activeChatsCount || 0 };
    }

    const conversations = await StorageService.getConversations();
    const activeChats = conversations.filter(conv => {
      if (!conv.messages || conv.messages.length === 0) return false;
      return conv.messages.some(msg => msg.senderId === user.id);
    });

    const current = activeChats.length;
    const isCurrentChatActive = activeChats.some(conv => conv.id === conversationId);

    if (isCurrentChatActive || current < limit) {
      return { canStart: true, limit, current };
    }

    const userPlan = user.subscription?.plan || 'basic';
    return {
      canStart: false,
      limit,
      current,
      reason: userPlan === 'basic'
        ? 'Basic users can have 3 active chats at once. Close a chat to start a new one.'
        : `You've reached your active chat limit (${current}/${limit}). Upgrade to Elite for unlimited chats!`,
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
      messagingData: {
        ...user.messagingData!,
        dailyMessageCount: user.messagingData?.dailyMessageCount ?? 0,
        dailyMessageResetDate: user.messagingData?.dailyMessageResetDate ?? new Date().toISOString(),
        activeChatsCount: newCount,
        coldMessagesUsedThisMonth: user.messagingData?.coldMessagesUsedThisMonth ?? 0,
        coldMessagesResetDate: user.messagingData?.coldMessagesResetDate ?? new Date().toISOString(),
      },
    };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
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
            undoPassExpiresAt: undefined,
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

  const blockUserAction = async (blockedUserId: string) => {
    if (!user) return;
    await StorageService.blockUser(user.id, blockedUserId);
    const updatedBlockedUsers = [...(user.blockedUsers || []), blockedUserId];
    const updatedUser: User = { ...user, blockedUsers: updatedBlockedUsers };
    await StorageService.setCurrentUser(updatedUser);
    setUser(updatedUser);
  };

  const unblockUserAction = async (blockedUserId: string) => {
    if (!user) return;
    await StorageService.unblockUser(user.id, blockedUserId);
    const updatedBlockedUsers = (user.blockedUsers || []).filter(id => id !== blockedUserId);
    const updatedUser: User = { ...user, blockedUsers: updatedBlockedUsers };
    await StorageService.setCurrentUser(updatedUser);
    setUser(updatedUser);
  };

  const reportUserAction = async (reportedUserId: string, reason: string) => {
    if (!user) return;
    await StorageService.reportUser(user.id, reportedUserId, reason);
    const updatedReportedUsers = [...(user.reportedUsers || []), { userId: reportedUserId, reason, reportedAt: new Date().toISOString() }];
    const updatedUser: User = { ...user, reportedUsers: updatedReportedUsers };
    await StorageService.setCurrentUser(updatedUser);
    setUser(updatedUser);
  };

  const isUserBlockedCheck = (otherUserId: string): boolean => {
    if (!user) return false;
    return (user.blockedUsers || []).includes(otherUserId);
  };

  const isBasicUser = (): boolean => {
    const plan = user?.subscription?.plan || 'basic';
    const status = user?.subscription?.status || 'active';
    return plan === 'basic' || status !== 'active';
  };

  const isPlaceSeeker = (): boolean => {
    if (!user) return false;
    const searchType = user.profileData?.apartment_search_type;
    return searchType === 'solo' || searchType === 'with_partner' || searchType === 'have_group' || searchType === 'entire_apartment';
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
      lastAdWatched: new Date().toISOString(),
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

  const canViewListing = (): { canView: boolean; remaining: number; limit: number; message?: string } => {
    if (!user) return { canView: false, remaining: 0, limit: 0, message: 'Not logged in' };

    const plan = user.subscription?.plan || 'basic';
    if (plan === 'plus' || plan === 'elite' || isPlaceSeeker()) {
      return { canView: true, remaining: Infinity, limit: Infinity };
    }

    const now = new Date();
    const lastReset = user.listingViewData?.lastViewReset
      ? new Date(user.listingViewData.lastViewReset)
      : null;

    let viewsUsed = user.listingViewData?.viewsToday || 0;
    if (!lastReset || !isSameDay(lastReset, now)) {
      viewsUsed = 0;
    }

    const limit = 10;
    const remaining = Math.max(0, limit - viewsUsed);

    if (remaining > 0) {
      return { canView: true, remaining, limit };
    }

    return {
      canView: false,
      remaining: 0,
      limit,
      message: `You've reached your daily listing view limit (${limit}/${limit}). Upgrade to Plus for unlimited views!`,
    };
  };

  const useListingView = async (): Promise<void> => {
    if (!user) return;

    const plan = user.subscription?.plan || 'basic';
    if (plan === 'plus' || plan === 'elite' || isPlaceSeeker()) return;

    const now = new Date();
    const lastReset = user.listingViewData?.lastViewReset
      ? new Date(user.listingViewData.lastViewReset)
      : null;

    let viewsUsed = user.listingViewData?.viewsToday || 0;
    if (!lastReset || !isSameDay(lastReset, now)) {
      viewsUsed = 0;
    }

    const updatedUser: User = {
      ...user,
      listingViewData: {
        viewsToday: viewsUsed + 1,
        lastViewReset: now,
      },
    };

    await StorageService.setCurrentUser(updatedUser);
    await StorageService.addOrUpdateUser(updatedUser);
    setUser(updatedUser);
  };

  const canSendInterest = async (): Promise<{ canSend: boolean; remaining: number; reason?: string }> => {
    if (!user) return { canSend: false, remaining: 0, reason: 'Not logged in' };

    const plan = user.subscription?.plan || 'basic';
    const status = user.subscription?.status || 'active';

    if ((plan === 'plus' || plan === 'elite') && status === 'active') {
      return { canSend: true, remaining: -1 };
    }

    const DAILY_LIMIT = isPlaceSeeker() ? 15 : 5;
    const cards = await StorageService.getInterestCardsForRenter(user.id);
    const now = new Date();
    const todayCards = cards.filter(card => {
      const created = new Date(card.createdAt);
      return created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate();
    });

    const remaining = Math.max(0, DAILY_LIMIT - todayCards.length);
    if (remaining <= 0) {
      return { canSend: false, remaining: 0, reason: 'Daily limit reached. Upgrade to Plus or Elite for unlimited interests.' };
    }

    return { canSend: true, remaining };
  };

  const resetSuperInterestMonthly = (): { usedThisMonth: number; lastResetDate: string } => {
    if (!user) return { usedThisMonth: 0, lastResetDate: new Date().toISOString() };
    const data = user.superInterestData;
    const now = new Date();
    if (data?.lastResetDate) {
      const lastReset = new Date(data.lastResetDate);
      if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
        return { usedThisMonth: 0, lastResetDate: now.toISOString() };
      }
      return { usedThisMonth: data.usedThisMonth, lastResetDate: data.lastResetDate };
    }
    return { usedThisMonth: 0, lastResetDate: now.toISOString() };
  };

  const canSendSuperInterest = (): { canSend: boolean; remaining: number; reason?: string } => {
    if (!user) return { canSend: false, remaining: 0, reason: 'Not logged in' };
    const plan = user.subscription?.plan || 'basic';
    if (plan === 'elite') {
      return { canSend: true, remaining: 999 };
    }
    if (plan === 'plus') {
      const monthData = resetSuperInterestMonthly();
      const remaining = Math.max(0, 5 - monthData.usedThisMonth);
      const purchased = user.purchases?.superInterestsRemaining || 0;
      const total = remaining + purchased;
      if (total <= 0) return { canSend: false, remaining: 0, reason: 'No Super Interests remaining this month. Buy more for $0.99 each.' };
      return { canSend: true, remaining: total };
    }
    const purchased = user.purchases?.superInterestsRemaining || 0;
    if (purchased <= 0) return { canSend: false, remaining: 0, reason: 'Buy Super Interests for $0.99 each or upgrade to Plus for 5 free per month.' };
    return { canSend: true, remaining: purchased };
  };

  const getSuperInterestCount = (): number => {
    if (!user) return 0;
    const plan = user.subscription?.plan || 'basic';
    if (plan === 'elite') return 999;
    if (plan === 'plus') {
      const monthData = resetSuperInterestMonthly();
      const freeRemaining = Math.max(0, 5 - monthData.usedThisMonth);
      return freeRemaining + (user.purchases?.superInterestsRemaining || 0);
    }
    return user.purchases?.superInterestsRemaining || 0;
  };

  const useSuperInterestCredit = async (): Promise<void> => {
    if (!user) return;
    const plan = user.subscription?.plan || 'basic';
    const prevTotal = user.superInterestData?.totalSent || 0;
    if (plan === 'elite') {
      const updated = {
        ...user,
        superInterestData: { ...user.superInterestData, usedThisMonth: user.superInterestData?.usedThisMonth || 0, lastResetDate: user.superInterestData?.lastResetDate || new Date().toISOString(), totalSent: prevTotal + 1 },
      };
      await StorageService.setCurrentUser(updated);
      await StorageService.addOrUpdateUser(updated);
      setUser(updated);
      return;
    }
    if (plan === 'plus') {
      const monthData = resetSuperInterestMonthly();
      const freeRemaining = Math.max(0, 5 - monthData.usedThisMonth);
      if (freeRemaining > 0) {
        const updated = {
          ...user,
          superInterestData: { usedThisMonth: monthData.usedThisMonth + 1, lastResetDate: monthData.lastResetDate, totalSent: prevTotal + 1 },
        };
        await StorageService.setCurrentUser(updated);
        await StorageService.addOrUpdateUser(updated);
        setUser(updated);
        return;
      }
    }
    const current = user.purchases?.superInterestsRemaining || 0;
    if (current <= 0) return;
    const updated = {
      ...user,
      purchases: { ...user.purchases, superInterestsRemaining: current - 1 },
      superInterestData: { ...user.superInterestData, usedThisMonth: user.superInterestData?.usedThisMonth || 0, lastResetDate: user.superInterestData?.lastResetDate || new Date().toISOString(), totalSent: prevTotal + 1 },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
  };

  const canSendColdMessage = async (): Promise<{ canSend: boolean; remaining: number; reason?: string }> => {
    if (!user) return { canSend: false, remaining: 0, reason: 'Not logged in' };
    const plan = user.subscription?.plan || 'basic';
    const baseLimit = getDailyColdMessageLimit(plan);
    const limit = (plan === 'basic' && isPlaceSeeker()) ? 10 : baseLimit;
    if (limit === Infinity) return { canSend: true, remaining: Infinity };
    const count = await getDailyColdMessageCount(user.id);
    const remaining = Math.max(0, limit - count);
    if (remaining <= 0) {
      return { canSend: false, remaining: 0, reason: `You've used all ${limit} free messages for today. Resets at midnight.` };
    }
    return { canSend: true, remaining };
  };

  const useColdMessage = async (): Promise<void> => {
    if (!user) return;
    const now = new Date();
    let used = user.coldMessagesUsedThisMonth || 0;
    const resetDate = user.coldMessagesResetDate ? new Date(user.coldMessagesResetDate) : null;
    const today = now.toISOString().split('T')[0];
    const resetDay = resetDate ? resetDate.toISOString().split('T')[0] : null;
    if (!resetDay || resetDay !== today) {
      used = 0;
    }
    const updated = {
      ...user,
      coldMessagesUsedThisMonth: used + 1,
      coldMessagesResetDate: now.toISOString(),
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
  };

  const canAskPi = (mode: 'general' | 'listing_advisor' | 'price_analysis' | 'photo_analysis' | 'compatibility'): { canAsk: boolean; remaining: number; limit: number; message?: string } => {
    if (!user) return { canAsk: false, remaining: 0, limit: 0, message: 'Not logged in' };

    const plan = user.subscription?.plan || 'basic';

    if (plan === 'plus' || plan === 'elite') {
      return { canAsk: true, remaining: Infinity, limit: Infinity };
    }

    if (mode === 'general') {
      return { canAsk: true, remaining: Infinity, limit: Infinity };
    }

    if (mode === 'listing_advisor' || mode === 'price_analysis' || mode === 'photo_analysis') {
      if (!isPlaceSeeker()) {
        return { canAsk: false, remaining: 0, limit: 0, message: 'This feature is for apartment seekers.' };
      }

      const now = new Date();
      const lastReset = user.piAdvisorData?.lastResetDate
        ? new Date(user.piAdvisorData.lastResetDate)
        : null;

      let questionsUsed = user.piAdvisorData?.questionsToday || 0;
      if (!lastReset || !isSameDay(lastReset, now)) {
        questionsUsed = 0;
      }

      const DAILY_LIMIT = 10;
      const remaining = Math.max(0, DAILY_LIMIT - questionsUsed);

      if (remaining > 0) {
        return { canAsk: true, remaining, limit: DAILY_LIMIT };
      }

      return {
        canAsk: false,
        remaining: 0,
        limit: DAILY_LIMIT,
        message: "You've used your 10 daily Pi questions. Upgrade to Plus for unlimited access, or check back tomorrow!",
      };
    }

    if (mode === 'compatibility') {
      if (isPlaceSeeker()) {
        return { canAsk: false, remaining: 0, limit: 0 };
      }

      const now = new Date();
      const lastReset = user.piMatchingData?.lastResetDate
        ? new Date(user.piMatchingData.lastResetDate)
        : null;

      let matchesUsed = user.piMatchingData?.matchesToday || 0;
      if (!lastReset || !isSameDay(lastReset, now)) {
        matchesUsed = 0;
      }

      const DAILY_LIMIT = 3;
      const remaining = Math.max(0, DAILY_LIMIT - matchesUsed);

      if (remaining > 0) {
        return { canAsk: true, remaining, limit: DAILY_LIMIT };
      }

      return {
        canAsk: false,
        remaining: 0,
        limit: DAILY_LIMIT,
        message: "You've used your 3 daily compatibility checks. Upgrade to Plus for unlimited Pi matching!",
      };
    }

    return { canAsk: false, remaining: 0, limit: 0 };
  };

  const incrementPiUsage = async (mode: 'listing_advisor' | 'price_analysis' | 'photo_analysis' | 'compatibility') => {
    if (!user) return;
    const now = new Date();

    if (mode === 'listing_advisor' || mode === 'price_analysis' || mode === 'photo_analysis') {
      const lastReset = user.piAdvisorData?.lastResetDate
        ? new Date(user.piAdvisorData.lastResetDate)
        : null;

      let questionsToday = user.piAdvisorData?.questionsToday || 0;
      if (!lastReset || !isSameDay(lastReset, now)) {
        questionsToday = 0;
      }

      const updatedData = {
        questionsToday: questionsToday + 1,
        lastResetDate: now.toISOString(),
      };

      const updated = { ...user, piAdvisorData: updatedData };
      await StorageService.setCurrentUser(updated);
      await StorageService.addOrUpdateUser(updated);
      setUser(updated);
    }

    if (mode === 'compatibility') {
      const lastReset = user.piMatchingData?.lastResetDate
        ? new Date(user.piMatchingData.lastResetDate)
        : null;

      let matchesToday = user.piMatchingData?.matchesToday || 0;
      if (!lastReset || !isSameDay(lastReset, now)) {
        matchesToday = 0;
      }

      const updatedData = {
        matchesToday: matchesToday + 1,
        lastResetDate: now.toISOString(),
      };

      const updated = { ...user, piMatchingData: updatedData };
      await StorageService.setCurrentUser(updated);
      await StorageService.addOrUpdateUser(updated);
      setUser(updated);
    }
  };

  const getHostPlan = (): string => {
    const plan = user?.hostSubscription?.plan;
    return plan || 'free';
  };

  const upgradeHostPlan = async (plan: string, billingCycle: 'monthly' | '3month' | 'annual' = 'monthly') => {
    if (!user) return;
    const expiresAt = getExpiryForCycle(billingCycle);
    const hostPrices: Record<string, Record<string, number>> = {
      starter: { monthly: 19.99, '3month': 53.97, annual: 191.88 },
      pro: { monthly: 49.99, '3month': 134.97, annual: 479.88 },
      business: { monthly: 99, '3month': 267.30, annual: 948.00 },
      agent_starter: { monthly: 79, '3month': 213.30, annual: 758.40 },
      agent_pro: { monthly: 149, '3month': 402.30, annual: 1430.40 },
      agent_business: { monthly: 249, '3month': 672.30, annual: 2390.40 },
      company_starter: { monthly: 199, '3month': 537.30, annual: 1910.40 },
      company_pro: { monthly: 399, '3month': 1077.30, annual: 3830.40 },
    };
    const amount = hostPrices[plan]?.[billingCycle] ?? 0;
    const prevHistory = user.hostSubscription?.billingHistory || [];
    const basePlan = plan.replace(/^(agent_|company_)/, '');
    const isAgentPlan = plan.startsWith('agent_');
    const isCompanyPlan = plan.startsWith('company_');
    const updated: User = {
      ...user,
      hostSubscription: {
        ...user.hostSubscription,
        plan,
        status: 'active' as const,
        expiresAt,
        scheduledPlan: undefined,
        scheduledChangeDate: undefined,
        billingCycle,
        inquiryResponsesUsed: user.hostSubscription?.inquiryResponsesUsed || 0,
        lastInquiryResetDate: user.hostSubscription?.lastInquiryResetDate || new Date().toISOString(),
        billingHistory: [
          { date: new Date().toISOString(), amount, description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ${billingCycle === '3month' ? '3-Month' : billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)}` },
          ...prevHistory.slice(0, 2),
        ],
      },
      ...(isAgentPlan || user.hostType === 'agent' ? { agentPlan: basePlan } : {}),
      ...(isCompanyPlan || user.hostType === 'company' ? { companyPlan: basePlan } : {}),
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);

    if (isSupabaseConfigured) {
      try {
        const patch: Record<string, any> = {};
        if (isAgentPlan || user.hostType === 'agent') patch.agent_plan = basePlan;
        if (isCompanyPlan || user.hostType === 'company') patch.company_plan = basePlan;
        if (Object.keys(patch).length > 0) {
          await supabase.from('users').update(patch).eq('id', user.id);
        }
        await supabase.from('subscriptions').upsert({
          user_id: user.id,
          plan,
          status: 'active',
          billing_cycle: billingCycle,
          current_period_end: expiresAt.toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('[Auth] Failed to sync host plan to Supabase:', e);
      }
    }
  };

  const downgradeHostPlan = async (plan: string) => {
    if (!user) return;
    const changeDate = user.hostSubscription?.expiresAt || new Date().toISOString();
    const updated = {
      ...user,
      hostSubscription: {
        ...user.hostSubscription,
        plan: user.hostSubscription?.plan || 'free' as const,
        status: 'active' as const,
        scheduledPlan: plan,
        scheduledChangeDate: changeDate,
        billingCycle: user.hostSubscription?.billingCycle || 'monthly' as const,
        inquiryResponsesUsed: user.hostSubscription?.inquiryResponsesUsed || 0,
        lastInquiryResetDate: user.hostSubscription?.lastInquiryResetDate || new Date().toISOString(),
      },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
  };

  const canAddListing = (currentCount: number): { allowed: boolean; limit: number; reason?: string } => {
    if (user?.hostType === 'agent') {
      const subPlan = user.hostSubscription?.plan;
      const resolvedAgentPlan = subPlan?.startsWith('agent_') ? subPlan.replace('agent_', '') : undefined;
      const agPlan = (user.agentPlan || resolvedAgentPlan || 'pay_per_use') as AgentPlan;
      const agentLimits = getAgentPlanLimits(agPlan);
      const limit = agentLimits.listingLimit;
      if (limit === -1) return { allowed: true, limit: -1 };
      if (currentCount >= limit) {
        return { allowed: false, limit, reason: getAgentListingLimitMessage(agPlan) };
      }
      return { allowed: true, limit };
    }
    const hostPlan = getHostPlan();
    const planLimitsMap: Record<string, number> = {
      free: 1, none: 1, starter: 5, pro: -1, business: -1,
      agent_starter: 10, agent_pro: 30, agent_business: -1,
      company_starter: 25, company_pro: 100, company_enterprise: -1,
    };
    const limit = planLimitsMap[hostPlan] ?? 1;
    if (limit === -1) {
      return { allowed: true, limit: -1 };
    }
    if (currentCount >= limit) {
      const planLabel = hostPlan === 'free' || hostPlan === 'none' ? 'Free' : hostPlan.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { allowed: false, limit, reason: `Your ${planLabel} plan allows up to ${limit} active listing${limit > 1 ? 's' : ''}. Upgrade to add more listings.` };
    }
    return { allowed: true, limit };
  };

  const canRespondToInquiry = async (): Promise<{ allowed: boolean; remaining: number; limit: number; reason?: string }> => {
    if (!user) return { allowed: false, remaining: 0, limit: 0, reason: 'Not logged in' };
    const hostPlan = getHostPlan();
    if (['pro', 'business', 'agent_pro', 'agent_business', 'company_pro', 'company_enterprise'].includes(hostPlan)) return { allowed: true, remaining: -1, limit: -1 };
    const starterLimit = (hostPlan === 'agent_starter' || hostPlan === 'company_starter') ? 20 : 5;
    const used = user.hostSubscription?.inquiryResponsesUsed || 0;
    const lastReset = user.hostSubscription?.lastInquiryResetDate;
    const now = new Date();
    if (lastReset) {
      const resetDate = new Date(lastReset);
      if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
        const updated = {
          ...user,
          hostSubscription: { ...user.hostSubscription, plan: user.hostSubscription?.plan || 'free' as const, status: 'active' as const, inquiryResponsesUsed: 0, lastInquiryResetDate: now.toISOString(), billingCycle: user.hostSubscription?.billingCycle || 'monthly' as const },
        };
        await StorageService.setCurrentUser(updated);
        await StorageService.addOrUpdateUser(updated);
        setUser(updated);
        return { allowed: true, remaining: starterLimit, limit: starterLimit };
      }
    }
    const remaining = Math.max(0, starterLimit - used);
    if (remaining <= 0) return { allowed: false, remaining: 0, limit: starterLimit, reason: `Your plan allows ${starterLimit} inquiry responses per month. Upgrade for more.` };
    return { allowed: true, remaining, limit: starterLimit };
  };

  const useInquiryResponse = async () => {
    if (!user) return;
    const used = (user.hostSubscription?.inquiryResponsesUsed || 0) + 1;
    const updated = {
      ...user,
      hostSubscription: {
        ...user.hostSubscription,
        plan: user.hostSubscription?.plan || 'free' as const,
        status: user.hostSubscription?.status || 'active' as const,
        inquiryResponsesUsed: used,
        lastInquiryResetDate: user.hostSubscription?.lastInquiryResetDate || new Date().toISOString(),
        billingCycle: user.hostSubscription?.billingCycle || 'monthly' as const,
      },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
  };

  const purchaseListingBoost = async (propertyId: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Not logged in' };
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + 7);
    const expiresAt = expiresAtDate.toISOString();
    const currentBoosts = user.purchases?.listingBoosts || [];
    const updated = {
      ...user,
      purchases: {
        ...user.purchases,
        listingBoosts: [...currentBoosts, { propertyId, expiresAt: expiresAt.toISOString() }],
      },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
    return { success: true, message: 'Listing boosted for 7 days!' };
  };

  const purchaseHostVerification = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Not logged in' };
    if (user.purchases?.hostVerificationBadge) {
      return { success: false, message: 'You already have the verification badge.' };
    }
    if (user.purchases?.hostVerificationPaid) {
      return { success: false, message: 'You have already purchased verification. Complete ID verification to activate your badge.' };
    }
    const updated = {
      ...user,
      purchases: { ...user.purchases, hostVerificationPaid: true },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
    return { success: true, message: 'Purchase complete! Now complete ID verification to activate your Host Verification Badge.' };
  };

  const purchaseSuperInterest = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Not logged in' };
    const current = user.purchases?.superInterestsRemaining || 0;
    const updated = {
      ...user,
      purchases: { ...user.purchases, superInterestsRemaining: current + 1 },
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
    return { success: true, message: 'Super Interest purchased!' };
  };

  const hostType = user?.hostType as 'individual' | 'agent' | 'company' | null | undefined;
  const hasCompletedHostOnboarding = user?.hasCompletedHostOnboarding ?? false;
  const canSwitchMode = user?.role === 'host' && hostType === 'individual' && hostType !== 'agent' && hostType !== 'company';
  const isFirstTimeHost = !hasCompletedHostOnboarding && hostType !== 'agent' && hostType !== 'company' && user?.role !== 'host';
  const effectiveMode: 'renter' | 'host' =
    hostType === 'agent' || hostType === 'company'
      ? 'host'
      : (user?.activeMode || 'renter');

  const switchMode = async (mode: 'renter' | 'host') => {
    if (!canSwitchMode || !user) return;
    const updated = { ...user, activeMode: mode as 'renter' | 'host' };
    setUser(updated);
    StorageService.setCurrentUser(updated).then(() => StorageService.addOrUpdateUser(updated));

    if (navigationRef?.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }

    if (isSupabaseConfigured) {
      supabase
        .from('profiles')
        .update({ active_mode: mode })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('[switchMode] Supabase error:', error);
        })
        .catch(createErrorHandler('AuthContext', 'switchMode'));
    }
  };

  function getTeamSeatLimitForPlan(plan: string): number {
    switch (plan) {
      case 'company_enterprise':
      case 'business': return Infinity;
      case 'company_pro':
      case 'pro': return 10;
      case 'company_starter':
      case 'starter': return 3;
      default: return 1;
    }
  }

  const getTeamSeatLimit = (): number => {
    const plan = user?.hostSubscription?.plan ?? 'free';
    return getTeamSeatLimitForPlan(plan);
  };

  const getTeamMembers = async (): Promise<TeamMember[]> => {
    if (!user || user.hostType !== 'company') return [];
    if (isSupabaseConfigured) {
      try {
        const queryPromise = supabase
          .from('team_members')
          .select('id, company_user_id, agent_user_id, role, status, permissions, created_at')
          .eq('company_user_id', user.id)
          .neq('status', 'removed')
          .order('created_at', { ascending: true });
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'Supabase query timed out' } }), 8000)
        );
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (error) {
          console.warn('[AuthContext] Supabase team_members query failed:', error.message);
        } else if (data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            companyUserId: d.company_user_id,
            memberUserId: d.member_user_id ?? undefined,
            email: d.email,
            fullName: d.full_name ?? undefined,
            role: d.role,
            status: d.status,
            invitedAt: d.invited_at,
            joinedAt: d.joined_at ?? undefined,
            agentLicenseNumber: d.agent_license_number ?? undefined,
            agentSpecialties: d.agent_specialties ?? undefined,
          }));
        } else if (data && data.length === 0) {
          return [];
        }
      } catch (e: any) {
        console.warn('[AuthContext] Supabase team_members error:', e?.message);
      }
    }
    try {
      const localData = await AsyncStorage.getItem(`@rhome/team_members_${user.id}`);
      if (localData) {
        const members = JSON.parse(localData);
        return members.map((m: { id: string; user_id: string; email: string; name: string; role: string; status?: string; invited_at?: string; joined_at?: string }) => ({
          id: m.id,
          companyUserId: user.id,
          memberUserId: m.user_id,
          email: m.email,
          fullName: m.name,
          role: m.role,
          status: m.status || 'active',
          invitedAt: m.invited_at || m.joined_at || new Date().toISOString(),
          joinedAt: m.joined_at,
        }));
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to load local team members:', e);
    }
    return [];
  };

  const sendTeamInviteEmail = async (teamMemberId: string) => {
    if (!user || !isSupabaseConfigured) return;
    try {
      const { error } = await withTimeout(
    supabase.functions.invoke('send-team-invite', {
        body: { teamMemberId },
      }),
    30000,
    'send-team-invite'
  );
      if (error) console.warn('Team invite email error:', error);
    } catch (e) {
      console.warn('Team invite email failed (invite still saved):', e);
    }
  };

  const inviteTeamMember = async (email: string, name: string, role: 'admin' | 'member' | 'agent', agentLicenseNumber?: string): Promise<void> => {
    if (!user || user.hostType !== 'company') return;
    const members = await getTeamMembers();
    const seatLimit = getTeamSeatLimit();
    const totalSeats = members.length + 1;
    if (totalSeats >= seatLimit) {
      throw new Error(`Your plan allows up to ${seatLimit} seats (including the owner). Upgrade to add more.`);
    }
    const sanitizedEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('team_members').insert({
        company_user_id: user.id,
        email: sanitizedEmail,
        full_name: name,
        role,
        status: 'pending',
        ...(role === 'agent' && agentLicenseNumber ? { agent_license_number: agentLicenseNumber } : {}),
      }).select('id').single();
      if (error) throw new Error(error.message);
      if (data?.id) {
        await sendTeamInviteEmail(data.id);
      }
    }
  };

  const resendTeamInvite = async (member: TeamMember): Promise<void> => {
    if (!user || user.hostType !== 'company') throw new Error('Only company accounts can resend invites.');
    if (member.status !== 'pending') throw new Error('Can only resend invites to pending members.');
    if (member.companyUserId !== user.id) throw new Error('You can only resend invites for your own team.');
    await sendTeamInviteEmail(member.id);
  };

  const removeTeamMember = async (memberId: string): Promise<void> => {
    if (!user) return;
    if (isSupabaseConfigured) {
      await supabase
        .from('team_members')
        .update({ status: 'removed' })
        .eq('id', memberId)
        .eq('company_user_id', user.id);
    }
  };

  const updateTeamMemberRole = async (memberId: string, role: 'admin' | 'member' | 'agent'): Promise<void> => {
    if (!user) return;
    if (isSupabaseConfigured) {
      await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId)
        .eq('company_user_id', user.id);
    }
  };

  const completeHostOnboarding = async () => {
    if (!user) return;
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({
          has_completed_host_onboarding: true,
          active_mode: 'host',
        })
        .eq('user_id', user.id);
      if (error) {
        console.error('[completeHostOnboarding] Supabase error:', error);
      }
    }
    const updated = {
      ...user,
      hasCompletedHostOnboarding: true,
      activeMode: 'host' as 'renter' | 'host',
    };
    await StorageService.setCurrentUser(updated);
    await StorageService.addOrUpdateUser(updated);
    setUser(updated);
  };

  const teamRole: 'owner' | 'admin' | 'member' | null = user?.hostType === 'company' ? 'owner' : null;
  const canInviteMembers = teamRole === 'owner' || teamRole === 'admin';
  const canManageBilling = teamRole === 'owner';
  const canDeleteListings = teamRole === 'owner' || teamRole === 'admin';
  const canRespondToInquiries = teamRole !== null;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, abandonSignup, resetPassword, passwordRecoveryMode, clearPasswordRecovery, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscription, cancelSubscriptionAtPeriodEnd, reactivateSubscription, getSubscriptionDetails, updateUser, blockUser: blockUserAction, unblockUser: unblockUserAction, reportUser: reportUserAction, isUserBlocked: isUserBlockedCheck, incrementMessageCount, canSendMessage, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, purchaseUndoPass, hasActiveUndoPass, getActiveChatLimit, canStartNewChat, incrementActiveChatCount, canRewind, useRewind, canSuperLike, useSuperLike, watchAdForCredit, getAdCredits, useAdCredit, isBasicUser, isPlaceSeeker, canViewListing, useListingView, canSendInterest, canSendSuperInterest, useSuperInterestCredit, canSendColdMessage, useColdMessage, canAskPi, incrementPiUsage, getSuperInterestCount, upgradeHostPlan, downgradeHostPlan, getHostPlan, canAddListing, canRespondToInquiry, useInquiryResponse, purchaseListingBoost, purchaseHostVerification, purchaseSuperInterest, completeOnboardingStep, cancelHostSubscriptionAtPeriodEnd, reactivateHostSubscription, softDeleteAccount, recoverDeletedAccount, updateLastActive, activeMode: effectiveMode, canSwitchMode, isFirstTimeHost, switchMode, completeHostOnboarding, getTeamMembers, inviteTeamMember, resendTeamInvite, removeTeamMember, updateTeamMemberRole, getTeamSeatLimit, teamRole, canInviteMembers, canManageBilling, canDeleteListings, canRespondToInquiries, refreshSession: loadUserFromSupabase }}>
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
