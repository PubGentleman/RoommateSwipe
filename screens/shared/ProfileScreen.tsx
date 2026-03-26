import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Image, Modal, ScrollView, Text, TouchableOpacity, Platform, Switch } from 'react-native';
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
import { getBoostTimeRemaining, getBoostDuration, isBoostExpired, RENTER_BOOST_OPTIONS, RenterBoostOptionId } from '../../utils/boostUtils';
import { isDev } from '../../utils/envUtils';
import { isHostTypeEditable, hoursRemainingInGracePeriod, getHostBadgeLabel, getHostBadgeColor, getHostBadgeIcon } from '../../utils/hostTypeUtils';
import * as Linking from 'expo-linking';
import { useConfirm } from '../../contexts/ConfirmContext';
import { ModeSwitchToggle } from '../../components/ModeSwitchToggle';
import { getAffiliateForUser } from '../../services/affiliateService';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { PlanBadgeInline } from '../../components/LockedFeatureOverlay';

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export const ProfileScreen = () => {
  const { user, logout, updateUser, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, getHostPlan, getSuperInterestCount, activeMode, canSwitchMode, isFirstTimeHost } = useAuth();
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
  const [safetyMode, setSafetyMode] = useState(false);
  const [hasAffiliate, setHasAffiliate] = useState(false);

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

  const getRoleLabel = () => {
    if (!user) return 'User';
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const isHost = activeMode === 'host';
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);
  const [matchCount, setMatchCount] = useState(0);
  const [profileViewCount, setProfileViewCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [hostListingCount, setHostListingCount] = useState(0);
  const [hostInquiryCount, setHostInquiryCount] = useState(0);
  const [hostViewCount, setHostViewCount] = useState(0);

  const loadProfileStats = React.useCallback(async () => {
    if (!user) return;
    try {
      if (user.role === 'host') {
        const allProperties = await StorageService.getProperties();
        const myListings = allProperties.filter(p => p.hostId === user.id);
        setHostListingCount(myListings.length);
        const activeCount = myListings.filter(p => p.available && !p.rentedDate).length;
        setHostViewCount(activeCount);
        const interestCards = await StorageService.getInterestCardsForHost(user.id);
        setHostInquiryCount(interestCards.length);
      } else {
        const matches = await StorageService.getMatches();
        const userMatches = matches.filter(m =>
          m.userId1 === user.id || m.userId2 === user.id
        );
        setMatchCount(userMatches.length);
        const allUsers = await StorageService.getUsers();
        const currentUser = allUsers.find(u => u.id === user.id);
        const receivedLikes = currentUser?.receivedLikes || [];
        const regularLikes = receivedLikes.filter((l: any) => !l.isSuperLike);
        const superLikes = receivedLikes.filter((l: any) => l.isSuperLike);
        setProfileViewCount(regularLikes.length);
        setLikesCount(superLikes.length);
      }
    } catch (e) {
      console.warn('Failed to load profile stats:', e);
    }
  }, [user?.id, user?.role]);

  const scrollRef = useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      checkAndUpdateBoostStatus();
      loadProfileStats();
      if (user) {
        StorageService.getInterestCardsForRenter(user.id).then(cards => {
          setPendingInterestCount(cards.filter(c => c.status === 'pending').length);
        });
        import('../../lib/supabase').then(({ supabase }) => {
          supabase.from('profiles').select('safety_mode_enabled').eq('user_id', user.id).single().then(({ data }) => {
            if (data?.safety_mode_enabled !== undefined) setSafetyMode(!!data.safety_mode_enabled);
          });
        }).catch(() => {});
        getAffiliateForUser(user.id).then(aff => setHasAffiliate(!!aff)).catch(() => {});
      }
    }, [user, loadProfileStats])
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <AIFloatingButton onPress={() => setShowAISheet(true)} position="inline" />
        <Pressable onPress={handleDevTap}>
          <Text style={styles.topNavTitle}>My Profile</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('PrivacySecurity')}>
          <Feather name="settings" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <AnimatedScrollView ref={scrollRef} style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} onScroll={profileScrollHandler} scrollEventThrottle={16}>
        <Animated.View style={profileCollapsibleStyle}>
        <LinearGradient
          colors={[isHost ? 'rgba(123,94,167,0.08)' : 'rgba(255,107,91,0.08)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.profileHeroGradient}
        >
        <View style={styles.profileHeader}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarWrap}>
              {(user?.photos?.[0] || user?.profilePicture) ? (
                <Image source={{ uri: user?.photos?.[0] || user?.profilePicture }} style={styles.avatarImage} />
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

          {canSwitchMode ? (
            <View style={{ marginBottom: 10 }}>
              <ModeSwitchToggle compact />
            </View>
          ) : (
            <View style={[styles.roleBadge, isHost && styles.roleBadgeHost]}>
              <Text style={[styles.roleBadgeText, isHost && styles.roleBadgeTextHost]}>{getRoleLabel()}</Text>
            </View>
          )}

          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            {user?.licenseVerificationStatus === 'verified' ? (
              <View style={styles.verifiedBadge}>
                <Feather name="shield" size={14} color="#3ECF8E" />
                <Text style={styles.verifiedBadgeText}>Verified Agent</Text>
              </View>
            ) : user?.licenseVerificationStatus === 'manual_review' || user?.licenseVerificationStatus === 'pending' ? (
              <View style={styles.pendingBadge}>
                <Feather name="clock" size={14} color="#F59E0B" />
                <Text style={styles.pendingBadgeText}>Verification Pending</Text>
              </View>
            ) : (user?.purchases?.hostVerificationBadge === true || (user?.role === 'host' && user?.hostSubscription?.plan && user.hostSubscription.plan !== 'free' && user.hostSubscription.plan !== 'none')) ? (
              <View style={styles.verifiedBadge}>
                <Feather name="shield" size={14} color="#3ECF8E" />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>

          <View style={styles.statsRow}>
            {isHost ? (
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

          {isHost ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HostSubscription')}
              style={styles.boostBtnWrap}
            >
              <View style={[styles.boostBtn, { backgroundColor: '#7B5EA7' }]}>
                <Feather name="briefcase" size={14} color="#fff" />
                <Text style={styles.boostBtnText}>Manage Plan</Text>
              </View>
            </TouchableOpacity>
          ) : renterLimits.hasProfileBoost ? (
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
                <PlanBadgeInline plan="Elite" locked />
              </View>
            </TouchableOpacity>
          )}
        </View>
        </LinearGradient>
        </Animated.View>

        {!isHost ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleBar} />
                <Text style={styles.sectionTitle}>Profile Strength</Text>
              </View>
              <Pressable onPress={() => { setShowAISheet(true); setAiSheetContext('profile_reminder'); }}>
                <Text style={styles.sectionAction}>View all</Text>
              </Pressable>
            </View>
            <ProfileCompletionCard user={user} onEditProfile={(missingSteps) => {
              navigation.navigate('ProfileQuestionnaire', { missingSteps });
            }} />
          </View>
        ) : null}

        {/* TODO: References section — build invite-based reference system post-launch */}

        {!isHost ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleBar} />
                <Text style={styles.sectionTitle}>Background Check</Text>
              </View>
            </View>
            <Pressable
              style={styles.bgCheckCard}
              onPress={() => navigation.navigate('BackgroundCheck')}
            >
              <View style={styles.bgCheckLeft}>
                <View style={styles.bgCheckIcon}>
                  <Feather name="shield" size={20} color="#22c55e" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bgCheckTitle}>
                    {user?.background_check_status === 'clear' ? 'Background Cleared' :
                     user?.background_check_status === 'pending' ? 'Check in Progress' :
                     'Get Background Checked'}
                  </Text>
                  <Text style={styles.bgCheckDesc}>
                    {user?.background_check_status === 'clear' ? 'Verified and visible to hosts. Tap to view details.' :
                     user?.background_check_status === 'pending' ? 'Results typically available within minutes' :
                     'Increase trust with hosts. Starting at $15'}
                  </Text>
                </View>
              </View>
              {user?.background_check_status === 'clear' ? (
                <View style={styles.bgCheckClearedBadge}>
                  <Feather name="check" size={14} color="#22c55e" />
                </View>
              ) : user?.background_check_status === 'pending' ? (
                <View style={styles.bgCheckPendingBadge}>
                  <Feather name="clock" size={14} color="#f59e0b" />
                </View>
              ) : (
                <Feather name="chevron-right" size={20} color="#999" />
              )}
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
                  ? (user?.hostSubscription?.plan === 'pro' ? 'Pro · $49.99/mo'
                    : user?.hostSubscription?.plan === 'business' ? 'Business · $99/mo'
                    : user?.hostSubscription?.plan === 'starter' ? 'Starter · $19.99/mo'
                    : 'Free')
                  : (user?.subscription?.plan === 'basic' ? 'Basic · Free' : user?.subscription?.plan === 'plus' ? 'Plus' : user?.subscription?.plan === 'elite' ? 'Elite' : 'Basic · Free')
                }
              </Text>
              <Text style={styles.subDesc}>
                {isHost
                  ? (!user?.hostSubscription?.plan || user?.hostSubscription?.plan === 'free' || user?.hostSubscription?.plan === 'none'
                    ? 'Upgrade to reach more renters' : 'You have full access')
                  : (user?.subscription?.plan === 'basic' ? 'Upgrade to unlock unlimited matches' : 'You have full access')
                }
              </Text>
            </View>
            {(isHost ? (!user?.hostSubscription?.plan || user?.hostSubscription?.plan === 'free' || user?.hostSubscription?.plan === 'none') : user?.subscription?.plan === 'basic') ? (
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
          {!isHost ? (
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
              <Text style={styles.sectionTitle}>Settings</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            {isHost ? (() => {
              const hostType = user?.hostType || 'individual';
              const canEdit = isHostTypeEditable(user?.hostTypeLockedAt || null);
              const hoursLeft = hoursRemainingInGracePeriod(user?.hostTypeLockedAt || null);
              const typeLabel = hostType === 'individual' ? 'Individual Host' : getHostBadgeLabel(hostType);
              const badgeColor = getHostBadgeColor(hostType) || '#6C63FF';
              const badgeIcon = getHostBadgeIcon(hostType);

              return (
                <Pressable
                  style={[styles.hostTypeRow, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}
                  onPress={() => {
                    if (canEdit) {
                      navigation.navigate('HostTypeSelect');
                    } else {
                      updateUser({ hostTypeChangeRequested: true });
                      const subject = encodeURIComponent('Host Type Change Request');
                      const body = encodeURIComponent(
                        `Hi Rhome Support,\n\nI'd like to change my host type.\n\nAccount email: ${user?.email}\nCurrent type: ${hostType}\nRequested type: [FILL IN]\n\nReason: [FILL IN]`
                      );
                      if (Platform.OS === 'web') {
                        window.open(`mailto:support@rhome.com?subject=${subject}&body=${body}`);
                      } else {
                        Linking.openURL(`mailto:support@rhome.com?subject=${subject}&body=${body}`);
                      }
                    }
                  }}
                >
                  <View style={[styles.hostTypeIcon, { backgroundColor: badgeColor + '20' }]}>
                    <Feather name={badgeIcon} size={16} color={badgeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Account Type</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{typeLabel}</Text>
                  </View>
                  {canEdit ? (
                    <View style={[styles.hostTypeChangeBtn, { borderColor: '#ff6b5b' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#ff6b5b' }}>
                        Change ({hoursLeft}h left)
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.hostTypeChangeBtn, { borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Feather name="mail" size={11} color="rgba(255,255,255,0.5)" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                        Contact Support
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })() : null}
            <SettingsItem
              iconName="user"
              iconColor="#667eea"
              iconBgColor="rgba(102,126,234,0.15)"
              iconBorderColor="rgba(102,126,234,0.2)"
              title="Edit Profile"
              subtitle="Name, bio, photos, preferences"
              onPress={() => navigation.navigate('ProfileQuestionnaire')}
            />
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
            <SettingsItem
              iconName="bell"
              iconColor="#2ecc71"
              iconBgColor="rgba(46,204,113,0.12)"
              iconBorderColor="rgba(46,204,113,0.18)"
              title="Notifications"
              subtitle="Matches, messages, activity"
              onPress={() => navigation.navigate('Notifications')}
              badge={unreadCount}
            />
            <SettingsItem
              iconName="lock"
              iconColor="orange"
              iconBgColor="rgba(255,165,0,0.12)"
              iconBorderColor="rgba(255,165,0,0.18)"
              title="Privacy & Safety"
              subtitle="Blocked users, data, visibility"
              onPress={() => navigation.navigate('PrivacySecurity')}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1a1a2e', borderRadius: 12, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="shield" size={18} color="#FF6B6B" />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Safety Mode</Text>
                </View>
                <Text style={{ color: '#999', fontSize: 12, marginTop: 4, marginLeft: 26 }}>
                  Blur phone numbers and social handles in messages
                </Text>
              </View>
              <Switch
                value={safetyMode}
                onValueChange={async (value) => {
                  setSafetyMode(value)
                  if (user) {
                    updateUser({ ...user, safetyModeEnabled: value })
                  }
                  try {
                    const { supabase } = await import('../../lib/supabase')
                    const { data: { user: authUser } } = await supabase.auth.getUser()
                    if (authUser) {
                      await supabase.from('profiles').update({ safety_mode_enabled: value }).eq('user_id', authUser.id)
                    }
                  } catch (_e) {}
                }}
                trackColor={{ false: '#333', true: '#FF6B6B' }}
                thumbColor="#fff"
              />
            </View>
            <SettingsItem
              iconName="credit-card"
              iconColor="#667eea"
              iconBgColor="rgba(102,126,234,0.15)"
              iconBorderColor="rgba(102,126,234,0.2)"
              title="Payment"
              subtitle="Manage payment methods"
              onPress={() => navigation.navigate('Payment')}
            />
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
              iconName="check-circle"
              iconColor="#3ECF8E"
              iconBgColor="rgba(62,207,142,0.12)"
              iconBorderColor="rgba(62,207,142,0.18)"
              title="Verify Identity"
              subtitle="Phone, ID, social verification"
              onPress={() => navigation.navigate('Verification')}
            />
            {!isHost ? (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: renterLimits.hasIncognito ? '#1a1a2e' : 'rgba(168,85,247,0.04)', borderRadius: 12, marginBottom: 8, borderWidth: renterLimits.hasIncognito ? 0 : 1, borderColor: 'rgba(168,85,247,0.12)' }}
                onPress={() => {
                  if (!renterLimits.hasIncognito) {
                    navigation.navigate('Plans');
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="eye-off" size={18} color={renterLimits.hasIncognito ? '#667eea' : 'rgba(255,255,255,0.3)'} />
                    <Text style={{ color: renterLimits.hasIncognito ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '600' }}>Incognito Mode</Text>
                    {!renterLimits.hasIncognito ? <PlanBadgeInline plan="Elite" locked /> : null}
                  </View>
                  <Text style={{ color: '#999', fontSize: 12, marginTop: 4, marginLeft: 26 }}>Browse profiles without being seen</Text>
                </View>
                {renterLimits.hasIncognito ? (
                  <Switch
                    value={false}
                    onValueChange={() => {}}
                    trackColor={{ false: '#333', true: '#667eea' }}
                    thumbColor="#fff"
                  />
                ) : null}
              </Pressable>
            ) : null}
            {!isHost ? (
              <SettingsItem
                iconName="headphones"
                iconColor={renterLimits.hasDedicatedSupport ? '#667eea' : 'rgba(255,255,255,0.3)'}
                iconBgColor={renterLimits.hasDedicatedSupport ? 'rgba(102,126,234,0.15)' : 'rgba(168,85,247,0.06)'}
                iconBorderColor={renterLimits.hasDedicatedSupport ? 'rgba(102,126,234,0.2)' : 'rgba(168,85,247,0.12)'}
                title="Dedicated Support"
                subtitle={renterLimits.hasDedicatedSupport ? 'Priority support for Elite members' : 'Priority email support'}
                onPress={async () => {
                  if (!renterLimits.hasDedicatedSupport) {
                    navigation.navigate('Plans');
                    return;
                  }
                  await alert({
                    title: 'Dedicated Support',
                    message: 'As an Elite member, you have access to priority support.\n\nEmail: hello@rhomeapp.io\nResponse time: Within 2 hours\n\nOur dedicated team is here to help you.',
                    variant: 'info',
                  });
                }}
                isLast={!isHost || !(isHost && getHostPlan() === 'business')}
                rightElement={!renterLimits.hasDedicatedSupport ? <PlanBadgeInline plan="Elite" locked /> : undefined}
              />
            ) : null}
            {isHost && getHostPlan() === 'business' ? (
              <SettingsItem
                iconName="headphones"
                iconColor="#667eea"
                iconBgColor="rgba(102,126,234,0.15)"
                iconBorderColor="rgba(102,126,234,0.2)"
                title="Dedicated Support"
                subtitle="Priority support for Business hosts"
                onPress={async () => {
                  await alert({
                    title: 'Dedicated Support',
                    message: 'As a Business host, you have access to priority support.\n\nEmail: support@rhome.com\nResponse time: Within 2 hours\n\nOur dedicated team is here to help you with any questions or issues.',
                    variant: 'info',
                  });
                }}
                isLast
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Support</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
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
    paddingHorizontal: 10,
    minWidth: 90,
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
  hostTypeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  hostTypeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  hostTypeChangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
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
});
