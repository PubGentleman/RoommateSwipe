import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Modal, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { RoommateProfile, Match } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, moderateScale, getResponsiveSpacing } from '../../utils/responsive';
import { calculateCompatibility, getMatchQualityColor, getCleanlinessLabel, getSocialLevelLabel, getWorkScheduleLabel, getWorkStyleTag, validateProfileDataConsistency, formatMoveInDate, getGenderSymbol } from '../../utils/matchingAlgorithm';
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
import { RoomdrAISheet, AISheetContextData } from '../../components/RoomdrAISheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Limit card size for web/desktop viewing
const MAX_CARD_WIDTH = 420;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xxl, MAX_CARD_WIDTH);

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseBoost, purchaseUndoPass, canRewind, useRewind, canSuperLike, useSuperLike, blockUser, reportUser } = useAuth();
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
  const [showPurchaseBoostModal, setShowPurchaseBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [lastSwipedProfile, setLastSwipedProfile] = useState<{ profile: RoommateProfile; action: 'like' | 'nope' | 'superlike' } | null>(null);
  const [showUndoUpgradeModal, setShowUndoUpgradeModal] = useState(false);
  const [processingUndoPass, setProcessingUndoPass] = useState(false);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [processingMessagePurchase, setProcessingMessagePurchase] = useState(false);
  const [showSuperLikeUpgradeModal, setShowSuperLikeUpgradeModal] = useState(false);
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
    loadProfiles();
  }, [activeCity, matchFilters]);

  useFocusEffect(
    React.useCallback(() => {
      console.log('[RoommatesScreen] Screen focused, reloading profiles to get latest photos');
      loadProfiles();
    }, [activeCity])
  );

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const allProfiles = await StorageService.getRoommateProfiles();
      const allUsers = await StorageService.getUsers();
      const history = await StorageService.getSwipeHistory();
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
      
      const profilesWithCompatibility = unseen.map(profile => {
        const compatibility = user ? calculateCompatibility(user, profile) : 50;
        return {
          ...profile,
          compatibility,
        };
      });
      
      setUnfilteredCount(profilesWithCompatibility.length);
      setUnfilteredProfiles(profilesWithCompatibility);

      const filteredProfiles = applyFiltersToProfiles(profilesWithCompatibility, matchFilters);

      const sortedProfiles = filteredProfiles.sort((a, b) => {
        const userA = userMap.get(a.id);
        const userB = userMap.get(b.id);
        
        const now = new Date();
        const isActiveBoostA = userA?.boostData?.isBoosted && userA?.boostData?.boostExpiresAt
          ? new Date(userA.boostData.boostExpiresAt) > now
          : false;
        const isActiveBoostB = userB?.boostData?.isBoosted && userB?.boostData?.boostExpiresAt
          ? new Date(userB.boostData.boostExpiresAt) > now
          : false;
        
        const isBoostedA = isActiveBoostA ? 1 : 0;
        const isBoostedB = isActiveBoostB ? 1 : 0;
        if (isBoostedA !== isBoostedB) return isBoostedB - isBoostedA;
        
        const getPriority = (user: typeof userA) => {
          const plan = user?.subscription?.plan || 'basic';
          if (plan === 'elite') return 3;
          if (plan === 'plus') return 2;
          return 1;
        };
        
        const priorityA = getPriority(userA);
        const priorityB = getPriority(userB);
        if (priorityA !== priorityB) return priorityB - priorityA;
        
        return (b.compatibility || 0) - (a.compatibility || 0);
      });
      
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
  
  const now = new Date();
  const isBoostActive = currentProfileUser?.boostData?.isBoosted && currentProfileUser?.boostData?.boostExpiresAt
    ? new Date(currentProfileUser.boostData.boostExpiresAt) > now
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
      await StorageService.addToSwipeHistory(profileId);
      
      if (action === 'like' || action === 'superlike') {
        const isSuperLike = action === 'superlike';
        await StorageService.addLike(userId, profileId, isSuperLike);
        
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
        
        const isReciprocalMatch = await StorageService.checkReciprocalLike(userId, profileId);
        if (isReciprocalMatch) {
          const match: Match = {
            id: `match_${Date.now()}`,
            userId1: userId,
            userId2: profileId,
            matchedAt: new Date(),
            isSuperLike,
            superLiker: isSuperLike ? userId : undefined,
          };
          await StorageService.addMatch(match);
          const matchedProfile = profiles.find(p => p.id === profileId);
          if (matchedProfile) {
            setMatchedProfileData({
              profile: matchedProfile,
              compatibility: matchedProfile.compatibility || 50,
            });
          }

          const matchedName = matchedProfile?.name || 'Someone';
          await StorageService.addNotification({
            id: `notification_match_${Date.now()}_${Math.random()}`,
            userId: userId,
            type: 'match',
            title: 'New Match!',
            body: `You and ${matchedName} are a match! Start a conversation.`,
            isRead: false,
            createdAt: new Date(),
            data: {
              matchId: match.id,
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
              matchId: match.id,
              fromUserId: userId,
              fromUserName: user?.name,
              fromUserPhoto: user?.profilePicture,
            },
          });

          setShowMatch(true);
          await refreshUnreadCount();
        }
      }
    } catch (error) {
      console.error('[RoommatesScreen] Error processing swipe:', error);
    }
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

  const handlePurchaseBoost = async () => {
    setProcessingBoost(true);
    const result = await purchaseBoost();
    setProcessingBoost(false);
    
    if (result.success) {
      setShowPurchaseBoostModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (result.message.includes('payment method')) {
        (navigation as any).navigate('Profile', { screen: 'Payment' });
        setShowPurchaseBoostModal(false);
      }
    }
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
    const users = await StorageService.getUsers();
    const currentUser = users.find(u => u.id === user?.id);
    const userPlan = currentUser?.subscription?.plan || 'basic';
    const userStatus = currentUser?.subscription?.status || 'active';
    
    const isEliteMember = userPlan === 'elite' && userStatus === 'active';
    
    if (isEliteMember) {
      handleSendDirectMessage();
    } else {
      setShowMessageModal(true);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!currentProfile || !user) return;
    
    const conversations = await StorageService.getConversations();
    const existingConversation = conversations.find(c =>
      c.participant.id === currentProfile.id
    );
    
    if (existingConversation) {
      (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: existingConversation.id } });
    } else {
      const newConversation = {
        id: `conv-${currentProfile.id}-${Date.now()}`,
        participant: {
          id: currentProfile.id,
          name: currentProfile.name,
          photo: currentProfile.photos?.[0],
          online: false,
        },
        lastMessage: '',
        timestamp: new Date(),
        unread: 0,
        messages: [],
      };
      await StorageService.addOrUpdateConversation(newConversation);
      (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: newConversation.id } });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePurchaseMessageCredit = async () => {
    setProcessingMessagePurchase(true);
    
    // NOTE: This is a simulated payment flow for demonstration purposes.
    // In a production app, you would need to:
    // 1. Set up a backend API server (Express, etc.)
    // 2. Create a Stripe payment intent for $0.99
    // 3. Handle the payment confirmation
    // 4. Grant the message credit upon successful payment
    // 5. Track message credits in user data
    
    // Simulated payment processing (1 second delay)
    setTimeout(async () => {
      // In production, this would only execute after successful payment
      const users = await StorageService.getUsers();
      const currentUser = users.find(u => u.id === user?.id);
      if (currentUser) {
        // In production: increment message credits
        // currentUser.messageCredits = (currentUser.messageCredits || 0) + 1;
        // await StorageService.updateUser(currentUser);
      }
      
      setProcessingMessagePurchase(false);
      setShowMessageModal(false);
      await handleSendDirectMessage();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  };

  const handleUpgradeForMessaging = () => {
    setShowMessageModal(false);
    (navigation as any).navigate('Profile', { screen: 'Payment' });
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
          {(user?.subscription?.plan || 'basic') === 'basic' && !user?.boostData?.isBoosted ? (
            <Pressable onPress={() => setShowPurchaseBoostModal(true)} style={styles.navIconBtn}>
              <View style={[styles.navIconBtnInner, { backgroundColor: '#FFD700' }]}>
                <Feather name="zap" size={18} color="#000000" />
              </View>
            </Pressable>
          ) : null}
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
          <Animated.View style={[styles.card, animatedCardStyle]}>
            <Image source={{ uri: photosArray[0] }} resizeMode="cover" style={styles.cardImage} />

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.4, 1]}
              style={[styles.cardGradient, { pointerEvents: 'none' }]}
            />

            <Pressable
              style={styles.flagBtn}
              onPress={() => setShowReportBlockModal(true)}
            >
              <Feather name="flag" size={14} color="rgba(255,255,255,0.7)" />
            </Pressable>

            {photosArray.length > 1 ? (
              <View style={styles.photoDots}>
                {photosArray.map((_, idx) => (
                  <View key={`dot-${idx}`} style={[styles.photoDotBar, idx === currentPhotoIndex ? styles.photoDotBarActive : null]} />
                ))}
              </View>
            ) : null}

            {canSeeOnlineStatus() && isProfileOnline ? (
              <View style={styles.onlineIndicatorContainer}>
                <View style={[styles.onlineIndicator, { backgroundColor: '#3ECF8E' }]} />
              </View>
            ) : null}

            {isBoosted ? (
              <View style={styles.boostedBadge}>
                <Feather name="zap" size={11} color="#000000" />
                <ThemedText style={styles.boostedText}>BOOSTED</ThemedText>
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
              </View>
              <ThemedText style={styles.cardJob} numberOfLines={1}>
                {currentProfile.occupation} {currentProfile.preferences?.location ? `\u00B7 ${currentProfile.preferences.location}` : ''}
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
            </View>
          </Animated.View>
        </GestureDetector>

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
        <Pressable
          style={[styles.actionBtnMd, styles.actionMsg]}
          onPress={handleMessageClick}
        >
          <Feather name="message-square" size={22} color="#ff6b8a" />
        </Pressable>
        <Pressable
          style={[styles.actionBtnMd, styles.actionStar]}
          onPress={() => handleSwipeAction('superlike')}
        >
          <Feather name="star" size={22} color="#5b8cff" />
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
          setShowMatch(false);
          setMatchedProfileData(null);
          if (matchedProfileData?.profile) {
            const conversations = await StorageService.getConversations();
            const existingConversation = conversations.find(c =>
              c.participant.id === matchedProfileData.profile.id
            );
            if (existingConversation) {
              (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: existingConversation.id } });
            } else {
              const newConversation = {
                id: `conv-${matchedProfileData.profile.id}-${Date.now()}`,
                participant: {
                  id: matchedProfileData.profile.id,
                  name: matchedProfileData.profile.name,
                  photo: matchedProfileData.profile.photos?.[0],
                  online: false,
                },
                lastMessage: '',
                timestamp: new Date(),
                unread: 0,
                messages: [],
              };
              await StorageService.addOrUpdateConversation(newConversation);
              (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: newConversation.id } });
            }
          }
        }}
        onKeepSwiping={() => {
          setShowMatch(false);
          setMatchedProfileData(null);
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
        visible={showPurchaseBoostModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPurchaseBoostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: '#FFD700' }]}>
              <Feather name="zap" size={32} color="#000000" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Purchase Boost
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Boost your profile for 24 hours and get prioritized placement in the swipe deck!
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={[Typography.h1, { color: theme.primary, marginBottom: Spacing.xs }]}>
                  $3.00
                </ThemedText>
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  24 hours of priority placement
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Priority placement in swipe deck
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Visible BOOSTED badge on profile
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Instant activation
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: '#FFD700', opacity: processingBoost ? 0.7 : 1 }]}
                onPress={handlePurchaseBoost}
                disabled={processingBoost}
              >
                <ThemedText style={[Typography.h3, { color: '#000000' }]}>
                  {processingBoost ? 'Processing...' : 'Purchase for $3'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowPurchaseBoostModal(false)}
                disabled={processingBoost}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
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
        visible={showMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.primary }]}>
              <Feather name="message-circle" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Send Direct Message
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Plus members can send messages without matching. Choose an option below to message {currentProfile?.name}.
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                  One-Time Message
                </ThemedText>
                <ThemedText style={[Typography.h1, { color: theme.primary, marginBottom: Spacing.xs }]}>
                  $0.99
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Send a single message to this person
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Start a conversation instantly
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    No matching required
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary, opacity: processingMessagePurchase ? 0.7 : 1 }]}
                onPress={handlePurchaseMessageCredit}
                disabled={processingMessagePurchase}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  {processingMessagePurchase ? 'Processing...' : 'Send Message - $0.99'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.warning, marginTop: Spacing.md }]}
                onPress={handleUpgradeForMessaging}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade to Plus
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowMessageModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
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
                  {currentProfile.occupation}
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

              <View style={[styles.detailSection, { paddingBottom: Spacing.xxl }]}>
                <Pressable
                  style={[styles.detailActionButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setShowProfileDetail(false);
                    handleMessageClick();
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

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="match"
        contextData={{
          match: {
            currentProfile: profiles[currentIndex] || undefined,
          },
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
    left: 14,
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
    backgroundColor: '#FFD700',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 10,
  },
  boostedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
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
});
