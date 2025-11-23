import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Modal, useWindowDimensions, Platform, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, interpolate } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { RoommateProfile, Match } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, moderateScale, getResponsiveSpacing } from '../../utils/responsive';
import { calculateCompatibility, getMatchQualityColor, getCleanlinessLabel, getSocialLevelLabel, getWorkScheduleLabel, formatMoveInDate, getGenderSymbol } from '../../utils/matchingAlgorithm';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Limit card size for web/desktop viewing
const MAX_CARD_WIDTH = 420;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xxl, MAX_CARD_WIDTH);

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseBoost, purchaseUndoPass, hasActiveUndoPass } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<RoommateProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [profileUsers, setProfileUsers] = useState<Map<string, any>>(new Map());
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [showPurchaseBoostModal, setShowPurchaseBoostModal] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);
  const [lastSwipedProfile, setLastSwipedProfile] = useState<{ profile: RoommateProfile; action: 'like' | 'nope' | 'superlike' } | null>(null);
  const [showUndoUpgradeModal, setShowUndoUpgradeModal] = useState(false);
  const [processingUndoPass, setProcessingUndoPass] = useState(false);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [processingMessagePurchase, setProcessingMessagePurchase] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${rotation.value}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate },
      ],
    };
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const allProfiles = await StorageService.getRoommateProfiles();
      const allUsers = await StorageService.getUsers();
      const history = await StorageService.getSwipeHistory();
      setSwipedIds(history);
      
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      setProfileUsers(userMap);
      
      const unseen = allProfiles.filter(p => !history.has(p.id) && p.id !== user?.id);
      
      const profilesWithCompatibility = unseen.map(profile => {
        const compatibility = user ? calculateCompatibility(user, profile) : 50;
        return {
          ...profile,
          compatibility,
        };
      });
      
      const sortedProfiles = profilesWithCompatibility.sort((a, b) => {
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
          if (plan === 'priority') return 3;
          if (plan === 'plus') return 2;
          return 1;
        };
        
        const priorityA = getPriority(userA);
        const priorityB = getPriority(userB);
        if (priorityA !== priorityB) return priorityB - priorityA;
        
        return (b.compatibility || 0) - (a.compatibility || 0);
      });
      
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
    const canSee = userPlan === 'priority' && userStatus === 'active';
    console.log('[RoommatesScreen] Online status check:', { userPlan, userStatus, canSee });
    return canSee;
  };
  
  const isProfileOnline = currentProfile ? Math.random() > 0.5 : false;

  const handleSwipeAction = (action: 'like' | 'nope' | 'superlike') => {
    if (!currentProfile || !user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setLastSwipedProfile({ profile: currentProfile, action });
    
    const direction = action === 'like' ? 1 : action === 'nope' ? -1 : 0;
    const toX = direction * SCREEN_WIDTH * 1.5;
    const toY = action === 'superlike' ? -SCREEN_HEIGHT : 0;

    translateX.value = withSpring(toX, { damping: 15, stiffness: 100 });
    translateY.value = withSpring(toY, { damping: 15, stiffness: 100 });
    rotation.value = withSpring(direction * 15, { damping: 15, stiffness: 100 });

    setTimeout(() => {
      translateX.value = 0;
      translateY.value = 0;
      rotation.value = 0;
      setCurrentIndex(currentIndex + 1);
    }, 300);

    processSwipeAsync(action, currentProfile.id, user.id);
  };

  const handleUndo = () => {
    if (!hasActiveUndoPass()) {
      setShowUndoUpgradeModal(true);
      return;
    }
    
    if (!lastSwipedProfile) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    undoLastSwipeAsync(lastSwipedProfile.profile.id, lastSwipedProfile.action);
    
    setCurrentIndex(currentIndex - 1);
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
        await StorageService.addLike(userId, profileId);
        
        const isReciprocalMatch = await StorageService.checkReciprocalLike(userId, profileId);
        if (isReciprocalMatch) {
          const match: Match = {
            id: `match_${Date.now()}`,
            userId1: userId,
            userId2: profileId,
            matchedAt: new Date(),
          };
          await StorageService.addMatch(match);
          setShowMatch(true);
          setTimeout(() => setShowMatch(false), 3000);
        }
      }
    } catch (error) {
      console.error('[RoommatesScreen] Error processing swipe:', error);
    }
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotation.value = event.translationX / 20;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        const action = event.translationX > 0 ? 'like' : 'nope';
        runOnJS(handleSwipeAction)(action);
      } else if (event.translationY < -120) {
        runOnJS(handleSwipeAction)('superlike');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="loader" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, styles.emptyTitle]}>Loading...</ThemedText>
        </View>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="users" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, styles.emptyTitle]}>No More Profiles</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
            You've seen all available roommates
          </ThemedText>
          <Pressable
            style={[styles.resetButton, { backgroundColor: theme.primary }]}
            onPress={resetSwipeHistory}
          >
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Start Over
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleOpenAIAssistant = async () => {
    console.log('[AI Assistant] Button clicked');
    const users = await StorageService.getUsers();
    const currentUser = users.find(u => u.id === user?.id);
    const userPlan = currentUser?.subscription?.plan || 'basic';
    const userStatus = currentUser?.subscription?.status || 'active';
    
    console.log('[AI Assistant] User plan:', userPlan, 'Status:', userStatus);
    
    const isPaidMember = (userPlan === 'plus' || userPlan === 'priority') && userStatus === 'active';
    
    if (!isPaidMember) {
      console.log('[AI Assistant] Showing upgrade modal');
      setShowVIPModal(true);
      return;
    }
    
    console.log('[AI Assistant] Navigating to AI Assistant screen');
    (navigation as any).navigate('AIAssistant');
  };

  const handleUpgradeToPaid = () => {
    setShowVIPModal(false);
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
    
    const isPriorityMember = userPlan === 'priority' && userStatus === 'active';
    
    if (isPriorityMember) {
      handleSendDirectMessage();
    } else {
      setShowMessageModal(true);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!currentProfile || !user) return;
    
    const conversations = await StorageService.getConversations();
    const existingConversation = conversations.find(c =>
      c.participants.includes(user.id) && c.participants.includes(currentProfile.id)
    );
    
    if (existingConversation) {
      (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: existingConversation.id } });
    } else {
      const newConversation = {
        id: `conv-${Date.now()}`,
        participants: [user.id, currentProfile.id],
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
      };
      await StorageService.saveConversation(newConversation);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={handleOpenAIAssistant} style={styles.aiButton}>
          <View style={[styles.aiButtonInner, { backgroundColor: theme.primary }]}>
            <Feather name="cpu" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
        {(user?.subscription?.plan || 'basic') === 'basic' && !user?.boostData?.isBoosted ? (
          <Pressable onPress={() => setShowPurchaseBoostModal(true)} style={styles.aiButton}>
            <View style={[styles.aiButtonInner, { backgroundColor: '#FFD700' }]}>
              <Feather name="zap" size={20} color="#000000" />
            </View>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.cardContainer}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.card, animatedCardStyle]}
          >
            <Pressable onPress={() => setShowProfileDetail(true)} style={{ flex: 1 }}>
              <Image source={{ uri: currentProfile.photos[0] }} style={styles.cardImage} />
            {canSeeOnlineStatus() && isProfileOnline ? (
              <View style={styles.onlineIndicatorContainer}>
                <View style={[styles.onlineIndicator, { backgroundColor: theme.success }]} />
              </View>
            ) : null}
            <View style={styles.gradient}>
              {isBoosted ? (
                <View style={styles.boostBadgeLeft}>
                  <View style={[styles.boostBadge, { backgroundColor: '#FFD700' }]}>
                    <Feather name="zap" size={14} color="#000000" />
                    <ThemedText style={[Typography.small, { color: '#000000', fontWeight: '700', marginLeft: 4 }]}>
                      BOOSTED
                    </ThemedText>
                  </View>
                </View>
              ) : null}
              <View style={styles.cardInfo}>
                <ThemedText style={[Typography.hero, { color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }]}>
                  {currentProfile.name}, {currentProfile.age} {getGenderSymbol(currentProfile.gender)}
                </ThemedText>
                <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.sm, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]}>
                  {currentProfile.occupation}
                </ThemedText>
                <ThemedText style={[Typography.caption, { color: '#FFFFFF', marginTop: Spacing.md, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]} numberOfLines={3}>
                  {currentProfile.bio}
                </ThemedText>
                <View style={styles.badges}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="dollar-sign" size={14} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]} numberOfLines={1}>
                      ${currentProfile.budget}/mo
                    </ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="map-pin" size={14} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]} numberOfLines={1}>
                      {currentProfile.preferences.location}
                    </ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: getMatchQualityColor(currentProfile.compatibility || 50) }]}>
                    <Feather name="heart" size={14} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs, fontWeight: '600' }]} numberOfLines={1}>
                      {currentProfile.compatibility || 50}% Match
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={[styles.actions, { paddingBottom: 90 }]}>
        <Pressable
          style={[
            styles.actionButtonSmall, 
            { 
              backgroundColor: '#FFFFFF', 
              borderColor: lastSwipedProfile ? theme.warning : theme.textSecondary,
              opacity: lastSwipedProfile ? 1 : 0.4,
            }
          ]}
          onPress={handleUndo}
        >
          <Feather name="rotate-ccw" size={24} color={lastSwipedProfile ? theme.warning : theme.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderColor: theme.error }]}
          onPress={() => handleSwipeAction('nope')}
        >
          <Feather name="x" size={32} color={theme.error} />
        </Pressable>
        <Pressable
          style={[styles.actionButtonSmall, { backgroundColor: '#FFFFFF', borderColor: theme.primary }]}
          onPress={handleMessageClick}
        >
          <Feather name="message-circle" size={24} color={theme.primary} />
        </Pressable>
        <Pressable
          style={[styles.actionButtonSmall, { backgroundColor: '#FFFFFF', borderColor: theme.info }]}
          onPress={() => handleSwipeAction('superlike')}
        >
          <Feather name="star" size={24} color={theme.info} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderColor: theme.success }]}
          onPress={() => handleSwipeAction('like')}
        >
          <Feather name="heart" size={32} color={theme.success} />
        </Pressable>
      </View>

      {showMatch ? (
        <View style={styles.matchOverlay}>
          <ThemedText style={[Typography.hero, { color: '#FFFFFF', fontSize: 48 }]}>
            It's a Match!
          </ThemedText>
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.lg }]}>
            You and {currentProfile.name} both liked each other
          </ThemedText>
        </View>
      ) : null}

      <Modal
        visible={showVIPModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVIPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.primary }]}>
              <Feather name="cpu" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Plus Feature
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                AI Match Assistant is available for Plus and Priority members. Upgrade to get personalized roommate recommendations powered by AI!
              </ThemedText>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    AI-powered match recommendations
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Personalized roommate insights
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Chat-based assistance 24/7
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary }]}
                onPress={handleUpgradeToPaid}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade Now
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowVIPModal(false)}
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
                Undo Swipe
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Take back your last swipe and get a second chance!
              </ThemedText>
              
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
            </View>
            
            <View style={styles.vipModalActions}>
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
                Priority members can send messages without matching. Choose an option below to message {currentProfile?.name}.
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
                  Upgrade to Priority
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
        visible={showProfileDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileDetail(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.detailHeader}>
              <ThemedText style={[Typography.h2]}>Profile Details</ThemedText>
              <Pressable onPress={() => setShowProfileDetail(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
              <Image source={{ uri: currentProfile.photos[0] }} style={styles.detailImage} />
              
              <View style={styles.detailSection}>
                <ThemedText style={[Typography.h2]}>{currentProfile.name}, {currentProfile.age}</ThemedText>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    zIndex: 10,
  },
  aiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    height: Math.min(SCREEN_HEIGHT * 0.58, 650),
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  topBadges: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  compatibilityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  boostBadgeLeft: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 2,
  },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  onlineIndicatorContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 3,
  },
  onlineIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  cardInfo: {
    gap: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  actionButton: {
    width: Spacing.swipeButtonSize,
    height: Spacing.swipeButtonSize,
    borderRadius: Spacing.swipeButtonSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonSmall: {
    width: Spacing.swipeButtonSmall,
    height: Spacing.swipeButtonSmall,
    borderRadius: Spacing.swipeButtonSmall / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailContent: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
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
});
