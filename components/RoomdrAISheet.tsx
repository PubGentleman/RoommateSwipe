import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Spacing, BorderRadius } from '../constants/theme';
import { calculateDetailedCompatibility } from '../utils/matchingAlgorithm';
import type { RoommateProfile, User, Message } from '../types/models';
import * as Haptics from 'expo-haptics';

const ACCENT = '#ff6b5b';
const SHEET_BG = '#1a1a1a';
const CARD_BG = '#242424';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.8;

type ScreenContext = 'match' | 'chat' | 'explore' | 'messages';

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
  onApplyFilters?: (filters: Record<string, any>) => void;
}

export interface AISheetContextData {
  match?: MatchContextData;
  chat?: ChatContextData;
  explore?: ExploreContextData;
}

interface RoomdrAISheetProps {
  visible: boolean;
  onDismiss: () => void;
  screenContext: ScreenContext;
  contextData?: AISheetContextData;
}

const PROFILE_FIELDS = [
  { key: 'photo', label: 'Profile Photo', check: (u: User) => !!(u.photos?.length || u.profilePicture) },
  { key: 'bio', label: 'Bio', check: (u: User) => !!(u.profileData?.bio && u.profileData.bio.trim().length > 0) },
  { key: 'birthday', label: 'Birthday', check: (u: User) => !!u.birthday },
  { key: 'budget', label: 'Budget', check: (u: User) => !!(u.profileData?.budget && u.profileData.budget > 0) },
  { key: 'location', label: 'Location', check: (u: User) => !!(u.profileData?.city || u.profileData?.neighborhood) },
  { key: 'occupation', label: 'Occupation', check: (u: User) => !!(u.profileData?.occupation) },
  { key: 'interests', label: 'Interests', check: (u: User) => !!(u.profileData?.interests) },
  { key: 'sleepSchedule', label: 'Sleep Schedule', check: (u: User) => !!u.profileData?.preferences?.sleepSchedule },
  { key: 'cleanliness', label: 'Cleanliness', check: (u: User) => !!u.profileData?.preferences?.cleanliness },
  { key: 'smoking', label: 'Smoking Pref', check: (u: User) => !!u.profileData?.preferences?.smoking },
];

const getGreeting = (context: ScreenContext): string => {
  switch (context) {
    case 'match':
      return "Let me help you understand your matches better.";
    case 'chat':
      return "Need help with your conversation? I've got you.";
    case 'explore':
      return "I can help you find the perfect place.";
    case 'messages':
      return "Here are some tips to improve your conversations.";
    default:
      return "How can I help you today?";
  }
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

const InsightCard = ({ icon, title, body, id, onFeedback }: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  id: string;
  onFeedback?: (id: string, positive: boolean) => void;
}) => (
  <View style={styles.insightCard}>
    <View style={styles.insightHeader}>
      <View style={styles.insightIconBox}>
        <Feather name={icon} size={14} color={ACCENT} />
      </View>
      <Text style={styles.insightTitle}>{title}</Text>
    </View>
    <Text style={styles.insightBody}>{body}</Text>
    <FeedbackThumbs id={id} onFeedback={onFeedback} />
  </View>
);

export const RoomdrAISheet = ({ visible, onDismiss, screenContext, contextData }: RoomdrAISheetProps) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [suggestedMessages, setSuggestedMessages] = useState<string[]>([]);

  const handleFeedback = async (id: string, positive: boolean) => {
    if (!user || positive) return;
    const existing = (user as any).aiAssistantData?.dismissedSuggestions || [];
    const updated = {
      ...user,
      aiAssistantData: {
        ...(user as any).aiAssistantData,
        dismissedSuggestions: [...existing, { id, timestamp: new Date().toISOString() }],
      },
    };
    await updateUser(updated);
  };

  const getProfileCompletion = () => {
    if (!user) return { score: 0, missing: [] as string[] };
    let completed = 0;
    const missing: string[] = [];
    PROFILE_FIELDS.forEach(f => {
      if (f.check(user)) completed++;
      else missing.push(f.label);
    });
    return { score: Math.round((completed / PROFILE_FIELDS.length) * 100), missing };
  };

  const getMatchContextContent = () => {
    if (!user || !contextData?.match?.currentProfile) return null;
    const profile = contextData.match.currentProfile;
    const detailed = calculateDetailedCompatibility(user, profile);
    const score = Math.round(detailed.totalScore);
    const { strengths, concerns } = detailed.reasons;

    const topStrengths = strengths.slice(0, 3);
    const topConcerns = concerns.slice(0, 2);

    let analysis = `${profile.name} scored ${score}%`;
    if (topStrengths.length > 0) {
      analysis += ` — ${topStrengths[0]}`;
    }
    if (topConcerns.length > 0) {
      analysis += `. However, ${topConcerns[0].toLowerCase()}`;
    }
    analysis += '.';

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
          <Text style={styles.contextTitle}>Match Analysis</Text>
        </View>
        <Text style={styles.contextBody}>{analysis}</Text>

        <View style={styles.breakdownContainer}>
          {topFactors.map(([key, value]) => {
            const info = breakdownLabels[key];
            if (!info) return null;
            const pct = Math.round((value / info.max) * 100);
            return (
              <View key={key} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{info.label}</Text>
                <View style={styles.breakdownBarBg}>
                  <View style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: pct >= 70 ? '#2ecc71' : pct >= 40 ? '#f1c40f' : '#e74c3c' }]} />
                </View>
                <Text style={styles.breakdownPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {topStrengths.length > 0 ? (
          <View style={styles.tagRow}>
            {topStrengths.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.strengthTag}>
                <Feather name="check" size={10} color="#2ecc71" />
                <Text style={styles.strengthText} numberOfLines={1}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {topConcerns.length > 0 ? (
          <View style={styles.tagRow}>
            {topConcerns.slice(0, 2).map((c, i) => (
              <View key={i} style={styles.concernTag}>
                <Feather name="alert-circle" size={10} color="#e74c3c" />
                <Text style={styles.concernText} numberOfLines={1}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <FeedbackThumbs id="match-analysis" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getChatContextContent = () => {
    if (!contextData?.chat) return null;
    const { otherUserName, otherUserProfile, messages, onSuggestMessage } = contextData.chat;
    const name = otherUserName || 'them';

    let tip = '';
    const chips: string[] = [];

    if (!messages || messages.length === 0) {
      tip = `Start the conversation with ${name}! Here are some ice-breakers based on their profile.`;
      if (otherUserProfile?.occupation) {
        chips.push(`Hey ${name}! I see you work as ${otherUserProfile.occupation.toLowerCase().startsWith('a') || otherUserProfile.occupation.toLowerCase().startsWith('e') ? 'an' : 'a'} ${otherUserProfile.occupation}. How do you like the work schedule?`);
      }
      chips.push(`Hi ${name}! I'm looking for a roommate in the area. What's your ideal living situation?`);
      chips.push(`Hey! What's your typical day like? I'm trying to find someone with a compatible schedule.`);
    } else {
      const lastMsg = messages[messages.length - 1];
      const lastTime = new Date(lastMsg.timestamp).getTime();
      const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

      if (hoursSince > 48) {
        tip = `It's been ${Math.round(hoursSince / 24)} days since the last message. A follow-up can revive the conversation!`;
        chips.push(`Hey ${name}, just checking in! Are you still looking for a roommate?`);
        chips.push(`Hi again! I wanted to follow up — would you be free to chat about the living situation?`);
        chips.push(`Hope you're doing well! I'm still interested in rooming together if you are.`);
      } else {
        tip = `Your conversation with ${name} is active. Keep the momentum going!`;
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
        <Text style={styles.contextBody}>{tip}</Text>
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
    const { budget, city, totalListings, filteredCount, onApplyFilters } = contextData.explore;

    let tip = '';
    if (budget && totalListings && filteredCount !== undefined) {
      const eliminatedPct = totalListings > 0 ? Math.round(((totalListings - filteredCount) / totalListings) * 100) : 0;
      if (eliminatedPct > 50) {
        tip = `Your current filters eliminate ${eliminatedPct}% of listings${city ? ` in ${city}` : ''}. `;
        if (budget < 2000) {
          tip += 'Try expanding your budget range or checking nearby neighborhoods for better options.';
        } else {
          tip += 'Consider relaxing some filters to see more options.';
        }
      } else {
        tip = `Great filter setup! You're seeing ${filteredCount} of ${totalListings} listings${city ? ` in ${city}` : ''}. `;
        tip += 'Your preferences are well-balanced.';
      }
    } else {
      tip = 'Use the filters to narrow down listings that match your lifestyle and budget.';
    }

    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="search" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Smart Filter Guide</Text>
        </View>
        <Text style={styles.contextBody}>{tip}</Text>
        {onApplyFilters && budget && budget < 2000 ? (
          <Pressable
            style={styles.applyBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onApplyFilters({ maxPrice: budget + 500 });
              onDismiss();
            }}
          >
            <LinearGradient colors={[ACCENT, '#e83a2a']} style={styles.applyGradient}>
              <Feather name="sliders" size={14} color="#fff" />
              <Text style={styles.applyText}>Apply Suggested Filters</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
        <FeedbackThumbs id="explore-guide" onFeedback={handleFeedback} />
      </View>
    );
  };

  const getMessagesContextContent = () => {
    return (
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Feather name="inbox" size={14} color={ACCENT} />
          <Text style={styles.contextTitle}>Messaging Tips</Text>
        </View>
        <Text style={styles.contextBody}>
          Respond within 24 hours to keep conversations active. Profiles with fast reply rates get 40% more matches. Open a conversation to get personalized message suggestions.
        </Text>
        <FeedbackThumbs id="messages-tips" onFeedback={handleFeedback} />
      </View>
    );
  };

  const renderContextContent = () => {
    switch (screenContext) {
      case 'match': return getMatchContextContent();
      case 'chat': return getChatContextContent();
      case 'explore': return getExploreContextContent();
      case 'messages': return getMessagesContextContent();
      default: return null;
    }
  };

  const profileCompletion = getProfileCompletion();

  const matchRateThisWeek = Math.floor(Math.random() * 20) + 60;
  const matchRateLastWeek = Math.floor(Math.random() * 20) + 50;
  const matchRateChange = matchRateThisWeek - matchRateLastWeek;

  const responseRate = Math.floor(Math.random() * 30) + 65;

  const poolReduction = user?.profileData?.preferences?.pets === 'no_pets' ? 58 : 
    user?.profileData?.preferences?.smoking === 'no' ? 32 : 15;
  const poolFactor = user?.profileData?.preferences?.pets === 'no_pets' ? "'no pets' preference" :
    user?.profileData?.preferences?.smoking === 'no' ? "'non-smoker' preference" : 'your filter selections';

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
              <Text style={styles.headerTitle}>Roomdr AI</Text>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.greetingCard}>
              <Text style={styles.greetingText}>{getGreeting(screenContext)}</Text>
            </View>

            {renderContextContent()}

            <Text style={styles.sectionLabel}>YOUR INSIGHTS</Text>

            <InsightCard
              icon="user"
              title="Profile Completion"
              body={profileCompletion.score === 100
                ? 'Your profile is 100% complete. Great job!'
                : `Your profile is ${profileCompletion.score}% complete. Add ${profileCompletion.missing.slice(0, 2).join(' and ')} to get more matches.`
              }
              id="profile-completion"
              onFeedback={handleFeedback}
            />

            <InsightCard
              icon="trending-up"
              title="Match Rate"
              body={`${matchRateThisWeek}% this week (${matchRateChange >= 0 ? '+' : ''}${matchRateChange}% vs last week). ${matchRateChange >= 0 ? 'Keep it up!' : 'Complete your profile to improve.'}`}
              id="match-rate"
              onFeedback={handleFeedback}
            />

            <InsightCard
              icon="alert-circle"
              title="Match Pool Impact"
              body={`Your ${poolFactor} reduces your match pool by ${poolReduction}% in your city. Consider adjusting if you want more options.`}
              id="pool-impact"
              onFeedback={handleFeedback}
            />

            <InsightCard
              icon="clock"
              title="Response Rate"
              body={`Your response rate is ${responseRate}%. ${responseRate >= 80 ? 'Excellent — you reply quickly!' : 'Try responding within 24 hours to boost your visibility.'}`}
              id="response-rate"
              onFeedback={handleFeedback}
            />

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
    color: '#2ecc71',
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
  applyBtn: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  applyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  applyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
});
