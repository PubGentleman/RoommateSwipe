import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Pressable, Image as RNImage, Modal, ScrollView, Text, TouchableOpacity, Platform, Switch } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { ProfileCompletionCard } from '../../components/ProfileCompletionCard';
import { getVerificationLevel } from '../../components/VerificationBadge';
import { StorageService } from '../../utils/storage';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import { AIFloatingButton } from '../../components/AIFloatingButton';
import { RhomeLogo } from '../../components/RhomeLogo';
import { AppHeader, HeaderIconButton } from '../../components/AppHeader';
import { getBoostTimeRemaining, getBoostDuration, isBoostExpired, RENTER_BOOST_OPTIONS, RenterBoostOptionId } from '../../utils/boostUtils';
import { isDev } from '../../utils/envUtils';
import * as Linking from 'expo-linking';
import { useConfirm } from '../../contexts/ConfirmContext';
import { ModeSwitchToggle } from '../../components/ModeSwitchToggle';
import { getAffiliateForUser } from '../../services/affiliateService';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { getHostPlanDisplayInfo, resolveEffectiveHostPlan, isFreeTier } from '../../utils/planResolver';
import { getProfileGateStatus, TIER_INFO, ProfileTier } from '../../utils/profileGate';
import LevelUpToast from '../../components/LevelUpToast';

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export const ProfileScreen = () => {
  const { user, logout, updateUser, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, getHostPlan, getSuperInterestCount, activeMode, canSwitchMode, isFirstTimeHost, isPlaceSeeker } = useAuth();
  const { unreadCount } = useNotificationContext();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { confirm, alert } = useConfirm();
  const [showPurchaseBoostModal, setShowPurchaseBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [selectedBoostTierId, setSelectedBoostTierId] = useState<RenterBoostOptionId>('standard');
  const [pendingInterestCount, setPendingInterestCount] = useState(0);
  const [showAISheet, setShowAISheet] = useState(false);
  const [aiSheetContext, setAiSheetContext] = useState<'profile' | 'profile_reminder'>('profile');
  const [devTapCount, setDevTapCount] = useState(0);
  const [devTapTimer, setDevTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [hasAffiliate, setHasAffiliate] = useState(false);
  const [searchPaused, setSearchPaused] = useState(false);
  const [searchPausedAt, setSearchPausedAt] = useState<string | null>(null);

  const PROFILE_COLLAPSE_H = 280;
  const profileScrollY = useSharedValue(0);
  const profileScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { profileScrollY.value = event.contentOffset.y; },
  });
  const profileCollapsibleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H * 0.5], [1, 0], Extrapolation.CLAMP);
    const maxH = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H], [PROFILE_COLLAPSE_H, 0], Extrapolation.CLAMP);
    const translateY = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H], [0, -PROFILE_COLLAPSE_H * 0.3], Extrapolation.CLAMP);
    return { opacity, maxHeight: maxH, overflow: 'hidden' as const, transform: [{ translateY }] };
  });
  const AnimatedScrollView = Animated.ScrollView;

  const handleDevTap = () => {
    const newCount = devTapCount + 1;
    if (devTapTimer) clearTimeout(devTapTimer);
    if (newCount >= 5) {
      setDevTapCount(0);
      navigation.navigate('Diagnostic');
      return;
    }
    setDevTapCount(newCount);
    setDevTapTimer(setTimeout(() => setDevTapCount(0), 3000));
  };

  const isHost = activeMode === 'host' || user?.role === 'host';
  const hostPlanInfo = useMemo(() => getHostPlanDisplayInfo(user), [user?.hostSubscription?.plan, user?.hostType]);
  const getRoleLabel = () => {
    if (!user) return 'User';
    if (isHost && user.hostType === 'agent') return 'Agent';
    if (isHost && user.hostType === 'company') return 'Company';
    const mode = activeMode || user.role;
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  const displayName = user?.hostType === 'company'
    ? (user?.companyName || user?.agencyName || user?.brokerageName || user?.profileData?.companyName || user?.name)
    : user?.hostType === 'agent'
      ? (user?.agencyName || user?.companyName || user?.name)
      : user?.name;
  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);
  const [matchCount, setMatchCount] = useState(0);
  const [profileViewCount, setProfileViewCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [inquirySentCount, setInquirySentCount] = useState(0);
  const [hostListingCount, setHostListingCount] = useState(0);
  const [hostInquiryCount, setHostInquiryCount] = useState(0);
  const [hostViewCount, setHostViewCount] = useState(0);
  const [agentGroupCount, setAgentGroupCount] = useState(0);
  const [agentPlacementCount, setAgentPlacementCount] = useState(0);

  const scrollRef = useRef<any>(null);

  const userId = user?.id;
  const userRole = user?.role;
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      checkAndUpdateBoostStatus();

      if (!userId) return () => { isMounted = false; };

      const loadData = async () => {
        try {
          if (userRole === 'host') {
            const allProperties = await StorageService.getProperties();
            if (!isMounted) return;
            const myListings = allProperties.filter(p => p.hostId === userId);
            setHostListingCount(myListings.length);
            setHostViewCount(myListings.filter(p => p.available && !p.rentedDate).length);
            const interestCards = await StorageService.getInterestCardsForHost(userId);
            if (!isMounted) return;
            setHostInquiryCount(interestCards.length);

            if (user?.hostType === 'agent' || user?.hostType === 'company') {
              const groups = await StorageService.getGroups();
              if (!isMounted) return;
              const myGroups = groups.filter((g: any) => g.createdByAgent === userId || g.agentId === userId);
              setAgentGroupCount(myGroups.length);
              setAgentPlacementCount(myListings.filter(p => p.rentedDate).length);
            }
          } else {
            const matches = await StorageService.getMatches();
            if (!isMounted) return;
            const userMatches = matches.filter(m => m.userId1 === userId || m.userId2 === userId);
            setMatchCount(userMatches.length);
            const allUsers = await StorageService.getUsers();
            if (!isMounted) return;
            const currentUser = allUsers.find(u => u.id === userId);
            const receivedLikes = currentUser?.receivedLikes || [];
            setProfileViewCount(receivedLikes.filter((l: any) => !l.isSuperLike).length);
            setLikesCount(receivedLikes.filter((l: any) => l.isSuperLike).length);
            const saved = await StorageService.getSavedProperties(userId);
            if (!isMounted) return;
            setSavedCount(saved.length);
            const renterCards = await StorageService.getInterestCardsForRenter(userId);
            if (!isMounted) return;
            setInquirySentCount(renterCards.length);
          }

          if (!isHost) {
            const cards = await StorageService.getInterestCardsForRenter(userId);
            if (!isMounted) return;
            setPendingInterestCount(cards.filter(c => c.status === 'pending').length);
          }

          const { supabase } = await import('../../lib/supabase');
          const { data } = await supabase
            .from('profiles')
            .select('search_paused, search_paused_at')
            .eq('user_id', userId)
            .single();
          if (!isMounted) return;
          if (data?.search_paused !== undefined) setSearchPaused(!!data.search_paused);
          if (data?.search_paused_at) setSearchPausedAt(data.search_paused_at);

          const aff = await getAffiliateForUser(userId);
          if (!isMounted) return;
          setHasAffiliate(!!aff);
        } catch (e) {
          console.warn('Failed to load profile data:', e);
        }
      };

      loadData();

      return () => { isMounted = false; };
    }, [userId, userRole, activeMode])
  );

  const [boostTimeLabel, setBoostTimeLabel] = useState('');
  const boostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.boostData?.isBoosted && user.boostData.boostExpiresAt && !isBoostExpired(user.boostData.boostExpiresAt)) {
      const update = () => setBoostTimeLabel(getBoostTimeRemaining(user.boostData!.boostExpiresAt));
      update();
      boostTimerRef.current = setInterval(update, 60000);
      return () => { if (boostTimerRef.current) clearInterval(boostTimerRef.current); };
    } else {
      setBoostTimeLabel('');
    }
  }, [user?.boostData?.isBoosted, user?.boostData?.boostExpiresAt]);

  const boostIsActive = user?.boostData?.isBoosted && user?.boostData?.boostExpiresAt && !isBoostExpired(user.boostData.boostExpiresAt);

  const handleBoostPress = () => {
    setShowPurchaseBoostModal(true);
  };

  const handleBoostConfirm = async (paid?: boolean) => {
    setProcessingBoost(true);
    const selectedOption = RENTER_BOOST_OPTIONS.find(o => o.id === selectedBoostTierId)!;
    const plan = user?.subscription?.plan || 'basic';
    const freeDuration = plan === 'elite' ? 24 : plan === 'plus' ? 12 : 6;
    const result = paid
      ? await purchaseBoost(selectedOption.price, selectedOption.durationHours)
      : await activateBoost(freeDuration);
    setProcessingBoost(false);
    if (result.success) {
      setShowPurchaseBoostModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await alert({ title: 'Cannot Boost', message: result.message, variant: 'warning' });
    }
  };

  const handleFoundPlace = async () => {
    const confirmed = await confirm({
      title: 'Pause your search?',
      message: "You'll stop appearing in Match, Explore, and Groups. Your conversations and account stay active.",
      confirmText: 'Yes, pause it',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setSearchPaused(true);
    setSearchPausedAt(new Date().toISOString());

    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { error } = await supabase.from('profiles').update({
          search_paused: true,
          search_paused_at: new Date().toISOString(),
          search_paused_reason: 'manual',
        }).eq('user_id', authUser.id);
        if (error) {
          setSearchPaused(false);
          setSearchPausedAt(null);
          await alert({ title: 'Error', message: 'Could not pause your search. Please try again.', variant: 'warning' });
        }
      }
    } catch (_e) {
      setSearchPaused(false);
      setSearchPausedAt(null);
    }
  };

  const handleResumeSearch = async () => {
    setSearchPaused(false);
    setSearchPausedAt(null);

    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { error } = await supabase.from('profiles').update({
          search_paused: false,
          search_paused_at: null,
          search_paused_reason: null,
        }).eq('user_id', authUser.id);
        if (error) {
          setSearchPaused(true);
          await alert({ title: 'Error', message: 'Could not resume your search. Please try again.', variant: 'warning' });
        }
      }
    } catch (_e) {
      setSearchPaused(true);
    }
  };

  const getLifestyleCards = (u: any): Array<{ icon: string; iconColor: string; label: string; value: string }> => {
    const prefs = u?.profileData?.preferences || {};
    const cards: Array<{ icon: string; iconColor: string; label: string; value: string }> = [];
    const sleep = prefs.sleepSchedule;
    if (sleep) {
      cards.push({
        icon: sleep === 'early_bird' ? 'sunrise' : sleep === 'night_owl' ? 'moon' : 'refresh-cw',
        iconColor: sleep === 'early_bird' ? '#f59e0b' : sleep === 'night_owl' ? '#6366f1' : '#3b82f6',
        label: sleep === 'early_bird' ? 'Early Bird' : sleep === 'night_owl' ? 'Night Owl' : 'Flexible',
        value: 'Sleep',
      });
    }
    const clean = prefs.cleanliness;
    if (clean) {
      cards.push({
        icon: 'check-circle',
        iconColor: clean === 'very_tidy' ? '#3ECF8E' : clean === 'moderate' ? '#6366f1' : '#f59e0b',
        label: clean === 'very_tidy' ? 'Very Tidy' : clean === 'moderate' ? 'Moderate' : 'Relaxed',
        value: 'Clean',
      });
    }
    const pets = prefs.pets;
    if (pets) {
      cards.push({
        icon: pets === 'no_pets' ? 'slash' : 'heart',
        iconColor: pets === 'have_pets' ? '#ff6b5b' : pets === 'love_pets' ? '#ec4899' : '#888',
        label: pets === 'have_pets' ? 'Has Pet' : pets === 'love_pets' ? 'Pet Lover' : 'No Pets',
        value: 'Pets',
      });
    }
    const work = prefs.workLocation;
    if (work) {
      cards.push({
        icon: work === 'wfh' ? 'home' : work === 'office' ? 'briefcase' : 'refresh-cw',
        iconColor: work === 'wfh' ? '#3ECF8E' : work === 'office' ? '#3b82f6' : '#f59e0b',
        label: work === 'wfh' ? 'WFH' : work === 'office' ? 'Office' : 'Hybrid',
        value: 'Work',
      });
    }
    const noise = prefs.noiseTolerance;
    if (noise) {
      cards.push({
        icon: noise === 'quiet' ? 'volume' : noise === 'moderate' ? 'volume-1' : 'volume-2',
        iconColor: noise === 'quiet' ? '#6366f1' : noise === 'moderate' ? '#3b82f6' : '#f59e0b',
        label: noise === 'quiet' ? 'Quiet' : noise === 'moderate' ? 'Normal' : 'Loud OK',
        value: 'Noise',
      });
    }
    const budget = u?.profileData?.budget;
    if (budget) {
      cards.push({
        icon: 'dollar-sign',
        iconColor: '#3ECF8E',
        label: budget >= 3000 ? '$3K+' : `$${(budget / 1000).toFixed(1)}K`,
        value: 'Budget',
      });
    }
    const smoking = prefs.smoking;
    if (smoking) {
      cards.push({
        icon: smoking === 'no' ? 'wind' : 'cloud',
        iconColor: smoking === 'no' ? '#3ECF8E' : '#888',
        label: smoking === 'no' ? 'Non-Smoker' : 'Smoker',
        value: 'Smoking',
      });
    }
    const guests = prefs.guestPolicy;
    if (guests) {
      cards.push({
        icon: guests === 'rarely' ? 'lock' : guests === 'sometimes' ? 'users' : 'user-plus',
        iconColor: guests === 'rarely' ? '#888' : guests === 'sometimes' ? '#3b82f6' : '#f59e0b',
        label: guests === 'rarely' ? 'Rarely' : guests === 'sometimes' ? 'Sometimes' : 'Often',
        value: 'Guests',
      });
    }
    return cards.slice(0, 6);
  };

  const gateStatus = useMemo(() => getProfileGateStatus(user), [user]);
  const prevTierRef = useRef<ProfileTier>(gateStatus.tier);
  const [levelUpTier, setLevelUpTier] = useState<ProfileTier | null>(null);

  useEffect(() => {
    const TIER_ORDER: ProfileTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const prev = TIER_ORDER.indexOf(prevTierRef.current);
    const curr = TIER_ORDER.indexOf(gateStatus.tier);
    if (curr > prev) {
      setLevelUpTier(gateStatus.tier);
    }
    prevTierRef.current = gateStatus.tier;
  }, [gateStatus.tier]);

  const profileCompletion = useMemo(() => {
    let filled = 0;
    const total = 10;
    if (user?.full_name || user?.name) filled++;
    if (user?.avatar_url || user?.profilePicture || user?.photos?.[0]) filled++;
    if (user?.profileData?.bio) filled++;
    if (user?.profileData?.occupation) filled++;
    if (user?.profileData?.city || user?.city) filled++;
    if (user?.profileData?.preferences?.sleepSchedule) filled++;
    if (user?.profileData?.preferences?.cleanliness) filled++;
    if (user?.profileData?.preferences?.smoking) filled++;
    if (user?.profileData?.budget) filled++;
    if ((user?.profileData?.photos?.length || user?.photos?.length || 0) >= 2) filled++;
    return Math.round((filled / total) * 100);
  }, [user]);

  const nextImprovement = useMemo(() => {
    if (!user?.profileData?.bio) return 'Add a bio to boost your match score by ~8%';
    if (!user?.profileData?.preferences?.sleepSchedule) return 'Add your sleep schedule for +5% accuracy';
    if (!user?.profileData?.preferences?.cleanliness) return 'Set your cleanliness level for +5% accuracy';
    if ((user?.profileData?.photos?.length || user?.photos?.length || 0) < 3) return 'Add more photos — profiles with 3+ get 40% more interest';
    if (!user?.profileData?.occupation) return 'Add your occupation for better work-style matching';
    return null;
  }, [user]);

  return (
    <View style={[styles.root, { paddingTop: 0 }]}>
      {levelUpTier ? (
        <LevelUpToast
          tier={levelUpTier}
          visible={true}
          onDismiss={() => setLevelUpTier(null)}
        />
      ) : null}
      <AppHeader
        title="Profile"
        role={isHost ? 'host' : 'renter'}
        hideSeparator
        rightActions={
          <>
            <AIFloatingButton onPress={() => setShowAISheet(true)} position="inline" />
            <HeaderIconButton
              icon="settings"
              onPress={() => navigation.navigate('PrivacySecurity')}
            />
          </>
        }
      />

      <AnimatedScrollView ref={scrollRef} style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} onScroll={profileScrollHandler} scrollEventThrottle={16}>
        <Animated.View style={profileCollapsibleStyle}>
        <LinearGradient
          colors={[user?.hostType === 'agent' ? 'rgba(30,120,200,0.08)' : user?.hostType === 'company' ? 'rgba(50,150,80,0.08)' : isHost ? 'rgba(123,94,167,0.08)' : 'rgba(255,107,91,0.08)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.profileHeroGradient}
        >
        <View style={styles.profileHeader}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarWrap}>
              {(user?.photos?.[0] || user?.profilePicture) ? (
                <RNImage source={{ uri: user?.photos?.[0] || user?.profilePicture }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.avatarCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.avatarInitial}>{userInitial}</Text>
                </LinearGradient>
              )}
              <Pressable style={styles.cameraBtn} onPress={() => navigation.navigate('ProfileQuestionnaire')}>
                <Feather name="camera" size={13} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={[styles.roleBadge, isHost && styles.roleBadgeHost]}>
            <Text style={[styles.roleBadgeText, isHost && styles.roleBadgeTextHost]}>{getRoleLabel()}</Text>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{user?.hostType === 'company' ? (user?.companyName || user?.brokerageName || user?.name || 'Company') : (user?.name || 'User')}</Text>
            {user?.licenseVerificationStatus === 'verified' ? (
              <View style={styles.verifiedBadge}>
                <Feather name="shield" size={14} color="#3ECF8E" />
                <Text style={styles.verifiedBadgeText}>{user?.hostType === 'agent' ? 'Verified Agent' : user?.hostType === 'company' ? 'Verified Company' : 'Verified Host'}</Text>
              </View>
            ) : user?.licenseVerificationStatus === 'manual_review' || user?.licenseVerificationStatus === 'pending' ? (
              <View style={styles.pendingBadge}>
                <Feather name="clock" size={14} color="#F59E0B" />
                <Text style={styles.pendingBadgeText}>Verification Pending</Text>
              </View>
            ) : (user?.purchases?.hostVerificationBadge === true || (user?.role === 'host' && !isFreeTier(user?.hostSubscription?.plan))) ? (
              <View style={styles.verifiedBadge}>
                <Feather name="shield" size={14} color="#3ECF8E" />
                <Text style={styles.verifiedBadgeText}>{isHost ? 'Verified Host' : 'Verified'}</Text>
              </View>
            ) : null}
          </View>
          {!isHost ? (
            <View style={styles.rpTierDisplay}>
              <Feather name={TIER_INFO[gateStatus.tier].icon as any} size={18} color={TIER_INFO[gateStatus.tier].color} />
              <View>
                <Text style={[styles.rpTierLabel, { color: TIER_INFO[gateStatus.tier].color }]}>
                  {TIER_INFO[gateStatus.tier].label} Level
                </Text>
                {gateStatus.nextTier ? (
                  <Text style={styles.rpTierNextHint}>
                    {gateStatus.nextItems.length} step{gateStatus.nextItems.length !== 1 ? 's' : ''} to {TIER_INFO[gateStatus.nextTier].label}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={styles.statsRow}>
            {isHost && (user?.hostType === 'agent' || user?.hostType === 'company') ? (
              <>
                <Pressable style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statPurple]}>{hostListingCount}</Text>
                  <Text style={styles.statLabel}>Listings</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable style={styles.statBox}>
                  <Text style={styles.statValue}>{agentGroupCount}</Text>
                  <Text style={styles.statLabel}>Groups</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statPurple]}>{agentPlacementCount}</Text>
                  <Text style={styles.statLabel}>Placements</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable style={styles.statBox}>
                  <Text style={styles.statValue}>{hostInquiryCount}</Text>
                  <Text style={styles.statLabel}>Inquiries</Text>
                </Pressable>
              </>
            ) : isHost ? (
              <>
                <Pressable style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statPurple]}>{hostListingCount}</Text>
                  <Text style={styles.statLabel}>Listings</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable style={styles.statBox}>
                  <Text style={styles.statValue}>{hostInquiryCount}</Text>
                  <Text style={styles.statLabel}>Inquiries</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable style={styles.statBox}>
                  <Text style={[styles.statValue, styles.statPurple]}>{hostViewCount}</Text>
                  <Text style={styles.statLabel}>Active</Text>
                </Pressable>
              </>
            ) : isPlaceSeeker() ? (
              <>
                <Pressable
                  style={styles.statBox}
                  onPress={() => navigation.navigate('SavedListings')}
                >
                  <Text style={[styles.statValue, styles.statCoral]}>{savedCount}</Text>
                  <Text style={styles.statLabel}>Saved</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable
                  style={styles.statBox}
                  onPress={() => navigation.navigate('InterestCards')}
                >
                  <Text style={styles.statValue}>{inquirySentCount}</Text>
                  <Text style={styles.statLabel}>Inquiries</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.statBox}
                  onPress={() => navigation.navigate('MatchesList')}
                >
                  <Text style={[styles.statValue, styles.statCoral]}>{matchCount}</Text>
                  <Text style={styles.statLabel}>Matches</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable
                  style={styles.statBox}
                  onPress={() => navigation.navigate('ProfileViews')}
                >
                  <Text style={styles.statValue}>{profileViewCount}</Text>
                  <Text style={styles.statLabel}>Likes</Text>
                </Pressable>
                <View style={styles.statDivider} />
                <Pressable
                  style={styles.statBox}
                  onPress={() => navigation.navigate('WhoLikedMe')}
                >
                  <Text style={[styles.statValue, styles.statCoral]}>{likesCount}</Text>
                  <Text style={styles.statLabel}>Super Likes</Text>
                </Pressable>
              </>
            )}
          </View>

        </View>
        </LinearGradient>
        </Animated.View>

          {isHost ? null : isPlaceSeeker() ? null : renterLimits.hasProfileBoost ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleBoostPress} style={styles.boostBtnWrap}>
              {boostIsActive ? (
                <View style={styles.boostActiveBtn}>
                  <Feather name="zap" size={14} color="#FFD700" />
                  <Text style={styles.boostActiveBtnText}>Boosted — {boostTimeLabel}</Text>
                </View>
              ) : (
                <View style={[styles.boostBtn, { backgroundColor: '#ff6b5b' }]}>
                  <Feather name="zap" size={14} color="#fff" />
                  <Text style={styles.boostBtnText}>Boost Profile</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Plans')} style={styles.boostBtnWrap}>
              <View style={[styles.boostBtn, { backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' }]}>
                <Feather name="lock" size={12} color="#a855f7" />
                <Text style={[styles.boostBtnText, { color: '#a855f7' }]}>Boost Profile</Text>
              </View>
            </TouchableOpacity>
          )}

        {!isHost ? (
          <View style={styles.renterProfileCard}>
            <View style={styles.rpPhotoGrid}>
              <Pressable style={styles.rpMainPhoto} onPress={() => navigation.navigate('ProfileQuestionnaire')}>
                {(user?.photos?.[0] || user?.profilePicture || user?.avatar_url) ? (
                  <Image source={{ uri: user?.photos?.[0] || user?.profilePicture || user?.avatar_url }} style={styles.rpMainPhotoImg} contentFit="cover" />
                ) : (
                  <LinearGradient colors={['#ff6b5b', '#ff8e53']} style={styles.rpMainPhotoImg}>
                    <Text style={styles.rpMainPhotoInitial}>
                      {(user?.name || user?.full_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.rpEditPhotoOverlay}>
                  <Feather name="camera" size={14} color="#fff" />
                </View>
              </Pressable>
              <View style={styles.rpThumbPhotos}>
                {(user?.photos || user?.profileData?.photos || []).slice(1, 4).map((photo: string, i: number) => (
                  <Image key={i} source={{ uri: photo }} style={styles.rpThumbPhoto} contentFit="cover" />
                ))}
                {(user?.photos || user?.profileData?.photos || []).length < 4 ? (
                  <Pressable style={styles.rpAddPhotoThumb} onPress={() => navigation.navigate('ProfileQuestionnaire')}>
                    <Feather name="plus" size={18} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.rpIdentity}>
              <Text style={styles.rpProfileName}>
                {user?.name || user?.full_name || 'Your Name'}{user?.profileData?.age ? `, ${user.profileData.age}` : ''}
              </Text>
              <View style={styles.rpInfoRow}>
                <Feather name="map-pin" size={12} color="#ff6b5b" />
                <Text style={styles.rpInfoText}>
                  {user?.profileData?.neighborhood || user?.profileData?.city || user?.city || 'Add your location'}
                </Text>
              </View>
              {user?.profileData?.occupation ? (
                <View style={styles.rpInfoRow}>
                  <Feather name="briefcase" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.rpInfoText}>{user.profileData.occupation}</Text>
                </View>
              ) : null}
              <View style={styles.rpBadgeRow}>
                {(user?.purchases?.hostVerificationBadge || user?.isVerified) ? (
                  <View style={styles.rpVerifiedBadge}>
                    <Feather name="shield" size={10} color="#3ECF8E" />
                    <Text style={styles.rpVerifiedText}>Verified</Text>
                  </View>
                ) : null}
                {renterPlan && renterPlan !== 'basic' ? (
                  <View style={[styles.rpPlanBadge, {
                    backgroundColor: renterPlan === 'elite' ? 'rgba(255,215,0,0.1)' : 'rgba(99,102,241,0.1)',
                  }]}>
                    <Feather name="star" size={10} color={renterPlan === 'elite' ? '#FFD700' : '#6366f1'} />
                    <Text style={[styles.rpPlanBadgeText, {
                      color: renterPlan === 'elite' ? '#FFD700' : '#6366f1',
                    }]}>
                      {renterPlan === 'elite' ? 'Elite' : 'Plus'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {user?.profileData?.bio ? (
              <View style={styles.rpBioSection}>
                <Text style={styles.rpBioText} numberOfLines={3}>
                  "{user.profileData.bio}"
                </Text>
              </View>
            ) : (
              <Pressable style={styles.rpAddBioPrompt} onPress={() => navigation.navigate('ProfileQuestionnaire')}>
                <Feather name="edit-2" size={14} color="#ff6b5b" />
                <Text style={styles.rpAddBioText}>Add a bio to help roommates get to know you</Text>
              </Pressable>
            )}

            {getLifestyleCards(user).length > 0 ? (
              <View style={styles.rpLifestyleGrid}>
                {getLifestyleCards(user).map((card, i) => (
                  <View key={i} style={styles.rpLifestyleCard}>
                    <Feather name={card.icon as any} size={20} color={card.iconColor} />
                    <Text style={styles.rpLifestyleLabel}>{card.label}</Text>
                    <Text style={styles.rpLifestyleValue}>{card.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.rpCompatPreview}>
              <Text style={styles.rpCompatPreviewTitle}>Your Match Profile</Text>
              <Text style={styles.rpCompatPreviewSubtext}>How others see your compatibility score</Text>
              <View style={styles.rpCompletionBar}>
                <View style={styles.rpCompletionTrack}>
                  <View style={[styles.rpCompletionFill, { width: `${profileCompletion}%` }]} />
                </View>
                <Text style={styles.rpCompletionPct}>{profileCompletion}%</Text>
              </View>
              {nextImprovement ? (
                <View style={styles.rpImprovementHint}>
                  <Feather name="zap" size={12} color="#f59e0b" />
                  <Text style={styles.rpImprovementText}>{nextImprovement}</Text>
                </View>
              ) : null}
            </View>

            <Pressable style={styles.rpEditProfileBtn} onPress={() => navigation.navigate('ProfileQuestionnaire')}>
              <Feather name="edit-2" size={16} color="#ff6b5b" />
              <Text style={styles.rpEditProfileText}>Edit Profile</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Subscription</Text>
            </View>
          </View>
          <Pressable style={styles.subCard} onPress={() => navigation.navigate(isHost ? 'HostSubscription' : 'Plans')}>
            <View style={styles.subLeft}>
              <Text style={styles.subLabel}>Current Plan</Text>
              <Text style={styles.subPlan}>
                {isHost
                  ? hostPlanInfo.label
                  : (user?.subscription?.plan === 'basic' ? 'Basic' : user?.subscription?.plan === 'plus' ? 'Plus' : user?.subscription?.plan === 'elite' ? 'Elite' : 'Basic')
                }
              </Text>
              <Text style={styles.subDesc}>
                {isHost
                  ? hostPlanInfo.description
                  : (user?.subscription?.plan === 'basic' ? 'Upgrade to unlock unlimited matches' : 'You have full access')
                }
              </Text>
            </View>
            {(isHost ? hostPlanInfo.isFree : user?.subscription?.plan === 'basic') ? (
              <Pressable onPress={() => navigation.navigate(isHost ? 'HostSubscription' : 'Plans')}>
                <LinearGradient colors={['#ff6b5b', '#e83a2a']} style={styles.upgradeBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </Pressable>
          {user?.subscription?.status === 'cancelling' ? (
            <View style={styles.cancellingBanner}>
              <Feather name="info" size={14} color="#ff6b5b" />
              <Text style={styles.cancellingText}>
                Your plan ends on {user?.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'end of period'}. Resubscribe anytime.
              </Text>
            </View>
          ) : null}
          {isHost && (user?.hostSubscription?.status === 'cancelling' || user?.hostSubscription?.status === 'cancelled') ? (
            <View style={styles.cancellingBanner}>
              <Feather name="alert-circle" size={14} color="#F59E0B" />
              <Text style={styles.cancellingText}>
                {user.hostSubscription.status === 'cancelled' ? 'Host plan cancelled.' : 'Cancellation scheduled.'}{' '}
                {user.hostSubscription.scheduledChangeDate
                  ? `Reverts to Free on ${new Date(user.hostSubscription.scheduledChangeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
                  : 'Reverts to Free at end of billing period.'}{' '}
                Reactivate from the subscription page.
              </Text>
            </View>
          ) : null}
          {!isHost && !isPlaceSeeker() ? (
            <View style={styles.superInterestTracker}>
              <Feather name="star" size={16} color="#4A90E2" />
              {user?.subscription?.plan === 'elite' ? (
                <Text style={styles.superInterestTrackerText}>Super Interests: Unlimited</Text>
              ) : user?.subscription?.plan === 'plus' ? (
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.superInterestTrackerText}>
                    Super Interests: {Math.max(0, 5 - (user?.superInterestData?.usedThisMonth || 0))} / 5 this month
                  </Text>
                  <View style={styles.superInterestProgressBar}>
                    <View style={[styles.superInterestProgressFill, { width: `${Math.min(100, ((user?.superInterestData?.usedThisMonth || 0) / 5) * 100)}%` }]} />
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1, marginLeft: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.superInterestTrackerText}>
                    Super Interests: {getSuperInterestCount()} remaining
                  </Text>
                  <Pressable onPress={() => navigation.navigate(isHost ? 'HostSubscription' : 'Plans')}>
                    <Text style={{ color: '#4A90E2', fontWeight: '600', fontSize: 13 }}>Buy more</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            <SettingsItem
              iconName="user"
              iconColor="#667eea"
              iconBgColor="rgba(102,126,234,0.15)"
              iconBorderColor="rgba(102,126,234,0.2)"
              title="Edit Profile"
              subtitle="Name, bio, photos, preferences"
              onPress={() => navigation.navigate('ProfileQuestionnaire')}
            />
            {isHost && user?.hostType === 'company' ? (
              <SettingsItem
                iconName="users"
                iconColor="#22C55E"
                iconBgColor="rgba(34, 197, 94, 0.1)"
                iconBorderColor="rgba(34, 197, 94, 0.2)"
                title="Manage Team"
                subtitle="Invite agents, manage roles and permissions"
                onPress={() => navigation.navigate('TeamManagement')}
              />
            ) : null}
            {user?.role === 'renter' ? (
              <SettingsItem
                iconName="target"
                iconColor="#4a9eff"
                iconBgColor="rgba(74,158,255,0.12)"
                iconBorderColor="rgba(74,158,255,0.18)"
                title="Search Intent"
                subtitle={(() => {
                  const st = user?.profileData?.apartment_search_type;
                  const maxRm = user?.profileData?.max_roommates ?? user?.max_roommates;
                  const rmLabel = maxRm != null
                    ? ` \u00B7 Up to ${maxRm === 4 ? '4+' : maxRm} roommate${maxRm === 1 ? '' : 's'}`
                    : '';
                  if (st === 'solo') return 'Looking solo';
                  if (st === 'with_partner') return 'Looking with a partner';
                  if (st === 'have_group') return `Looking with your group${rmLabel}`;
                  if (st === 'with_roommates') return `Open to roommates${rmLabel}`;
                  return 'Set your search preference';
                })()}
                onPress={() => navigation.navigate('SearchIntent')}
              />
            ) : null}
            <SettingsItem
              iconName="check-circle"
              iconColor="#3ECF8E"
              iconBgColor="rgba(62,207,142,0.12)"
              iconBorderColor="rgba(62,207,142,0.18)"
              title="Verify Identity"
              subtitle="Phone, ID, social verification"
              onPress={() => navigation.navigate('Verification')}
            />
            {!isHost ? (
              <SettingsItem
                iconName="shield"
                iconColor="#22c55e"
                iconBgColor="rgba(34,197,94,0.12)"
                iconBorderColor="rgba(34,197,94,0.18)"
                title={user?.background_check_status === 'clear' ? 'Background Cleared' :
                       user?.background_check_status === 'pending' ? 'Check in Progress' :
                       'Background Check'}
                subtitle={user?.background_check_status === 'clear' ? 'Verified and visible to hosts' :
                          user?.background_check_status === 'pending' ? 'Results typically available within minutes' :
                          'Increase trust with hosts'}
                onPress={() => navigation.navigate('BackgroundCheck')}
                isLast
              />
            ) : (
              <SettingsItem
                iconName="credit-card"
                iconColor="#667eea"
                iconBgColor="rgba(102,126,234,0.15)"
                iconBorderColor="rgba(102,126,234,0.2)"
                title="Payment"
                subtitle="Manage payment methods"
                onPress={() => navigation.navigate(isHost ? 'HostSubscription' : 'Plans')}
                isLast
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Activity</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            {!isHost ? (
              <SettingsItem
                iconName="heart"
                iconColor="#ff6b5b"
                iconBgColor="rgba(255,107,91,0.12)"
                iconBorderColor="rgba(255,107,91,0.18)"
                title="My Interests"
                subtitle="Interest cards you've sent"
                onPress={() => navigation.navigate('MyInterests')}
                badge={pendingInterestCount}
              />
            ) : null}
            <SettingsItem
              iconName="bell"
              iconColor="#2ecc71"
              iconBgColor="rgba(46,204,113,0.12)"
              iconBorderColor="rgba(46,204,113,0.18)"
              title="Notifications"
              subtitle={isHost ? 'Inquiries, messages, activity' : 'Matches, messages, activity'}
              onPress={() => navigation.navigate('Notifications')}
              badge={unreadCount}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Settings</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            <SettingsItem
              iconName="lock"
              iconColor="orange"
              iconBgColor="rgba(255,165,0,0.12)"
              iconBorderColor="rgba(255,165,0,0.18)"
              title="Privacy & Safety"
              subtitle="Blocked users, data, visibility"
              onPress={() => navigation.navigate('PrivacySecurity')}
              isLast={isHost}
            />
            {!isHost ? (
              <SettingsItem
                iconName="credit-card"
                iconColor="#667eea"
                iconBgColor="rgba(102,126,234,0.15)"
                iconBorderColor="rgba(102,126,234,0.2)"
                title="Payment"
                subtitle="Manage payment methods"
                onPress={() => navigation.navigate('Plans')}
                isLast
              />
            ) : null}
          </View>
        </View>

        {!isHost ? (
          <View style={styles.pauseCard}>
            {searchPaused ? (
              <>
                <View style={styles.pauseCardHeader}>
                  <View style={styles.pauseIconWrap}>
                    <Feather name="pause-circle" size={20} color="#667eea" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pauseTitle}>Your search is paused</Text>
                    <Text style={styles.pauseSubtitle}>
                      You're not visible in searches or matches
                    </Text>
                  </View>
                </View>
                {renterPlan === 'plus' || renterPlan === 'elite' ? (
                  <Text style={styles.pauseSubscriptionNote}>
                    Your {renterPlan === 'elite' ? 'Elite' : 'Plus'} subscription is still active — your benefits are preserved.
                  </Text>
                ) : null}
                <Pressable
                  style={styles.resumeButton}
                  onPress={handleResumeSearch}
                >
                  <Feather name="search" size={15} color="#fff" />
                  <Text style={styles.resumeButtonText}>Resume Search</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.pauseCardHeader}>
                  <View style={[styles.pauseIconWrap, { backgroundColor: 'rgba(76,175,80,0.12)' }]}>
                    <Feather name="home" size={20} color="#4CAF50" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pauseTitle}>Found your place?</Text>
                    <Text style={styles.pauseSubtitle}>
                      Pause your profile — you can always come back
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.foundPlaceButton}
                  onPress={handleFoundPlace}
                >
                  <Text style={styles.foundPlaceButtonText}>I Found a Place</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>More</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            <SettingsItem
              iconName="users"
              iconColor="#ff6b5b"
              iconBgColor="rgba(255,107,91,0.12)"
              iconBorderColor="rgba(255,107,91,0.18)"
              title="Affiliate Program"
              subtitle={hasAffiliate ? 'View dashboard & earnings' : 'Earn by referring friends'}
              onPress={() => navigation.navigate(hasAffiliate ? 'AffiliateDashboard' : 'AffiliateApply')}
            />
            <SettingsItem
                iconName="mail"
                iconColor="#667eea"
                iconBgColor="rgba(102,126,234,0.15)"
                iconBorderColor="rgba(102,126,234,0.2)"
                title="Contact Support"
                subtitle={
                  isHost
                    ? (['business', 'agent_business', 'company_enterprise'].includes(getHostPlan()) || user?.hostType === 'company'
                      ? 'Priority support — we respond faster'
                      : "We'll get back to you as soon as possible")
                    : (renterLimits.plan === 'elite' || renterLimits.plan === 'plus'
                      ? 'Priority support — we respond faster'
                      : "We'll get back to you as soon as possible")
                }
                onPress={async () => {
                  const emailAddress = 'hello@rhomeapp.io';
                  let subject: string;
                  if (isHost) {
                    const plan = getHostPlan() || 'standard';
                    const hostType = user?.hostType || 'individual';
                    const roleLabel = hostType === 'company' ? 'COMPANY' : hostType === 'agent' ? 'AGENT' : 'HOST';
                    subject = encodeURIComponent(`[${roleLabel}][${plan.toUpperCase()}] Support Request`);
                  } else {
                    const plan = renterLimits.plan ?? 'free';
                    subject = encodeURIComponent(`[${plan.toUpperCase()}] Support Request`);
                  }
                  const url = `mailto:${emailAddress}?subject=${subject}`;
                  try {
                    if (Platform.OS === 'web') {
                      window.location.href = url;
                    } else {
                      await Linking.openURL(url);
                    }
                  } catch {
                    await alert({
                      title: 'Email not available',
                      message: `Please email us at ${emailAddress}`,
                      variant: 'info',
                    });
                  }
                }}
              />
            <SettingsItem
              iconName="file-text"
              iconColor="rgba(255,255,255,0.5)"
              iconBgColor="rgba(255,255,255,0.06)"
              iconBorderColor="rgba(255,255,255,0.08)"
              title="Terms of Service"
              subtitle="Rules and conditions"
              onPress={() => navigation.navigate('TermsOfService')}
            />
            <SettingsItem
              iconName="info"
              iconColor="rgba(255,255,255,0.5)"
              iconBgColor="rgba(255,255,255,0.06)"
              iconBorderColor="rgba(255,255,255,0.08)"
              title="About Rhome"
              subtitle="Version and info"
              onPress={() => navigation.navigate('About')}
              isLast
            />
          </View>

          {canSwitchMode ? (
            <View style={styles.modeSwitchSection}>
              <Text style={styles.modeSwitchLabel}>Your Mode</Text>
              <ModeSwitchToggle />
              <Text style={styles.modeSwitchHint}>
                {isHost
                  ? 'Switch to Renter to find your next place'
                  : 'Switch to Host to manage your listings'}
              </Text>
            </View>
          ) : isFirstTimeHost ? (
            <Pressable
              style={styles.becomeHostBtn}
              onPress={() => navigation.navigate('HostTypeSelect' as any)}
            >
              <View style={styles.becomeHostLeft}>
                <View style={styles.becomeHostIcon}>
                  <Feather name="home" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.becomeHostTitle}>Become a Host</Text>
                  <Text style={styles.becomeHostSub}>List a room and find great renters</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
          ) : (user?.hostType === 'agent' || user?.hostType === 'company') ? (
            <View style={styles.agentLockNotice}>
              <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" />
              <View style={styles.agentLockTextWrap}>
                <Text style={styles.agentLockTitle}>
                  {user?.hostType === 'agent' ? 'Agent Account' : 'Company Account'}
                </Text>
                <Text style={styles.agentLockSub}>
                  To browse Rhome as a renter, sign up with a separate renter account.
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable style={styles.signoutBtn} onPress={logout}>
            <Feather name="log-out" size={16} color="#ff4d4d" />
            <Text style={styles.signoutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={{ height: 20 }} />
      </AnimatedScrollView>

      <Modal visible={showPurchaseBoostModal} animationType="slide" transparent onRequestClose={() => setShowPurchaseBoostModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPurchaseBoostModal(false)}>
          <Pressable style={styles.boostSheet} onPress={() => {}}>
            <View style={styles.boostSheetHandle} />
            {(() => {
              const plan = user?.subscription?.plan || 'basic';
              const boostCheck = canBoost();
              const duration = getBoostDuration(plan);

              if (boostIsActive) {
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
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowPurchaseBoostModal(false)}>
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
                                <View style={[
                                  styles.boostTierBadge,
                                  { backgroundColor: option.highlight ? '#FF6B6B' : '#22C55E' }
                                ]}>
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
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowPurchaseBoostModal(false)}>
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
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowPurchaseBoostModal(false)}>
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
                  <Pressable style={styles.boostSheetDismiss} onPress={() => setShowPurchaseBoostModal(false)}>
                    <Text style={styles.boostSheetDismissText}>Cancel</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>


      <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => { setShowAISheet(false); setAiSheetContext('profile'); }}
        screenContext={aiSheetContext}
        contextData={aiSheetContext === 'profile' ? {
          profile: {
            savedListingsCount: 0,
          },
        } : undefined}
        onNavigate={(screen, params) => {
          navigation.navigate(screen as any, params);
        }}
      />
    </View>
  );
};

const SettingsItem = ({ iconName, iconColor, iconBgColor, iconBorderColor, title, subtitle, onPress, badge, isLast, rightElement }: any) => (
  <Pressable style={[styles.settingsItem, isLast ? null : styles.settingsItemBorder]} onPress={onPress}>
    <View style={[styles.settingsIcon, { backgroundColor: iconBgColor, borderColor: iconBorderColor, borderWidth: 1 }]}>
      <Feather name={iconName} size={16} color={iconColor} />
    </View>
    <View style={styles.settingsTextWrap}>
      <Text style={styles.settingsTitle}>{title}</Text>
      <Text style={styles.settingsSubtitle}>{subtitle}</Text>
    </View>
    {rightElement ? rightElement : null}
    {badge > 0 ? (
      <View style={styles.navBadge}>
        <Text style={styles.navBadgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    ) : null}
    <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
  </Pressable>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  renterProfileCard: {
    margin: 16,
    backgroundColor: '#161616',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rpPhotoGrid: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  rpMainPhoto: {
    flex: 2,
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  rpMainPhotoImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpMainPhotoInitial: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
  },
  rpEditPhotoOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpThumbPhotos: {
    flex: 1,
    gap: 3,
  },
  rpThumbPhoto: {
    flex: 1,
    borderRadius: 12,
  },
  rpAddPhotoThumb: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  rpIdentity: {
    padding: 16,
    paddingBottom: 8,
    gap: 6,
  },
  rpProfileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  rpInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rpInfoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  rpBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rpVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(62,207,142,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rpVerifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3ECF8E',
  },
  rpPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rpPlanBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rpBioSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  rpBioText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  rpAddBioPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    borderStyle: 'dashed',
  },
  rpAddBioText: {
    fontSize: 13,
    color: 'rgba(255,107,91,0.7)',
    flex: 1,
  },
  rpLifestyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rpLifestyleCard: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rpLifestyleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  rpLifestyleValue: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  rpCompatPreview: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
    gap: 6,
  },
  rpCompatPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  rpCompatPreviewSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  rpCompletionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  rpCompletionTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  rpCompletionFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#ff6b5b',
  },
  rpCompletionPct: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ff6b5b',
  },
  rpImprovementHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rpImprovementText: {
    fontSize: 11,
    color: '#f59e0b',
  },
  rpEditProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  rpEditProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  rpTierDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  rpTierLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rpTierNextHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  profileAiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  profileAiBtnInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  topNavTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  profileHeroGradient: {
    paddingBottom: 12,
    paddingTop: 8,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 10,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 3,
    borderWidth: 2.5,
    borderColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff6b5b',
    borderWidth: 2.5,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  roleBadgeHost: {
    backgroundColor: 'rgba(123,94,167,0.2)',
    borderColor: 'rgba(123,94,167,0.35)',
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ff8070',
  },
  roleBadgeTextHost: {
    color: '#a68dd4',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(62,207,142,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3ECF8E',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2a2a2a',
    alignSelf: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  statCoral: {
    color: '#ff6b5b',
  },
  statPurple: {
    color: '#7B5EA7',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#ff6b5b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  subCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subLeft: {
    flex: 1,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subPlan: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  subDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
  },
  upgradeBtn: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cancellingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  cancellingText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
  },
  superInterestTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,144,226,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.15)',
  },
  superInterestTrackerText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 10,
  },
  superInterestProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 6,
    overflow: 'hidden',
  },
  superInterestProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A90E2',
  },
  settingsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  modeSwitchSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modeSwitchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modeSwitchHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 8,
    textAlign: 'center',
  },
  becomeHostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  becomeHostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  becomeHostIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeHostTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  becomeHostSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  agentLockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  agentLockTextWrap: {
    flex: 1,
  },
  agentLockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  agentLockSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 17,
  },
  signoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.2)',
  },
  signoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff4d4d',
  },
  navBadge: {
    backgroundColor: '#ff4d4d',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginRight: 4,
  },
  navBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  boostBtnWrap: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  boostBtn: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  boostBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  boostActiveBtn: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  boostActiveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700',
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
    alignSelf: 'center',
    marginBottom: 20,
  },
  boostSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  boostSheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  boostSheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  boostSheetDesc: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 19,
  },
  boostSheetNote: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 16,
  },
  boostSheetPriceRow: {
    alignItems: 'center',
    marginBottom: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  boostSheetPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ff6b5b',
    marginBottom: 2,
  },
  boostSheetPriceSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  boostSheetCta: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  boostSheetCtaGrad: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  boostSheetCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  boostSheetDismiss: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostSheetDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  boostTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '700',
    color: '#fff',
  },
  boostTierSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
  },
  boostTierPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ff6b5b',
  },
  boostTierBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  boostTierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  bgCheckCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bgCheckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  bgCheckIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCheckTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  bgCheckDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
    lineHeight: 17,
  },
  bgCheckBtn: {
    backgroundColor: '#ff6b5b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  bgCheckBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  bgCheckClearedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  bgCheckPendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  pauseCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  pauseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  pauseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  pauseSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  pauseSubscriptionNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 12,
    lineHeight: 17,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 10,
  },
  resumeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  foundPlaceButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  foundPlaceButtonText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 14,
  },
});
