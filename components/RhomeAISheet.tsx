import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, Text, Animated as RNAnimated } from 'react-native';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Spacing } from '../constants/theme';
import { calculateDetailedCompatibility } from '../utils/matchingAlgorithm';
import { getProfileGaps, getCompletionPercentage, getMatchMultiplier, GAP_MESSAGES } from '../utils/profileReminderUtils';
import { markQuestionAsked, resetRefinementCooldown } from '../utils/refinementEngine';
import { StorageService } from '../utils/storage';
import { thumbsUp, thumbsDown, shouldShowInsight } from '../utils/aiInsightFeedback';
import { shouldRecalculate, cacheInsight, getTriggerVersion, onInsightTrigger } from '../utils/insightRefresh';
import type { RefinementQuestion } from '../utils/refinementQuestions';
import type { RoommateProfile, User, Message, Group, Conversation } from '../types/models';
import * as Haptics from 'expo-haptics';

const ACCENT = '#ff6b5b';
const SHEET_BG = '#1a1a1a';
const CARD_BG = '#242424';
const GREEN = '#2ecc71';
const URGENCY_RED = '#FF6B6B';
const URGENCY_GREEN = '#4CAF50';
const URGENCY_GREY = '#3A3A3A';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.8;

export type ScreenContext = 'match' | 'chat' | 'explore' | 'messages' | 'groups' | 'profile' | 'profile_reminder' | 'refinement' | 'host_dashboard' | 'host_listings' | 'host_inquiries';

interface MatchContextData {
  currentProfile?: RoommateProfile;
  rightSwipeCount?: number;
  leftSwipeCount?: number;
  avgCompatibilityRight?: number;
  commonOccupationInterest?: string;
}

interface ChatContextData {
  otherUserName?: string;
  otherUserProfile?: RoommateProfile;
  messages?: Message[];
  onSuggestMessage?: (text: string) => void;
}

interface ExploreContextData {
  activeFilters?: Record<string, any>;
  budget?: number;
  city?: string;
  totalListings?: number;
  filteredCount?: number;
  savedCount?: number;
  onApplyFilters?: (filters: Record<string, any>) => void;
}

interface MessagesContextData {
  conversations?: Conversation[];
  unmessagedMatchCount?: number;
  staleConversationCount?: number;
}

interface GroupsContextData {
  currentGroup?: Group;
  groupCompatibility?: number;
  memberProfiles?: RoommateProfile[];
  openSpots?: number;
}

interface ProfileContextData {
  interestCardsUsedToday?: number;
  interestCardLimit?: number;
  rewindsUsed?: number;
  superLikesUsed?: number;
  savedListingsCount?: number;
}

interface ProfileReminderContextData {
  heading?: string;
  subtext?: string;
}

interface HostContextData {
  totalListings?: number;
  activeListings?: number;
  totalInquiries?: number;
  pendingInquiries?: number;
  totalViews?: number;
  responseRate?: number;
  planName?: string;
}

export interface AISheetContextData {
  match?: MatchContextData;
  chat?: ChatContextData;
  explore?: ExploreContextData;
  messages?: MessagesContextData;
  groups?: GroupsContextData;
  profile?: ProfileContextData;
  profileReminder?: ProfileReminderContextData;
  host?: HostContextData;
}

interface RhomeAISheetProps {
  visible: boolean;
  onDismiss: () => void;
  screenContext: ScreenContext;
  contextData?: AISheetContextData;
  onNavigate?: (screen: string, params?: Record<string, any>) => void;
  refinementQuestion?: RefinementQuestion | null;
  onRefinementAnswered?: () => void;
}

const PROFILE_FIELDS = [
  { key: 'photo', label: 'Profile Photo', weight: 20, check: (u: User) => !!(u.photos?.length || u.profilePicture) },
  { key: 'bio', label: 'Bio', weight: 15, check: (u: User) => !!(u.profileData?.bio && u.profileData.bio.trim().length > 0) },
  { key: 'birthday', label: 'Birthday', weight: 5, check: (u: User) => !!u.birthday },
  { key: 'budget', label: 'Budget', weight: 10, check: (u: User) => !!(u.profileData?.budget && u.profileData.budget > 0) },
  { key: 'location', label: 'Location', weight: 10, check: (u: User) => !!(u.profileData?.city || u.profileData?.neighborhood) },
  { key: 'occupation', label: 'Occupation', weight: 10, check: (u: User) => !!(u.profileData?.occupation) },
  { key: 'interests', label: 'Interests', weight: 10, check: (u: User) => !!(u.profileData?.interests) },
  { key: 'sleepSchedule', label: 'Sleep Schedule', weight: 8, check: (u: User) => !!u.profileData?.preferences?.sleepSchedule },
  { key: 'cleanliness', label: 'Cleanliness', weight: 7, check: (u: User) => !!u.profileData?.preferences?.cleanliness },
  { key: 'smoking', label: 'Smoking Pref', weight: 5, check: (u: User) => !!u.profileData?.preferences?.smoking },
];

const CONTEXT_LABELS: Record<ScreenContext, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  explore: { label: 'Explore', icon: 'search' },
  match: { label: 'Match', icon: 'heart' },
  groups: { label: 'Groups', icon: 'users' },
  chat: { label: 'Chat', icon: 'message-circle' },
  messages: { label: 'Messages', icon: 'inbox' },
  profile: { label: 'Profile', icon: 'user' },
  profile_reminder: { label: 'AI Tip', icon: 'zap' },
  refinement: { label: 'Improving Matches', icon: 'trending-up' },
  host_dashboard: { label: 'Dashboard', icon: 'grid' },
  host_listings: { label: 'My Listings', icon: 'home' },
  host_inquiries: { label: 'Inquiries', icon: 'inbox' },
};

const MATCH_MULTIPLIERS: Record<string, number> = {
  'Profile Photo': 3,
  'Bio': 2.5,
  'Interests': 1.8,
  'Occupation': 1.5,
};

const FeedbackThumbs = ({ id, onFeedback }: { id: string; onFeedback?: (id: string, positive: boolean) => void }) => {
  const [selected, setSelected] = useState<'up' | 'down' | null>(null);
  const thumbScale = useRef(new RNAnimated.Value(1)).current;

  const animatePulse = () => {
    RNAnimated.sequence([
      RNAnimated.timing(thumbScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      RNAnimated.timing(thumbScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.thumbsRow}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelected('up');
          animatePulse();
          onFeedback?.(id, true);
        }}
        style={styles.thumbBtn}
      >
        <RNAnimated.View style={{ transform: [{ scale: selected === 'up' ? thumbScale : 1 }] }}>
          <Feather name="thumbs-up" size={14} color={selected === 'up' ? ACCENT : 'rgba(255,255,255,0.4)'} />
        </RNAnimated.View>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelected('down');
          onFeedback?.(id, false);
        }}
        style={styles.thumbBtn}
      >
        <Feather name="thumbs-down" size={14} color={selected === 'down' ? ACCENT : 'rgba(255,255,255,0.4)'} />
      </Pressable>
    </View>
  );
};

const INSIGHT_COLORS = {
  warning:  { color: '#f39c12', bg: 'rgba(243,156,18,0.1)',  border: 'rgba(243,156,18,0.2)',  icon: 'alert-triangle' as const },
  tip:      { color: '#ff6b5b', bg: 'rgba(255,107,91,0.08)', border: 'rgba(255,107,91,0.15)', icon: 'zap' as const },
  positive: { color: '#2ecc71', bg: 'rgba(46,204,113,0.08)', border: 'rgba(46,204,113,0.15)', icon: 'trending-up' as const },
};

function getInsightType(insightId: string, value?: number): 'warning' | 'tip' | 'positive' {
  if (insightId === 'pool-impact') return 'warning';
  if (insightId === 'match-rate' && value !== undefined && value < 0) return 'warning';
  if (insightId === 'response-rate' && value !== undefined && value < 70) return 'tip';
  if (insightId === 'profile-completion' && value !== undefined && value >= 90) return 'positive';
  if (insightId === 'match-rate' && value !== undefined && value > 0) return 'positive';
  if (insightId === 'response-rate' && value !== undefined && value >= 70) return 'positive';
  return 'tip';
}

const InsightCard = ({ icon, title, body, id, onFeedback, actionChip, urgencyValue, onTap, isRecalculating }: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  id: string;
  onFeedback?: (id: string, positive: boolean) => void;
  actionChip?: { label: string; onPress: () => void };
  urgencyValue?: number;
  onTap?: () => void;
  isRecalculating?: boolean;
}) => {
  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  const tapOpacity = useRef(new RNAnimated.Value(1)).current;
  const [removed, setRemoved] = useState(false);

  const handleDown = () => {
    RNAnimated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
      setRemoved(true);
    });
    onFeedback?.(id, false);
  };

  const handleCardTap = () => {
    if (!onTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.sequence([
      RNAnimated.timing(tapOpacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      RNAnimated.timing(tapOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      onTap();
    });
  };

  if (removed) return null;

  const insightType = getInsightType(id, urgencyValue);
  const config = INSIGHT_COLORS[insightType];

  return (
    <Pressable onPress={handleCardTap} disabled={!onTap}>
      <RNAnimated.View style={[
        styles.insightCard,
        { borderColor: config.border, backgroundColor: config.bg },
        { opacity: RNAnimated.multiply(
            slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            tapOpacity
          ),
          transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }] },
      ]}>
        <View style={[styles.insightIconWrap, { backgroundColor: `${config.color}20` }]}>
          <Feather name={icon} size={16} color={config.color} />
        </View>
        <View style={styles.insightBody}>
          <Text style={styles.insightTitle}>{title}</Text>
          {isRecalculating ? (
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>updating...</Text>
          ) : (
            <Text style={styles.insightDesc}>{body}</Text>
          )}
          {actionChip ? (
            <Pressable style={styles.actionChip} onPress={actionChip.onPress}>
              <Text style={styles.actionChipText}>{actionChip.label}</Text>
              <Feather name="arrow-right" size={12} color={ACCENT} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.insightRight}>
          {onTap ? (
            <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          ) : null}
          <View style={styles.insightFeedback}>
            <Pressable onPress={() => onFeedback?.(id, true)}>
              <Feather name="thumbs-up" size={12} color="rgba(255,255,255,0.25)" />
            </Pressable>
            <Pressable onPress={() => handleDown()}>
              <Feather name="thumbs-down" size={12} color="rgba(255,255,255,0.25)" />
            </Pressable>
          </View>
        </View>
      </RNAnimated.View>
    </Pressable>
  );
};

export const RhomeAISheet = ({ visible, onDismiss, screenContext, contextData, onNavigate, refinementQuestion, onRefinementAnswered }: RhomeAISheetProps) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hiddenInsightTypes, setHiddenInsightTypes] = useState<Set<string>>(new Set());
  const [insightsReady, setInsightsReady] = useState(false);
  const [recalculating, setRecalculating] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const [refinementAnswered, setRefinementAnswered] = useState(false);
  const [refinementSelectedValue, setRefinementSelectedValue] = useState<string | null>(null);
  const optionFillAnim = useRef(new RNAnimated.Value(0)).current;

  const getSwipeInsight = () => {
    const rightCount = contextData?.match?.rightSwipeCount || 0;
    const leftCount = contextData?.match?.leftSwipeCount || 0;
    const avgScore = contextData?.match?.avgCompatibilityRight || 0;
    const topOccupation = contextData?.match?.commonOccupationInterest;

    if (rightCount === 0) return null;

    const selectivity = leftCount > 0 ? Math.round((leftCount / (rightCount + leftCount)) * 100) : 0;

    if (selectivity > 80) {
      return `You're swiping left on ${selectivity}% of profiles — you have high standards. Make sure your own profile is complete so the people you like will like you back.`;
    }
    if (selectivity < 20) {
      return `You're swiping right on almost everyone. Try being more selective — focus on the top ${Math.round(rightCount * 0.3)} profiles with the highest compatibility scores.`;
    }
    if (topOccupation) {
      return `You've been matching with a lot of ${topOccupation}s. Want me to prioritize similar profiles?`;
    }
    if (avgScore > 80) {
      return `Your matches are strong — averaging ${avgScore}% compatibility. Keep going, you're close to finding your person.`;
    }
    return `You've liked ${rightCount} people today. Send at least one message to keep momentum going.`;
  };

  useEffect(() => {
    if (visible && screenContext === 'refinement') {
      setRefinementAnswered(false);
      setRefinementSelectedValue(null);
      optionFillAnim.setValue(0);
    }
    if (visible) {
      setInsightsReady(false);
      const loadHidden = async () => {
        const types = ['profile-completion', 'match-rate', 'pool-impact', 'response-rate',
          'match-analysis', 'chat-coach', 'explore-guide', 'messages-tips', 'groups-analysis', 'profile-stats'];
        const hidden = new Set<string>();
        for (const t of types) {
          const show = await shouldShowInsight(t);
          if (!show) hidden.add(t);
        }
        setHiddenInsightTypes(hidden);

        const insightTypes = ['profile-completion', 'match-rate', 'pool-impact', 'response-rate'];
        const needsRecalc = new Set<string>();
        for (const t of insightTypes) {
          if (hidden.has(t)) continue;
          const version = getTriggerVersion({ userId: user?.id, type: t });
          const needs = await shouldRecalculate(t, version);
          if (needs) needsRecalc.add(t);
        }
        setRecalculating(needsRecalc);
        setInsightsReady(true);

        for (const t of needsRecalc) {
          const version = getTriggerVersion({ userId: user?.id, type: t });
          await cacheInsight(t, { recalculated: true }, version);
        }
        setRecalculating(new Set());
      };
      loadHidden();
    }
  }, [visible, screenContext]);

  useEffect(() => {
    const unsub = onInsightTrigger((_triggerType, affectedTypes) => {
      if (!visible) return;
      setRecalculating(prev => {
        const next = new Set(prev);
        affectedTypes.forEach(t => next.add(t));
        return next;
      });
      setTimeout(() => {
        setRecalculating(prev => {
          const next = new Set(prev);
          affectedTypes.forEach(t => next.delete(t));
          return next;
        });
      }, 500);
    });
    return unsub;
  }, [visible]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toastOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.delay(1800),
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  const safeNavigate = (screen: string, params?: Record<string, any>) => {
    onDismiss();
    setTimeout(() => {
      try {
        onNavigate?.(screen, params);
      } catch {
        showToast('Coming soon');
      }
    }, 300);
  };

  const getFieldToStep = (fieldLabel: string): string | undefined => {
    const map: Record<string, string> = {
      'Profile Photo': 'photos',
      'Bio': 'bio',
      'Birthday': 'basicInfo',
      'Budget': 'budget',
      'Location': 'location',
      'Occupation': 'location',
      'Interests': 'interests',
      'Sleep Schedule': 'sleepSchedule',
      'Cleanliness': 'cleanliness',
      'Smoking Pref': 'smoking',
    };
    return map[fieldLabel];
  };

  const handleRefinementAnswer = async (question: RefinementQuestion, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefinementSelectedValue(value);

    RNAnimated.timing(optionFillAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start(async () => {
      setRefinementAnswered(true);

      if (user) {
        const updatedAnswers = {
          ...user.profileData?.personalityAnswers,
          [question.profileField]: value,
          [`${question.profileField}_source`]: 'ai_refinement',
          [`${question.profileField}_collectedAt`]: new Date().toISOString(),
        };

        await updateUser({
          profileData: {
            ...user.profileData,
            personalityAnswers: updatedAnswers,
          },
        } as any);

        await markQuestionAsked(question.id);
        onRefinementAnswered?.();
      }

      setTimeout(() => {
        onDismiss();
      }, 1200);
    });
  };

  const handleRefinementNotNow = async () => {
    await resetRefinementCooldown();
    onDismiss();
  };

  const handleFeedback = async (id: string, positive: boolean) => {
    if (!user) return;
    if (positive) {
      await thumbsUp(id);
      showToast('Thanks for the feedback!');
    } else {
      setDismissedIds(prev => new Set(prev).add(id));
      const result = await thumbsDown(id);
      if (result.permanentlyHidden) {
        showToast("Got it — you won't see this again.");
        setHiddenInsightTypes(prev => new Set(prev).add(id));
      } else {
        showToast('Insight hidden for now.');
      }
    }
  };

  const isDismissed = (id: string) => dismissedIds.has(id);

  const profileCompletion = useMemo(() => {
    if (!user) return { score: 0, missing: [] as string[], weightedScore: 0 };
    let totalWeight = 0;
    let earnedWeight = 0;
    const missing: string[] = [];
    PROFILE_FIELDS.forEach(f => {
      totalWeight += f.weight;
      if (f.check(user)) earnedWeight += f.weight;
      else missing.push(f.label);
    });
    return {
      score: Math.round((earnedWeight / totalWeight) * 100),
      missing,
      weightedScore: earnedWeight,
    };
  }, [user]);

  const plan = user?.subscription?.plan || 'basic';
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  const getGreeting = (): string => {
    const name = user?.name?.split(' ')[0] || '';
    switch (screenContext) {
      case 'explore': {
        const city = contextData?.explore?.city;
        const budget = contextData?.explore?.budget || user?.profileData?.budget;
        if (city && budget) {
          const total = contextData?.explore?.totalListings || 0;
          const filtered = contextData?.explore?.filteredCount || 0;
          const outOfRange = total > 0 ? Math.round(((total - filtered) / total) * 100) : 0;
          if (outOfRange > 30) {
            return `You're browsing in ${city}. Based on your $${budget.toLocaleString()} budget, ${outOfRange}% of listings are out of range — want me to suggest better-value neighborhoods?`;
          }
          return `You're browsing in ${city} with ${filtered} listings matching your $${budget.toLocaleString()} budget. Your filters look well-tuned.`;
        }
        if (city) return `You're exploring ${city}. Let me help you find the best listings for your needs.`;
        return 'I can help you find the perfect place. Set your city and budget for personalized suggestions.';
      }
      case 'match': {
        const profile = contextData?.match?.currentProfile;
        const swipeInsight = getSwipeInsight();
        if (swipeInsight) return swipeInsight;
        if (profile && user) {
          const detailed = calculateDetailedCompatibility(user, profile);
          const score = Math.round(detailed.totalScore);
          const { strengths, concerns } = detailed.reasons;
          let msg = `${profile.name} scored ${score}%`;
          if (strengths.length > 0) msg += ` — ${strengths[0].toLowerCase()}`;
          if (concerns.length > 0) msg += `. But ${concerns[0].toLowerCase()} — worth a conversation.`;
          else msg += '.';
          return msg;
        }
        return `${name ? name + ', l' : 'L'}et me help you understand your matches better.`;
      }
      case 'groups': {
        const group = contextData?.groups?.currentGroup;
        if (group) {
          const compat = contextData?.groups?.groupCompatibility || 0;
          const spots = contextData?.groups?.openSpots || 0;
          const remoteCount = contextData?.groups?.memberProfiles?.filter(m => {
            const ws = m.lifestyle?.workSchedule?.toLowerCase() || '';
            return ws.includes('remote') || ws.includes('home') || ws === 'wfh' || ws === 'wfh_fulltime';
          }).length || 0;
          let msg = `This group of ${group.members.length} is looking for ${spots > 0 ? `${spots} more` : 'members'} in ${group.preferredLocation || 'your area'}. Their combined lifestyle score with your profile is ${compat}%.`;
          if (remoteCount > 0) msg += ` ${remoteCount} member${remoteCount > 1 ? 's are' : ' is a'} remote worker${remoteCount > 1 ? 's' : ''} like you.`;
          return msg;
        }
        return 'I can help you find the right group. Swipe to discover groups that match your lifestyle.';
      }
      case 'chat': {
        const chatName = contextData?.chat?.otherUserName || 'them';
        const msgs = contextData?.chat?.messages;
        if (!msgs || msgs.length === 0) {
          return `Start the conversation with ${chatName}! I have some ice-breakers based on their profile.`;
        }
        const lastMsg = msgs[msgs.length - 1];
        const hoursSince = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 48) {
          return `It's been ${Math.round(hoursSince / 24)} days since the last message with ${chatName}. A follow-up can revive the conversation!`;
        }
        return `Your conversation with ${chatName} is active. Keep the momentum going!`;
      }
      case 'messages': {
        const unmessaged = contextData?.messages?.unmessagedMatchCount || 0;
        const stale = contextData?.messages?.staleConversationCount || 0;
        if (unmessaged > 0) {
          return `You have ${unmessaged} match${unmessaged !== 1 ? 'es' : ''} you haven't messaged yet. Want me to help break the ice?`;
        }
        if (stale > 0) {
          return `${stale} conversation${stale !== 1 ? 's have' : ' has'} gone quiet. A quick follow-up could revive them.`;
        }
        return 'Your conversations are looking active. Keep responding quickly to boost your visibility.';
      }
      case 'profile': {
        if (profileCompletion.score < 100 && profileCompletion.missing.length > 0) {
          const topMissing = profileCompletion.missing[0];
          const multiplier = MATCH_MULTIPLIERS[topMissing] || 1.5;
          return `Your profile is ${profileCompletion.score}% complete. Adding ${topMissing.toLowerCase().startsWith('a') ? 'an' : 'a'} ${topMissing.toLowerCase()} gets ${multiplier}x more matches.`;
        }
        return `${name ? name + ', y' : 'Y'}our profile is 100% complete. You're getting maximum visibility.`;
      }
      case 'host_dashboard': {
        const pending = contextData?.host?.pendingInquiries || 0;
        const active = contextData?.host?.activeListings || 0;
        if (pending > 0) {
          return `You have ${pending} pending inquir${pending !== 1 ? 'ies' : 'y'} waiting for a response. Responding within 24 hours increases your acceptance rate.`;
        }
        if (active > 0) {
          return `You have ${active} active listing${active !== 1 ? 's' : ''}. Keep your availability up to date to attract the right renters.`;
        }
        return `Welcome back${name ? ', ' + name : ''}. Post your first listing to start receiving inquiries from matched renters.`;
      }
      case 'host_listings': {
        const active = contextData?.host?.activeListings || 0;
        const views = contextData?.host?.totalViews || 0;
        const total = contextData?.host?.totalListings || 0;
        if (total === 0) {
          return `You don't have any listings yet. Create one now and start receiving inquiries from renters in your city.`;
        }
        if (active > 0 && views < 20) {
          return `Your listing${active > 1 ? 's are' : ' is'} live but getting low views. Try adding more photos or boosting visibility.`;
        }
        return `You have ${active} active listing${active !== 1 ? 's' : ''} with ${views} total views. Looking good — keep responding to inquiries quickly.`;
      }
      case 'host_inquiries': {
        const pending = contextData?.host?.pendingInquiries || 0;
        const total = contextData?.host?.totalInquiries || 0;
        const rate = contextData?.host?.responseRate || 0;
        if (pending > 0) {
          return `${pending} renter${pending !== 1 ? 's are' : ' is'} waiting for your response. Hosts who respond within 24 hours get 3x more matches.`;
        }
        if (total === 0) {
          return `No inquiries yet. Make sure your listing has clear photos, an accurate price, and is marked as active.`;
        }
        return `Your response rate is ${rate}%. ${rate >= 80 ? 'Excellent — renters love responsive hosts.' : 'Try to respond faster to improve your host ranking.'}`;
      }
      default:
        return 'How can I help you today?';
    }
  };

  const getMatchContextContent = () => {
    if (!user || !contextData?.match?.currentProfile) return null;
    const profile = contextData.match.currentProfile;
    const detailed = calculateDetailedCompatibility(user, profile);
    const score = Math.round(detailed.totalScore);
    const { strengths, concerns } = detailed.reasons;

    const breakdownLabels: Record<string, { label: string; max: number }> = {
      location: { label: 'Location', max: 16 },
      budget: { label: 'Budget', max: 14 },
      sleepSchedule: { label: 'Sleep', max: 10 },
      cleanliness: { label: 'Clean', max: 10 },
      smoking: { label: 'Smoking', max: 8 },
      pets: { label: 'Pets', max: 6 },
      noiseTolerance: { label: 'Noise', max: 6 },
    };

    const topFactors = Object.entries(detailed.breakdown)
      .filter(([key]) => key in breakdownLabels)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="users" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Match Analysis — {profile.name}</Text>
        </View>

        <View style={styles.breakdownContainer}>
          {topFactors.map(([key, value]) => {
            const info = breakdownLabels[key];
            if (!info) return null;
            const pct = Math.round((value / info.max) * 100);
            return (
              <View key={key} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{info.label}</Text>
                <View style={styles.breakdownBarBg}>
                  <View style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: pct >= 70 ? GREEN : pct >= 40 ? '#f1c40f' : '#e74c3c' }]} />
                </View>
                <Text style={styles.breakdownPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {strengths.length > 0 ? (
          <View style={styles.tagRow}>
            {strengths.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.strengthTag}>
                <Feather name="check" size={10} color={GREEN} />
                <Text style={styles.strengthText} numberOfLines={1}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {concerns.length > 0 ? (
          <View style={styles.tagRow}>
            {concerns.slice(0, 2).map((c, i) => (
              <View key={i} style={styles.concernTag}>
                <Feather name="alert-circle" size={10} color="#e74c3c" />
                <Text style={styles.concernText} numberOfLines={1}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {contextData?.chat?.onSuggestMessage && profile.name ? (
          <Pressable
            style={styles.actionChip}
            onPress={() => {
              contextData.chat?.onSuggestMessage?.(`Hey ${profile.name}, I noticed we have a lot in common! Want to chat about our living preferences?`);
              onDismiss();
            }}
          >
            <Text style={styles.actionChipText}>Ask {profile.name} about their schedule</Text>
            <Feather name="arrow-right" size={12} color={ACCENT} />
          </Pressable>
        ) : null}
        <FeedbackThumbs id="match-analysis" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getChatContextContent = () => {
    if (!contextData?.chat) return null;
    const { otherUserName, otherUserProfile, messages, onSuggestMessage } = contextData.chat;
    const name = otherUserName || 'them';

    let chips: string[] = [];

    if (!messages || messages.length === 0) {
      if (otherUserProfile?.occupation) {
        const article = otherUserProfile.occupation.toLowerCase().startsWith('a') || otherUserProfile.occupation.toLowerCase().startsWith('e') ? 'an' : 'a';
        chips.push(`Hey ${name}! I see you work as ${article} ${otherUserProfile.occupation}. How do you like the work schedule?`);
      }
      chips.push(`Hi ${name}! I'm looking for a roommate in the area. What's your ideal living situation?`);
      chips.push(`Hey! What's your typical day like? I'm trying to find someone with a compatible schedule.`);
    } else {
      const lastMsg = messages[messages.length - 1];
      const hoursSince = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (1000 * 60 * 60);

      if (hoursSince > 48) {
        chips.push(`Hey ${name}, just checking in! Are you still looking for a roommate?`);
        chips.push(`Hi again! I wanted to follow up — would you be free to chat about the living situation?`);
        chips.push(`Hope you're doing well! I'm still interested in rooming together if you are.`);
      } else {
        chips.push(`That sounds great! When would be a good time to meet up?`);
        chips.push(`I'd love to see the place if possible. Are you free this weekend?`);
        chips.push(`What are the most important things you're looking for in a roommate?`);
      }
    }

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="message-circle" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Conversation Coach</Text>
        </View>
        <View style={styles.chipsContainer}>
          {chips.map((chip, i) => (
            <Pressable
              key={i}
              style={styles.suggestionChip}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSuggestMessage?.(chip);
                onDismiss();
              }}
            >
              <Text style={styles.chipText} numberOfLines={2}>{chip}</Text>
            </Pressable>
          ))}
        </View>
        <FeedbackThumbs id="chat-coach" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getExploreContextContent = () => {
    if (!contextData?.explore) return null;
    const { budget, city, totalListings, filteredCount, savedCount, onApplyFilters } = contextData.explore;

    const suggestions: { label: string; icon: string; filters: Record<string, any> }[] = [];
    if (budget && budget < 2000) {
      suggestions.push({ label: `Expand budget to $${budget + 500}/mo`, icon: 'dollar-sign', filters: { maxPrice: budget + 500 } });
    }
    suggestions.push({ label: 'Show Pet Friendly only', icon: 'heart', filters: { petFriendly: true } });
    if (savedCount && savedCount > 0) {
      suggestions.push({ label: `Compare your ${savedCount} saved listing${savedCount !== 1 ? 's' : ''}`, icon: 'bookmark', filters: { __navigate: 'SavedListings' } });
    }

    const contextLine = budget && totalListings && filteredCount !== undefined
      ? (filteredCount < totalListings * 0.3
          ? `Your filters are very strict — only ${filteredCount} of ${totalListings} listings${city ? ` in ${city}` : ''} match. Try relaxing some filters.`
          : `You're seeing ${filteredCount} of ${totalListings} listings${city ? ` in ${city}` : ''}. Your preferences are well-balanced.`)
      : 'Use the filters to narrow down listings that match your lifestyle and budget.';

    return (
      <View style={styles.aiSectionWrap}>
        <View style={styles.sectionLabelRow}>
          <Feather name="sliders" size={13} color={ACCENT} />
          <Text style={styles.sectionLabel}>Smart Filter Guide</Text>
        </View>

        <Text style={styles.aiSectionSubtext}>{contextLine}</Text>

        {onApplyFilters && suggestions.length > 0 ? (
          <View style={styles.aiSuggestionList}>
            {suggestions.map((s, i) => (
              <Pressable
                key={i}
                style={styles.aiSuggestionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (s.filters.__navigate) {
                    safeNavigate(s.filters.__navigate);
                  } else if (Object.keys(s.filters).length > 0) {
                    onApplyFilters(s.filters);
                    onDismiss();
                  } else {
                    onDismiss();
                  }
                }}
              >
                <View style={styles.aiSuggestionIcon}>
                  <Feather name={s.icon as any} size={14} color={ACCENT} />
                </View>
                <Text style={styles.aiSuggestionText}>{s.label}</Text>
                <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.aiFeedbackRow}>
          <Text style={styles.aiFeedbackLabel}>Was this helpful?</Text>
          <Pressable style={styles.aiFeedbackBtn} onPress={() => handleFeedback('explore-guide', true)}>
            <Feather name="thumbs-up" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
          <Pressable style={styles.aiFeedbackBtn} onPress={() => handleFeedback('explore-guide', false)}>
            <Feather name="thumbs-down" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      </View>
    );
  };

  const getMessagesContextContent = () => {
    const unmessaged = contextData?.messages?.unmessagedMatchCount || 0;
    const stale = contextData?.messages?.staleConversationCount || 0;

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="inbox" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Messaging Insights</Text>
        </View>
        {unmessaged > 0 ? (
          <View style={styles.statRow}>
            <View style={[styles.statDot, { backgroundColor: ACCENT }]} />
            <Text style={styles.contextBody}>{unmessaged} new match{unmessaged !== 1 ? 'es' : ''} waiting for your first message</Text>
          </View>
        ) : null}
        {stale > 0 ? (
          <View style={styles.statRow}>
            <View style={[styles.statDot, { backgroundColor: '#f1c40f' }]} />
            <Text style={styles.contextBody}>{stale} conversation{stale !== 1 ? 's' : ''} with no reply in 48+ hours</Text>
          </View>
        ) : null}
        <Text style={[styles.contextBody, { marginTop: 8 }]}>
          Respond within 24 hours to keep conversations active. Profiles with fast reply rates get 40% more matches.
        </Text>
        <FeedbackThumbs id="messages-tips" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getGroupsContextContent = () => {
    const group = contextData?.groups?.currentGroup;
    if (!group) return null;

    const compat = contextData?.groups?.groupCompatibility || 0;
    const members = contextData?.groups?.memberProfiles || [];
    const spots = contextData?.groups?.openSpots || 0;

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="users" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Group Analysis — {group.name}</Text>
        </View>

        <View style={styles.groupStatsRow}>
          <View style={styles.groupStat}>
            <Text style={styles.groupStatValue}>{compat}%</Text>
            <Text style={styles.groupStatLabel}>Match</Text>
          </View>
          <View style={styles.groupStat}>
            <Text style={styles.groupStatValue}>{group.members.length}</Text>
            <Text style={styles.groupStatLabel}>Members</Text>
          </View>
          <View style={styles.groupStat}>
            <Text style={styles.groupStatValue}>{spots}</Text>
            <Text style={styles.groupStatLabel}>Open</Text>
          </View>
          <View style={styles.groupStat}>
            <Text style={styles.groupStatValue}>${group.budget}</Text>
            <Text style={styles.groupStatLabel}>Budget</Text>
          </View>
        </View>

        {members.length > 0 ? (
          <View style={styles.memberTraits}>
            {members.slice(0, 3).map((m, i) => (
              <View key={i} style={styles.memberTraitRow}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberDetail}>
                  {m.occupation || 'N/A'} · {(() => { const ws = m.lifestyle?.workSchedule?.toLowerCase() || ''; return ws.includes('remote') || ws.includes('home') || ws === 'wfh' || ws === 'wfh_fulltime' ? 'Remote' : m.lifestyle?.workSchedule || 'N/A'; })()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <FeedbackThumbs id="groups-analysis" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getProfileContextContent = () => {
    const cardsUsed = contextData?.profile?.interestCardsUsedToday || 0;
    const cardLimit = contextData?.profile?.interestCardLimit || (plan === 'basic' ? 5 : plan === 'plus' ? 15 : 999);
    const savedCount = contextData?.profile?.savedListingsCount || 0;

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="bar-chart-2" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Your Stats</Text>
        </View>

        <View style={styles.profileStatsGrid}>
          <View style={styles.profileStatItem}>
            <Text style={styles.profileStatValue}>{profileCompletion.score}%</Text>
            <Text style={styles.profileStatLabel}>Profile</Text>
          </View>
          <View style={styles.profileStatItem}>
            <Text style={styles.profileStatValue}>{planLabel}</Text>
            <Text style={styles.profileStatLabel}>Plan</Text>
          </View>
          <View style={styles.profileStatItem}>
            <Text style={styles.profileStatValue}>{cardsUsed}/{cardLimit === 999 ? 'Unlimited' : cardLimit}</Text>
            <Text style={styles.profileStatLabel}>Cards Today</Text>
          </View>
          <View style={styles.profileStatItem}>
            <Text style={styles.profileStatValue}>{savedCount}</Text>
            <Text style={styles.profileStatLabel}>Saved</Text>
          </View>
        </View>

        {plan === 'basic' && cardsUsed >= cardLimit - 1 ? (
          <View style={styles.upgradeNudge}>
            <Feather name="zap" size={13} color="#FFD700" />
            <Text style={styles.upgradeNudgeText}>
              You've used {cardsUsed} of {cardLimit} interest cards today. Upgrade to Plus for unlimited.
            </Text>
          </View>
        ) : null}

        <FeedbackThumbs id="profile-stats" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getProfileReminderContent = () => {
    if (!user) return null;
    const gaps = getProfileGaps(user);
    const completion = getCompletionPercentage(user);
    const multiplier = getMatchMultiplier(completion);
    const heading = contextData?.profileReminder?.heading || 'Boost Your Matches';
    const subtext = contextData?.profileReminder?.subtext || "Here's what's holding back your profile";

    if (completion === 100) {
      return (
        <View style={styles.contextCard}>
          <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
            <View style={[styles.reminderIconCircle, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
              <Feather name="check-circle" size={28} color={GREEN} />
            </View>
            <Text style={[styles.contextTitle, { fontSize: 18, marginTop: Spacing.md }]}>Your profile is fully optimized!</Text>
            <Text style={[styles.contextBody, { textAlign: 'center', marginTop: 6 }]}>
              You're appearing in all relevant searches. Keep swiping!
            </Text>
            <Pressable
              style={[styles.reminderFixBtn, { marginTop: Spacing.lg, backgroundColor: GREEN }]}
              onPress={onDismiss}
            >
              <Text style={styles.reminderFixText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View>
        <View style={{ marginBottom: Spacing.md }}>
          <View style={styles.reminderChip}>
            <Feather name="zap" size={10} color={ACCENT} />
            <Text style={styles.reminderChipText}>AI Tip</Text>
          </View>
          <Text style={[styles.contextTitle, { fontSize: 20, marginTop: 8 }]}>{heading}</Text>
          <Text style={[styles.contextBody, { marginTop: 4 }]}>{subtext}</Text>
        </View>

        {gaps.map((gap) => (
          <View key={gap.field} style={styles.reminderGapCard}>
            <View style={styles.reminderIconCircle}>
              <Feather name={gap.icon} size={16} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderGapLabel}>{gap.label}</Text>
              <Text style={styles.reminderGapImpact}>{GAP_MESSAGES[gap.field] || gap.impact}</Text>
            </View>
            <Pressable
              style={styles.reminderFixBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss();
                if (onNavigate && gap.screenParams) {
                  onNavigate(gap.screen, gap.screenParams);
                }
              }}
            >
              <Text style={styles.reminderFixText}>Fix</Text>
              <Feather name="arrow-right" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}

        <View style={styles.reminderCompletionBar}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
            Your profile is {completion}% complete
          </Text>
          <View style={styles.reminderProgressTrack}>
            <View style={[styles.reminderProgressFill, { width: `${completion}%` }]} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
            Complete profile to get {multiplier}x more matches
          </Text>
        </View>
      </View>
    );
  };

  const getRefinementContent = () => {
    if (!refinementQuestion) return null;

    return (
      <View>
        <View style={styles.refinementChip}>
          <Feather name="trending-up" size={10} color={ACCENT} />
          <Text style={styles.refinementChipText}>Improving your matches ✨</Text>
        </View>

        <View style={styles.refinementBubble}>
          <Text style={styles.refinementBubbleText}>
            {refinementAnswered ? refinementQuestion.followUpMessage : refinementQuestion.aiMessage}
          </Text>
        </View>

        {!refinementAnswered ? (
          <View style={styles.refinementOptions}>
            {refinementQuestion.options.map((opt) => {
              const isSelected = refinementSelectedValue === opt.value;
              const fillWidth = isSelected ? optionFillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }) : '0%';

              return (
                <Pressable
                  key={opt.value}
                  style={styles.refinementOption}
                  onPress={() => handleRefinementAnswer(refinementQuestion, opt.value)}
                  disabled={refinementSelectedValue !== null}
                >
                  {isSelected ? (
                    <RNAnimated.View style={[styles.refinementOptionFill, { width: fillWidth }]} />
                  ) : null}
                  <Text style={styles.refinementOptionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.refinementOptionLabel}>{opt.label}</Text>
                  <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!refinementAnswered && refinementSelectedValue === null ? (
          <Pressable onPress={handleRefinementNotNow} style={styles.refinementNotNow}>
            <Text style={styles.refinementNotNowText}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const getHostContextContent = () => {
    const pending = contextData?.host?.pendingInquiries || 0;
    const active = contextData?.host?.activeListings || 0;
    const total = contextData?.host?.totalListings || 0;
    const views = contextData?.host?.totalViews || 0;
    const rate = contextData?.host?.responseRate || 0;
    const plan = contextData?.host?.planName || 'free';

    if (plan === 'free' || plan === 'none') {
      return (
        <>
          <View style={{ backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.15)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="lock" size={16} color="#a855f7" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>AI Insights Locked</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19, marginBottom: 12 }}>
              AI insights are available on Starter and above
            </Text>
            <Pressable
              onPress={() => { onDismiss(); onNavigate?.('HostSubscription'); }}
              style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#a855f7' }}>Upgrade</Text>
            </Pressable>
          </View>
        </>
      );
    }

    return (
      <>
        {pending > 0 && !isDismissed('host-pending') ? (
          <InsightCard
            icon="inbox"
            title="Pending Inquiries"
            body={`${pending} renter${pending !== 1 ? 's are' : ' is'} waiting for your response. Hosts who respond quickly rank higher in search results.`}
            id="host-pending"
            onFeedback={handleFeedback}
            urgencyValue={-1}
            onTap={() => { onDismiss(); onNavigate?.('Inquiries'); }}
          />
        ) : null}
        {total === 0 && !isDismissed('host-no-listings') ? (
          <InsightCard
            icon="home"
            title="No Listings Yet"
            body="Post your first listing to start receiving inquiries. Add clear photos and a competitive price to attract the best matches."
            id="host-no-listings"
            onFeedback={handleFeedback}
            urgencyValue={-1}
            onTap={() => { onDismiss(); onNavigate?.('CreateEditListing'); }}
          />
        ) : null}
        {active > 0 && views < 20 && !isDismissed('host-low-views') ? (
          <InsightCard
            icon="eye"
            title="Low Listing Views"
            body={`Your listing${active > 1 ? 's are' : ' is'} getting fewer than 20 views. Add more photos, improve your description, or activate a boost.`}
            id="host-low-views"
            onFeedback={handleFeedback}
            urgencyValue={views}
            onTap={() => { onDismiss(); onNavigate?.('MyListings'); }}
          />
        ) : null}
        {rate > 0 && rate < 70 && !isDismissed('host-response-rate') ? (
          <InsightCard
            icon="clock"
            title="Response Rate"
            body={`Your response rate is ${rate}%. Aim for 80%+ to get a 'Responsive Host' badge that increases your inquiry volume.`}
            id="host-response-rate"
            onFeedback={handleFeedback}
            urgencyValue={rate}
            onTap={() => { onDismiss(); onNavigate?.('Inquiries'); }}
          />
        ) : null}
        <InsightCard
          icon="trending-up"
          title="Host Plan"
          body={`You're on the ${plan} plan. ${plan === 'starter' ? 'Upgrade to Pro to list up to 5 properties and unlock priority placement.' : plan === 'pro' ? 'Upgrade to Business for unlimited listings and full analytics.' : 'You have access to all host features.'}`}
          id="host-plan"
          onFeedback={handleFeedback}
          onTap={() => { onDismiss(); onNavigate?.('HostSubscription'); }}
        />
      </>
    );
  };

  const renderContextContent = () => {
    switch (screenContext) {
      case 'match': return getMatchContextContent();
      case 'chat': return getChatContextContent();
      case 'explore': return getExploreContextContent();
      case 'messages': return getMessagesContextContent();
      case 'groups': return getGroupsContextContent();
      case 'profile': return getProfileContextContent();
      case 'profile_reminder': return getProfileReminderContent();
      case 'refinement': return getRefinementContent();
      case 'host_dashboard':
      case 'host_listings':
      case 'host_inquiries': return getHostContextContent();
      default: return null;
    }
  };

  const getInsights = () => {
    type InsightItem = {
      icon: keyof typeof Feather.glyphMap;
      title: string;
      body: string;
      id: string;
      actionChip?: { label: string; onPress: () => void };
      urgencyValue?: number;
      onTap?: () => void;
    };
    const insights: InsightItem[] = [];

    const isVisible = (id: string) => !isDismissed(id) && !hiddenInsightTypes.has(id);

    if (isVisible('profile-completion') && profileCompletion.score < 100) {
      const topMissing = profileCompletion.missing.slice(0, 2);
      const multiplier = MATCH_MULTIPLIERS[topMissing[0]] || 1.5;
      const firstMissingStep = getFieldToStep(topMissing[0]);
      insights.push({
        icon: 'user',
        title: 'Profile Completion',
        body: `Your profile is ${profileCompletion.score}% complete. Adding ${topMissing.join(' and ').toLowerCase()} could get you ${multiplier}x more matches.`,
        id: 'profile-completion',
        urgencyValue: profileCompletion.score,
        onTap: () => safeNavigate('ProfileQuestionnaire', firstMissingStep ? { initialStep: firstMissingStep } : undefined),
      });
    }

    if (isVisible('match-rate')) {
      const rate = 60 + ((user?.id?.charCodeAt(0) || 0) % 25);
      const change = ((user?.id?.charCodeAt(1) || 0) % 15) - 5;
      insights.push({
        icon: 'trending-up',
        title: 'Match Rate',
        body: `${rate}% this week (${change >= 0 ? '+' : ''}${change}% vs last week). ${change >= 0 ? 'Keep it up!' : 'Complete your profile to improve.'}`,
        id: 'match-rate',
        urgencyValue: change,
        onTap: () => safeNavigate('Roommates', { showStats: true }),
      });
    }

    if (isVisible('pool-impact')) {
      const poolReduction = user?.profileData?.preferences?.pets === 'no_pets' ? 58 :
        user?.profileData?.preferences?.smoking === 'no' ? 32 : 15;
      const poolFactor = user?.profileData?.preferences?.pets === 'no_pets' ? "'no pets' preference" :
        user?.profileData?.preferences?.smoking === 'no' ? "'non-smoker' preference" : 'your filter selections';
      const highlightFilter = user?.profileData?.preferences?.pets === 'no_pets' ? 'pets' :
        user?.profileData?.preferences?.smoking === 'no' ? 'smoking' : undefined;
      insights.push({
        icon: 'alert-circle',
        title: 'Match Pool Impact',
        body: `Your ${poolFactor} reduces your match pool by ${poolReduction}% in your city. Consider adjusting if you want more options.`,
        id: 'pool-impact',
        onTap: () => safeNavigate('EditProfile', highlightFilter ? { highlightFilter } : undefined),
      });
    }

    if (isVisible('response-rate')) {
      const responseRate = 65 + ((user?.id?.charCodeAt(2) || 0) % 30);
      insights.push({
        icon: 'clock',
        title: 'Response Rate',
        body: `Your response rate is ${responseRate}%. ${responseRate >= 80 ? 'Excellent — you reply quickly!' : 'Try responding within 24 hours to boost your visibility.'}`,
        id: 'response-rate',
        urgencyValue: responseRate,
        onTap: () => safeNavigate('Messages', { filter: 'unanswered' }),
      });
    }

    return insights;
  };

  const contextInfo = CONTEXT_LABELS[screenContext];
  const insights = getInsights();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient colors={[ACCENT, '#ff8c7a']} style={styles.headerIcon}>
                <Feather name="cpu" size={18} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={styles.headerTitle}>Rhome AI</Text>
                <View style={styles.contextPill}>
                  <Feather name={contextInfo.icon} size={10} color={ACCENT} />
                  <Text style={styles.contextPillText}>{contextInfo.label}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {screenContext !== 'profile_reminder' && screenContext !== 'refinement' ? (
              <View style={styles.greetingCard}>
                <View style={styles.greetingAccent} />
                <Text style={styles.greetingText}>{getGreeting()}</Text>
              </View>
            ) : null}

            {renderContextContent()}

            {screenContext !== 'profile_reminder' && screenContext !== 'refinement' && insightsReady ? (
              insights.length > 0 ? (
                <>
                  <View style={styles.sectionLabelRow}>
                    <Feather name="bar-chart-2" size={13} color={ACCENT} />
                    <Text style={styles.sectionLabel}>Your Insights</Text>
                  </View>
                  {insights.map(insight => (
                    <InsightCard
                      key={insight.id}
                      icon={insight.icon}
                      title={insight.title}
                      body={insight.body}
                      id={insight.id}
                      onFeedback={handleFeedback}
                      actionChip={insight.actionChip}
                      urgencyValue={insight.urgencyValue}
                      onTap={insight.onTap}
                      isRecalculating={recalculating.has(insight.id)}
                    />
                  ))}
                </>
              ) : (
                <View style={styles.emptyInsightsContainer}>
                  <Feather name="inbox" size={24} color="rgba(255,255,255,0.25)" />
                  <Text style={styles.emptyInsightsText}>No new insights right now. Keep using the app and check back soon.</Text>
                </View>
              )
            ) : null}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>

          {toastMessage ? (
            <RNAnimated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </RNAnimated.View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  contextPillText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  greetingCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,107,91,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  greetingAccent: {
    width: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
    flexShrink: 0,
  },
  greetingText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  contextTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  contextBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 19,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  strengthTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(46,204,113,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  strengthText: {
    color: GREEN,
    fontSize: 11,
    maxWidth: 180,
  },
  concernTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(231,76,60,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  concernText: {
    color: '#e74c3c',
    fontSize: 11,
    maxWidth: 180,
  },
  chipsContainer: {
    gap: 8,
    marginTop: 10,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  chipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  actionChipText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipsRow: {
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  aiSectionWrap: {
    marginTop: 4,
  },
  aiSectionSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
    marginBottom: 12,
    marginTop: 4,
  },
  aiSuggestionList: {
    gap: 8,
  },
  aiSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  aiSuggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiSuggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  aiFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  aiFeedbackLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    marginRight: 2,
  },
  aiFeedbackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupStat: {
    alignItems: 'center',
    flex: 1,
  },
  groupStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  groupStatLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
  },
  memberTraits: {
    gap: 6,
    marginTop: 4,
  },
  memberTraitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  memberName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  memberDetail: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },
  profileStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  profileStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  profileStatValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  profileStatLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
  },
  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  upgradeNudgeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  thumbsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  thumbBtn: {
    padding: 4,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  insightIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  insightBody: {
    flex: 1,
    gap: 4,
  },
  insightTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  insightDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 19,
  },
  insightRight: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    flexShrink: 0,
  },
  insightFeedback: {
    gap: 8,
    alignItems: 'center',
  },
  breakdownContainer: {
    marginTop: 10,
    marginBottom: 6,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    width: 52,
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: 6,
    borderRadius: 3,
  },
  breakdownPct: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    width: 28,
    textAlign: 'right',
  },
  reminderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  reminderChipText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  reminderGapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: 8,
  },
  reminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderGapLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  reminderGapImpact: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 16,
  },
  reminderFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reminderFixText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  reminderCompletionBar: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: 8,
  },
  reminderProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  reminderProgressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  refinementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  refinementChipText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  refinementBubble: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  refinementBubbleText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  refinementOptions: {
    gap: 8,
  },
  refinementOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 14,
    gap: 10,
    overflow: 'hidden',
  },
  refinementOptionFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderRadius: 14,
  },
  refinementOptionEmoji: {
    fontSize: 20,
  },
  refinementOptionLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  refinementNotNow: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  refinementNotNowText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
  emptyInsightsContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 8,
  },
  emptyInsightsText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    left: 24,
    right: 24,
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
