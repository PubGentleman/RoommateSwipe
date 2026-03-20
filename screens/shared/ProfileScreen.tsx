import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, Modal, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
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
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import { getBoostTimeRemaining, getBoostDuration, isBoostExpired } from '../../utils/boostUtils';
import { isDev } from '../../utils/envUtils';
import { isHostTypeEditable, daysRemainingInGracePeriod, getHostBadgeLabel, getHostBadgeColor, getHostBadgeIcon } from '../../utils/hostTypeUtils';
import * as Linking from 'expo-linking';

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export const ProfileScreen = () => {
  const { user, logout, updateUser, activateBoost, canBoost, checkAndUpdateBoostStatus, purchaseBoost, getHostPlan, getSuperInterestCount } = useAuth();
  const { unreadCount } = useNotificationContext();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [showPurchaseBoostModal, setShowPurchaseBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [pendingInterestCount, setPendingInterestCount] = useState(0);
  const [showAISheet, setShowAISheet] = useState(false);
  const [aiSheetContext, setAiSheetContext] = useState<'profile' | 'profile_reminder'>('profile');
  const [devTapCount, setDevTapCount] = useState(0);
  const [devTapTimer, setDevTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const PROFILE_COLLAPSE_H = 200;
  const profileScrollY = useSharedValue(0);
  const profileScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { profileScrollY.value = event.contentOffset.y; },
  });
  const profileCollapsibleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H * 0.5], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H], [1, 0.9], Extrapolation.CLAMP);
    const translateY = interpolate(profileScrollY.value, [0, PROFILE_COLLAPSE_H], [0, -PROFILE_COLLAPSE_H * 0.5], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }, { translateY }] };
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

  useFocusEffect(
    React.useCallback(() => {
      checkAndUpdateBoostStatus();
      if (user) {
        StorageService.getInterestCardsForRenter(user.id).then(cards => {
          setPendingInterestCount(cards.filter(c => c.status === 'pending').length);
        });
      }
    }, [user])
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
    const result = paid ? await purchaseBoost() : await activateBoost();
    setProcessingBoost(false);
    if (result.success) {
      setShowPurchaseBoostModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Cannot Boost', result.message);
    }
  };

  const getRoleLabel = () => {
    if (!user) return 'User';
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const [matchCount, setMatchCount] = useState(0);
  const [profileViewCount, setProfileViewCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      try {
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
      } catch (e) {
        console.warn('Failed to load profile stats:', e);
      }
    };
    loadStats();
  }, [user?.id]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => setShowAISheet(true)} style={styles.profileAiBtn}>
          <View style={styles.profileAiBtnInner}>
            <Feather name="cpu" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
        <Pressable onPress={handleDevTap}>
          <Text style={styles.topNavTitle}>My Profile</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('PrivacySecurity')}>
          <Feather name="settings" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <AnimatedScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} onScroll={profileScrollHandler} scrollEventThrottle={16}>
        <Animated.View style={profileCollapsibleStyle}>
        <LinearGradient
          colors={['rgba(255,107,91,0.08)', 'transparent']}
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

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{getRoleLabel()}</Text>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            {user?.purchases?.hostVerificationBadge === true ? (
              <View style={styles.verifiedBadge}>
                <Feather name="shield" size={14} color="#3ECF8E" />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>

          <View style={styles.statsRow}>
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
          </View>

          {user?.role === 'renter' ? (
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
          ) : null}
        </View>
        </LinearGradient>
        </Animated.View>

        {user?.role === 'renter' ? (
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

        {user?.role === 'renter' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleBar} />
                <Text style={styles.sectionTitle}>Background Check</Text>
              </View>
            </View>
            <View style={styles.bgCheckCard}>
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
                    {user?.background_check_status === 'clear' ? 'Your background check is verified and visible to hosts' :
                     user?.background_check_status === 'pending' ? 'Results typically available in 2-3 business days' :
                     'Increase trust with hosts. One-time fee of $9.99'}
                  </Text>
                </View>
              </View>
              {user?.background_check_status !== 'clear' && user?.background_check_status !== 'pending' ? (
                <Pressable
                  style={styles.bgCheckBtn}
                  onPress={() => {
                    if (isDev) {
                      if (Platform.OS === 'web') {
                        const confirmed = window.confirm('Dev Mode: Mark background check as cleared?');
                        if (confirmed && user) {
                          updateUser({ ...user, background_check_status: 'clear', background_check_completed_at: new Date().toISOString() });
                        }
                      } else {
                        Alert.alert('Dev Mode', 'Background check marked as cleared', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Mark Cleared', onPress: () => {
                            if (user) updateUser({ ...user, background_check_status: 'clear', background_check_completed_at: new Date().toISOString() });
                          }},
                        ]);
                      }
                    } else {
                      navigation.navigate('Payment', { type: 'background_check', amount: 999 } as any);
                    }
                  }}
                >
                  <Text style={styles.bgCheckBtnText}>$9.99</Text>
                </Pressable>
              ) : user?.background_check_status === 'clear' ? (
                <View style={styles.bgCheckClearedBadge}>
                  <Feather name="check" size={14} color="#22c55e" />
                </View>
              ) : (
                <View style={styles.bgCheckPendingBadge}>
                  <Feather name="clock" size={14} color="#f59e0b" />
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitle}>Subscription</Text>
            </View>
          </View>
          <Pressable style={styles.subCard} onPress={() => navigation.navigate(user?.role === 'host' ? 'HostSubscription' : 'Plans')}>
            <View style={styles.subLeft}>
              <Text style={styles.subLabel}>Current Plan</Text>
              <Text style={styles.subPlan}>
                {user?.role === 'host'
                  ? (user?.hostPlan === 'pro' ? 'Pro' : user?.hostPlan === 'business' ? 'Business' : 'Starter · Free')
                  : (user?.subscription?.plan === 'basic' ? 'Basic' : user?.subscription?.plan === 'plus' ? 'Plus' : user?.subscription?.plan === 'elite' ? 'Elite' : 'Basic')
                } {user?.role !== 'host' && user?.subscription?.plan === 'basic' ? '· Free' : ''}
              </Text>
              <Text style={styles.subDesc}>
                {user?.role === 'host'
                  ? (user?.hostPlan === 'starter' || !user?.hostPlan ? 'Upgrade to reach more renters' : 'You have full access')
                  : (user?.subscription?.plan === 'basic' ? 'Upgrade to unlock unlimited matches' : 'You have full access')
                }
              </Text>
            </View>
            {(user?.role === 'host' ? (!user?.hostPlan || user?.hostPlan === 'starter') : user?.subscription?.plan === 'basic') ? (
              <Pressable onPress={() => navigation.navigate(user?.role === 'host' ? 'HostSubscription' : 'Plans')}>
                <LinearGradient colors={['#ff6b5b', '#e83a2a']} style={styles.upgradeBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </Pressable>
          {user?.role !== 'host' && user?.subscription?.plan !== 'basic' ? (
            <Pressable style={styles.manageSubRow} onPress={() => navigation.navigate('ManageSubscription')}>
              <View style={styles.manageSubLeft}>
                <Feather name="settings" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.manageSubText}>Manage Subscription</Text>
              </View>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ) : null}
          {user?.subscription?.status === 'cancelling' ? (
            <View style={styles.cancellingBanner}>
              <Feather name="info" size={14} color="#ff6b5b" />
              <Text style={styles.cancellingText}>
                Your plan ends on {user?.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'end of period'}. Resubscribe anytime.
              </Text>
            </View>
          ) : null}
          {user?.role === 'renter' ? (
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
                  <Pressable onPress={() => navigation.navigate(user?.role === 'host' ? 'HostSubscription' : 'Plans')}>
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
            {user?.role === 'host' ? (() => {
              const hostType = user?.hostType || 'individual';
              const canEdit = isHostTypeEditable(user?.hostTypeLockedAt || null);
              const daysLeft = daysRemainingInGracePeriod(user?.hostTypeLockedAt || null);
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
                        `Hi Roomdr Support,\n\nI'd like to change my host type.\n\nAccount email: ${user?.email}\nCurrent type: ${hostType}\nRequested type: [FILL IN]\n\nReason: [FILL IN]`
                      );
                      if (Platform.OS === 'web') {
                        window.open(`mailto:support@roomdr.com?subject=${subject}&body=${body}`);
                      } else {
                        Linking.openURL(`mailto:support@roomdr.com?subject=${subject}&body=${body}`);
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
                        Change ({daysLeft}d left)
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
              iconName="check-circle"
              iconColor="#3ECF8E"
              iconBgColor="rgba(62,207,142,0.12)"
              iconBorderColor="rgba(62,207,142,0.18)"
              title="Verify Identity"
              subtitle="Phone, ID, social verification"
              onPress={() => navigation.navigate('Verification')}
              isLast={!(user?.role === 'host' && getHostPlan() === 'business')}
            />
            {user?.role === 'host' && getHostPlan() === 'business' ? (
              <SettingsItem
                iconName="headphones"
                iconColor="#667eea"
                iconBgColor="rgba(102,126,234,0.15)"
                iconBorderColor="rgba(102,126,234,0.2)"
                title="Dedicated Support"
                subtitle="Priority support for Business hosts"
                onPress={() => {
                  Alert.alert(
                    'Dedicated Support',
                    'As a Business host, you have access to priority support.\n\nEmail: support@roomdr.com\nResponse time: Within 2 hours\n\nOur dedicated team is here to help you with any questions or issues.',
                    [{ text: 'OK' }]
                  );
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
              title="About Roomdr"
              subtitle="Version and info"
              onPress={() => navigation.navigate('About')}
              isLast
            />
          </View>

          <Pressable
            style={styles.switchRoleBtn}
            onPress={() => {
              const newRole = user?.role === 'renter' ? 'host' : 'renter';
              updateUser({ role: newRole });
            }}
          >
            <Feather name="repeat" size={16} color="#ff6b5b" />
            <Text style={styles.switchRoleText}>
              Switch to {user?.role === 'renter' ? 'Host' : 'Renter'}
            </Text>
          </Pressable>

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
                    <Pressable style={styles.boostSheetDismiss} onPress={() => setShowPurchaseBoostModal(false)}>
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


      <RoomdrAISheet
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

const SettingsItem = ({ iconName, iconColor, iconBgColor, iconBorderColor, title, subtitle, onPress, badge, isLast }: any) => (
  <Pressable style={[styles.settingsItem, isLast ? null : styles.settingsItemBorder]} onPress={onPress}>
    <View style={[styles.settingsIcon, { backgroundColor: iconBgColor, borderColor: iconBorderColor, borderWidth: 1 }]}>
      <Feather name={iconName} size={16} color={iconColor} />
    </View>
    <View style={styles.settingsTextWrap}>
      <Text style={styles.settingsTitle}>{title}</Text>
      <Text style={styles.settingsSubtitle}>{subtitle}</Text>
    </View>
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
    paddingBottom: 24,
    paddingTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    padding: 3,
    borderWidth: 2.5,
    borderColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitial: {
    fontSize: 36,
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
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ff8070',
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
  manageSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  manageSubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageSubText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
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
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 14,
    height: 48,
    marginTop: 16,
  },
  switchRoleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6b5b',
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
