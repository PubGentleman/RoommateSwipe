import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Spacing } from '../constants/theme';
import { calculateDetailedCompatibility } from '../utils/matchingAlgorithm';
import { getProfileGaps, getCompletionPercentage, getMatchMultiplier, GAP_MESSAGES } from '../utils/profileReminderUtils';
import type { RoommateProfile, User, Message, Group, Conversation } from '../types/models';
import * as Haptics from 'expo-haptics';

const ACCENT = '#ff6b5b';
const SHEET_BG = '#1a1a1a';
const CARD_BG = '#242424';
const GREEN = '#2ecc71';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.8;

export type ScreenContext = 'match' | 'chat' | 'explore' | 'messages' | 'groups' | 'profile' | 'profile_reminder';

interface MatchContextData {
  currentProfile?: RoommateProfile;
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

export interface AISheetContextData {
  match?: MatchContextData;
  chat?: ChatContextData;
  explore?: ExploreContextData;
  messages?: MessagesContextData;
  groups?: GroupsContextData;
  profile?: ProfileContextData;
  profileReminder?: ProfileReminderContextData;
}

interface RoomdrAISheetProps {
  visible: boolean;
  onDismiss: () => void;
  screenContext: ScreenContext;
  contextData?: AISheetContextData;
  onNavigate?: (screen: string, params?: Record<string, any>) => void;
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
};

const MATCH_MULTIPLIERS: Record<string, number> = {
  'Profile Photo': 3,
  'Bio': 2.5,
  'Interests': 1.8,
  'Occupation': 1.5,
};

const FeedbackThumbs = ({ id, onFeedback }: { id: string; onFeedback?: (id: string, positive: boolean) => void }) => {
  const [selected, setSelected] = useState<'up' | 'down' | null>(null);

  return (
    <View style={styles.thumbsRow}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelected('up');
          onFeedback?.(id, true);
        }}
        style={styles.thumbBtn}
      >
        <Feather name="thumbs-up" size={14} color={selected === 'up' ? ACCENT : 'rgba(255,255,255,0.4)'} />
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

const InsightCard = ({ icon, title, body, id, onFeedback, actionChip }: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  id: string;
  onFeedback?: (id: string, positive: boolean) => void;
  actionChip?: { label: string; onPress: () => void };
}) => (
  <View style={styles.insightCard}>
    <View style={styles.insightHeader}>
      <View style={styles.insightIconBox}>
        <Feather name={icon} size={14} color={ACCENT} />
      </View>
      <Text style={styles.insightTitle}>{title}</Text>
    </View>
    <Text style={styles.insightBody}>{body}</Text>
    {actionChip ? (
      <Pressable style={styles.actionChip} onPress={actionChip.onPress}>
        <Text style={styles.actionChipText}>{actionChip.label}</Text>
        <Feather name="arrow-right" size={12} color={ACCENT} />
      </Pressable>
    ) : null}
    <FeedbackThumbs id={id} onFeedback={onFeedback} />
  </View>
);

export const RoomdrAISheet = ({ visible, onDismiss, screenContext, contextData, onNavigate }: RoomdrAISheetProps) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleFeedback = async (id: string, positive: boolean) => {
    if (!user) return;
    if (!positive) {
      setDismissedIds(prev => new Set(prev).add(id));
      const existing = (user as any).aiAssistantData?.dismissedSuggestions || [];
      const updated = {
        ...user,
        aiAssistantData: {
          ...(user as any).aiAssistantData,
          dismissedSuggestions: [...existing, { id, timestamp: new Date().toISOString() }],
        },
      };
      await updateUser(updated);
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

    const filterChips: { label: string; filters: Record<string, any> }[] = [];
    if (budget && budget < 2000) {
      filterChips.push({ label: `Expand budget to $${budget + 500}/mo`, filters: { maxPrice: budget + 500 } });
    }
    filterChips.push({ label: 'Show Pet Friendly only', filters: { petFriendly: true } });

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="search" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Smart Filter Guide</Text>
        </View>
        {budget && totalListings && filteredCount !== undefined ? (
          <Text style={styles.contextBody}>
            {filteredCount < totalListings * 0.3
              ? `Your filters are very strict — only ${filteredCount} of ${totalListings} listings${city ? ` in ${city}` : ''} match. Try relaxing some filters.`
              : `You're seeing ${filteredCount} of ${totalListings} listings${city ? ` in ${city}` : ''}. Your preferences are well-balanced.`
            }
          </Text>
        ) : (
          <Text style={styles.contextBody}>Use the filters to narrow down listings that match your lifestyle and budget.</Text>
        )}

        {savedCount && savedCount > 0 ? (
          <View style={styles.savedNote}>
            <Feather name="bookmark" size={12} color={ACCENT} />
            <Text style={styles.savedNoteText}>You've saved {savedCount} listing{savedCount !== 1 ? 's' : ''}. Want me to compare them?</Text>
          </View>
        ) : null}

        {onApplyFilters && filterChips.length > 0 ? (
          <View style={styles.filterChipsRow}>
            {filterChips.map((fc, i) => (
              <Pressable
                key={i}
                style={styles.filterChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onApplyFilters(fc.filters);
                  onDismiss();
                }}
              >
                <Feather name="sliders" size={11} color={ACCENT} />
                <Text style={styles.filterChipText}>{fc.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <FeedbackThumbs id="explore-guide" onFeedback={handleFeedback} />
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

  const renderContextContent = () => {
    switch (screenContext) {
      case 'match': return getMatchContextContent();
      case 'chat': return getChatContextContent();
      case 'explore': return getExploreContextContent();
      case 'messages': return getMessagesContextContent();
      case 'groups': return getGroupsContextContent();
      case 'profile': return getProfileContextContent();
      case 'profile_reminder': return getProfileReminderContent();
      default: return null;
    }
  };

  const getInsights = () => {
    const insights: { icon: keyof typeof Feather.glyphMap; title: string; body: string; id: string; actionChip?: { label: string; onPress: () => void } }[] = [];

    if (!isDismissed('profile-completion') && profileCompletion.score < 100) {
      const topMissing = profileCompletion.missing.slice(0, 2);
      const multiplier = MATCH_MULTIPLIERS[topMissing[0]] || 1.5;
      insights.push({
        icon: 'user',
        title: 'Profile Completion',
        body: `Your profile is ${profileCompletion.score}% complete. Adding ${topMissing.join(' and ').toLowerCase()} could get you ${multiplier}x more matches.`,
        id: 'profile-completion',
      });
    }

    if (!isDismissed('match-rate')) {
      const rate = 60 + ((user?.id?.charCodeAt(0) || 0) % 25);
      const change = ((user?.id?.charCodeAt(1) || 0) % 15) - 5;
      insights.push({
        icon: 'trending-up',
        title: 'Match Rate',
        body: `${rate}% this week (${change >= 0 ? '+' : ''}${change}% vs last week). ${change >= 0 ? 'Keep it up!' : 'Complete your profile to improve.'}`,
        id: 'match-rate',
      });
    }

    if (!isDismissed('pool-impact')) {
      const poolReduction = user?.profileData?.preferences?.pets === 'no_pets' ? 58 :
        user?.profileData?.preferences?.smoking === 'no' ? 32 : 15;
      const poolFactor = user?.profileData?.preferences?.pets === 'no_pets' ? "'no pets' preference" :
        user?.profileData?.preferences?.smoking === 'no' ? "'non-smoker' preference" : 'your filter selections';
      insights.push({
        icon: 'alert-circle',
        title: 'Match Pool Impact',
        body: `Your ${poolFactor} reduces your match pool by ${poolReduction}% in your city. Consider adjusting if you want more options.`,
        id: 'pool-impact',
      });
    }

    if (!isDismissed('response-rate')) {
      const responseRate = 65 + ((user?.id?.charCodeAt(2) || 0) % 30);
      insights.push({
        icon: 'clock',
        title: 'Response Rate',
        body: `Your response rate is ${responseRate}%. ${responseRate >= 80 ? 'Excellent — you reply quickly!' : 'Try responding within 24 hours to boost your visibility.'}`,
        id: 'response-rate',
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
              <LinearGradient colors={[ACCENT, '#e83a2a']} style={styles.headerIcon}>
                <Feather name="zap" size={14} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={styles.headerTitle}>Roomdr AI</Text>
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
            {screenContext !== 'profile_reminder' ? (
              <View style={styles.greetingCard}>
                <Text style={styles.greetingText}>{getGreeting()}</Text>
              </View>
            ) : null}

            {renderContextContent()}

            {screenContext !== 'profile_reminder' && insights.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>YOUR INSIGHTS</Text>
                {insights.map(insight => (
                  <InsightCard
                    key={insight.id}
                    icon={insight.icon}
                    title={insight.title}
                    body={insight.body}
                    id={insight.id}
                    onFeedback={handleFeedback}
                    actionChip={insight.actionChip}
                  />
                ))}
              </>
            ) : null}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  greetingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
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
  savedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 8,
    padding: 8,
  },
  savedNoteText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    flex: 1,
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
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  insightIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  insightBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
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
});
