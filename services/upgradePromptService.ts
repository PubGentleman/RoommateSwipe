import AsyncStorage from '@react-native-async-storage/async-storage';

export type UpgradeContext =
  | 'message_limit_approaching'
  | 'message_limit_reached'
  | 'chat_limit_reached'
  | 'cold_message_limit'
  | 'swipe_limit_approaching'
  | 'swipe_limit_reached'
  | 'listing_limit_reached'
  | 'boost_unavailable'
  | 'analytics_locked'
  | 'feature_locked'
  | 'group_limit_reached'
  | 'filter_locked'
  | 'who_liked_locked'
  | 'match_breakdown_locked'
  | 'outreach_limit'
  | 'pi_limit_reached';

export interface UpgradePromptData {
  context: UpgradeContext;
  title: string;
  message: string;
  stat?: string;
  statProgress?: number;
  benefit: string;
  recommendedPlan: string;
  urgency: 'low' | 'medium' | 'high';
  ctaText: string;
  dismissible: boolean;
}

const PROMPT_HISTORY_KEY = 'upgrade_prompt_history';
const MAX_PROMPTS_PER_DAY = 3;
const COOLDOWN_HOURS = 4;

interface PromptHistoryEntry {
  context: UpgradeContext;
  shownAt: string;
  dismissed: boolean;
}

export async function shouldShowUpgradePrompt(context: UpgradeContext): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PROMPT_HISTORY_KEY);
    const history: PromptHistoryEntry[] = raw ? JSON.parse(raw) : [];

    const today = new Date().toISOString().substring(0, 10);
    const todayEntries = history.filter(h => h.shownAt.startsWith(today));

    if (todayEntries.length >= MAX_PROMPTS_PER_DAY) return false;

    const lastSame = history
      .filter(h => h.context === context)
      .sort((a, b) => b.shownAt.localeCompare(a.shownAt))[0];

    if (lastSame) {
      const hoursSince = (Date.now() - new Date(lastSame.shownAt).getTime()) / 3600000;
      if (hoursSince < COOLDOWN_HOURS) return false;
    }

    return true;
  } catch {
    return true;
  }
}

export async function recordPromptShown(context: UpgradeContext, dismissed: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PROMPT_HISTORY_KEY);
    const history: PromptHistoryEntry[] = raw ? JSON.parse(raw) : [];

    history.push({ context, shownAt: new Date().toISOString(), dismissed });

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const trimmed = history.filter(h => h.shownAt > weekAgo);

    await AsyncStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function getUpgradePromptData(
  context: UpgradeContext,
  currentPlan: string,
  usageStats?: { used: number; limit: number }
): UpgradePromptData {
  const isRenter = ['basic', 'free', 'plus', 'elite'].includes(currentPlan);

  switch (context) {
    case 'message_limit_approaching':
      return {
        context,
        title: 'Running low on messages',
        message: `You've used ${usageStats?.used || 0} of your ${usageStats?.limit || 20} daily messages.`,
        stat: `${usageStats?.used}/${usageStats?.limit} messages`,
        statProgress: usageStats ? usageStats.used / usageStats.limit : 0.8,
        benefit: isRenter
          ? 'Plus gives you 200 messages/day. Elite gives you unlimited.'
          : 'Upgrade for more daily outreach capacity.',
        recommendedPlan: isRenter ? 'plus' : 'starter',
        urgency: 'medium',
        ctaText: 'Get More Messages',
        dismissible: true,
      };

    case 'message_limit_reached':
      return {
        context,
        title: 'Daily message limit reached',
        message: `You've sent all ${usageStats?.limit || 20} messages for today. Messages reset at midnight.`,
        stat: `${usageStats?.limit}/${usageStats?.limit} used`,
        statProgress: 1,
        benefit: isRenter
          ? (currentPlan === 'plus' ? 'Elite: Unlimited messages' : 'Plus: 200/day  |  Elite: Unlimited')
          : 'Upgrade to increase your daily limit.',
        recommendedPlan: isRenter ? (currentPlan === 'plus' ? 'elite' : 'plus') : 'pro',
        urgency: 'high',
        ctaText: 'Upgrade Now',
        dismissible: true,
      };

    case 'chat_limit_reached':
      return {
        context,
        title: 'Active chat limit reached',
        message: 'You\'ve reached the maximum number of active conversations on your plan.',
        stat: `${usageStats?.limit}/${usageStats?.limit} chats`,
        statProgress: 1,
        benefit: 'Upgrade to chat with more people at once.',
        recommendedPlan: isRenter ? 'plus' : 'starter',
        urgency: 'high',
        ctaText: 'Get More Chats',
        dismissible: true,
      };

    case 'swipe_limit_reached':
      return {
        context,
        title: 'No more swipes today',
        message: `You've used all ${usageStats?.limit || 10} swipes for today.`,
        stat: `${usageStats?.limit}/${usageStats?.limit} swipes`,
        statProgress: 1,
        benefit: 'Plus & Elite give you unlimited swipes every day.',
        recommendedPlan: 'plus',
        urgency: 'high',
        ctaText: 'Get Unlimited Swipes',
        dismissible: true,
      };

    case 'swipe_limit_approaching':
      return {
        context,
        title: 'Almost out of swipes',
        message: `You have ${(usageStats?.limit || 10) - (usageStats?.used || 0)} swipes left today.`,
        stat: `${usageStats?.used}/${usageStats?.limit} swipes`,
        statProgress: usageStats ? usageStats.used / usageStats.limit : 0.8,
        benefit: 'Upgrade for unlimited daily swipes.',
        recommendedPlan: 'plus',
        urgency: 'medium',
        ctaText: 'Go Unlimited',
        dismissible: true,
      };

    case 'listing_limit_reached':
      return {
        context,
        title: 'Listing limit reached',
        message: `Your ${currentPlan} plan includes ${usageStats?.limit || 1} listing${(usageStats?.limit || 1) > 1 ? 's' : ''}.`,
        stat: `${usageStats?.used}/${usageStats?.limit} listings`,
        statProgress: 1,
        benefit: 'Upgrade for more listings and better placement.',
        recommendedPlan: currentPlan === 'free' ? 'starter' : 'pro',
        urgency: 'high',
        ctaText: 'Add More Listings',
        dismissible: false,
      };

    case 'boost_unavailable':
      return {
        context,
        title: 'Boosts not available on your plan',
        message: 'Boost your listing to get 40-60% more views.',
        benefit: 'Starter includes 1 free boost/month. Pro includes 3.',
        recommendedPlan: 'starter',
        urgency: 'medium',
        ctaText: 'Unlock Boosts',
        dismissible: true,
      };

    case 'analytics_locked':
      return {
        context,
        title: 'Analytics requires Pro',
        message: 'See who\'s viewing your listings, track inquiries, and measure performance.',
        benefit: 'Pro: Basic analytics  |  Business: Advanced analytics with trends.',
        recommendedPlan: 'pro',
        urgency: 'low',
        ctaText: 'Unlock Analytics',
        dismissible: true,
      };

    case 'who_liked_locked':
      return {
        context,
        title: 'See who liked you',
        message: 'Someone liked your profile! Upgrade to see who.',
        benefit: 'Plus shows you who liked your profile so you never miss a match.',
        recommendedPlan: 'plus',
        urgency: 'high',
        ctaText: 'See Who Liked You',
        dismissible: true,
      };

    case 'match_breakdown_locked':
      return {
        context,
        title: 'Unlock compatibility details',
        message: 'See exactly why you matched — lifestyle, budget, location, and more.',
        benefit: 'Plus unlocks detailed match breakdowns for every profile.',
        recommendedPlan: 'plus',
        urgency: 'medium',
        ctaText: 'See Match Details',
        dismissible: true,
      };

    case 'filter_locked':
      return {
        context,
        title: 'Advanced filters',
        message: 'Filter by transit, lifestyle, schedule, and more to find your perfect match.',
        benefit: 'Plus unlocks all advanced filters.',
        recommendedPlan: 'plus',
        urgency: 'low',
        ctaText: 'Unlock Filters',
        dismissible: true,
      };

    case 'outreach_limit':
      return {
        context,
        title: 'Daily outreach limit reached',
        message: `You've used all ${usageStats?.limit || 0} outreach messages for today.`,
        stat: `${usageStats?.limit}/${usageStats?.limit} used`,
        statProgress: 1,
        benefit: 'Upgrade for more daily outreach to potential renters.',
        recommendedPlan: currentPlan === 'starter' ? 'pro' : 'business',
        urgency: 'high',
        ctaText: 'Get More Outreach',
        dismissible: true,
      };

    case 'pi_limit_reached':
      return {
        context,
        title: 'AI features limit reached',
        message: 'You\'ve used your monthly AI matching allowance.',
        benefit: 'Upgrade for more AI-powered matching and recommendations.',
        recommendedPlan: isRenter ? 'elite' : 'pro',
        urgency: 'medium',
        ctaText: 'Get More AI Features',
        dismissible: true,
      };

    default:
      return {
        context: 'feature_locked',
        title: 'Premium feature',
        message: 'This feature requires an upgraded plan.',
        benefit: 'Upgrade to access all premium features.',
        recommendedPlan: isRenter ? 'plus' : 'starter',
        urgency: 'low',
        ctaText: 'Upgrade',
        dismissible: true,
      };
  }
}
