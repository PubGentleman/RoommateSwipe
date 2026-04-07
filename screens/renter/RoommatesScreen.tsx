import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Modal, ScrollView, Text, Animated as RNAnimated, InteractionManager, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS, interpolate, FadeInDown } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { RoommateProfile, Match, InterestCard, Group, Conversation, Property } from '../../types/models';
import { isBoostExpired, getBoostDuration, getBoostTimeRemaining, RENTER_BOOST_OPTIONS, RenterBoostOptionId } from '../../utils/boostUtils';
import { dispatchInsightTrigger } from '../../utils/insightRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, moderateScale, getResponsiveSpacing } from '../../utils/responsive';
import { calculateCompatibility, calculateDetailedCompatibility, MatchScore, getMatchQualityColor, getCleanlinessLabel, getSocialLevelLabel, getWorkScheduleLabel, getWorkStyleTag, validateProfileDataConsistency, formatMoveInDate, getGenderSymbol } from '../../utils/matchingAlgorithm';
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
import { checkVerificationGate } from '../../utils/verificationGating';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { mapListingToProperty } from '../../services/listingService';
import { applyBoostRotation } from '../../utils/boostRotation';
import { NEIGHBORHOOD_TRAINS } from '../../constants/transitData';
import { trackImpression } from '../../services/boostImpressionService';
import { LinearGradient } from 'expo-linear-gradient';
import CoachMarkOverlay from '../../components/CoachMark';
import { useTourSetup } from '../../hooks/useTourSetup';
import { TOUR_CONTENT } from '../../constants/tourSteps';
import { getProfileGateStatus, getItemsForTier, ProfileTier } from '../../utils/profileGate';
import FeatureGateModal from '../../components/FeatureGateModal';
import { RhomeLogo } from '../../components/RhomeLogo';
import { AppHeader, HeaderIconButton } from '../../components/AppHeader';
import { RoommateFilterSheet, MatchFilters, DEFAULT_FILTERS, getActiveFilterCount, getActiveFilterChips, removeFilterChip, loadSavedFilters, saveFilters, applyFiltersToProfiles } from '../../components/RoommateFilterSheet';
import { PlanBadge } from '../../components/PlanBadge';
import { normalizeRenterPlan, getRenterPlanLimits, canSwipe } from '../../constants/renterPlanLimits';
import { PlanBadgeInline } from '../../components/LockedFeatureOverlay';
import { getDailySwipeCount, incrementDailySwipeCount, decrementDailySwipeCount, getTimeUntilMidnight } from '../../utils/dailySwipeLimit';
import SmartUpgradePrompt from '../../components/SmartUpgradePrompt';
import { getUpgradePromptData, shouldShowUpgradePrompt, type UpgradePromptData } from '../../services/upgradePromptService';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { useFeedBadge } from '../../contexts/FeedBadgeContext';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import type { ScreenContext } from '../../components/RhomeAISheet';
import { trackSwipe, startSession, shouldShowRefinementQuestion, getQuestionsAsked } from '../../utils/refinementEngine';
import { getNextRefinementQuestion, REFINEMENT_QUESTIONS } from '../../utils/refinementQuestions';
import type { RefinementQuestion } from '../../utils/refinementQuestions';
import { getSwipeDeck, sendLike, sendPass, undoLastAction, saveRefinementAnswer } from '../../services/discoverService';
import { getMyGroups as getMyGroupsFromSupabase } from '../../services/groupService';
import { recordSwipe, getAIMemory } from '../../utils/aiMemory';
import { getNextMicroQuestion } from '../../utils/aiMicroQuestions';
import { AIQuestionCard } from '../../components/AIQuestionCard';
import { AIInsightBanner } from '../../components/AIInsightBanner';
import { AskAboutPersonModal } from '../../components/AskAboutPersonModal';
import { markQuestionAsked } from '../../utils/refinementEngine';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getBestMatchToday } from '../../utils/bestMatchToday';
import { AIGroupSuggestionCard } from '../../components/AIGroupSuggestionCard';
import { InstagramBadge } from '../../components/InstagramBadge';
import { WhyThisMatchModal } from '../../components/WhyThisMatchModal';
import InsightChip from '../../components/InsightChip';
import { generateAlgorithmicInsights, selectCardInsight, getEnhancedInsight, QuickInsight } from '../../services/quickInsightService';
import { getCachedOrGenerateInsight, getCachedDeckRanking } from '../../services/piMatchingService';
import { DailyQuestionCard } from '../../components/DailyQuestionCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BETA_MODE } from '../../constants/betaConfig';
import { getCompletionPercentage } from '../../utils/profileReminderUtils';
import { createErrorHandler } from '../../utils/errorLogger';

const PROFILE_PROMPT_KEY = 'hasSeenProfilePrompt';
const PROFILE_PROMPT_DISMISS_KEY = 'profile_prompt_dismissed_date';
const PROFILE_PROMPT_COOLDOWN_DAYS = 7;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Limit card size for web/desktop viewing
const MAX_CARD_WIDTH = 420;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xxl, MAX_CARD_WIDTH);

const CATEGORY_MAXES: Record<string, number> = {
  location: 16, budget: 12, sleepSchedule: 12, cleanliness: 12,
  smoking: 10, age: 8, workLocation: 6, guestPolicy: 6,
  noiseTolerance: 4, pets: 4, moveInTimeline: 4,
  roommateRelationship: 2, sharedExpenses: 2, lifestyle: 2, zodiac: 2,
};
const CATEGORY_LABELS: Record<string, string> = {
  location: 'Location', budget: 'Budget', sleepSchedule: 'Sleep',
  cleanliness: 'Cleanliness', smoking: 'Smoking', age: 'Age',
  workLocation: 'Work Style', guestPolicy: 'Guests', noiseTolerance: 'Noise',
  pets: 'Pets', moveInTimeline: 'Move-in', roommateRelationship: 'Vibe',
  sharedExpenses: 'Expenses', lifestyle: 'Lifestyle', zodiac: 'Zodiac',
};

const MatchInsights = ({ score }: { score: MatchScore }) => {
  const { breakdown, reasons } = score;
  const strengths = reasons.strengths.slice(0, 3);
  const topConcern = reasons.concerns[0];

  const topCategories = Object.entries(breakdown)
    .filter(([key]) => CATEGORY_MAXES[key])
    .map(([key, val]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      pct: Math.round(((val as number) / CATEGORY_MAXES[key]) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  return (
    <View style={insightStyles.container}>
      {strengths.length > 0 ? (
        <View style={insightStyles.chipRow}>
          {strengths.map((s, i) => (
            <View key={i} style={insightStyles.strengthChip}>
              <Feather name="check-circle" size={10} color="#3ECF8E" />
              <Text style={insightStyles.strengthText} numberOfLines={1}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {topConcern ? (
        <View style={insightStyles.chipRow}>
          <View style={insightStyles.concernChip}>
            <Feather name="alert-circle" size={10} color="#f59e0b" />
            <Text style={insightStyles.concernText} numberOfLines={1}>{topConcern}</Text>
          </View>
        </View>
      ) : null}
      <View style={insightStyles.barsContainer}>
        {topCategories.map((cat) => (
          <View key={cat.key} style={insightStyles.barRow}>
            <Text style={insightStyles.barLabel}>{cat.label}</Text>
            <View style={insightStyles.barTrack}>
              <View
                style={[
                  insightStyles.barFill,
                  {
                    width: `${Math.max(5, cat.pct)}%`,
                    backgroundColor: cat.pct >= 80 ? '#3ECF8E' : cat.pct >= 50 ? '#ff6b5b' : '#f59e0b',
                  },
                ]}
              />
            </View>
            <Text style={insightStyles.barPct}>{cat.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const insightStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  strengthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(62,207,142,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  strengthText: { fontSize: 11, color: '#3ECF8E', fontWeight: '600', maxWidth: 140 },
  concernChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  concernText: { fontSize: 11, color: '#f59e0b', fontWeight: '600', maxWidth: 200 },
  barsContainer: { gap: 6, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', width: 60, fontWeight: '600' },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  barPct: { fontSize: 10, color: 'rgba(255,255,255,0.35)', width: 28, textAlign: 'right' },
});

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseUndoPass, canRewind, useRewind, canSuperLike, useSuperLike, blockUser, reportUser, canSendSuperInterest, useSuperInterestCredit, getSuperInterestCount, purchaseSuperInterest, canSendColdMessage, activateBoost, canBoost, purchaseBoost, checkAndUpdateBoostStatus } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useNotificationContext();
  const { unreadFeedCount } = useFeedBadge();
  const { confirm, alert: showAlert } = useConfirm();
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);
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
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const [photoGridIndex, setPhotoGridIndex] = useState(0);
  const [showSuperLikeUpgradeModal, setShowSuperLikeUpgradeModal] = useState(false);
  const [showSuperInterestUpsell, setShowSuperInterestUpsell] = useState(false);
  const [showSuperInterestConfirm, setShowSuperInterestConfirm] = useState(false);
  const [superInterestGlow, setSuperInterestGlow] = useState(false);
  const [showSuperInterestFlash, setShowSuperInterestFlash] = useState(false);
  const superInterestScale = useSharedValue(1);
  const [showReportBlockModal, setShowReportBlockModal] = useState(false);
  const [matchedProfileData, setMatchedProfileData] = useState<{ profile: RoommateProfile; compatibility: number } | null>(null);
  const [gateModal, setGateModal] = useState<{ visible: boolean; feature: string; requiredTier: ProfileTier } | null>(null);
  const gateStatus = useMemo(() => getProfileGateStatus(user), [user]);
  const { activeCity, activeSubArea, recentCities, setActiveCity, setActiveSubArea, initialized: cityInitialized } = useCityContext();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [matchFilters, setMatchFilters] = useState<MatchFilters>({ ...DEFAULT_FILTERS });
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [unfilteredProfiles, setUnfilteredProfiles] = useState<RoommateProfile[]>([]);
  const [showAISheet, setShowAISheet] = useState(false);
  const roommatesTour = useTourSetup('roommates', TOUR_CONTENT.roommates);
  const [aiSheetContext, setAiSheetContext] = useState<ScreenContext>('match');
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [piCardSummary, setPiCardSummary] = useState<string | null>(null);
  const [piCardLoading, setPiCardLoading] = useState(false);
  const piSummaryCache = useRef<Record<string, string>>({});
  const [piBoostedIds, setPiBoostedIds] = useState<Set<string>>(new Set());
  const [askAboutVisible, setAskAboutVisible] = useState(false);
  const [askAboutTarget, setAskAboutTarget] = useState<{ id: string; name: string; age?: number; compatibility?: number; entryPoint: 'swipe_card' | 'match_screen' | 'chat_screen' } | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<RefinementQuestion | null>(null);
  const [questionInjectedAtIndex, setQuestionInjectedAtIndex] = useState<number | null>(null);
  const [rightSwipeCount, setRightSwipeCount] = useState(0);
  const [totalSwipeCount, setTotalSwipeCount] = useState(0);
  const [dailySwipesUsed, setDailySwipesUsed] = useState(-1);
  const [showSwipeLimitModal, setShowSwipeLimitModal] = useState(false);
  const [swipeUpgradePrompt, setSwipeUpgradePrompt] = useState<UpgradePromptData | null>(null);
  const [bestMatch, setBestMatch] = useState<{ profile: any; score: number; reason: string } | null>(null);
  const [highlightedProfileId, setHighlightedProfileId] = useState<string | null>(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [selectedBoostTierId, setSelectedBoostTierId] = useState<RenterBoostOptionId>('standard');
  const [boostTimeLabel, setBoostTimeLabel] = useState('');
  const [userOpenGroup, setUserOpenGroup] = useState<Group | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showFirstSessionPrompt, setShowFirstSessionPrompt] = useState(false);
  const [suggestedListingForPair, setSuggestedListingForPair] = useState<{
    listing: Property;
    perPersonRent: number;
    sharedNeighborhoods: string[];
    isBoosted: boolean;
  } | null>(null);
  const [allListingsCache, setAllListingsCache] = useState<Property[]>([]);
  const profileCompletion = user ? getCompletionPercentage(user) : 0;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isAnimatingSwipe = useSharedValue(false);
  const swipingOutId = useRef<string | null>(null);
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
    const checkFirstSessionPrompt = async () => {
      try {
        const isOnboarded = user?.onboardingStep === 'complete' || !user?.onboardingStep;
        if (!isOnboarded) return;

        const completion = user ? getCompletionPercentage(user) : 0;
        if (completion > 50) return;

        const dismissedDate = await AsyncStorage.getItem(PROFILE_PROMPT_DISMISS_KEY);
        if (dismissedDate) {
          const dismissed = new Date(dismissedDate);
          if (!isNaN(dismissed.getTime())) {
            const now = new Date();
            const daysSince = (now.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < PROFILE_PROMPT_COOLDOWN_DAYS) return;
          }
        }

        const seen = await AsyncStorage.getItem(PROFILE_PROMPT_KEY);
        if (seen !== 'true') {
          setShowFirstSessionPrompt(true);
        } else if (!dismissedDate) {
          setShowFirstSessionPrompt(true);
        }
      } catch {}
    };
    if (user) checkFirstSessionPrompt();
  }, [user?.id]);

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

  const canSeeAIMatch = BETA_MODE || user?.plan === 'plus' || user?.plan === 'elite';
  useEffect(() => {
    if (canSeeAIMatch && user) {
      getBestMatchToday(user.id).then(result => {
        setBestMatch(result);
        if (result) {
          setHighlightedProfileId(result.profile.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }).catch(createErrorHandler('RoommatesScreen', 'getBestMatchToday'));
    }
  }, [user?.id]);

  const lastLoadTime = useRef<number>(0);
  const RELOAD_THRESHOLD_MS = 5 * 60 * 1000;

  useEffect(() => {
    loadProfiles();
  }, [activeCity, activeSubArea, matchFilters]);

  const checkRefinementTrigger = async () => {
    if (pendingQuestion) return;

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
        setPendingQuestion(question);
        setQuestionInjectedAtIndex(currentIndex + 1);
      }
    }
  };

  const checkMicroQuestionTrigger = async () => {
    if (pendingQuestion || !user) return;
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
        options: nextQ.options.map(opt => ({ value: opt.value, label: opt.label, icon: opt.icon })),
        profileField: nextQ.category,
      };
      setPendingQuestion(asRefinement);
      setQuestionInjectedAtIndex(currentIndex + 1);
    } catch {}
  };

  const handleQuestionAnswer = async (questionId: string, value: string) => {
    await markQuestionAsked(questionId);
    await saveRefinementAnswer(user!.id, questionId, value);
    setPendingQuestion(null);
    setQuestionInjectedAtIndex(null);
  };

  const handleQuestionSkip = () => {
    setPendingQuestion(null);
    setQuestionInjectedAtIndex(null);
  };

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const shouldReload = now - lastLoadTime.current > RELOAD_THRESHOLD_MS;

      if (shouldReload) {
        console.log('[RoommatesScreen] Screen focused, reloading profiles (threshold met)');
        loadProfiles();
        lastLoadTime.current = now;
      }

      getDailySwipeCount().then(count => setDailySwipesUsed(count)).catch(createErrorHandler('RoommatesScreen', 'getDailySwipeCount'));

      if (user) {
        (async () => {
          try {
            const supabaseGroups = await getMyGroupsFromSupabase(user.id, 'roommate');
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
      lastLoadTime.current = Date.now();

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
        const deckProfiles = await getSwipeDeck(user!.id, activeCity || undefined, supabaseFilters);
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
            instagram_verified: p.profile?.instagram_verified || false,
            instagram_handle: p.profile?.instagram_handle || undefined,
            preferred_neighborhoods: p.profile?.preferred_neighborhoods || [],
            ideal_roommate_text: p.profile?.ideal_roommate_text || undefined,
            profileData: {
              interests: Array.isArray(p.profile?.interests) ? p.profile.interests : [],
              profileNote: p.profile?.profile_note || undefined,
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
        const filterSubArea = activeSubArea;
        const subAreaNeighborhoods = filterCity && filterSubArea
          ? require('../../utils/locationData').getNeighborhoodsBySubArea(filterCity, filterSubArea) as string[]
          : [];
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
            if (filterSubArea && subAreaNeighborhoods.length > 0) {
              const profileNeighborhood = profileUser?.profileData?.neighborhood || p.preferences?.location || '';
              if (profileNeighborhood && !subAreaNeighborhoods.some((n: string) =>
                profileNeighborhood.toLowerCase().includes(n.toLowerCase())
              )) return false;
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

      const filteredProfiles = applyFiltersToProfiles(profilesWithCompatibility, matchFilters);

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
      prefetchNextImages(sortedProfiles, 0);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && profiles.length > 0 && roommatesTour.shouldShowTour) {
      roommatesTour.startTour();
    }
  }, [isLoading, profiles.length, roommatesTour.shouldShowTour]);

  const prefetchNextImages = useCallback((profileList: RoommateProfile[], fromIndex: number) => {
    const nextProfiles = profileList.slice(fromIndex, fromIndex + 3);
    nextProfiles.forEach(profile => {
      const photos = Array.isArray(profile.photos) ? profile.photos : profile.photos ? [profile.photos] : [];
      (photos as string[]).slice(0, 2).forEach((uri: string) => {
        if (uri && uri.startsWith('http')) {
          Image.prefetch(uri).catch(createErrorHandler('RoommatesScreen', 'prefetch'));
        }
      });
    });
  }, []);

  const resetSwipeHistory = async () => {
    await StorageService.clearSwipeHistory();
    await loadProfiles();
  };

  const compatibilityMap = useMemo(() => {
    if (!user) return new Map<string, number>();
    const map = new Map<string, number>();
    profiles.forEach(profile => {
      const score = profile.compatibility ?? calculateCompatibility(user, profile);
      map.set(profile.id, score);
    });
    return map;
  }, [profiles, user?.id]);

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
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
  
  const isProfileOnline = currentProfile
    ? (() => {
        const lastActive = currentProfileUser?.last_active_at || currentProfile?.lastActiveAt;
        if (!lastActive) return false;
        const minutesAgo = (Date.now() - new Date(lastActive).getTime()) / 60000;
        return minutesAgo < 30;
      })()
    : false;

  useEffect(() => {
    const loadListings = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data } = await supabase
            .from('listings')
            .select('*')
            .eq('is_active', true);
          if (data) {
            setAllListingsCache(data.map((l: any) => mapListingToProperty(l)));
          }
        } else {
          const props = await StorageService.getProperties();
          setAllListingsCache(props.filter((p: Property) => p.available));
        }
      } catch (err) {
        console.warn('Failed to load listings for pair suggestions:', err);
      }
    };
    loadListings();
  }, []);

  useEffect(() => {
    if (!user || !currentProfile || allListingsCache.length === 0) {
      setSuggestedListingForPair(null);
      return;
    }

    const myNeighborhoods: string[] = user.preferred_neighborhoods || [];
    const myBudget = user.profileData?.budget || user.budget || 1500;
    const myTrains: string[] = user.profileData?.preferredTrains || user.required_train_lines || [];

    const theirNeighborhoods: string[] = currentProfile.preferred_neighborhoods || [];
    const theirBudget = currentProfile.budget || 1500;
    const theirTrains: string[] = (currentProfile as any).requiredTrainLines || [];

    const allPreferredNeighborhoods = [...new Set([...myNeighborhoods, ...theirNeighborhoods])];
    const sharedNeighborhoods = myNeighborhoods.filter(n => theirNeighborhoods.includes(n));

    const combinedMaxBudget = myBudget + theirBudget;

    const candidates = allListingsCache
      .filter(l => {
        if (!l.price || l.price > combinedMaxBudget) return false;
        if (l.bedrooms && l.bedrooms < 2) return false;
        const listingNeighborhood = l.neighborhood || '';
        const isInPreferred = allPreferredNeighborhoods.includes(listingNeighborhood);
        const listingTrains = NEIGHBORHOOD_TRAINS[listingNeighborhood] || [];
        const allWantedTrains = [...new Set([...myTrains, ...theirTrains])];
        const hasTransitOverlap = allWantedTrains.length === 0 ||
          allWantedTrains.some(t => listingTrains.includes(t));
        return isInPreferred || hasTransitOverlap;
      })
      .map(l => ({
        listing: l,
        perPersonRent: Math.round((l.price || 0) / 2),
        sharedNeighborhoods: sharedNeighborhoods.filter(n =>
          n === l.neighborhood || NEIGHBORHOOD_TRAINS[n]?.some(t =>
            NEIGHBORHOOD_TRAINS[l.neighborhood || '']?.includes(t)
          )
        ),
        isBoosted: !!(l.listingBoost?.isActive && new Date(l.listingBoost.expiresAt) > new Date()),
      }));

    if (candidates.length === 0) {
      setSuggestedListingForPair(null);
      return;
    }

    const boosted = candidates.filter(c => c.isBoosted);
    const regular = candidates.filter(c => !c.isBoosted);

    const rotatedBoosted = boosted.length > 0 && user
      ? applyBoostRotation(boosted, [], user.id)
      : boosted;

    const best = rotatedBoosted[0]
      || regular.sort((a, b) => a.perPersonRent - b.perPersonRent)[0]
      || null;

    if (best) {
      setSuggestedListingForPair(best);
      if (best.isBoosted) {
        trackImpression(best.listing.id, 'card_view', {
          boostType: best.listing.listingBoost?.includesTopPicks ? 'extended'
            : best.listing.listingBoost?.includesFeaturedBadge ? 'standard' : 'quick',
          section: 'roommate_card',
        });
      }
    } else {
      setSuggestedListingForPair(null);
    }
  }, [currentIndex, allListingsCache.length]);

  useEffect(() => {
    if (!renterLimits.hasPiDeckReranking || profiles.length === 0) return;
    getCachedDeckRanking(user!.id).then((ranking) => {
      if (!ranking?.adjustments) return;
      const boosted = new Set<string>();
      for (const adj of ranking.adjustments) {
        if (adj.direction === 'up') boosted.add(adj.user_id);
      }
      setPiBoostedIds(boosted);
    }).catch(createErrorHandler('RoommatesScreen', 'getCachedDeckRanking'));
  }, [renterLimits.hasPiDeckReranking, profiles.length]);

  useEffect(() => {
    if (!currentProfile?.id) {
      setPiCardSummary(null);
      setPiCardLoading(false);
      return;
    }
    const profileId = currentProfile.id;
    if (piSummaryCache.current[profileId]) {
      setPiCardSummary(piSummaryCache.current[profileId]);
      setPiCardLoading(false);
      return;
    }
    let stale = false;
    setPiCardSummary(null);
    setPiCardLoading(true);
    getCachedOrGenerateInsight(user!.id, profileId, currentProfile?.compatibility).then((insight) => {
      if (stale) return;
      if (insight?.summary) {
        piSummaryCache.current[profileId] = insight.summary;
        setPiCardSummary(insight.summary);
      }
    }).catch(createErrorHandler('RoommatesScreen', 'finally')).finally(() => { if (!stale) setPiCardLoading(false); });
    return () => { stale = true; };
  }, [currentProfile?.id]);

  const advanceCard = () => {
    InteractionManager.runAfterInteractions(() => {
      swipingOutId.current = null;
      setCurrentPhotoIndex(0);
      setCurrentIndex(prev => {
        const next = prev + 1;
        prefetchNextImages(profiles, next + 1);
        return next;
      });
      translateX.value = 0;
      translateY.value = 0;
      rotation.value = 0;
      cardOpacity.value = 1;
      isAnimatingSwipe.value = false;
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
      await showAlert({ title: 'Invite Sent!', message: `${matchedProfileData.profile.name} has been invited to join your group.`, variant: 'success' });
    } catch {
      await showAlert({ title: 'Error', message: 'Could not send invite. Try again.', variant: 'warning' });
    }
  };

  const handleResendVerification = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user?.email ?? '' });
      if (!error) {
        Alert.alert('Sent', 'Verification email sent! Check your inbox.');
      }
    } catch {}
  };

  const handleSwipeAction = async (action: 'like' | 'nope' | 'superlike') => {
    if (!currentProfile || !user || isAnimatingSwipe.value) return;

    const verificationCheck = checkVerificationGate(user, 'swipe');
    if (!verificationCheck.allowed) {
      Alert.alert(
        'Email Verification Required',
        'Please verify your email address to start swiping. Check your inbox for the verification link.',
        [
          { text: 'Resend Email', onPress: handleResendVerification },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    if (!gateStatus.canSwipe) {
      setGateModal({ visible: true, feature: 'Swiping', requiredTier: 'silver' });
      return;
    }

    if (action === 'superlike' && !gateStatus.canSuperLike) {
      setGateModal({ visible: true, feature: 'Super Likes', requiredTier: 'gold' });
      return;
    }

    const effectiveSwipes = dailySwipesUsed === -1 ? 0 : dailySwipesUsed;
    if (!canSwipe(renterPlan, effectiveSwipes)) {
      setSwipeUpgradePrompt(getUpgradePromptData('swipe_limit_reached', renterPlan, {
        used: effectiveSwipes, limit: renterLimits.dailySwipes,
      }));
      setShowSwipeLimitModal(true);
      return;
    }

    if (renterLimits.dailySwipes !== -1) {
      const newCount = await incrementDailySwipeCount();
      setDailySwipesUsed(newCount);
      if (newCount >= renterLimits.dailySwipes * 0.8 && newCount < renterLimits.dailySwipes) {
        shouldShowUpgradePrompt('swipe_limit_approaching').then(canShow => {
          if (canShow) {
            setSwipeUpgradePrompt(getUpgradePromptData('swipe_limit_approaching', renterPlan, {
              used: newCount, limit: renterLimits.dailySwipes,
            }));
          }
        });
      }
    }

    if (action === 'superlike') {
      const superLikeCheck = canSuperLike();
      if (!superLikeCheck.canSuperLike) {
        setShowSuperLikeUpgradeModal(true);
        return;
      }
      await useSuperLike();
    }

    isAnimatingSwipe.value = true;
    swipingOutId.current = currentProfile.id;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setLastSwipedProfile({ profile: currentProfile, action });
    
    const direction = action === 'like' ? 1 : action === 'nope' ? -1 : 0;
    const toX = direction * SCREEN_WIDTH * 1.5;
    const toY = action === 'superlike' ? -SCREEN_HEIGHT : 0;
    const exitDuration = 250;

    cardOpacity.value = 0;
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
    if (renterLimits.dailySwipes !== -1) {
      const newCount = await decrementDailySwipeCount();
      setDailySwipesUsed(newCount);
    }
    
    setCurrentIndex(prev => prev - 1);
    setLastSwipedProfile(null);
  };

  const undoLastSwipeAsync = async (profileId: string, action: 'like' | 'nope' | 'superlike') => {
    try {
      try {
        await undoLastAction(user!.id);
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
          supabaseResult = await sendLike(user!.id, profileId);
          usedSupabase = true;
          console.log('[RoommatesScreen] Sent like via Supabase');
        } else {
          await sendPass(user!.id, profileId);
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
            createdAt: new Date().toISOString(),
            data: {
              fromUserId: userId,
              fromUserName: user?.name,
              fromUserPhoto: user?.profilePicture,
            },
          });
          
          await StorageService.addSuperLike(profileId, userId, user?.name, user?.profilePicture);
        }

        let supabaseMatch: any = null;
        if (usedSupabase && supabaseResult?.matchPromise) {
          supabaseMatch = await supabaseResult.matchPromise;
        }
        const hasMatch = usedSupabase ? !!supabaseMatch : await StorageService.checkReciprocalLike(userId, profileId);
        
        if (hasMatch) {
          if (!usedSupabase) {
            const match: Match = {
              id: `match_${Date.now()}`,
              userId1: userId,
              userId2: profileId,
              matchedAt: new Date().toISOString(),
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
          const matchId = usedSupabase ? supabaseMatch?.id : `match_${Date.now()}`;

          await StorageService.addNotification({
            id: `notification_match_${Date.now()}_${Math.random()}`,
            userId: userId,
            type: 'match',
            title: 'New Match!',
            body: `You and ${matchedName} are a match! Start a conversation.`,
            isRead: false,
            createdAt: new Date().toISOString(),
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
            createdAt: new Date().toISOString(),
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
      recordSwipe(isRight, score).catch(createErrorHandler('RoommatesScreen', 'recordSwipe'));
      if (isRight) {
        checkMicroQuestionTrigger().catch(createErrorHandler('RoommatesScreen', 'checkMicroQuestionTrigger'));
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
      createdAt: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
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
        matchedAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        data: { matchId: match.id, fromUserId: currentProfile.id, fromUserName: currentProfile.name, fromUserPhoto: currentProfile.photos?.[0] },
      });
      await StorageService.addNotification({
        id: `notification_match_${Date.now()}_${Math.random()}_other`,
        userId: currentProfile.id,
        type: 'match',
        title: 'New Match!',
        body: `You and ${user.name || 'Someone'} are a match!`,
        isRead: false,
        createdAt: new Date().toISOString(),
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

  const trackProfileView = (viewedId: string, viewerId: string) => {
    StorageService.addProfileView(viewedId, viewerId).catch(createErrorHandler('RoommatesScreen', 'addProfileView'));
  };

  const tap = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(200)
    .requireExternalGestureToFail(pan)
    .onEnd(() => {
      runOnJS(setCurrentPhotoIndex)(0);
      runOnJS(setShowProfileDetail)(true);
      if (currentProfile && user && currentProfile.id !== user.id) {
        runOnJS(trackProfileView)(currentProfile.id, user.id);
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


  const renderCitySelector = () => (
    <View style={styles.citySelectorRow}>
      <CityPillButton activeCity={activeCity} activeSubArea={activeSubArea} onPress={() => setShowCityPicker(true)} />
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

  const renderBoostModal = () => (
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
              const selectedOption = RENTER_BOOST_OPTIONS.find(o => o.id === selectedBoostTierId)!;
              const freeDuration = plan === 'elite' ? 24 : plan === 'plus' ? 12 : 6;
              const result = paid
                ? await purchaseBoost(selectedOption.price, selectedOption.durationHours)
                : await activateBoost(freeDuration);
              setProcessingBoost(false);
              if (result.success) {
                setShowBoostModal(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                showAlert({ title: 'Cannot Boost', message: result.message, variant: 'warning' });
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
              const selOpt = RENTER_BOOST_OPTIONS.find(o => o.id === selectedBoostTierId)!;
              return (
                <>
                  <View style={styles.boostSheetHeader}>
                    <View style={styles.boostSheetIconWrap}>
                      <Feather name="zap" size={28} color="#ff6b5b" />
                    </View>
                    <Text style={styles.boostSheetTitle}>Boost Your Profile</Text>
                    <Text style={styles.boostSheetDesc}>Your profile appears near the top of swipe decks</Text>
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    {RENTER_BOOST_OPTIONS.map(option => (
                      <Pressable
                        key={option.id}
                        onPress={() => setSelectedBoostTierId(option.id)}
                        style={[
                          styles.boostTierRow,
                          selectedBoostTierId === option.id && styles.boostTierRowSelected,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.boostTierLabel}>{option.label}</Text>
                            {option.badge ? (
                              <View style={[styles.boostTierBadge, { backgroundColor: option.highlight ? '#FF6B6B' : '#22C55E' }]}>
                                <Text style={styles.boostTierBadgeText}>{option.badge}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.boostTierSub}>Priority placement for {option.label.toLowerCase()}</Text>
                        </View>
                        <Text style={styles.boostTierPrice}>${option.price.toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                    onPress={() => handleBoostConfirm(true)}
                    disabled={processingBoost}
                  >
                    <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                      <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Processing...' : `Boost for $${selOpt.price.toFixed(2)}`}</Text>
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
              const selOpt = RENTER_BOOST_OPTIONS.find(o => o.id === selectedBoostTierId)!;
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
                        <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Activating...' : `Activate Free Boost (${duration}h)`}</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <>
                      <View style={{ marginBottom: 16 }}>
                        {RENTER_BOOST_OPTIONS.map(option => (
                          <Pressable
                            key={option.id}
                            onPress={() => setSelectedBoostTierId(option.id)}
                            style={[
                              styles.boostTierRow,
                              selectedBoostTierId === option.id && styles.boostTierRowSelected,
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.boostTierLabel}>{option.label}</Text>
                                {option.badge ? (
                                  <View style={[styles.boostTierBadge, { backgroundColor: option.highlight ? '#FF6B6B' : '#22C55E' }]}>
                                    <Text style={styles.boostTierBadgeText}>{option.badge}</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.boostTierSub}>Priority placement for {option.label.toLowerCase()}</Text>
                            </View>
                            <Text style={styles.boostTierPrice}>${option.price.toFixed(2)}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        style={[styles.boostSheetCta, { opacity: processingBoost ? 0.7 : 1 }]}
                        onPress={() => handleBoostConfirm(true)}
                        disabled={processingBoost}
                      >
                        <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostSheetCtaGrad}>
                          <Text style={styles.boostSheetCtaText}>{processingBoost ? 'Processing...' : `Boost for $${selOpt.price.toFixed(2)}`}</Text>
                        </LinearGradient>
                      </Pressable>
                    </>
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
  );

  const isProfileBoosted = !!(user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt)));

  if (showCityPrompt && !activeCity) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <AppHeader title="Roommates" role="renter" hideSeparator />
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
          activeSubArea={activeSubArea}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onSubAreaSelect={setActiveSubArea}
          onClose={() => setShowCityPicker(false)}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <AppHeader title="Roommates" role="renter" hideSeparator />
        {renderCitySelector()}
        <View style={styles.emptyState}>
          <Feather name="loader" size={64} color="rgba(255,255,255,0.35)" />
          <ThemedText style={[Typography.h2, styles.emptyTitle, { color: '#FFFFFF' }]}>Loading...</ThemedText>
        </View>
        <CityPickerModal
          visible={showCityPicker}
          activeCity={activeCity}
          activeSubArea={activeSubArea}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onSubAreaSelect={setActiveSubArea}
          onClose={() => setShowCityPicker(false)}
        />
      </View>
    );
  }

  const lowProfileCount = profiles.length > 0 && profiles.length <= 2 && activeCity;

  if (!currentProfile) {
    return (
      <View style={[styles.container, { backgroundColor: '#141414' }]}>
        <AppHeader
          title="Roommates"
          role="renter"
          hideSeparator
          rightActions={
            <>
              <HeaderIconButton
                icon="zap"
                onPress={() => {
                  if (user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt))) {
                    setBoostTimeLabel(getBoostTimeRemaining(user.boostData.boostExpiresAt));
                  }
                  setShowBoostModal(true);
                }}
                color={isProfileBoosted ? '#FFD700' : undefined}
                active={isProfileBoosted}
                activeColor="#FFD700"
              />
              <HeaderIconButton
                icon="bell"
                onPress={() => (navigation as any).navigate('ActivityFeed')}
                badge={unreadFeedCount > 0}
              />
            </>
          }
        />
        {renderCitySelector()}
        <AIInsightBanner
          onPress={() => (navigation as any).navigate('AIAssistant')}
          rightSwipeCount={rightSwipeCount}
          totalSwipeCount={totalSwipeCount}
        />
        <DailyQuestionCard />
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
          activeSubArea={activeSubArea}
          recentCities={recentCities}
          onCitySelect={handleCityChange}
          onSubAreaSelect={setActiveSubArea}
          onClose={() => setShowCityPicker(false)}
        />
        <RoommateFilterSheet
          visible={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          onApply={handleApplyFilters}
          currentFilters={matchFilters}
          allProfiles={unfilteredProfiles}
          userPlan={user?.subscription?.plan || 'basic'}
          onUpgradePress={() => { setShowFilterSheet(false); setTimeout(() => setShowPaywall(true), 300); }}
        />
        <PaywallSheet
          visible={showPaywall}
          featureName="AI Match Assistant"
          requiredPlan="plus"
          role="renter"
          onUpgrade={() => { setShowPaywall(false); (navigation as any).navigate('Plans'); }}
          onDismiss={() => setShowPaywall(false)}
        />
        {renderBoostModal()}
      </View>
    );
  }

  const handleUpgradeToPaid = () => {
    setShowPaywall(false);
    (navigation as any).navigate('Plans');
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
        (navigation as any).navigate('Plans');
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
        const wantsUpgrade = await confirm({
          title: 'Daily Limit Reached',
          message: coldCheck.reason || "You've used all your messages for today. Resets at midnight.",
          confirmText: 'Upgrade for More',
          cancelText: 'OK',
          variant: 'warning',
        });
        if (wantsUpgrade) (navigation as any).navigate('Plans');
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

      const compatibility = compatibilityMap.get(currentProfile.id) ?? 50;
      const systemText = isCold
        ? `You sent a direct message request to ${currentProfile.name}.`
        : `You matched with ${currentProfile.name}! Say hello.`;

      const systemMessage = {
        id: `msg-sys-${Date.now()}`,
        senderId: 'system',
        text: systemText,
        content: systemText,
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
        unreadCount: 0,
        unread: 0,
        messages: [systemMessage],
        matchType: isCold ? 'cold' : 'mutual',
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
        createdAt: new Date().toISOString(),
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
      <AppHeader
        title="Roommates"
        role="renter"
        hideSeparator
        rightActions={
          <>
            <HeaderIconButton
              icon="zap"
              onPress={() => {
                if (user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(String(user.boostData.boostExpiresAt))) {
                  setBoostTimeLabel(getBoostTimeRemaining(user.boostData.boostExpiresAt));
                }
                setShowBoostModal(true);
              }}
              color={isProfileBoosted ? '#FFD700' : undefined}
              active={isProfileBoosted}
              activeColor="#FFD700"
            />
            <HeaderIconButton
              icon="bell"
              onPress={() => (navigation as any).navigate('ActivityFeed')}
              badge={unreadFeedCount > 0}
            />
          </>
        }
      />

      {renderCitySelector()}

      {profileCompletion < 100 && !bannerDismissed ? (
        <Pressable
          style={styles.completionBannerWrap}
          onPress={() => (navigation as any).navigate('ProfileCompletion')}
        >
          <View style={styles.completionBannerLeft}>
            <ThemedText style={styles.completionBannerTitle}>
              Complete your profile — {profileCompletion}% done
            </ThemedText>
            <View style={styles.completionBarTrack}>
              <LinearGradient
                colors={['#ff6b5b', '#e83a2a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.completionBarFill, { width: `${Math.max(profileCompletion, 5)}%` }]}
              />
            </View>
          </View>
          <Pressable
            style={styles.completionDismissBtn}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              setBannerDismissed(true);
            }}
          >
            <Feather name="x" size={14} color="rgba(255,255,255,0.35)" />
          </Pressable>
        </Pressable>
      ) : null}

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

      <AIInsightBanner
        onPress={() => (navigation as any).navigate('AIAssistant')}
        rightSwipeCount={rightSwipeCount}
        totalSwipeCount={totalSwipeCount}
      />

      <AIGroupSuggestionCard
        onAccepted={() => {}}
        onDismissed={() => {}}
      />

      <DailyQuestionCard />

      {canSeeAIMatch && bestMatch ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.bestMatchBanner}>
          <LinearGradient
            colors={['#1a1a1a', '#222']}
            style={styles.bestMatchCard}
          >
            <View style={styles.bestMatchHeader}>
              <Feather name="zap" size={14} color="#ff6b5b" />
              <ThemedText style={styles.bestMatchLabel}>YOUR BEST MATCH TODAY</ThemedText>
            </View>
            <View style={styles.bestMatchContent}>
              <Image
                source={{ uri: bestMatch.profile.profile?.photos?.[0] || bestMatch.profile.avatar_url }}
                style={styles.bestMatchAvatar}
              />
              <View style={styles.bestMatchInfo}>
                <ThemedText style={styles.bestMatchName}>
                  {bestMatch.profile.full_name}{bestMatch.profile.age ? `, ${bestMatch.profile.age}` : ''}
                </ThemedText>
                <ThemedText style={styles.bestMatchReason}>{bestMatch.reason}</ThemedText>
              </View>
              <View style={styles.bestMatchScoreWrap}>
                <ThemedText style={styles.bestMatchScoreNum}>{bestMatch.score}%</ThemedText>
                <ThemedText style={styles.bestMatchScoreLabel}>match</ThemedText>
              </View>
            </View>
            <Pressable
              style={styles.findInDeckBtn}
              onPress={() => {
                if (highlightedProfileId) {
                  const idx = profiles.findIndex(p => p.id === highlightedProfileId);
                  if (idx >= 0 && idx !== currentIndex) {
                    setCurrentIndex(idx);
                    setCurrentPhotoIndex(0);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    showAlert({ title: 'Not in Deck', message: 'This person may not be in your current deck. Try adjusting your filters or city.' });
                  }
                }
              }}
            >
              <ThemedText style={styles.findInDeckText}>Find in deck</ThemedText>
              <Feather name="arrow-right" size={14} color="#ff6b5b" />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      ) : !canSeeAIMatch ? (
        <Pressable
          onPress={() => setShowPaywall(true)}
          style={styles.lockedBestMatchBanner}
        >
          <Feather name="zap" size={14} color="#ff6b5b" />
          <ThemedText style={styles.lockedBestMatchText}>
            Upgrade to Plus to see your best match today
          </ThemedText>
        </Pressable>
      ) : null}

      {lowProfileCount ? (
        <View style={styles.lowProfileBanner}>
          <Feather name="info" size={14} color="#FFD700" />
          <ThemedText style={styles.lowProfileBannerText}>
            Not many roommates here yet — be the first!
          </ThemedText>
        </View>
      ) : null}

      {swipeUpgradePrompt && !showSwipeLimitModal ? (
        <SmartUpgradePrompt
          data={swipeUpgradePrompt}
          variant="banner"
          onUpgrade={() => {
            setSwipeUpgradePrompt(null);
            (navigation as any).navigate('Plans');
          }}
          onDismiss={() => setSwipeUpgradePrompt(null)}
        />
      ) : null}

      <View style={styles.cardArea}>
        {pendingQuestion && questionInjectedAtIndex === currentIndex ? (
          <View style={[styles.card, { zIndex: 1, justifyContent: 'center' }]}>
            <AIQuestionCard
              question={pendingQuestion}
              onAnswer={handleQuestionAnswer}
              onSkip={handleQuestionSkip}
            />
          </View>
        ) : (
        <>
        {nextProfile ? (
          <View style={[styles.card, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0, pointerEvents: 'none' }]}>
            <Image source={{ uri: (Array.isArray(nextProfile.photos) ? nextProfile.photos : nextProfile.photos ? [nextProfile.photos] : [])[0] }} resizeMode="cover" style={styles.cardImage} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.4, 1]}
              style={[styles.cardGradient, { pointerEvents: 'none' }]}
            />
            <View style={styles.cardInfo}>
              <ThemedText style={styles.cardName}>{nextProfile.name}, {nextProfile.age}</ThemedText>
            </View>
          </View>
        ) : null}
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            ref={roommatesTour.setRef('swipeCard')}
            collapsable={false}
            style={[
            styles.card,
            animatedCardStyle,
            { zIndex: 1 },
            isBoosted ? styles.cardBoostedGlow : null,
            user?.receivedSuperLikes?.some((sl: { superLikerId: string }) => sl.superLikerId === currentProfile.id) ? styles.cardSuperInterestGlow : null,
            highlightedProfileId && currentProfile.id === highlightedProfileId ? styles.cardHighlightedGlow : null,
          ]}>
            <Image source={{ uri: photosArray[currentPhotoIndex] || photosArray[0] }} resizeMode="cover" style={styles.cardImage} />
            {photosArray.length > 1 ? (
              <View style={styles.photoTapZones}>
                <Pressable
                  style={styles.photoTapLeft}
                  onPress={() => setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))}
                />
                <Pressable
                  style={styles.photoTapRight}
                  onPress={() => setCurrentPhotoIndex(Math.min(photosArray.length - 1, currentPhotoIndex + 1))}
                />
              </View>
            ) : null}

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
              {(currentProfile as any).instagram_verified ? (
                <InstagramBadge verified={true} />
              ) : null}
              {user?.receivedSuperLikes?.some((sl: { superLikerId: string }) => sl.superLikerId === currentProfile.id) ? (
                <ThemedText style={styles.superInterestCardLabel}>Sent you a Super Interest</ThemedText>
              ) : null}
              <ThemedText style={styles.cardJob} numberOfLines={1}>
                {getTagLabel(currentProfile.occupation) || currentProfile.occupation} {currentProfile.preferences?.location ? `\u00B7 ${currentProfile.preferences.location}` : ''}
              </ThemedText>
              <ThemedText style={styles.cardBio} numberOfLines={2}>
                {currentProfile.bio}
              </ThemedText>
              {currentProfile.ideal_roommate_text ? (
                <ThemedText style={styles.piLookingFor} numberOfLines={1}>
                  {'\u03C0'} Looking for: {currentProfile.ideal_roommate_text}
                </ThemedText>
              ) : null}
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
                {currentProfile.preferred_neighborhoods?.length > 0 ? (
                  <View style={styles.tagDark}>
                    <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
                    <ThemedText style={styles.tagDarkText} numberOfLines={1}>{currentProfile.preferred_neighborhoods.slice(0, 2).join(', ')}</ThemedText>
                  </View>
                ) : currentProfile.preferences?.location ? (
                  <View style={styles.tagDark}>
                    <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
                    <ThemedText style={styles.tagDarkText} numberOfLines={1}>{currentProfile.preferences.location}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.tagMatch}>
                  <Feather name="heart" size={12} color="#ff8070" />
                  <ThemedText style={styles.tagMatchText}>{currentProfile.compatibility || 50}% Match</ThemedText>
                </View>
                {renterLimits.hasPiDeckReranking && piBoostedIds.has(currentProfile.id) ? (
                  <View style={styles.piPickBadge}>
                    <Feather name="cpu" size={10} color="#a855f7" />
                    <ThemedText style={styles.piPickText}>{'\u03C0'} Pi Pick</ThemedText>
                  </View>
                ) : null}
                <Pressable
                  style={styles.whyMatchButton}
                  onPress={() => setShowWhyModal(true)}
                >
                  <ThemedText style={styles.whyMatchText}>Why?</ThemedText>
                  <Feather name="cpu" size={12} color="#a855f7" />
                </Pressable>
                <Pressable
                  style={styles.askAIPill}
                  onPress={() => {
                    setAskAboutTarget({
                      id: currentProfile.id,
                      name: currentProfile.name,
                      age: currentProfile.age,
                      compatibility: currentProfile.compatibility,
                      entryPoint: 'swipe_card',
                    });
                    setAskAboutVisible(true);
                  }}
                >
                  <Feather name="cpu" size={12} color="#FF6B6B" />
                  <ThemedText style={styles.askAIPillText}>Ask AI</ThemedText>
                </Pressable>
              </View>
              {(() => {
                const cardInsights = user ? generateAlgorithmicInsights(user, currentProfile) : [];
                const topInsight = selectCardInsight(cardInsights);
                return topInsight ? (
                  <View style={{ paddingHorizontal: 16, marginTop: -2 }}>
                    <InsightChip insight={topInsight} compact />
                  </View>
                ) : null;
              })()}
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
              {piCardLoading ? (
                <View style={styles.piSummaryRow}>
                  <Feather name="cpu" size={11} color="#a855f7" />
                  <View style={styles.piSummarySkeleton}>
                    <View style={[styles.piSkeletonBar, { width: '70%' }]} />
                  </View>
                </View>
              ) : piCardSummary ? (
                <View style={styles.piSummaryRow}>
                  <Feather name="cpu" size={11} color="#a855f7" />
                  <ThemedText style={styles.piSummaryText} numberOfLines={2}>
                    {'\u03C0'} Pi's Take: {piCardSummary}
                  </ThemedText>
                </View>
              ) : null}
              {(renterPlan === 'plus' || renterPlan === 'elite') && suggestedListingForPair ? (
                <Pressable
                  style={styles.pairListingSuggestion}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    (navigation as any).navigate('Explore', {
                      highlightListingId: suggestedListingForPair.listing.id,
                    });
                  }}
                >
                  <View style={styles.pairListingHeader}>
                    <Feather name="home" size={11} color="#ff6b5b" />
                    <Text style={styles.pairListingHeaderText}>
                      Perfect listing for you two
                    </Text>
                    {suggestedListingForPair.isBoosted ? (
                      <View style={styles.pairListingPromoted}>
                        <Feather name="zap" size={8} color="#60a5fa" />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.pairListingContent}>
                    {suggestedListingForPair.listing.photos?.[0] ? (
                      <Image
                        source={{ uri: suggestedListingForPair.listing.photos[0] }}
                        style={styles.pairListingThumb}
                      />
                    ) : (
                      <View style={[styles.pairListingThumb, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="home" size={16} color="#666" />
                      </View>
                    )}
                    <View style={styles.pairListingInfo}>
                      <Text style={styles.pairListingTitle} numberOfLines={1}>
                        {suggestedListingForPair.listing.bedrooms}BR in {suggestedListingForPair.listing.neighborhood || suggestedListingForPair.listing.city}
                      </Text>
                      <Text style={styles.pairListingPrice}>
                        ${suggestedListingForPair.perPersonRent.toLocaleString()}/person
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
                  </View>
                </Pressable>
              ) : renterPlan === 'free' && suggestedListingForPair ? (
                <Pressable
                  style={[styles.pairListingSuggestion, { opacity: 0.5 }]}
                  onPress={() => setShowPaywall(true)}
                >
                  <View style={styles.pairListingHeader}>
                    <Feather name="lock" size={11} color="rgba(255,255,255,0.3)" />
                    <Text style={[styles.pairListingHeaderText, { color: 'rgba(255,255,255,0.3)' }]}>
                      Listing suggestion for you two
                    </Text>
                    <PlanBadgeInline plan="Plus" locked />
                  </View>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>

        <Pressable
          style={styles.flagBtn}
          onPress={() => setShowReportBlockModal(true)}
        >
          <Feather name="flag" size={14} color="rgba(255,255,255,0.7)" />
        </Pressable>
        </>
        )}
      </View>

      <View style={styles.actionRow} ref={roommatesTour.setRef('matchInsights')} collapsable={false}>
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
        <Animated.View style={superInterestBtnStyle} ref={roommatesTour.setRef('superLike')} collapsable={false}>
          <Pressable
            style={[styles.actionBtnSuperInterest, getSuperInterestCount() === 0 && !BETA_MODE && user?.subscription?.plan !== 'elite' ? { opacity: 0.4 } : null]}
            onPress={handleSuperInterest}
          >
            <LinearGradient colors={['#4A90E2', '#1a5fc4']} style={styles.actionBtnSuperInterestGradient}>
              <Feather name="star" size={24} color="#fff" />
              {getSuperInterestCount() === 0 && !BETA_MODE && user?.subscription?.plan !== 'elite' ? (
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
        matchedUserInstagramVerified={matchedProfileData?.profile?.instagram_verified}
        matchedUserInstagramHandle={matchedProfileData?.profile?.instagram_handle}
        viewerHasPremium={BETA_MODE || user?.subscription?.plan === 'plus' || user?.subscription?.plan === 'elite'}
        onUpgradePress={() => setShowPaywall(true)}
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

              const compatibility = compatibilityMap.get(profile.id) ?? 50;
              const systemText = `You matched with ${profile.name}! Say hello.`;
              const systemMessage = {
                id: `msg-sys-${Date.now()}`,
                senderId: 'system',
                text: systemText,
                content: systemText,
                timestamp: new Date().toISOString(),
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
                timestamp: new Date().toISOString(),
                unreadCount: 0,
                unread: 0,
                messages: [systemMessage],
                matchType: (thisMatch?.matchType || 'mutual') as 'mutual' | 'super_interest' | 'cold',
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
                createdAt: new Date().toISOString(),
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
        onAskAI={() => {
          const p = matchedProfileData?.profile;
          if (p) {
            setAskAboutTarget({
              id: p.id,
              name: p.name,
              age: p.age,
              compatibility: matchedProfileData?.compatibility,
              entryPoint: 'match_screen',
            });
            setAskAboutVisible(true);
          }
        }}
      />

      <PaywallSheet
        visible={showPaywall}
        featureName="AI Match Assistant"
        requiredPlan="plus"
        role="renter"
        onUpgrade={handleUpgradeToPaid}
        onDismiss={() => setShowPaywall(false)}
      />

      <Modal
        visible={showSwipeLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwipeLimitModal(false)}
      >
        <Pressable style={styles.swipeLimitOverlay} onPress={() => { setShowSwipeLimitModal(false); setSwipeUpgradePrompt(null); }}>
          <Pressable onPress={() => {}}>
            {swipeUpgradePrompt ? (
              <SmartUpgradePrompt
                data={swipeUpgradePrompt}
                variant="card"
                onUpgrade={() => {
                  setShowSwipeLimitModal(false);
                  setSwipeUpgradePrompt(null);
                  (navigation as any).navigate('Plans');
                }}
                onDismiss={() => {
                  setShowSwipeLimitModal(false);
                  setSwipeUpgradePrompt(null);
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFirstSessionPrompt} transparent animationType="fade" onRequestClose={async () => {
        setShowFirstSessionPrompt(false);
        await AsyncStorage.setItem(PROFILE_PROMPT_DISMISS_KEY, new Date().toISOString());
      }}>
        <View style={styles.firstSessionOverlay}>
          <View style={styles.firstSessionCard}>
            <Pressable
              style={styles.firstSessionCloseBtn}
              onPress={async () => {
                setShowFirstSessionPrompt(false);
                await AsyncStorage.setItem(PROFILE_PROMPT_DISMISS_KEY, new Date().toISOString());
              }}
            >
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
            <View style={styles.firstSessionIconWrap}>
              <Feather name="user-check" size={36} color="#ff6b5b" />
            </View>
            <ThemedText style={styles.firstSessionTitle}>Let's set up your profile</ThemedText>
            <ThemedText style={styles.firstSessionSub}>
              A complete profile helps us find your best matches. It only takes a minute.
            </ThemedText>
            <Pressable
              style={styles.firstSessionPrimary}
              onPress={async () => {
                setShowFirstSessionPrompt(false);
                await AsyncStorage.setItem(PROFILE_PROMPT_KEY, 'true');
                (navigation as any).navigate('ProfileCompletion');
              }}
            >
              <LinearGradient
                colors={['#ff6b5b', '#e83a2a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.firstSessionPrimaryGrad}
              >
                <ThemedText style={styles.firstSessionPrimaryText}>Get started</ThemedText>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {renderBoostModal()}

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
                  (navigation as any).navigate('Plans');
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
        transparent={false}
        onRequestClose={() => { setShowProfileDetail(false); setShowPhotoGrid(false); }}
      >
        <View style={{ flex: 1, backgroundColor: '#111' }}>
          {(() => {
            const photosArray = Array.isArray(currentProfile.photos)
              ? currentProfile.photos
              : currentProfile.photos
                ? [currentProfile.photos]
                : [];
            const matchScore = currentProfile.compatibility || 50;
            const detailedScore = user ? calculateDetailedCompatibility(user, currentProfile) : null;
            const verifyLevel = getVerificationLevel(currentProfile.verification);

            return (
              <>
                <View style={styles.pdPhotoWrap}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                      setCurrentPhotoIndex(idx);
                    }}
                  >
                    {photosArray.length > 0 ? photosArray.map((uri, i) => (
                      <Image
                        key={i}
                        source={{ uri }}
                        style={styles.pdPhoto}
                        resizeMode="cover"
                      />
                    )) : (
                      <View style={[styles.pdPhoto, { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="user" size={64} color="rgba(255,255,255,0.15)" />
                      </View>
                    )}
                  </ScrollView>

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={styles.pdPhotoGradient}
                  >
                    <View style={[
                      styles.pdMatchBadge,
                      { backgroundColor: matchScore >= 70 ? '#2ecc71' : matchScore >= 40 ? '#f39c12' : '#e74c3c' }
                    ]}>
                      <Feather name="heart" size={11} color="#fff" />
                      <Text style={styles.pdMatchText}>{matchScore}% Match</Text>
                    </View>

                    <Text style={styles.pdName}>{currentProfile.name}, {currentProfile.age}</Text>

                    <View style={styles.pdSubRow}>
                      <Text style={styles.pdOccupation}>
                        {getTagLabel(currentProfile.occupation) || currentProfile.occupation}
                      </Text>
                      {verifyLevel > 0 ? (
                        <View style={styles.pdVerifiedBadge}>
                          <Feather name="check-circle" size={11} color="#2ecc71" />
                          <Text style={styles.pdVerifiedText}>
                            {verifyLevel >= 3 ? 'Fully Verified' : verifyLevel >= 2 ? 'Verified' : 'Partial'}
                          </Text>
                        </View>
                      ) : null}
                      {currentProfile.zodiacSign ? (
                        <View style={styles.pdZodiacPill}>
                          <Text style={styles.pdZodiacText}>{currentProfile.zodiacSign}</Text>
                        </View>
                      ) : null}
                    </View>
                  </LinearGradient>

                  {photosArray.length > 1 ? (
                    <View style={styles.pdDots}>
                      {photosArray.map((_, i) => (
                        <View key={i} style={[styles.pdDot, i === currentPhotoIndex && styles.pdDotActive]} />
                      ))}
                    </View>
                  ) : null}

                  {photosArray.length > 1 ? (
                    <Pressable
                      style={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      }}
                      onPress={() => {
                        setPhotoGridIndex(currentPhotoIndex);
                        setShowPhotoGrid(true);
                      }}
                    >
                      <Feather name="grid" size={12} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                        {photosArray.length} photos
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable style={[styles.pdCloseBtn, { top: Math.max(14, insets.top + 6) }]} onPress={() => { setShowProfileDetail(false); setShowPhotoGrid(false); }}>
                    <Feather name="x" size={18} color="#fff" />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.pdStatStrip}>
                    {[
                      { icon: 'dollar-sign' as const, label: 'Budget', value: `$${currentProfile.budget}/mo` },
                      { icon: 'map-pin' as const, label: 'Location', value: currentProfile.preferred_neighborhoods?.length > 0 ? currentProfile.preferred_neighborhoods.join(', ') : (currentProfile.preferences?.location ?? 'Flexible') },
                      { icon: 'calendar' as const, label: 'Move-in', value: currentProfile.preferences?.moveInDate ? formatMoveInDate(currentProfile.preferences.moveInDate) : 'ASAP' },
                      { icon: 'home' as const, label: 'Rooms', value: `${currentProfile.preferences?.bedrooms ?? 1} bd` },
                    ].map((stat, i) => (
                      <View key={i} style={[styles.pdStat, i < 3 && styles.pdStatBorder]}>
                        <Feather name={stat.icon} size={16} color="#ff6b5b" />
                        <Text style={styles.pdStatValue}>{stat.value}</Text>
                        <Text style={styles.pdStatLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>

                  {detailedScore && matchScore >= 50 ? (
                    <View style={styles.pdSection}>
                      <Text style={styles.pdSectionLabel}>Match Insights</Text>
                      <View style={styles.pdCard}>
                        <MatchInsights score={detailedScore} />
                      </View>
                    </View>
                  ) : null}

                  {currentProfile.bio ? (
                    <View style={styles.pdSection}>
                      <Text style={styles.pdSectionLabel}>About</Text>
                      <View style={styles.pdCard}>
                        <Text style={styles.pdBioText}>{currentProfile.bio}</Text>
                      </View>
                    </View>
                  ) : null}

                  {currentProfile.profileData?.profileNote ? (
                    <View style={styles.pdSection}>
                      <View style={{
                        padding: 14,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderRadius: 14,
                        borderLeftWidth: 3,
                        borderLeftColor: '#ff6b5b',
                      }}>
                        <Text style={{
                          color: '#ff6b5b',
                          fontSize: 11,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                          marginBottom: 6,
                        }}>
                          IN THEIR OWN WORDS
                        </Text>
                        <Text style={{
                          color: 'rgba(255,255,255,0.85)',
                          fontSize: 14,
                          lineHeight: 21,
                          fontStyle: 'italic',
                        }}>
                          "{currentProfile.profileData.profileNote}"
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          <Feather name="eye" size={10} color="rgba(255,255,255,0.3)" />
                          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                            Written by {currentProfile.name?.split(' ')[0]}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {currentProfile.ideal_roommate_text ? (
                    <View style={styles.pdSection}>
                      <View style={{
                        padding: 14,
                        backgroundColor: 'rgba(168,85,247,0.06)',
                        borderRadius: 14,
                        borderLeftWidth: 3,
                        borderLeftColor: '#a855f7',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Feather name="cpu" size={11} color="#a855f7" />
                          <Text style={{
                            color: '#a855f7',
                            fontSize: 11,
                            fontWeight: '700',
                            letterSpacing: 0.5,
                          }}>
                            {'\u03C0'} Looking for...
                          </Text>
                        </View>
                        <Text style={{
                          color: 'rgba(255,255,255,0.85)',
                          fontSize: 14,
                          lineHeight: 21,
                          fontStyle: 'italic',
                        }}>
                          "{currentProfile.ideal_roommate_text}"
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.pdSection}>
                    <Text style={styles.pdSectionLabel}>Lifestyle</Text>
                    <View style={{ gap: 8 }}>
                      {([
                        {
                          icon: 'star' as const,
                          value: getCleanlinessLabel(currentProfile.lifestyle?.cleanliness),
                          sub: (() => {
                            const v = currentProfile.lifestyle?.cleanliness ?? 3;
                            if (v >= 4.5) return 'Keeps shared spaces spotless';
                            if (v >= 3.5) return 'Tidies up regularly';
                            if (v >= 2.5) return 'Moderately tidy';
                            if (v >= 1.5) return 'Relaxed about mess';
                            return 'Very laid-back about cleanliness';
                          })(),
                          color: '#ff6b5b',
                        },
                        {
                          icon: 'users' as const,
                          value: getSocialLevelLabel(currentProfile.lifestyle?.socialLevel),
                          sub: (() => {
                            const v = currentProfile.lifestyle?.socialLevel ?? 3;
                            if (v >= 4.5) return 'Loves having people over';
                            if (v >= 3.5) return 'Enjoys socializing at home';
                            if (v >= 2.5) return 'Balanced — social but values quiet time';
                            if (v >= 1.5) return 'Prefers a quieter home';
                            return 'Needs a very quiet environment';
                          })(),
                          color: '#ff6b5b',
                        },
                        {
                          icon: 'briefcase' as const,
                          value: getWorkScheduleLabel(currentProfile.lifestyle?.workSchedule),
                          sub: (() => {
                            const s = currentProfile.lifestyle?.workSchedule;
                            if (s === 'wfh' || s === 'wfh_fulltime' || s === 'remote') return 'Home most of the day';
                            if (s === 'office' || s === 'office_fulltime') return 'Out of the apartment 9\u20135';
                            if (s === 'hybrid') return 'Mix of home and office days';
                            if (s === 'night_shift') return 'Works nights — sleeps during the day';
                            if (s === 'irregular') return 'Varied schedule — hours change often';
                            if (s === 'student') return 'On campus most days';
                            if (s === 'freelance') return 'Works from home on flexible hours';
                            return 'Schedule varies';
                          })(),
                          color: '#ff6b5b',
                        },
                        currentProfile.lifestyle?.pets
                          ? { icon: 'heart' as const, value: 'Has Pets', sub: 'Will bring a pet to the apartment', color: '#f39c12' }
                          : null,
                        currentProfile.lifestyle?.smoking
                          ? { icon: 'wind' as const, value: 'Smoking OK', sub: 'Open to smoking in shared spaces', color: 'rgba(255,255,255,0.5)' }
                          : { icon: 'x' as const, value: 'No Smoking', sub: 'Prefers a smoke-free home', color: 'rgba(255,255,255,0.35)' },
                        currentProfile.preferences?.privateBathroom
                          ? { icon: 'droplet' as const, value: 'Needs Private Bath', sub: 'Requires their own bathroom', color: '#ff6b5b' }
                          : null,
                      ] as (null | { icon: any; value: string; sub: string; color: string })[])
                        .filter(Boolean)
                        .map((tag, i) => (
                          <View key={i} style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.07)',
                          }}>
                            <View style={{
                              width: 32, height: 32, borderRadius: 10,
                              backgroundColor: 'rgba(255,107,91,0.1)',
                              alignItems: 'center', justifyContent: 'center',
                              marginTop: 1,
                            }}>
                              <Feather name={tag!.icon} size={14} color={tag!.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                                {tag!.value}
                              </Text>
                              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                {tag!.sub}
                              </Text>
                            </View>
                          </View>
                        ))}
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
                      <View style={styles.pdSection}>
                        <Text style={styles.pdSectionLabel}>Interests</Text>
                        {Object.entries(INTEREST_TAGS).map(([catKey, cat]) => {
                          const catTags = cat.tags.filter(t => profileTags.includes(t.id));
                          if (catTags.length === 0) return null;
                          return (
                            <View key={catKey} style={{ marginBottom: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <Feather name={cat.icon as any} size={14} color="rgba(255,255,255,0.4)" />
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>{cat.label}</Text>
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
                                      <Text style={{ fontSize: 12, fontWeight: '500', color: isShared ? '#ff6b5b' : '#FFFFFF' }}>
                                        {tag.label}
                                      </Text>
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

                  {user && currentProfile.zodiacSign && user.zodiacSign && (BETA_MODE || user.subscription?.plan === 'plus' || user.subscription?.plan === 'elite') ? (
                    <View style={styles.pdSection}>
                      <Text style={styles.pdSectionLabel}>Zodiac Compatibility</Text>
                      <View style={styles.pdCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 22, marginRight: 8 }}>
                            {getZodiacSymbol(user.zodiacSign)}
                          </Text>
                          <Feather name="heart" size={16} color="#ff6b5b" />
                          <Text style={{ fontSize: 22, marginLeft: 8 }}>
                            {getZodiacSymbol(currentProfile.zodiacSign)}
                          </Text>
                        </View>
                        <Text style={styles.pdBioText}>
                          {getZodiacCompatibilityLevel(user.zodiacSign, currentProfile.zodiacSign)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 6,
                  backgroundColor: '#111',
                }}>
                  {renterLimits.hasMatchBreakdown ? (
                    <Pressable
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255,107,91,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,107,91,0.2)',
                      }}
                      onPress={() => setShowWhyModal(true)}
                    >
                      <Feather name="zap" size={14} color="#ff6b5b" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#ff6b5b' }}>
                        Why this match?
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: 'rgba(168,85,247,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(168,85,247,0.2)',
                      }}
                      onPress={() => {
                        setShowProfileDetail(false);
                        setShowPhotoGrid(false);
                        setTimeout(() => (navigation as any).navigate('Plans'), 200);
                      }}
                    >
                      <Feather name="lock" size={13} color="#a855f7" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#a855f7' }}>
                        Why this match?
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 11,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,107,91,0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,107,91,0.18)',
                    }}
                    onPress={() => {
                      setShowProfileDetail(false);
                      setShowPhotoGrid(false);
                      setTimeout(() => {
                        setAskAboutTarget({
                          id: currentProfile.id,
                          name: currentProfile.name,
                          age: currentProfile.age,
                          compatibility: currentProfile.compatibility,
                          entryPoint: 'match_screen',
                        });
                        setAskAboutVisible(true);
                      }, 300);
                    }}
                  >
                    <Feather name="cpu" size={14} color="#ff6b5b" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#ff6b5b' }}>
                      Ask AI about {currentProfile.name?.split(' ')[0] || 'them'}
                    </Text>
                  </Pressable>
                </View>

                <View style={[styles.pdActionBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
                  <Pressable
                    style={styles.pdActionPass}
                    onPress={() => {
                      setShowProfileDetail(false);
                      setShowPhotoGrid(false);
                      handleSwipeAction('nope');
                    }}
                  >
                    <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
                  </Pressable>

                  <Pressable
                    style={styles.pdActionInterested}
                    onPress={() => {
                      setShowProfileDetail(false);
                      setShowPhotoGrid(false);
                      handleSwipeAction('like');
                    }}
                  >
                    <Feather name="heart" size={18} color="#fff" />
                    <Text style={styles.pdActionInterestedText}>I'm Interested</Text>
                  </Pressable>

                  <Pressable
                    style={styles.pdActionMessage}
                    onPress={async () => {
                      if (!currentProfile || !user) return;
                      const matches = await StorageService.getMatches();
                      const hasMatch = matches.some(m =>
                        (m.userId1 === user.id && m.userId2 === currentProfile.id) ||
                        (m.userId2 === user.id && m.userId1 === currentProfile.id)
                      );
                      if (hasMatch) {
                        setShowProfileDetail(false);
                        setShowPhotoGrid(false);
                        setTimeout(() => handleSendDirectMessage(false), 200);
                      } else {
                        const coldCheck = await canSendColdMessage();
                        if (!coldCheck.canSend) {
                          const wantsUpgrade = await confirm({
                            title: 'Daily Limit Reached',
                            message: coldCheck.reason || "You've used all your messages for today. Resets at midnight.",
                            confirmText: 'Upgrade for More',
                            cancelText: 'OK',
                            variant: 'warning',
                          });
                          if (wantsUpgrade) (navigation as any).navigate('Plans');
                          return;
                        }
                        setShowProfileDetail(false);
                        setShowPhotoGrid(false);
                        setTimeout(() => handleSendDirectMessage(true), 200);
                      }
                    }}
                  >
                    <Feather name="message-circle" size={22} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                </View>
              </>
            );
          })()}
        </View>
      </Modal>

      <Modal
        visible={showPhotoGrid}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setShowPhotoGrid(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: Math.max(16, insets.top + 8),
            paddingBottom: 12,
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              {currentProfile?.name?.split(' ')[0]}'s Photos
            </Text>
            <Pressable
              onPress={() => setShowPhotoGrid(false)}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Feather name="x" size={18} color="#fff" />
            </Pressable>
          </View>

          {(() => {
            const gridPhotos = Array.isArray(currentProfile?.photos)
              ? currentProfile.photos
              : currentProfile?.photos
              ? [currentProfile.photos]
              : [];

            if (gridPhotos.length === 0) {
              return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No photos available</Text>
                </View>
              );
            }

            return (
              <>
                <View style={{ width: '100%', height: 340, marginBottom: 12 }}>
                  <Image
                    source={{ uri: gridPhotos[photoGridIndex] || '' }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 12,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {photoGridIndex + 1} / {gridPhotos.length}
                    </Text>
                  </View>
                </View>

                <ScrollView contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 3,
                  paddingHorizontal: 3,
                }}>
                  {gridPhotos.map((uri: string, i: number) => (
                    <Pressable
                      key={i}
                      onPress={() => setPhotoGridIndex(i)}
                      style={{
                        width: '32.5%',
                        aspectRatio: 1,
                        borderRadius: 4,
                        overflow: 'hidden',
                        borderWidth: photoGridIndex === i ? 2 : 0,
                        borderColor: '#ff6b5b',
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            );
          })()}
        </View>
      </Modal>

      <CityPickerModal
        visible={showCityPicker}
        activeCity={activeCity}
        activeSubArea={activeSubArea}
        recentCities={recentCities}
        onCitySelect={handleCityChange}
        onSubAreaSelect={setActiveSubArea}
        onClose={() => setShowCityPicker(false)}
      />

      <RoommateFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onApply={handleApplyFilters}
        currentFilters={matchFilters}
        allProfiles={unfilteredProfiles}
        userPlan={user?.subscription?.plan || 'basic'}
        onUpgradePress={() => { setShowFilterSheet(false); setTimeout(() => setShowPaywall(true), 300); }}
      />

      {currentProfile ? (
        <WhyThisMatchModal
          visible={showWhyModal}
          profileId={currentProfile.id}
          profileName={currentProfile.name}
          compatibilityScore={currentProfile.compatibility || 50}
          onClose={() => setShowWhyModal(false)}
        />
      ) : null}

      {askAboutTarget ? (
        <AskAboutPersonModal
          visible={askAboutVisible}
          onClose={() => {
            setAskAboutVisible(false);
            setTimeout(() => setAskAboutTarget(null), 300);
          }}
          targetProfileId={askAboutTarget.id}
          targetName={askAboutTarget.name}
          targetAge={askAboutTarget.age}
          entryPoint={askAboutTarget.entryPoint}
          compatibilityScore={askAboutTarget.compatibility}
        />
      ) : null}

      <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => {
          setShowAISheet(false);
          setAiSheetContext('match');
        }}
        screenContext={aiSheetContext}
        contextData={{
          match: {
            currentProfile: profiles[currentIndex] || undefined,
            rightSwipeCount,
            leftSwipeCount: totalSwipeCount - rightSwipeCount,
          },
        }}
        onNavigate={(screen, params) => {
          if (screen === 'ProfileQuestionnaire') {
            (navigation as any).navigate('Profile', { screen: 'ProfileQuestionnaire', params });
          } else {
            (navigation as any).navigate(screen, params);
          }
        }}
      />
      <CoachMarkOverlay
        steps={roommatesTour.tourSteps}
        visible={roommatesTour.showTour}
        onComplete={roommatesTour.completeTour}
      />
      {gateModal ? (
        <FeatureGateModal
          visible={gateModal.visible}
          onClose={() => setGateModal(null)}
          onCompleteProfile={() => { setGateModal(null); (navigation as any).navigate('Profile', { screen: 'ProfileQuestionnaire' }); }}
          featureName={gateModal.feature}
          requiredTier={gateModal.requiredTier}
          currentTier={gateStatus.tier}
          nextItems={getItemsForTier(user, gateModal.requiredTier)}
        />
      ) : null}
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
  cardHighlightedGlow: {
    borderWidth: 2,
    borderColor: 'rgba(255,107,91,0.5)',
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
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
  photoTapZones: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: '40%' as any,
    flexDirection: 'row' as const,
    zIndex: 5,
  },
  photoTapLeft: {
    flex: 1,
  },
  photoTapRight: {
    flex: 1,
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
  piLookingFor: {
    fontSize: 12,
    color: 'rgba(168,85,247,0.8)',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 2,
  },
  piSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  piSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  piSummarySkeleton: {
    flex: 1,
    height: 14,
    justifyContent: 'center',
  },
  piSkeletonBar: {
    height: 10,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 5,
  },
  piPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  piPickText: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '700',
  },
  whyMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  whyMatchText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  askAIPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
  },
  askAIPillText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
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
  pdPhotoWrap: {
    position: 'relative',
    width: '100%',
    height: 320,
  },
  pdPhoto: {
    width: SCREEN_WIDTH,
    height: 320,
  },
  pdPhotoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 80,
    gap: 6,
  },
  pdMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 4,
  },
  pdMatchText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  pdName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pdSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pdOccupation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  pdVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pdVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ecc71',
  },
  pdZodiacPill: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pdZodiacText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c084fc',
  },
  pdDots: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  pdDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pdDotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  pdCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdStatStrip: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  pdStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  pdStatBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
  },
  pdStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  pdStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pdSection: {
    paddingHorizontal: 18,
    marginTop: 20,
    gap: 10,
  },
  pdSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pdCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  pdBioText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  pdPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdLifestylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pdLifestylePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  pdActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#111',
    gap: 14,
  },
  pdActionPass: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pdActionInterested: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff6b5b',
    borderRadius: 16,
    paddingVertical: 15,
  },
  pdActionInterestedText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  pdActionMessage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  boostTierRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  boostTierRowSelected: {
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  boostTierLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  boostTierSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
  },
  boostTierPrice: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#ff6b5b',
  },
  boostTierBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  boostTierBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#fff',
  },
  bestMatchBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: 8,
  },
  bestMatchCard: {
    borderRadius: 16,
    padding: 14,
  },
  bestMatchHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 10,
  },
  bestMatchLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#ff6b5b',
    letterSpacing: 1,
  },
  bestMatchContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  bestMatchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
  },
  bestMatchInfo: {
    flex: 1,
  },
  bestMatchName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  bestMatchReason: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  bestMatchScoreWrap: {
    alignItems: 'center' as const,
  },
  bestMatchScoreNum: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#ff6b5b',
  },
  bestMatchScoreLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600' as const,
  },
  findInDeckBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  findInDeckText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ff6b5b',
  },
  lockedBestMatchBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  lockedBestMatchText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  completionBannerWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: Spacing.md,
    marginBottom: 10,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 36,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    borderRadius: 14,
  },
  completionBannerLeft: {
    flex: 1,
    gap: 8,
  },
  completionBannerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  completionBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden' as const,
  },
  completionBarFill: {
    height: '100%' as any,
    borderRadius: 2,
  },
  completionDismissBtn: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  firstSessionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  firstSessionCard: {
    width: '100%' as any,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center' as const,
  },
  firstSessionCloseBtn: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1,
  },
  firstSessionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  firstSessionTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  firstSessionSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 28,
  },
  firstSessionPrimary: {
    width: '100%' as any,
    marginBottom: 14,
  },
  firstSessionPrimaryGrad: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  firstSessionPrimaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  swipeLimitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  swipeLimitCard: {
    width: '100%' as any,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
  },
  swipeLimitIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,91,0.12)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  swipeLimitTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  swipeLimitMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 8,
  },
  swipeLimitTimer: {
    fontSize: 13,
    color: '#ff6b5b',
    fontWeight: '600' as const,
    marginBottom: 24,
  },
  swipeLimitUpgradeBtn: {
    width: '100%' as any,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ff6b5b',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  swipeLimitUpgradeBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  swipeLimitDismissBtn: {
    paddingVertical: 10,
  },
  swipeLimitDismissText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500' as const,
  },
  pairListingSuggestion: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 107, 91, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 91, 0.15)',
    padding: 10,
  },
  pairListingHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 6,
  },
  pairListingHeaderText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255, 107, 91, 0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    flex: 1,
  },
  pairListingPromoted: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pairListingContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  pairListingThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  pairListingInfo: {
    flex: 1,
  },
  pairListingTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ddd',
  },
  pairListingPrice: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
});
