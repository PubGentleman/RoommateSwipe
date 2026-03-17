import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Modal, ScrollView, Alert, Text, Animated as RNAnimated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS, interpolate } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { RoommateProfile, Match, InterestCard, Group, Conversation } from '../../types/models';
import { isBoostExpired, getBoostDuration, getBoostTimeRemaining } from '../../utils/boostUtils';
import { dispatchInsightTrigger } from '../../utils/insightRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, moderateScale, getResponsiveSpacing } from '../../utils/responsive';
import { calculateCompatibility, getMatchQualityColor, getCleanlinessLabel, getSocialLevelLabel, getWorkScheduleLabel, getWorkStyleTag, validateProfileDataConsistency, formatMoveInDate, getGenderSymbol } from '../../utils/matchingAlgorithm';
import { getTagLabel, INTEREST_TAGS } from '../../constants/interestTags';
import { getCityFromNeighborhood } from '../../utils/locationData';
import { useCityContext } from '../../contexts/CityContext';
import { CityPickerModal, CityPillButton } from '../../components/CityPickerModal';
import { getZodiacSymbol, getZodiacCompatibilityLevel } from '../../utils/zodiacUtils';
import { RewardedAdButton } from '../../components/AdBanner';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { MatchCelebrationModal } from '../../components/MatchCelebrationModal';
import { PaywallSheet } from '../../components/PaywallSheet';
import { VerificationBadgeInline, getVerificationLevel } from '../../components/VerificationBadge';
import { LinearGradient } from 'expo-linear-gradient';
import { RoomdrLogo } from '../../components/RoomdrLogo';
import { RoommateFilterSheet, MatchFilters, DEFAULT_FILTERS, getActiveFilterCount, getActiveFilterChips, removeFilterChip, loadSavedFilters, saveFilters, applyFiltersToProfiles } from '../../components/RoommateFilterSheet';
import { PlanBadge } from '../../components/PlanBadge';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import type { ScreenContext } from '../../components/RoomdrAISheet';
import { trackSwipe, startSession, shouldShowRefinementQuestion, getQuestionsAsked } from '../../utils/refinementEngine';
import { getNextRefinementQuestion, REFINEMENT_QUESTIONS } from '../../utils/refinementQuestions';
import type { RefinementQuestion } from '../../utils/refinementQuestions';
import { getSwipeDeck, sendLike, sendPass, undoLastAction } from '../../services/discoverService';
import { getMyGroups as getMyGroupsFromSupabase } from '../../services/groupService';
import { recordSwipe, getAIMemory } from '../../utils/aiMemory';
import { getNextMicroQuestion } from '../../utils/aiMicroQuestions';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Limit card size for web/desktop viewing
const MAX_CARD_WIDTH = 420;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xxl, MAX_CARD_WIDTH);

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseUndoPass, canRewind, useRewind, canSuperLike, useSuperLike, blockUser, reportUser, canSendSuperInterest, useSuperInterestCredit, getSuperInterestCount, purchaseSuperInterest, canSendColdMessage, activateBoost, canBoost, purchaseBoost, checkAndUpdateBoostStatus } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useNotificationContext();
  const [profiles, setProfiles] = useState<RoommateProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [profileUsers, setProfileUsers] = useState<Map<string, any>>(new Map());
  const [showPaywall, setShowPaywall] = useState(false);
  
  const [lastSwipedProfile, setLastSwipedProfile] = useState<{ profile: RoommateProfile; action: 'like' | 'nope' | 'superlike' } | null>(null);
  const [showUndoUpgradeModal, setShowUndoUpgradeModal] = useState(false);
  const [processingUndoPass, setProcessingUndoPass] = useState(false);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showSuperLikeUpgradeModal, setShowSuperLikeUpgradeModal] = useState(false);
  const [showSuperInterestUpsell, setShowSuperInterestUpsell] = useState(false);
  const [showSuperInterestConfirm, setShowSuperInterestConfirm] = useState(false);
  const [superInterestGlow, setSuperInterestGlow] = useState(false);
  const [showSuperInterestFlash, setShowSuperInterestFlash] = useState(false);
  const superInterestScale = useSharedValue(1);
  const [showReportBlockModal, setShowReportBlockModal] = useState(false);
  const [matchedProfileData, setMatchedProfileData] = useState<{ profile: RoommateProfile; compatibility: number } | null>(null);
  const { activeCity, recentCities, setActiveCity, initialized: cityInitialized } = useCityContext();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [matchFilters, setMatchFilters] = useState<MatchFilters>({ ...DEFAULT_FILTERS });
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [unfilteredProfiles, setUnfilteredProfiles] = useState<RoommateProfile[]>([]);
  const [showAISheet, setShowAISheet] = useState(false);
  const [aiSheetContext, setAiSheetContext] = useState<ScreenContext>('match');
  const [refinementQuestion, setRefinementQuestion] = useState<RefinementQuestion | null>(null);
  const [showRefinementBanner, setShowRefinementBanner] = useState(false);
  const refinementBannerOpacity = useRef(new RNAnimated.Value(0)).current;
  const [rightSwipeCount, setRightSwipeCount] = useState(0);
  const [totalSwipeCount, setTotalSwipeCount] = useState(0);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [boostTimeLabel, setBoostTimeLabel] = useState('');
  const [userOpenGroup, setUserOpenGroup] = useState<Group | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isAnimatingSwipe = useSharedValue(false);
  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  useEffect(() => {
    const init = async () => {
      try {
        const savedFilters = await loadSavedFilters();
        setMatchFilters(savedFilters);
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    if (cityInitialized && !activeCity) {
      setShowCityPrompt(true);
    } else if (activeCity) {
      setShowCityPrompt(false);
    }
  }, [cityInitialized, activeCity]);

  useEffect(() => {
    startSession();
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [activeCity, matchFilters]);

  const checkRefinementTrigger = async () => {
    if (showAISheet) return;

    const alreadyAsked = await getQuestionsAsked();
    const allDone = alreadyAsked.length >= REFINEMENT_QUESTIONS.length;

    const should = await shouldShowRefinementQuestion(
      rightSwipeCount,
      totalSwipeCount,
      user?.profileData?.personalityAnswers ?? {},
      allDone
    );

    if (should) {
      const question = getNextRefinementQuestion(
        alreadyAsked,
        user?.profileData?.personalityAnswers ?? {}
      );
      if (question) {
        setTimeout(() => {
          setRefinementQuestion(question);
          setAiSheetContext('refinement');
          setShowAISheet(true);
        }, 800);
      }
    }
  };

  const checkMicroQuestionTrigger = async () => {
    if (showAISheet || !user) return;
    try {
      const mem = await getAIMemory();
      if (mem.rightSwipes % 25 !== 0 || mem.rightSwipes === 0) return;
      if (mem.lastRefinementTimestamp) {
        const hoursSince = (Date.now() - new Date(mem.lastRefinementTimestamp).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 3) return;
      }
      const nextQ = getNextMicroQuestion(user);
      if (!nextQ) return;
      const asRefinement: RefinementQuestion = {
        id: nextQ.id,
        aiMessage: nextQ.question,
        followUpMessage: 'Thanks for sharing! This helps us refine your matches.',
        options: [],
        profileField: nextQ.category,
      };
      setTimeout(() => {
        setRefinementQuestion(asRefinement);
        setAiSheetContext('refinement');
        setShowAISheet(true);
      }, 800);
    } catch {}
  };

  const showRefinementBannerBriefly = () => {
    setShowRefinementBanner(true);
    RNAnimated.timing(refinementBannerOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        RNAnimated.timing(refinementBannerOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setShowRefinementBanner(false);
        });
      }, 4000);
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('[RoommatesScreen] Screen focused, reloading profiles to get latest photos');
      loadProfiles();
      if (user) {
        (async () => {
          try {
            const supabaseGroups = await getMyGroupsFromSupabase('roommate');
            if (supabaseGroups && supabaseGroups.length > 0) {
              const mapped = supabaseGroups.map((g: any) => ({
                id: g.id,
                name: g.name,
                members: (g.group_members || []).map((m: any) => m.user_id),
                maxMembers: g.max_members || 10,
                createdBy: g.created_by,
              }));
              const openGroup = mapped.find((g: any) =>
                g.createdBy === user.id && g.members.length < g.maxMembers
              );
              setUserOpenGroup(openGroup || null);
              return;
            }
          } catch {}
          try {
            const groups = await StorageService.getGroups();
            const openGroup = groups.find(g =>
              g.createdBy === user.id &&
              g.members.includes(user.id) &&
              g.members.length < g.maxMembers
            );
            setUserOpenGroup(openGroup || null);
          } catch {}
        })();
      }
      return () => {
        dispatchInsightTrigger('swipe_session_end');
      };
    }, [activeCity, user])
  );

  const loadProfiles = async () => {
    try {
      setIsLoading(true);

      let allProfiles: RoommateProfile[] = [];
      let allUsers: any[] = [];
      let history = new Set<string>();
      let usedSupabase = false;

      try {
        const supabaseFilters: any = {};
        if (matchFilters.budgetMin > 0 || matchFilters.budgetMax < 10000) {
          supabaseFilters.budgetMin = matchFilters.budgetMin;
          supabaseFilters.budgetMax = matchFilters.budgetMax;
        }
        if (matchFilters.roomTypes && matchFilters.roomTypes.length > 0) {
          supabaseFilters.roomType = matchFilters.roomTypes[0];
        }
        if (matchFilters.minCompatibility && matchFilters.minCompatibility > 0) {
          supabaseFilters.minCompatibility = matchFilters.minCompatibility;
        }
        const deckProfiles = await getSwipeDeck(activeCity || undefined, supabaseFilters);
        if (deckProfiles && deckProfiles.length > 0) {
          allProfiles = deckProfiles.map((p: any) => ({
            id: p.id,
            name: p.full_name || p.name || 'Unknown',
            age: p.age || p.profile?.age || 0,
            gender: p.gender || p.profile?.gender,
            occupation: p.occupation || p.profile?.occupation || '',
            bio: p.bio || p.profile?.bio || '',
            budget: p.profile?.budget_max || p.profile?.budget || 0,
            photos: p.avatar_url ? [p.avatar_url] : p.profile?.photos || [],
            preferences: p.profile?.preferences || { location: '', moveInDate: '', bedrooms: 1 },
            lifestyle: p.profile?.lifestyle || { cleanliness: 3, socialLevel: 3, workSchedule: 'regular', pets: false, smoking: false },
            compatibility: p.profile?.compatibility,
            zodiacSign: p.profile?.zodiac_sign,
            moveInDate: p.profile?.move_in_date,
            verified: p.profile?.verified || false,
            profileData: {
              interests: Array.isArray(p.profile?.interests) ? p.profile.interests : [],
            },
          })) as RoommateProfile[];
          usedSupabase = true;
          console.log('[RoommatesScreen] Loaded profiles from Supabase:', allProfiles.length);
        }
      } catch (supabaseError) {
        console.log('[RoommatesScreen] Supabase getSwipeDeck failed, falling back to StorageService:', supabaseError);
      }

      if (!usedSupabase) {
        allProfiles = await StorageService.getRoommateProfiles();
        allUsers = await StorageService.getUsers();
        history = await StorageService.getSwipeHistory();
        setSwipedIds(history);

        const userMap = new Map(allUsers.map(u => [u.id, u]));
        setProfileUsers(userMap);

        const blockedIds = new Set(user?.blockedUsers || []);
        const filterCity = activeCity;
        const unseen = allProfiles.filter(p => {
          if (history.has(p.id) || p.id === user?.id || blockedIds.has(p.id)) return false;
          if (filterCity) {
            const profileUser = userMap.get(p.id);
            const profileUserCity = profileUser?.profileData?.city;
            if (profileUserCity && profileUserCity !== filterCity) return false;
            if (!profileUserCity && p.preferences?.location) {
              const profileCity = getCityFromNeighborhood(p.preferences.location);
              if (profileCity && profileCity !== filterCity) return false;
            }
          }
          return true;
        });
        allProfiles = unseen;
      }
      
      const profilesWithCompatibility = allProfiles.map(profile => {
        const compatibility = profile.compatibility || (user ? calculateCompatibility(user, profile) : 50);
        return {
          ...profile,
          compatibility,
        };
      });
      
      setUnfilteredCount(profilesWithCompatibility.length);
      setUnfilteredProfiles(profilesWithCompatibility);

      const filteredProfiles = usedSupabase ? profilesWithCompatibility : applyFiltersToProfiles(profilesWithCompatibility, matchFilters);

      const userMap = profileUsers.size > 0 ? profileUsers : new Map(allUsers.map((u: any) => [u.id, u]));

      const byCompatibility = (a: typeof filteredProfiles[0], b: typeof filteredProfiles[0]) =>
        (b.compatibility || 0) - (a.compatibility || 0);

      const isBoostedProfile = (p: typeof filteredProfiles[0]) => {
        const u = userMap.get(p.id);
        return u?.boostData?.isBoosted && u?.boostData?.boostExpiresAt && !isBoostExpired(String(u.boostData.boostExpiresAt));
      };

      const boosted = filteredProfiles.filter(isBoostedProfile).sort(byCompatibility);
      const normal = filteredProfiles.filter(p => !isBoostedProfile(p)).sort(byCompatibility);

      const topSlots = Math.ceil(filteredProfiles.length * 0.2);
      const boostedForTop = boosted.slice(0, topSlots);
      const boostedRemainder = boosted.slice(topSlots);

      const sortedProfiles = [...boostedForTop, ...boostedRemainder, ...normal];
      
      sortedProfiles.forEach(p => validateProfileDataConsistency(p));
      setProfiles(sortedProfiles);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSwipeHistory = async () => {
    await StorageService.clearSwipeHistory();
    await loadProfiles();
  };

  const currentProfile = profiles[currentIndex];
  const currentProfileUser = currentProfile ? profileUsers.get(currentProfile.id) : null;
  
  const isBoostActive = currentProfileUser?.boostData?.isBoosted && currentProfileUser?.boostData?.boostExpiresAt
    ? !isBoostExpired(String(currentProfileUser.boostData.boostExpiresAt))
    : false;
  const isBoosted = isBoostActive;
  const subscriptionPlan = currentProfileUser?.subscription?.plan || 'basic';
  
  const canSeeOnlineStatus = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    const canSee = (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
    console.log('[RoommatesScreen] Online status check:', { userPlan, userStatus, canSee });
    return canSee;
  };
  
  const isProfileOnline = currentProfile ? Math.random() > 0.5 : false;

  const advanceCard = () => {
    translateX.value = 0;
    translateY.value = 0;
    rotation.value = 0;
    cardOpacity.value = 0;
    isAnimatingSwipe.value = false;
    setCurrentIndex(prev => prev + 1);
    requestAnimationFrame(() => {
      cardOpacity.value = withTiming(1, { duration: 150 });
    });
  };

  const handleInviteToGroup = async () => {
    if (!userOpenGroup || !user || !matchedProfileData?.profile) return;
    try {
      await StorageService.sendGroupInvite({
        groupId: userOpenGroup.id,
        groupName: userOpenGroup.name,
        invitedUserId: matchedProfileData.profile.id,
        invitedByUserId: user.id,
        invitedByName: user.name || 'Someone',
        createdAt: new Date().toISOString(),
      });
      setShowMatch(false);
      setMatchedProfileData(null);
      Alert.alert(
        'Invite Sent!',
        `${matchedProfileData.profile.name} has been invited to join your group.`,
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Error', 'Could not send invite. Try again.');
    }
  };

  const handleSwipeAction = async (action: 'like' | 'nope' | 'superlike') => {
    if (!currentProfile || !user || isAnimatingSwipe.value) return;

    if (action === 'superlike') {
      const superLikeCheck = canSuperLike();
      if (!superLikeCheck.canSuperLike) {
        setShowSuperLikeUpgradeModal(true);
        return;
      }
      await useSuperLike();
    }

    isAnimatingSwipe.value = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setLastSwipedProfile({ profile: currentProfile, action });
    
    const direction = action === 'like' ? 1 : action === 'nope' ? -1 : 0;
    const toX = direction * SCREEN_WIDTH * 1.5;
    const toY = action === 'superlike' ? -SCREEN_HEIGHT : 0;
    const exitDuration = 250;

    translateX.value = withTiming(toX, { duration: exitDuration });
    translateY.value = withTiming(toY, { duration: exitDuration });
    rotation.value = withTiming(direction * 15, { duration: exitDuration }, () => {
      runOnJS(advanceCard)();
    });

    processSwipeAsync(action, currentProfile.id, user.id);
  };

  const handleUndo = async () => {
    const rewindCheck = canRewind();
    
    if (!rewindCheck.canRewind) {
      setShowUndoUpgradeModal(true);
      return;
    }
    
    if (!lastSwipedProfile) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await undoLastSwipeAsync(lastSwipedProfile.profile.id, lastSwipedProfile.action);
    
    await useRewind();
    
    setCurrentIndex(prev => prev - 1);
    setLastSwipedProfile(null);
  };

  const undoLastSwipeAsync = async (profileId: string, action: 'like' | 'nope' | 'superlike') => {
    try {
      try {
        await undoLastAction();
        console.log('[RoommatesScreen] Undo via Supabase successful');
        return;
      } catch (supabaseError) {
        console.log('[RoommatesScreen] Supabase undo failed, falling back to StorageService:', supabaseError);
      }

      await StorageService.removeFromSwipeHistory(profileId);
      
      if (action === 'like' || action === 'superlike') {
        await StorageService.removeLike(user!.id, profileId);
        await StorageService.removeMatch(user!.id, profileId);
      }
    } catch (error) {
      console.error('[RoommatesScreen] Error undoing swipe:', error);
    }
  };

  const processSwipeAsync = async (action: 'like' | 'nope' | 'superlike', profileId: string, userId: string) => {
    try {
      let supabaseResult: any = null;
      let usedSupabase = false;

      try {
        if (action === 'like' || action === 'superlike') {
          supabaseResult = await sendLike(profileId);
          usedSupabase = true;
          console.log('[RoommatesScreen] Sent like via Supabase');
        } else {
          await sendPass(profileId);
          usedSupabase = true;
          console.log('[RoommatesScreen] Sent pass via Supabase');
        }
      } catch (supabaseError) {
        console.log('[RoommatesScreen] Supabase swipe failed, falling back to StorageService:', supabaseError);
      }

      if (!usedSupabase) {
        await StorageService.addToSwipeHistory(profileId);
      }
      
      if (action === 'like' || action === 'superlike') {
        const isSuperLike = action === 'superlike';

        if (!usedSupabase) {
          await StorageService.addLike(userId, profileId, isSuperLike);
        }
        
        if (isSuperLike) {
          await StorageService.addNotification({
            id: `notification_superlike_${Date.now()}_${Math.random()}`,
            userId: profileId,
            type: 'super_like',
            title: 'Super Like!',
            body: `${user?.name || 'Someone'} super liked you!`,
            isRead: false,
            createdAt: new Date(),
            data: {
              fromUserId: userId,
              fromUserName: user?.name,
              fromUserPhoto: user?.profilePicture,
            },
          });
          
          await StorageService.addSuperLike(profileId, userId, user?.name, user?.profilePicture);
        }

        const hasMatch = usedSupabase ? !!supabaseResult?.match : await StorageService.checkReciprocalLike(userId, profileId);
        
        if (hasMatch) {
          if (!usedSupabase) {
            const match: Match = {
              id: `match_${Date.now()}`,
              userId1: userId,
              userId2: profileId,
              matchedAt: new Date(),
              isSuperLike,
              superLiker: isSuperLike ? userId : undefined,
              matchType: isSuperLike ? 'super_interest' : 'mutual',
            };
            await StorageService.addMatch(match);
          }

          const matchedProfile = profiles.find(p => p.id === profileId);
          if (matchedProfile) {
            setMatchedProfileData({
              profile: matchedProfile,
              compatibility: matchedProfile.compatibility || 50,
            });
          }

          const matchedName = matchedProfile?.name || 'Someone';
          const matchId = usedSupabase ? supabaseResult?.match?.id : `match_${Date.now()}`;

          await StorageService.addNotification({
            id: `notification_match_${Date.now()}_${Math.random()}`,
            userId: userId,
            type: 'match',
            title: 'New Match!',
            body: `You and ${matchedName} are a match! Start a conversation.`,
            isRead: false,
            createdAt: new Date(),
            data: {
              matchId,
              fromUserId: profileId,
              fromUserName: matchedName,
              fromUserPhoto: matchedProfile?.photos?.[0],
            },
          });

          await StorageService.addNotification({
            id: `notification_match_${Date.now()}_${Math.random()}_other`,
            userId: profileId,
            type: 'match',
            title: 'New Match!',
            body: `You and ${user?.name || 'Someone'} are a match! Start a conversation.`,
            isRead: false,
            createdAt: new Date(),
            data: {
              matchId,
              fromUserId: userId,
              fromUserName: user?.name,
              fromUserPhoto: user?.profilePicture,
            },
          });

          setShowMatch(true);
          await refreshUnreadCount();
        }
      }
      trackSwipe();
      setTotalSwipeCount(prev => prev + 1);
      const isRight = action === 'like' || action === 'superlike';
      if (isRight) {
        setRightSwipeCount(prev => prev + 1);
      }
      const matchedProfile = profiles.find(p => p.id === profileId);
      const score = matchedProfile?.compatibility;
      recordSwipe(isRight, score).catch(() => {});
      if (isRight) {
        checkMicroQuestionTrigger().catch(() => {});
      }
      checkRefinementTrigger();
    } catch (error) {
      console.error('[RoommatesScreen] Error processing swipe:', error);
    }
  };

  const superInterestBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: superInterestScale.value }],
  }));

  const handleSuperInterest = async () => {
    if (!currentProfile || !user) return;
    const check = canSendSuperInterest();
    if (!check.canSend) {
      setShowSuperInterestUpsell(true);
      return;
    }
    await useSuperInterestCredit();
    superInterestScale.value = withSequence(
      withTiming(1.3, { duration: 150 }),
      withTiming(1.0, { duration: 150 })
    );
    setShowSuperInterestFlash(true);
    setSuperInterestGlow(true);
    setShowSuperInterestConfirm(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setShowSuperInterestFlash(false), 400);
    setTimeout(() => {
      setShowSuperInterestConfirm(false);
      setSuperInterestGlow(false);
    }, 2000);
    await StorageService.addNotification({
      id: `notification_si_${Date.now()}_${Math.random()}`,
      userId: currentProfile.id,
      type: 'super_like',
      title: 'You got a Super Interest!',
      body: `${user.name || 'Someone'} really wants to connect with you`,
      isRead: false,
      createdAt: new Date(),
      data: {
        fromUserId: user.id,
        fromUserName: user.name,
        fromUserPhoto: user.profilePicture,
      },
    });
    await StorageService.addLike(user.id, currentProfile.id, true);
    await StorageService.addSuperLike(currentProfile.id, user.id, user.name, user.profilePicture);

    const interestCardId = `si-${Date.now()}`;
    const superInterestCard: InterestCard = {
      id: interestCardId,
      renterId: user.id,
      renterName: user.name || 'Renter',
      renterPhoto: user.profilePicture || '',
      propertyId: '',
      propertyTitle: currentProfile.name,
      hostId: currentProfile.id,
      compatibility: currentProfile.compatibility || 50,
      moveInDate: '',
      budgetRange: '',
      lifestyleTags: [],
      personalNote: '',
      status: 'pending',
      isSuperInterest: true,
      createdAt: new Date().toISOString(),
    };
    await StorageService.addInterestCard(superInterestCard);

    const superConvId = `super-conv-${interestCardId}`;
    const siSystemMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'system',
      text: 'You sent a Super Interest. The host will see this at the top of their inquiries.',
      content: 'You sent a Super Interest. The host will see this at the top of their inquiries.',
      timestamp: new Date(),
      read: true,
    };
    const superInterestConversation: Conversation = {
      id: superConvId,
      participant: {
        id: currentProfile.id,
        name: currentProfile.name,
        photo: currentProfile.photos?.[0] || '',
        online: false,
      },
      lastMessage: 'Super Interest sent — awaiting response',
      timestamp: new Date(),
      unread: 0,
      messages: [siSystemMessage],
      isInquiryThread: true,
      isSuperInterest: true,
      inquiryStatus: 'pending',
      inquiryId: interestCardId,
      listingTitle: currentProfile.name,
      listingPhoto: currentProfile.photos?.[0] || '',
      hostName: currentProfile.name,
      hostId: currentProfile.id,
    };
    await StorageService.addOrUpdateConversation(superInterestConversation);

    const isReciprocalMatch = await StorageService.checkReciprocalLike(user.id, currentProfile.id);
    if (isReciprocalMatch) {
      const match: Match = {
        id: `match_${Date.now()}`,
        userId1: user.id,
        userId2: currentProfile.id,
        matchedAt: new Date(),
        isSuperLike: true,
        superLiker: user.id,
        matchType: 'super_interest',
      };
      await StorageService.addMatch(match);
      setMatchedProfileData({ profile: currentProfile, compatibility: currentProfile.compatibility || 50 });
      await StorageService.addNotification({
        id: `notification_match_${Date.now()}_${Math.random()}`,
        userId: user.id,
        type: 'match',
        title: 'New Match!',
        body: `You and ${currentProfile.name} are a match!`,
        isRead: false,
        createdAt: new Date(),
        data: { matchId: match.id, fromUserId: currentProfile.id, fromUserName: currentProfile.name, fromUserPhoto: currentProfile.photos?.[0] },
      });
      await StorageService.addNotification({
        id: `notification_match_${Date.now()}_${Math.random()}_other`,
        userId: currentProfile.id,
        type: 'match',
        title: 'New Match!',
        body: `You and ${user.name || 'Someone'} are a match!`,
        isRead: false,
        createdAt: new Date(),
        data: { matchId: match.id, fromUserId: user.id, fromUserName: user.name, fromUserPhoto: user.profilePicture },
      });
      setShowMatch(true);
      await refreshUnreadCount();
    }
    setTimeout(() => handleSwipeAction('like'), 500);
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      if (isAnimatingSwipe.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotation.value = event.translationX / 20;
    })
    .onEnd((event) => {
      if (isAnimatingSwipe.value) return;
      if (Math.abs(event.translationX) > 120) {
        const action = event.translationX > 0 ? 'like' : 'nope';
        runOnJS(handleSwipeAction)(action);
      } else if (event.translationY < -120) {
        runOnJS(handleSwipeAction)('superlike');
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        rotation.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(200)
    .requireExternalGestureToFail(pan)
    .onEnd(() => {
      runOnJS(setCurrentPhotoIndex)(0);
      runOnJS(setShowProfileDetail)(true);
      if (currentProfile && user && currentProfile.id !== user.id) {
        runOnJS(StorageService.addProfileView)(currentProfile.id, user.id);
      }
    });

  const composedGesture = Gesture.Exclusive(tap, pan);

  const handleApplyFilters = async (newFilters: MatchFilters) => {
    setMatchFilters(newFilters);
    setShowFilterSheet(false);
    await saveFilters(newFilters);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveFilterChip = async (key: string) => {
    const updated = removeFilterChip(matchFilters, key);
    setMatchFilters(updated);
    await saveFilters(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRelaxFilters = async () => {
    setMatchFilters({ ...DEFAULT_FILTERS });
    await saveFilters({ ...DEFAULT_FILTERS });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const activeFilterChips = getActiveFilterChips(matchFilters);

  const handleCityChange = (city: string | null) => {
    setActiveCity(city);
    setCurrentPhotoIndex(0);
    setShowCityPicker(false);
    setShowCityPrompt(false);
  };

  const handleOpenAIAssistant = async () => {
    console.log('[AI Assistant] Button clicked');
    const users = await StorageService.getUsers();
    const currentUser = users.find(u => u.id === user?.id);
    const userPlan = currentUser?.subscription?.plan || 'basic';
    const userStatus = currentUser?.subscription?.status || 'active';
    
    console.log('[AI Assistant] User plan:', userPlan, 'Status:', userStatus);
    
    const isPaidMember = (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
    
    if (!isPaidMember) {
      console.log('[AI Assistant] Showing upgrade modal');
      setShowPaywall(true);
      return;
    }
    
    console.log('[AI Assistant] Navigating to AI Assistant screen');
    (navigation as any).navigate('AIAssistant');
  };

  const renderCitySelector = () => (
    <View style={styles.citySelectorRow}>
      <CityPillButton activeCity={activeCity} onPress={() => setShowCityPicker(true)} />
      <Pressable
        style={[styles.filterIconButton, getActiveFilterCount(matchFilters) > 0 ? { borderColor: '#ff6b5b' } : null]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowFilterSheet(true);
        }}
      >
        <Feather name="sliders" size={18} color={getActiveFilterCount(matchFilters) > 0 ? '#ff6b5b' : '#FFFFFF'} />
        {getActiveFilterCount(matchFilters) > 0 ? (
          <View style={styles.filterBadge}>
            <ThemedText style={styles.filterBadgeText}>{getActiveFilterCount(matchFilters)}</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );


  if (showCityPrompt && !activeCity) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={{ width: 42 }} />
          <RoomdrLogo variant="horizontal" size="sm" />
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.emptyState}>
          <Feather name="map-pin" size={64} color="#ff4d4d" />
          <ThemedText style={[Typography.h2, styles.emptyTitle, { color: '#FFFFFF' }]}>
            Where are you looking?
          </ThemedText>
          <ThemedText style={[Typography.body, { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: Spacing.xl }]}>
            Pick a city to start finding roommates near you
          </ThemedText>
          <Pressable
            style={[styles.resetButton, { backgroundColor: '#ff4d4d' }]}
            onPress={() => setShowCityPicker(true)}
          >
            <Feather name="map-pin" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Choose a City
            </ThemedText>
          </Pressable>
        </View>
        <CityPickerModal
          visible={showCityPicker}
          activeCity={activeCity}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onClose={() => setShowCityPicker(false)}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={{ width: 42 }} />
          <RoomdrLogo variant="horizontal" size="sm" />
          <View style={{ width: 42 }} />
        </View>
        {renderCitySelector()}
        <View style={styles.emptyState}>
          <Feather name="loader" size={64} color="rgba(255,255,255,0.35)" />
          <ThemedText style={[Typography.h2, styles.emptyTitle, { color: '#FFFFFF' }]}>Loading...</ThemedText>
        </View>
        <CityPickerModal
          visible={showCityPicker}
          activeCity={activeCity}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onClose={() => setShowCityPicker(false)}
        />
      </View>
    );
  }

  const lowProfileCount = profiles.length > 0 && profiles.length < 5 && activeCity;

  if (!currentProfile) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={handleOpenAIAssistant} style={styles.navIconBtn}>
            <View style={[styles.navIconBtnInner, { backgroundColor: '#ff4d4d' }]}>
              <Feather name="cpu" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
          <RoomdrLogo variant="horizontal" size="sm" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => (navigation as any).navigate('Profile', { screen: 'Notifications' })} style={styles.navIconBtn}>
              <View style={[styles.navIconBtnInner, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Feather name="bell" size={18} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        </View>
        {renderCitySelector()}
        <View style={styles.emptyState}>
          <Feather name={getActiveFilterCount(matchFilters) > 0 ? 'filter' : 'users'} size={64} color="rgba(255,255,255,0.35)" />
          <ThemedText style={[Typography.h2, styles.emptyTitle, { color: '#FFFFFF' }]}>
            {getActiveFilterCount(matchFilters) > 0
              ? 'No matches with these filters'
              : activeCity ? `No Profiles in ${activeCity}` : 'No More Profiles'}
          </ThemedText>
          <ThemedText style={[Typography.body, { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: Spacing.xl }]}>
            {getActiveFilterCount(matchFilters) > 0
              ? `${unfilteredCount} roommate${unfilteredCount !== 1 ? 's' : ''} available — try relaxing your filters`
              : activeCity
                ? 'Try browsing All Cities or switch to a different city'
                : "You've seen all available roommates"}
          </ThemedText>
          {getActiveFilterCount(matchFilters) > 0 ? (
            <Pressable
              style={[styles.resetButton, { backgroundColor: '#ff6b5b' }]}
              onPress={handleRelaxFilters}
            >
              <Feather name="x-circle" size={20} color="#FFFFFF" />
              <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
                Relax Filters
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.resetButton, { backgroundColor: '#ff4d4d', marginTop: getActiveFilterCount(matchFilters) > 0 ? Spacing.sm : 0 }]}
            onPress={resetSwipeHistory}
          >
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Start Over
            </ThemedText>
          </Pressable>
        </View>
        <CityPickerModal
          visible={showCityPicker}
          activeCity={activeCity}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onClose={() => setShowCityPicker(false)}
        />
        <RoommateFilterSheet
          visible={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          onApply={handleApplyFilters}
          currentFilters={matchFilters}
          allProfiles={unfilteredProfiles}
          userPlan={user?.subscription?.plan || 'basic'}
        />
      </View>
    );
  }

  const handleUpgradeToPaid = () => {
    setShowPaywall(false);
    (navigation as any).navigate('Profile', { screen: 'Payment' });
  };


  

  const handlePurchaseUndoPass = async () => {
    setProcessingUndoPass(true);
    const result = await purchaseUndoPass();
    setProcessingUndoPass(false);
    
    if (result.success) {
      setShowUndoUpgradeModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (result.message.includes('payment method')) {
        (navigation as any).navigate('Profile', { screen: 'Payment' });
        setShowUndoUpgradeModal(false);
      }
    }
  };

  const handleMessageClick = async () => {
    if (!currentProfile || !user) return;
    const matches = await StorageService.getMatches();
    const hasMatch = matches.some(m =>
      (m.userId1 === user.id && m.userId2 === currentProfile.id) ||
      (m.userId2 === user.id && m.userId1 === currentProfile.id)
    );
    if (hasMatch) {
      handleSendDirectMessage(false);
    } else {
      const coldCheck = await canSendColdMessage();
      if (!coldCheck.canSend) {
        Alert.alert(
          'Daily Limit Reached',
          coldCheck.reason || "You've used all your messages for today. Resets at midnight.",
          [
            { text: 'Upgrade for More', onPress: () => (navigation as any).getParent()?.navigate('Profile', { screen: 'Plans' }) },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }
      handleSendDirectMessage(true);
    }
  };

  const handleSendDirectMessage = async (isCold: boolean) => {
    if (!currentProfile || !user) return;
    
    const conversations = await StorageService.getConversations();
    let existingConversation = conversations.find(c =>
      c.participant.id === currentProfile.id
    );

    let conversationId: string;
    
    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const storedMatches = await StorageService.getMatches();
      const thisMatch = storedMatches.find(m =>
        (m.userId1 === user.id && m.userId2 === currentProfile.id) ||
        (m.userId2 === user.id && m.userId1 === currentProfile.id)
      );

      conversationId = thisMatch
        ? `conv_${thisMatch.id}`
        : `conv-cold-${currentProfile.id}`;

      const compatibility = user ? calculateCompatibility(user, currentProfile) : 0;
      const systemText = isCold
        ? `You sent a direct message request to ${currentProfile.name}.`
        : `You matched with ${currentProfile.name}! Say hello.`;

      const systemMessage = {
        id: `msg-sys-${Date.now()}`,
        senderId: 'system',
        text: systemText,
        content: systemText,
        timestamp: new Date(),
        read: true,
      };

      const newConversation: any = {
        id: conversationId,
        participant: {
          id: currentProfile.id,
          name: currentProfile.name,
          photo: currentProfile.photos?.[0] || currentProfile.profilePicture || '',
          online: false,
        },
        lastMessage: isCold ? 'Direct message request sent' : 'You matched! Say hello.',
        lastMessageTime: new Date(),
        timestamp: new Date(),
        unreadCount: 0,
        unread: 0,
        messages: [systemMessage],
        matchType: isCold ? 'cold' : 'mutual',
        isInquiryThread: true,
        inquiryStatus: isCold ? 'pending' : 'accepted',
        hostName: currentProfile.name,
        hostPhoto: currentProfile.photos?.[0] || currentProfile.profilePicture || '',
        compatibilityScore: compatibility,
        createdAt: new Date().toISOString(),
      };
      await StorageService.addOrUpdateConversation(newConversation);

      await StorageService.addNotification({
        id: `notif_msg_${Date.now()}`,
        userId: currentProfile.id,
        type: isCold ? 'cold_message' : 'new_match_message',
        title: isCold ? 'New Message Request' : 'New Match!',
        body: `${user.name} wants to chat with you`,
        isRead: false,
        createdAt: new Date(),
        data: {
          conversationId,
          fromUserId: user.id,
          fromUserName: user.name,
          fromUserPhoto: user.profilePicture,
        },
      });
    }

    const profileForChat = currentProfile;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const tabNavigation = (navigation as any).getParent();
    if (tabNavigation) {
      tabNavigation.navigate('Messages', { screen: 'MessagesList' });
      setTimeout(() => {
        tabNavigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            conversationId,
            otherUser: profileForChat,
          },
        });
      }, 50);
    }
  };


  const photosArray = Array.isArray(currentProfile.photos) ? currentProfile.photos : currentProfile.photos ? [currentProfile.photos] : [];

  return (
    <View style={[styles.container, { backgroundColor: '#141414' }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={handleOpenAIAssistant} style={styles.navIconBtn}>
          <View style={[styles.navIconBtnInner, { backgroundColor: '#ff4d4d' }]}>
            <Feather name="cpu" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
        <RoomdrLogo variant="horizontal" size="sm" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => {
            if (user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt))) {
              setBoostTimeLabel(getBoostTimeRemaining(user.boostData.boostExpiresAt));
            }
            setShowBoostModal(true);
          }} style={styles.navIconBtn}>
            <View style={[styles.navIconBtnInner, user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt))
              ? { backgroundColor: '#FFD700' }
              : { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
            ]}>
              <Feather name="zap" size={18} color={user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt)) ? '#000000' : '#FFD700'} />
            </View>
          </Pressable>
          <Pressable onPress={() => (navigation as any).navigate('Profile', { screen: 'Notifications' })} style={styles.navIconBtn}>
            <View style={[styles.navIconBtnInner, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Feather name="bell" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      </View>

      {renderCitySelector()}

      {activeFilterChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipsRow}
          contentContainerStyle={styles.filterChipsContent}
        >
          {activeFilterChips.map(chip => (
            <Pressable
              key={chip.key}
              style={styles.filterChipDismissible}
              onPress={() => handleRemoveFilterChip(chip.key)}
            >
              <ThemedText style={styles.filterChipDismissibleText}>{chip.label}</ThemedText>
              <Feather name="x" size={12} color="rgba(255,255,255,0.6)" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {lowProfileCount ? (
        <View style={styles.lowProfileBanner}>
          <Feather name="info" size={14} color="#FFD700" />
          <ThemedText style={styles.lowProfileBannerText}>
            Not many roommates here yet — be the first!
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.cardArea}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[
            styles.card,
            animatedCardStyle,
            isBoosted ? styles.cardBoostedGlow : null,
            user?.receivedSuperLikes?.some((sl: { superLikerId: string }) => sl.superLikerId === currentProfile.id) ? styles.cardSuperInterestGlow : null,
          ]}>
            <Image source={{ uri: photosArray[0] }} resizeMode="cover" style={styles.cardImage} />

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.4, 1]}
              style={[styles.cardGradient, { pointerEvents: 'none' }]}
            />

            {photosArray.length > 1 ? (
              <View style={styles.photoDots}>
                {photosArray.map((_, idx) => (
                  <View key={`dot-${idx}`} style={[styles.photoDotBar, idx === currentPhotoIndex ? styles.photoDotBarActive : null]} />
                ))}
              </View>
            ) : null}

            {user?.receivedSuperLikes?.some((sl: { superLikerId: string }) => sl.superLikerId === currentProfile.id) ? (
              <View style={styles.superInterestCardBadge}>
                <LinearGradient colors={['#4A90E2', '#1a5fc4']} style={{ width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                  <Feather name="star" size={14} color="#fff" />
                </LinearGradient>
              </View>
            ) : null}

            {isBoosted ? (
              <View style={styles.boostedBadge}>
                <Feather name="zap" size={12} color="#fff" />
              </View>
            ) : null}

            <View style={styles.cardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {currentProfile.name}, {currentProfile.age}
                </ThemedText>
                <PlanBadge plan={subscriptionPlan} size={16} />
                {getVerificationLevel(currentProfile.verification) >= 2 ? (
                  <View style={styles.verifiedCheckCard}>
                    <Feather name="check-circle" size={16} color="#2563EB" />
                  </View>
                ) : null}
                {(currentProfile as any).references?.length > 0 ? (
                  <View style={styles.refBadgeCard}>
                    <Feather name="star" size={12} color="#FFD700" />
                    <ThemedText style={styles.refBadgeText}>{(currentProfile as any).references.length}</ThemedText>
                  </View>
                ) : null}
                {(currentProfile as any).background_check_status === 'clear' ? (
                  <View style={styles.bgBadgeCard}>
                    <Feather name="shield" size={12} color="#22c55e" />
                  </View>
                ) : null}
              </View>
              {user?.receivedSuperLikes?.some((sl: { superLikerId: string }) => sl.superLikerId === currentProfile.id) ? (
                <ThemedText style={styles.superInterestCardLabel}>Sent you a Super Interest</ThemedText>
              ) : null}
              <ThemedText style={styles.cardJob} numberOfLines={1}>
                {getTagLabel(currentProfile.occupation) || currentProfile.occupation} {currentProfile.preferences?.location ? `\u00B7 ${currentProfile.preferences.location}` : ''}
              </ThemedText>
              <ThemedText style={styles.cardBio} numberOfLines={2}>
                {currentProfile.bio}
              </ThemedText>
              <View style={styles.cardTags}>
                {currentProfile.budget ? (
                  <View style={styles.tagDark}>
                    <Feather name="dollar-sign" size={12} color="rgba(255,255,255,0.85)" />
                    <ThemedText style={styles.tagDarkText}>${currentProfile.budget}/mo</ThemedText>
                  </View>
                ) : null}
                {getWorkStyleTag(currentProfile.profileData?.preferences?.workLocation) ? (
                  <View style={styles.tagDark}>
                    <Feather name="briefcase" size={12} color="rgba(255,255,255,0.85)" />
                    <ThemedText style={styles.tagDarkText}>{getWorkStyleTag(currentProfile.profileData?.preferences?.workLocation)}</ThemedText>
                  </View>
                ) : null}
                {currentProfile.preferences?.location ? (
                  <View style={styles.tagDark}>
                    <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
                    <ThemedText style={styles.tagDarkText} numberOfLines={1}>{currentProfile.preferences.location}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.tagMatch}>
                  <Feather name="heart" size={12} color="#ff8070" />
                  <ThemedText style={styles.tagMatchText}>{currentProfile.compatibility || 50}% Match</ThemedText>
                </View>
              </View>
              {(() => {
                const rawMyTags = user?.profileData?.interests;
                const myTags: string[] = Array.isArray(rawMyTags) ? rawMyTags : [];
                const rawTheirTags = (currentProfile.profileData?.interests) || (currentProfile as any).interests;
                const theirTags: string[] = Array.isArray(rawTheirTags) ? rawTheirTags : [];
                const shared = myTags.filter(t => theirTags.includes(t)).slice(0, 3);
                if (shared.length === 0) return null;
                return (
                  <View style={{ marginTop: 6 }}>
                    <ThemedText style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>You both</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {shared.map(tagId => (
                        <View key={tagId} style={{ backgroundColor: 'rgba(255,107,91,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                          <ThemedText style={{ fontSize: 11, color: '#ff6b5b', fontWeight: '600' }}>{getTagLabel(tagId)}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          </Animated.View>
        </GestureDetector>

        <Pressable
          style={styles.flagBtn}
          onPress={() => setShowReportBlockModal(true)}
        >
          <Feather name="flag" size={14} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View style={styles.adBanner}>
          <View style={styles.adLeft}>
            <View style={styles.adLogo}>
              <Feather name="home" size={16} color="#FFFFFF" />
            </View>
            <View>
              <ThemedText style={styles.adSponsoredLabel}>SPONSORED</ThemedText>
              <ThemedText style={styles.adTitle}>Renters Insurance from $5/mo</ThemedText>
              <ThemedText style={styles.adSubtitle}>Protect your belongings</ThemedText>
            </View>
          </View>
          <View style={styles.adCta}>
            <ThemedText style={styles.adCtaText}>View</ThemedText>
            <Feather name="arrow-right" size={10} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtnSm, styles.actionUndo, { opacity: lastSwipedProfile ? 1 : 0.4 }]}
          onPress={handleUndo}
        >
          <Feather name="rotate-ccw" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
        <Pressable
          style={[styles.actionBtnMd, styles.actionPass]}
          onPress={() => handleSwipeAction('nope')}
        >
          <Feather name="x" size={24} color="#ff4d4d" />
        </Pressable>
        <Animated.View style={superInterestBtnStyle}>
          <Pressable
            style={[styles.actionBtnSuperInterest, getSuperInterestCount() === 0 && user?.subscription?.plan !== 'elite' ? { opacity: 0.4 } : null]}
            onPress={handleSuperInterest}
          >
            <LinearGradient colors={['#4A90E2', '#1a5fc4']} style={styles.actionBtnSuperInterestGradient}>
              <Feather name="star" size={24} color="#fff" />
              {getSuperInterestCount() === 0 && user?.subscription?.plan !== 'elite' ? (
                <View style={styles.superInterestLockBadge}>
                  <Feather name="lock" size={10} color="#fff" />
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        </Animated.View>
        <Pressable
          style={[styles.actionBtnMd, styles.actionMsg]}
          onPress={handleMessageClick}
        >
          <Feather name="message-square" size={22} color="#ff6b8a" />
        </Pressable>
        <Pressable
          style={[styles.actionBtnLg, styles.actionLike]}
          onPress={() => handleSwipeAction('like')}
        >
          <Feather name="heart" size={28} color="#2ecc71" />
        </Pressable>
      </View>

      <MatchCelebrationModal
        visible={showMatch}
        currentUserPhoto={user?.profilePicture}
        currentUserName={user?.name}
        currentUserPlan={user?.subscription?.plan}
        matchedUserPhoto={matchedProfileData?.profile?.photos?.[0]}
        matchedUserName={matchedProfileData?.profile?.name}
        matchedUserPlan={matchedProfileData?.profile ? profileUsers.get(matchedProfileData.profile.id)?.subscription?.plan : undefined}
        compatibility={matchedProfileData?.compatibility}
        onSendMessage={async () => {
          const profile = matchedProfileData?.profile;
          setShowMatch(false);
          setMatchedProfileData(null);

          if (profile) {
            const conversations = await StorageService.getConversations();
            let existingConversation = conversations.find(c =>
              c.participant.id === profile.id
            );

            let conversationId: string;

            if (existingConversation) {
              conversationId = existingConversation.id;
            } else {
              const storedMatches = await StorageService.getMatches();
              const thisMatch = storedMatches.find(m =>
                (m.userId1 === user?.id && m.userId2 === profile.id) ||
                (m.userId2 === user?.id && m.userId1 === profile.id)
              );
              conversationId = thisMatch
                ? `conv_${thisMatch.id}`
                : `conv-match-${profile.id}`;

              const compatibility = user ? calculateCompatibility(user, profile) : 0;
              const systemText = `You matched with ${profile.name}! Say hello.`;
              const systemMessage = {
                id: `msg-sys-${Date.now()}`,
                senderId: 'system',
                text: systemText,
                content: systemText,
                timestamp: new Date(),
                read: true,
              };

              const newConversation = {
                id: conversationId,
                participant: {
                  id: profile.id,
                  name: profile.name,
                  photo: profile.photos?.[0] || '',
                  online: false,
                },
                lastMessage: 'You matched! Say hello.',
                lastMessageTime: new Date(),
                timestamp: new Date(),
                unreadCount: 0,
                unread: 0,
                messages: [systemMessage],
                matchType: (thisMatch?.matchType || 'mutual') as 'mutual' | 'super_interest' | 'cold',
                isInquiryThread: true,
                inquiryStatus: 'accepted' as const,
                hostName: profile.name,
                hostPhoto: profile.photos?.[0] || '',
                compatibilityScore: compatibility,
                createdAt: new Date().toISOString(),
              };
              await StorageService.addOrUpdateConversation(newConversation);

              await StorageService.addNotification({
                id: `notif_match_msg_${Date.now()}`,
                userId: profile.id,
                type: 'new_match_message',
                title: 'New Match!',
                body: `${user?.name} wants to chat with you`,
                isRead: false,
                createdAt: new Date(),
                data: {
                  conversationId,
                  fromUserId: user?.id,
                  fromUserName: user?.name,
                  fromUserPhoto: user?.profilePicture,
                },
              });
            }

            const tabNavigation = (navigation as any).getParent();
            if (tabNavigation) {
              tabNavigation.navigate('Messages', { screen: 'MessagesList' });
              setTimeout(() => {
                tabNavigation.navigate('Messages', {
                  screen: 'Chat',
                  params: {
                    conversationId,
                    otherUser: profile,
                  },
                });
              }, 50);
            }
          }
        }}
        onKeepSwiping={() => {
          setShowMatch(false);
          setMatchedProfileData(null);
        }}
        showInviteToGroup={!!userOpenGroup}
        onInviteToGroup={handleInviteToGroup}
      />

      <PaywallSheet
        visible={showPaywall}
        featureName="AI Match Assistant"
        requiredPlan="plus"
        role="renter"
        onUpgrade={handleUpgradeToPaid}
        onDismiss={() => setShowPaywall(false)}
      />

      <Modal visible={showBoostModal} animationType="slide" transparent onRequestClose={() => setShowBoostModal(false)}>
        <Pressable style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]} onPress={() => setShowBoostModal(false)}>
          <Pressable style={styles.boostSheet} onPress={() => {}}>
            <View style={styles.boostSheetHandle} />
            {(() => {
              const plan = user?.subscription?.plan || 'basic';
              const boostCheck = canBoost();
              const duration = getBoostDuration(plan);
              const boostActive = user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt));

              const handleBoostConfirm = async (paid?: boolean) => {
                setProcessingBoost(true);
                const result = paid ? await purchaseBoost() : await activateBoost();
                setProcessingBoost(false);
                if (result.success) {
                  setShowBoostModal(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Alert.alert('Cannot Boost', result.message);
                }
              };

              if (boostActive) {
                return (
                  <>
                    <View style={styles.boostSheetHeader}>
                      <View style={styles.boostSheetIconWrap}>
                        <Feather name="zap" size={28} color="#FFD700" />
                      </View>
                      <Text style={styles.boostSheetTitle}>Boost Already Active</Text>
                      <Text style={styles.boostSheetDesc}>{boostTimeLabel}</Text>
                    </View>
                    {plan === 'elite' ? (
                      <Text style={styles.boostSheetNote}>You can activate a new boost once this one expires</Text>
                    ) : null}
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowBoostModal(false)}>
                      <Text style={styles.boostSheetDismissText}>Got it</Text>
                    </Pressable>
                  </>
                );
              }

              if (plan === 'basic') {
                return (
                  <>
                    <View style={styles.boostSheetHeader}>
                      <View style={styles.boostSheetIconWrap}>
                        <Feather name="zap" size={28} color="#ff6b5b" />
                      </View>
                      <Text style={styles.boostSheetTitle}>Boost Your Profile</Text>
                      <Text style={styles.boostSheetDesc}>Your profile appears near the top of swipe decks for {duration} hours</Text>
                    </View>
                    <View style={styles.boostSheetPriceRow}>
                      <Text style={styles.boostSheetPrice}>$4.99</Text>
                      <Text style={styles.boostSheetPriceSub}>{duration} hours of priority placement</Text>
                    </View>
                    <Pressable
                      style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                      onPress={() => handleBoostConfirm(true)}
                      disabled={processingBoost}
                    >
                      <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                        <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Processing...' : 'Boost for $4.99'}</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowBoostModal(false)}>
                      <Text style={styles.boostSheetDismissText}>Cancel</Text>
                    </Pressable>
                  </>
                );
              }

              if (plan === 'plus') {
                const hasFree = boostCheck.hasFreeBoost;
                return (
                  <>
                    <View style={styles.boostSheetHeader}>
                      <View style={styles.boostSheetIconWrap}>
                        <Feather name="zap" size={28} color={hasFree ? '#3ECF8E' : '#FFD700'} />
                      </View>
                      <Text style={styles.boostSheetTitle}>{hasFree ? 'Boost Your Profile — Free with Plus' : 'Free Boost Used'}</Text>
                      <Text style={styles.boostSheetDesc}>
                        {hasFree
                          ? `Your profile appears near the top of swipe decks for ${duration} hours`
                          : boostCheck.nextAvailableAt
                            ? `Your next free boost is available on ${new Date(boostCheck.nextAvailableAt).toLocaleDateString()}`
                            : 'Your free boost is on cooldown'}
                      </Text>
                    </View>
                    {hasFree ? (
                      <Pressable
                        style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                        onPress={() => handleBoostConfirm(false)}
                        disabled={processingBoost}
                      >
                        <LinearGradient colors={['#3ECF8E', '#2bb878']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                          <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Activating...' : 'Activate Free Boost'}</Text>
                        </LinearGradient>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                        onPress={() => handleBoostConfirm(true)}
                        disabled={processingBoost}
                      >
                        <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                          <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Processing...' : 'Boost now for $4.99 (12 hours)'}</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowBoostModal(false)}>
                      <Text style={styles.boostSheetDismissText}>Cancel</Text>
                    </Pressable>
                  </>
                );
              }

              return (
                <>
                  <View style={styles.boostSheetHeader}>
                    <View style={[styles.boostSheetIconWrap, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                      <Feather name="zap" size={28} color="#FFD700" />
                    </View>
                    <Text style={styles.boostSheetTitle}>Boost Your Profile — Unlimited with Elite</Text>
                    <Text style={styles.boostSheetDesc}>Your profile appears near the top of swipe decks for {duration} hours</Text>
                  </View>
                  <Pressable
                    style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                    onPress={() => handleBoostConfirm(false)}
                    disabled={processingBoost}
                  >
                    <LinearGradient colors={['#FFD700', '#f0c000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                      <Text style={[styles.boostSheetCtaText, { color: '#000' }]}>{processingBoost ? 'Activating...' : 'Activate Boost'}</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable style={styles.boostSheetDismiss} onPress={() => setShowBoostModal(false)}>
                    <Text style={styles.boostSheetDismissText}>Cancel</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showUndoUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUndoUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.warning }]}>
              <Feather name="rotate-ccw" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                {user?.subscription?.plan === 'plus' ? 'Daily Rewind Limit Reached' : 'Undo Swipe'}
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                {user?.subscription?.plan === 'plus' 
                  ? "You've used all 5 rewinds for today! Upgrade to Elite for unlimited rewinds or try again tomorrow."
                  : 'Take back your last swipe and get a second chance!'}
              </ThemedText>
              
              {user?.subscription?.plan === 'plus' ? (
                <View style={styles.vipFeaturesList}>
                  <View style={styles.vipFeatureItem}>
                    <Feather name="info" size={20} color={theme.info} />
                    <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                      Your 5 daily rewinds reset at midnight
                    </ThemedText>
                  </View>
                  <View style={styles.vipFeatureItem}>
                    <Feather name="zap" size={20} color={theme.warning} />
                    <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                      Elite members get unlimited rewinds
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <>
                  <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                      24-Hour Undo Pass
                    </ThemedText>
                    <ThemedText style={[Typography.h1, { color: theme.warning, marginBottom: Spacing.xs }]}>
                      $1.99
                    </ThemedText>
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      Undo swipes for 24 hours
                    </ThemedText>
                  </View>
                  
                  <View style={styles.vipFeaturesList}>
                    <View style={styles.vipFeatureItem}>
                      <Feather name="check-circle" size={20} color={theme.success} />
                      <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                        Take back your last swipe
                      </ThemedText>
                    </View>
                    <View style={styles.vipFeatureItem}>
                      <Feather name="check-circle" size={20} color={theme.success} />
                      <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                        24-hour unlimited undo access
                      </ThemedText>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            <View style={styles.vipModalActions}>
              <RewardedAdButton creditType="rewinds" style={{ marginBottom: Spacing.md, marginHorizontal: 0 }} />
              {user?.subscription?.plan !== 'plus' ? (
                <>
                  <Pressable
                    style={[styles.vipModalButton, { backgroundColor: theme.warning, opacity: processingUndoPass ? 0.7 : 1 }]}
                    onPress={handlePurchaseUndoPass}
                    disabled={processingUndoPass}
                  >
                    <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                      {processingUndoPass ? 'Processing...' : 'Get 24hr Pass - $1.99'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.vipModalButton, { backgroundColor: theme.primary, marginTop: Spacing.md }]}
                    onPress={() => {
                      setShowUndoUpgradeModal(false);
                      navigation.navigate('Settings' as never);
                    }}
                  >
                    <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                      Upgrade to Plus
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[styles.vipModalButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setShowUndoUpgradeModal(false);
                    navigation.navigate('Settings' as never);
                  }}
                >
                  <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                    Upgrade to Elite
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowUndoUpgradeModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Maybe Later
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>


      <Modal
        visible={showSuperLikeUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuperLikeUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.info }]}>
              <Feather name="star" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                {canSuperLike().message?.includes('Upgrade to Plus') ? 'Plus Feature' : 'Elite Feature'}
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                {canSuperLike().message}
              </ThemedText>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="star" size={20} color={theme.info} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Basic: 1 Super Like per day
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="star" size={20} color={theme.info} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Plus: 3 Super Likes per day
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="star" size={20} color={theme.info} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Elite: Unlimited Super Likes
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <RewardedAdButton creditType="superLikes" style={{ marginBottom: Spacing.md, marginHorizontal: 0 }} />
              <Pressable
                style={[styles.vipCancelButton, { borderColor: theme.border }]}
                onPress={() => setShowSuperLikeUpgradeModal(false)}
              >
                <ThemedText style={[Typography.h3, { color: theme.textSecondary }]}>
                  Maybe Later
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipUpgradeButton, { backgroundColor: theme.info }]}
                onPress={() => {
                  setShowSuperLikeUpgradeModal(false);
                  (navigation as any).navigate('Profile', { 
                    screen: 'Subscription',
                  });
                }}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showSuperInterestFlash ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, pointerEvents: 'none' }}>
          <LinearGradient colors={['rgba(74,144,226,0.3)', 'rgba(26,95,196,0.1)', 'transparent']} style={{ flex: 1 }} />
        </View>
      ) : null}

      {showSuperInterestConfirm ? (
        <View style={{ position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: 'rgba(74,144,226,0.95)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, zIndex: 999, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="star" size={16} color="#fff" />
          <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Super Interest Sent!</ThemedText>
        </View>
      ) : null}

      <Modal
        visible={showSuperInterestUpsell}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuperInterestUpsell(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Pressable style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onPress={() => setShowSuperInterestUpsell(false)}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
            <View style={[styles.vipModalHeader, { backgroundColor: '#4A90E2' }]}>
              <Feather name="star" size={36} color="#FFFFFF" />
            </View>
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                You're out of Super Interests
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Stand out instantly — your profile gets highlighted on their card and they're notified right away
              </ThemedText>
            </View>
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipUpgradeButton, { backgroundColor: '#4A90E2', marginBottom: Spacing.sm }]}
                onPress={async () => {
                  await purchaseSuperInterest();
                  setShowSuperInterestUpsell(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  3 Super Interests for $1.99
                </ThemedText>
              </Pressable>
              <ThemedText style={[Typography.small, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.md }]}>
                Or $0.99 each
              </ThemedText>
              <Pressable
                style={[styles.vipUpgradeButton, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#ff6b5b', marginBottom: Spacing.sm }]}
                onPress={() => {
                  setShowSuperInterestUpsell(false);
                  (navigation as any).navigate('Profile', { screen: 'Subscription' });
                }}
              >
                <ThemedText style={[Typography.h3, { color: '#ff6b5b' }]}>
                  Get 5 free every month with Plus — $14.99/mo
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {currentProfile ? (
        <ReportBlockModal
          visible={showReportBlockModal}
          onClose={() => setShowReportBlockModal(false)}
          userName={currentProfile.name}
          onReport={async (reason) => {
            await reportUser(currentProfile.id, reason);
          }}
          onBlock={async () => {
            await blockUser(currentProfile.id);
            setShowReportBlockModal(false);
            await loadProfiles();
          }}
        />
      ) : null}

      <Modal
        visible={showProfileDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileDetail(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              <View style={styles.detailHeader}>
                <ThemedText style={[Typography.h2]}>Profile Details</ThemedText>
              </View>
              
              {/* Photo gallery */}
            {(() => {
              const photosArray = Array.isArray(currentProfile.photos) 
                ? currentProfile.photos 
                : currentProfile.photos 
                  ? [currentProfile.photos]
                  : [];
              
              const handlePrevPhoto = () => {
                setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photosArray.length - 1));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              };
              
              const handleNextPhoto = () => {
                setCurrentPhotoIndex(prev => (prev < photosArray.length - 1 ? prev + 1 : 0));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              };
              
              return (
                <>
                  <View style={styles.photoGalleryContainer}>
                    <Image 
                      source={{ uri: photosArray[currentPhotoIndex] || photosArray[0] }} 
                      style={styles.detailImage}
                      resizeMode="cover"
                    />
                    {photosArray.length > 1 ? (
                      <>
                        <Pressable 
                          style={[styles.photoNavButton, styles.photoNavLeft]} 
                          onPress={handlePrevPhoto}
                        >
                          <Feather name="chevron-left" size={28} color="#FFFFFF" />
                        </Pressable>
                        <Pressable 
                          style={[styles.photoNavButton, styles.photoNavRight]} 
                          onPress={handleNextPhoto}
                        >
                          <Feather name="chevron-right" size={28} color="#FFFFFF" />
                        </Pressable>
                        <View style={styles.photoDotsContainer}>
                          {photosArray.map((_, index) => (
                            <View 
                              key={`dot-${index}`}
                              style={[
                                styles.photoDot,
                                currentPhotoIndex === index && styles.photoDotActive
                              ]}
                            />
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                  <View style={styles.photoIndicatorContainer}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                      {photosArray.length} {photosArray.length === 1 ? 'photo' : 'photos'}
                    </ThemedText>
                  </View>
                </>
              );
            })()}
              
              <View style={styles.detailSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <ThemedText style={[Typography.h2]}>{currentProfile.name}, {currentProfile.age}{currentProfile.zodiacSign ? ` ${getZodiacSymbol(currentProfile.zodiacSign)}` : ''}</ThemedText>
                  {getVerificationLevel(currentProfile.verification) > 0 ? (
                    <View style={{ marginLeft: Spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                      <Feather name="check-circle" size={14} color="#2563EB" />
                      <ThemedText style={[Typography.small, { color: '#2563EB', fontWeight: '600', marginLeft: 4 }]}>
                        {getVerificationLevel(currentProfile.verification) >= 3 ? 'Fully Verified' : getVerificationLevel(currentProfile.verification) >= 2 ? 'Verified' : 'Partially Verified'}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                  {getTagLabel(currentProfile.occupation) || currentProfile.occupation}
                </ThemedText>
              </View>

              <View style={styles.detailSection}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>About</ThemedText>
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  {currentProfile.bio}
                </ThemedText>
              </View>

              <View style={styles.detailSection}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Preferences</ThemedText>
                <View style={styles.detailRow}>
                  <Feather name="dollar-sign" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Budget</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>${currentProfile.budget}/month</ThemedText>
                  </View>
                </View>
                {currentProfile.lookingFor ? (
                  <View style={styles.detailRow}>
                    <Feather name={currentProfile.lookingFor === 'room' ? 'home' : 'key'} size={20} color={theme.primary} />
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Looking For</ThemedText>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.lookingFor === 'room' ? 'Room' : 'Entire Apartment'}</ThemedText>
                    </View>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Preferred Location</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.preferences.location}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="calendar" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Move-in Date</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{formatMoveInDate(currentProfile.preferences.moveInDate)}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="home" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Bedrooms Needed</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.preferences.bedrooms}</ThemedText>
                  </View>
                </View>
                {currentProfile.preferences.privateBathroom != null ? (
                  <View style={styles.detailRow}>
                    <Feather name="droplet" size={20} color={theme.primary} />
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Private Bathroom</ThemedText>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.preferences.privateBathroom ? 'Yes' : 'No'}</ThemedText>
                    </View>
                  </View>
                ) : null}
                {currentProfile.preferences.bathrooms ? (
                  <View style={styles.detailRow}>
                    <Feather name="layout" size={20} color={theme.primary} />
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Bathrooms in Apartment</ThemedText>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.preferences.bathrooms}</ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.detailSection}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Lifestyle</ThemedText>
                <View style={styles.detailRow}>
                  <Feather name="droplet" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Cleanliness</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{getCleanlinessLabel(currentProfile.lifestyle.cleanliness)}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="users" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Social Level</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{getSocialLevelLabel(currentProfile.lifestyle.socialLevel)}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="briefcase" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Work Schedule</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{getWorkScheduleLabel(currentProfile.lifestyle.workSchedule)}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name={currentProfile.lifestyle.pets ? 'check-circle' : 'x-circle'} size={20} color={currentProfile.lifestyle.pets ? theme.success : theme.error} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Pets</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.lifestyle.pets ? 'Yes' : 'No'}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Feather name={currentProfile.lifestyle.smoking ? 'check-circle' : 'x-circle'} size={20} color={currentProfile.lifestyle.smoking ? theme.error : theme.success} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Smoking</ThemedText>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentProfile.lifestyle.smoking ? 'Yes' : 'No'}</ThemedText>
                  </View>
                </View>
              </View>

              {(() => {
                const rawProfileTags = (currentProfile.profileData?.interests) || (currentProfile as any).interests;
                const profileTags: string[] = Array.isArray(rawProfileTags) ? rawProfileTags : [];
                const rawMyTags2 = user?.profileData?.interests;
                const myTags: string[] = Array.isArray(rawMyTags2) ? rawMyTags2 : [];
                const myTagSet = new Set(myTags);
                if (profileTags.length === 0) return null;
                return (
                  <View style={styles.detailSection}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Interests</ThemedText>
                    {Object.entries(INTEREST_TAGS).map(([catKey, cat]) => {
                      const catTags = cat.tags.filter(t => profileTags.includes(t.id));
                      if (catTags.length === 0) return null;
                      return (
                        <View key={catKey} style={{ marginBottom: Spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Feather name={cat.icon as any} size={14} color={theme.textSecondary} />
                            <ThemedText style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' }}>{cat.label}</ThemedText>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {catTags.map(tag => {
                              const isShared = myTagSet.has(tag.id);
                              return (
                                <View key={tag.id} style={{
                                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                                  backgroundColor: isShared ? 'rgba(255,107,91,0.15)' : 'rgba(255,255,255,0.08)',
                                  borderWidth: isShared ? 0 : 1,
                                  borderColor: 'rgba(255,255,255,0.15)',
                                }}>
                                  <ThemedText style={{ fontSize: 12, fontWeight: '500', color: isShared ? '#ff6b5b' : '#FFFFFF' }}>
                                    {tag.label}
                                  </ThemedText>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

              <View style={[styles.detailSection, { paddingBottom: Spacing.xxl }]}>
                <View style={[styles.matchBadge, { backgroundColor: getMatchQualityColor(currentProfile.compatibility || 50) + '20' }]}>
                  <Feather name="heart" size={24} color={getMatchQualityColor(currentProfile.compatibility || 50)} />
                  <ThemedText style={[Typography.h1, { color: getMatchQualityColor(currentProfile.compatibility || 50), marginLeft: Spacing.md }]}>
                    {currentProfile.compatibility || 50}% Match
                  </ThemedText>
                </View>
              </View>

              {/* Premium Zodiac Compatibility Insight - Only for Plus/Elite users when both have zodiac signs */}
              {user && currentProfile.zodiacSign && user.zodiacSign && (user.subscription?.plan === 'plus' || user.subscription?.plan === 'elite') ? (
                <View style={styles.detailSection}>
                  <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Zodiac Compatibility</ThemedText>
                  <View style={[styles.zodiacInsightCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                      <ThemedText style={[Typography.h2, { marginRight: Spacing.sm }]}>
                        {getZodiacSymbol(user.zodiacSign)}
                      </ThemedText>
                      <Feather name="heart" size={16} color={theme.primary} />
                      <ThemedText style={[Typography.h2, { marginLeft: Spacing.sm }]}>
                        {getZodiacSymbol(currentProfile.zodiacSign)}
                      </ThemedText>
                    </View>
                    <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                      {getZodiacCompatibilityLevel(user.zodiacSign, currentProfile.zodiacSign)}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              <View style={[styles.detailSection, { paddingBottom: Spacing.xxl, gap: Spacing.md }]}>
                <Pressable
                  style={[styles.detailActionButton, { backgroundColor: theme.primary }]}
                  onPress={async () => {
                    if (!currentProfile || !user) return;
                    const matches = await StorageService.getMatches();
                    const hasMatch = matches.some(m =>
                      (m.userId1 === user.id && m.userId2 === currentProfile.id) ||
                      (m.userId2 === user.id && m.userId1 === currentProfile.id)
                    );
                    if (hasMatch) {
                      setShowProfileDetail(false);
                      setTimeout(() => handleSendDirectMessage(false), 200);
                    } else {
                      const coldCheck = await canSendColdMessage();
                      if (!coldCheck.canSend) {
                        Alert.alert(
                          'Daily Limit Reached',
                          coldCheck.reason || "You've used all your messages for today. Resets at midnight.",
                          [
                            { text: 'Upgrade for More', onPress: () => (navigation as any).getParent()?.navigate('Profile', { screen: 'Plans' }) },
                            { text: 'OK', style: 'cancel' },
                          ]
                        );
                        return;
                      }
                      setShowProfileDetail(false);
                      setTimeout(() => handleSendDirectMessage(true), 200);
                    }
                  }}
                >
                  <Feather name="message-circle" size={20} color="#FFFFFF" />
                  <ThemedText style={[Typography.h3, { color: '#FFFFFF', marginLeft: Spacing.md }]}>
                    Send Message
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
            
            {/* Floating close button */}
            <Pressable 
              onPress={() => setShowProfileDetail(false)}
              style={styles.detailCloseButton}
            >
              <View style={[styles.detailCloseButtonInner, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="x" size={24} color={theme.text} />
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <CityPickerModal
        visible={showCityPicker}
        activeCity={activeCity}
        recentCities={recentCities}
        onCitySelect={handleCityChange}
        onClose={() => setShowCityPicker(false)}
      />

      <RoommateFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onApply={handleApplyFilters}
        currentFilters={matchFilters}
        allProfiles={unfilteredProfiles}
        userPlan={user?.subscription?.plan || 'basic'}
      />

      {showRefinementBanner ? (
        <RNAnimated.View style={{ position: 'absolute', top: 100, left: 20, right: 20, opacity: refinementBannerOpacity, zIndex: 200, backgroundColor: 'rgba(255,107,91,0.15)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,107,91,0.3)', alignItems: 'center' }}>
          <Text style={{ color: '#ff6b5b', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>AI is learning your preferences to find better matches</Text>
        </RNAnimated.View>
      ) : null}

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => {
          setShowAISheet(false);
          setAiSheetContext('match');
          setRefinementQuestion(null);
        }}
        screenContext={aiSheetContext}
        contextData={{
          match: {
            currentProfile: profiles[currentIndex] || undefined,
          },
        }}
        refinementQuestion={refinementQuestion}
        onRefinementAnswered={() => {
          showRefinementBannerBriefly();
        }}
        onNavigate={(screen, params) => {
          if (screen === 'ProfileQuestionnaire') {
            (navigation as any).navigate('Profile', { screen: 'ProfileQuestionnaire', params });
          } else {
            (navigation as any).navigate(screen, params);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  navIconBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconBtnInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  citySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff6b5b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterChipsRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterChipsContent: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 6,
  },
  filterChipDismissible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  filterChipDismissibleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ff6b5b',
  },
  lowProfileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  lowProfileBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#FFD700',
    fontWeight: '500',
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
    maxWidth: MAX_CARD_WIDTH + 32,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
  },
  cardBoostedGlow: {
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,107,91,0.4)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  flagBtn: {
    position: 'absolute',
    top: 14,
    left: 30,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  photoDots: {
    position: 'absolute',
    top: 14,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    zIndex: 10,
  },
  photoDotBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  photoDotBarActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  onlineIndicatorContainer: {
    position: 'absolute',
    top: 14,
    right: 60,
    zIndex: 3,
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  boostedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingTop: 24,
  },
  verifiedCheckCard: {
    marginLeft: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 10,
    padding: 2,
  },
  refBadgeCard: {
    marginLeft: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  refBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
  },
  bgBadgeCard: {
    marginLeft: 5,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    padding: 3,
  },
  cardName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 3,
    flexShrink: 1,
  },
  cardJob: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  cardBio: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    marginBottom: 12,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  tagDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagDarkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  tagMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 91, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 91, 0.4)',
  },
  tagMatchText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#ff8070',
  },
  adBanner: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  adLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adSponsoredLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  adTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  adCta: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adCtaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 8,
    paddingBottom: 90,
  },
  actionBtnSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  actionBtnMd: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  actionBtnLg: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  actionUndo: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionPass: {
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  actionMsg: {
    borderColor: '#ff6b8a',
    backgroundColor: 'rgba(255,107,138,0.08)',
  },
  actionStar: {
    borderColor: '#5b8cff',
    backgroundColor: 'rgba(91,140,255,0.08)',
  },
  actionBtnSuperInterest: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  actionBtnSuperInterestGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  superInterestLockBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSuperInterestGlow: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  superInterestCardBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    overflow: 'hidden',
  },
  superInterestCardLabel: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
    marginTop: 2,
  },
  actionLike: {
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,107,107,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  vipModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  vipModalHeader: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  vipModalContent: {
    padding: Spacing.xl,
  },
  vipFeaturesList: {
    gap: Spacing.md,
  },
  vipFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipModalActions: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  vipModalButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  vipModalButtonSecondary: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  vipCancelButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  vipUpgradeButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  priceCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  detailContent: {
    flex: 1,
  },
  photoGalleryContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
    backgroundColor: '#000',
  },
  detailImage: {
    width: '100%',
    height: 400,
  },
  photoNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoNavLeft: {
    left: 16,
  },
  photoNavRight: {
    right: 16,
  },
  photoDotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoDotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  photoIndicatorContainer: {
    padding: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
  },
  zodiacInsightCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.medium,
  },
  detailCloseButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 100,
  },
  detailCloseButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  boostSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center' as const,
    marginBottom: 20,
  },
  boostSheetHeader: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  boostSheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  boostSheetTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  boostSheetDesc: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  boostSheetNote: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  boostSheetPriceRow: {
    alignItems: 'center' as const,
    marginBottom: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  boostSheetPrice: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#ff6b5b',
    marginBottom: 2,
  },
  boostSheetPriceSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  boostSheetCta: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 10,
  },
  boostSheetCtaGrad: {
    height: 50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 14,
  },
  boostSheetCtaText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  boostSheetDismiss: {
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  boostSheetDismissText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
  },
});
