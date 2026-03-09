import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, Modal, ScrollView, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  const [devTapCount, setDevTapCount] = useState(0);
  const [devTapTimer, setDevTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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
  const matchCount = 12;
  const profileViewCount = 84;
  const likesCount = 7;

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

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={styles.profileHeader}>
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
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statCoral]}>{matchCount}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{profileViewCount}</Text>
              <Text style={styles.statLabel}>Profile Views</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statCoral]}>{likesCount}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          {user?.role === 'renter' ? (
            <Pressable onPress={handleBoostPress} style={styles.boostBtnWrap}>
              {boostIsActive ? (
                <View style={styles.boostActiveBtn}>
                  <Feather name="zap" size={14} color="#FFD700" />
                  <Text style={styles.boostActiveBtnText}>Boosted — {boostTimeLabel}</Text>
                </View>
              ) : (
                <LinearGradient colors={['#ff6b5b', '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.boostBtn} pointerEvents="none">
                  <Feather name="zap" size={14} color="#fff" />
                  <Text style={styles.boostBtnText}>Boost Profile</Text>
                </LinearGradient>
              )}
            </Pressable>
          ) : null}
        </View>

        {user?.role === 'renter' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile Strength</Text>
              <Pressable onPress={() => navigation.navigate('ProfileQuestionnaire')}>
                <Text style={styles.sectionAction}>View all</Text>
              </Pressable>
            </View>
            <ProfileCompletionCard user={user} onEditProfile={(missingSteps) => navigation.navigate('ProfileQuestionnaire', missingSteps?.length ? { missingSteps } : undefined)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Subscription</Text>
          </View>
          <Pressable style={styles.subCard} onPress={() => navigation.navigate(user?.role === 'host' ? 'HostPricing' : 'Plans')}>
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
              <Pressable onPress={() => navigation.navigate(user?.role === 'host' ? 'HostPricing' : 'Plans')}>
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
                  <Pressable onPress={() => navigation.navigate('Plans')}>
                    <Text style={{ color: '#4A90E2', fontWeight: '600', fontSize: 13 }}>Buy more</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Settings</Text>
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
            <Text style={styles.sectionTitle}>Support</Text>
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
      </ScrollView>

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
        onDismiss={() => setShowAISheet(false)}
        screenContext="profile"
        contextData={{
          profile: {
            savedListingsCount: 0,
          },
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
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
    backgroundColor: '#ff4d4d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
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
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '400',
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  statCoral: {
    color: '#ff6b5b',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  subCard: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(91,140,255,0.2)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    overflow: 'hidden',
  },
  subLeft: {
    flex: 1,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  subPlan: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  upgradeBtnText: {
    fontSize: 13,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#fff',
  },
  settingsSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 1,
  },
  switchRoleBtn: {
    marginTop: 14,
    height: 48,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.18)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  switchRoleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  signoutBtn: {
    marginTop: 14,
    height: 48,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.18)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signoutText: {
    fontSize: 14,
    fontWeight: '700',
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
    marginTop: 14,
  },
  boostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
  },
  boostBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  boostActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
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
});
