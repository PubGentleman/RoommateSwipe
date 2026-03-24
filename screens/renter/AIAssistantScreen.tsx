import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { sendAIMessage, createSessionId } from '../../utils/aiService';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { StorageService } from '../../utils/storage';

type AIMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestions?: string[];
  isWelcome?: boolean;
};

type AIAssistantScreenProps = {
  navigation: any;
};

const QUICK_ACTIONS = [
  { icon: 'search' as const, label: 'Find my best\nmatches today', action: 'best_matches' },
  { icon: 'trending-up' as const, label: 'Improve my\nprofile', action: 'improve_profile' },
  { icon: 'map-pin' as const, label: 'Best neighborhoods\nfor my budget', action: 'neighborhoods' },
  { icon: 'calendar' as const, label: 'Plan my\nmove-in timeline', action: 'timeline' },
];

const QUICK_ACTION_PROMPTS: Record<string, string> = {
  best_matches: 'Based on my profile, who should I be swiping right on today and why?',
  improve_profile: 'What changes to my profile would get me the most matches?',
  neighborhoods: 'What neighborhoods in NYC fit my budget and lifestyle best?',
  timeline: 'Help me plan a realistic move-in timeline based on when I need to be moved in.',
};

const PROFILE_FIELDS = [
  'sleep_schedule', 'cleanliness', 'smoking', 'pets',
  'move_in_date', 'budget_max', 'preferred_trains', 'apartment_prefs_complete',
] as const;

function calculateProfileCompletion(profileData: any): number {
  if (!profileData) return 0;
  const fields = [
    profileData.sleep_schedule,
    profileData.cleanliness,
    profileData.smoking,
    profileData.pets,
    profileData.move_in_date,
    profileData.budget_max,
    profileData.preferred_trains?.length > 0,
    profileData.apartment_prefs_complete,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getOpeningMessage(completion: number, userName: string): string {
  if (completion === 0) {
    return `Hey ${userName}! I'm your Rhome AI assistant. I'll help you find the perfect roommates and apartment. To get started, what's your budget for rent each month?`;
  } else if (completion < 50) {
    return `Welcome back ${userName}! Your profile is ${completion}% complete. The more I know about you, the better your matches will be. What trains do you take for work?`;
  } else if (completion < 100) {
    return `Hey ${userName}! Almost there \u2014 your profile is ${completion}% done. Let me ask you one more thing so I can give you better matches.`;
  }
  return `Hey ${userName}! Your profile looks great — you're all set to find your perfect roommate. Ask me anything: who to swipe on, which neighborhoods fit your budget, how to stand out to hosts, or what to ask when you meet someone.`;
}

export const AIAssistantScreen = ({ navigation }: AIAssistantScreenProps) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const sessionId = useRef(createSessionId());
  const prevCompletion = useRef<number>(0);
  const { showToast } = useNotificationContext();

  const checkProfileCompletion = async () => {
    if (!user) return 0;
    try {
      const profiles = await StorageService.getRoommateProfiles();
      const myProfile = profiles.find(p => p.id === user.id);
      const profileData = myProfile?.profileData ?? myProfile?.preferences ?? {};
      const lifestyle = myProfile?.lifestyle ?? {};
      const combined = {
        sleep_schedule: lifestyle.workSchedule ?? profileData.sleep_schedule,
        cleanliness: lifestyle.cleanliness ?? profileData.cleanliness,
        smoking: lifestyle.smoking ?? profileData.smoking,
        pets: lifestyle.pets ?? profileData.pets,
        move_in_date: myProfile?.preferences?.moveInDate ?? profileData.move_in_date,
        budget_max: myProfile?.budget ?? profileData.budget_max,
        preferred_trains: profileData.preferred_trains,
        apartment_prefs_complete: profileData.apartment_prefs_complete,
      };
      const pct = calculateProfileCompletion(combined);
      setProfileCompletion(pct);
      return pct;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    checkProfileCompletion().then(pct => {
      prevCompletion.current = pct;
      const userName = user?.name?.split(' ')[0] || 'there';
      const welcomeMessage: AIMessage = {
        id: 'welcome',
        text: getOpeningMessage(pct, userName),
        isUser: false,
        timestamp: new Date(),
        isWelcome: pct >= 100,
      };
      setMessages([welcomeMessage]);
    });
  }, []);

  useEffect(() => {
    if (profileCompletion !== null && profileCompletion > prevCompletion.current) {
      showToast({
        id: `profile_update_${Date.now()}`,
        title: 'Profile Updated',
        body: 'Your profile info was saved from the conversation',
        type: 'system',
      });
      prevCompletion.current = profileCompletion;
    }
  }, [profileCompletion]);

  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;
    if (!user) return;

    const userMessage: AIMessage = {
      id: `user_${Date.now()}`,
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    const aiMessageId = `ai_${Date.now()}`;
    const aiMessage: AIMessage = {
      id: aiMessageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMessage]);

    try {
      await sendAIMessage(
        messageText,
        sessionId.current,
        (delta: string) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, text: m.text + delta } : m
          ));
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        },
        (remaining: number, _plan: string) => {
          setIsTyping(false);
          if (remaining <= 3) {
            setLimitWarning(`${remaining} AI message${remaining !== 1 ? 's' : ''} remaining today`);
          }
        },
      );

      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      await checkProfileCompletion();
    } catch {
      setIsTyping(false);
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId
          ? { ...m, text: 'Something went wrong. Please try again.' }
          : m
      ));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleQuickAction = (action: string) => {
    const prompt = QUICK_ACTION_PROMPTS[action];
    if (prompt) {
      handleSend(prompt);
    }
  };

  const renderMessage = ({ item }: { item: AIMessage }) => {
    if (item.isUser) {
      return (
        <View style={styles.messageWrapper}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messageWrapper}>
        <View style={styles.messageRow}>
          <LinearGradient colors={['#ff6b5b', '#ff8c7a']} style={styles.msgAvatar}>
            <Feather name="cpu" size={12} color="#fff" />
          </LinearGradient>
          <View style={styles.aiBubble}>
            <Text style={styles.aiBubbleText}>{item.text}</Text>
          </View>
        </View>

        {item.isWelcome ? (
          <View style={styles.quickActionsWrap}>
            <Text style={styles.quickActionsLabel}>Quick actions</Text>
            <View style={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map((qa) => (
                <Pressable
                  key={qa.action}
                  style={styles.quickCard}
                  onPress={() => handleQuickAction(qa.action)}
                >
                  <View style={styles.quickCardIcon}>
                    <Feather name={qa.icon} size={18} color="#ff6b5b" />
                  </View>
                  <Text style={styles.quickCardText}>{qa.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {item.suggestions && item.suggestions.length > 0 && !item.isWelcome ? (
          <View style={styles.suggestionsContainer}>
            {item.suggestions.map((suggestion, index) => (
              <Pressable
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleSend(suggestion)}
              >
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.aiHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.aiBackBtn}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <LinearGradient colors={['#ff6b5b', '#ff8c7a']} style={styles.aiAvatarCircle}>
          <Feather name="cpu" size={18} color="#fff" />
        </LinearGradient>
        <View style={styles.aiTitleWrap}>
          <View style={styles.aiTitleRow}>
            <Text style={styles.aiTitle}>AI Match Assistant</Text>
            <View style={styles.premiumBadge}>
              <Feather name="zap" size={9} color="#a855f7" />
              <Text style={styles.premiumBadgeText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.aiSubtitle}>Powered by Rhome AI</Text>
        </View>
      </View>

      {profileCompletion !== null && profileCompletion < 100 ? (
        <View style={styles.completionBanner}>
          <View style={styles.completionBarTrack}>
            <View style={[styles.completionBarFill, { width: `${profileCompletion}%` }]} />
          </View>
          <Text style={styles.completionText}>
            Profile {profileCompletion}% complete {profileCompletion < 100 ? '\u2014 chat with me to finish it' : ''}
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {isTyping ? (
        <View style={styles.typingRow}>
          <LinearGradient colors={['#ff6b5b', '#ff8c7a']} style={styles.msgAvatar}>
            <Feather name="cpu" size={12} color="#fff" />
          </LinearGradient>
          <View style={styles.aiBubble}>
            <Text style={[styles.aiBubbleText, { color: 'rgba(255,255,255,0.4)' }]}>Thinking...</Text>
          </View>
        </View>
      ) : null}

      {limitWarning ? (
        <View style={styles.limitWarningBar}>
          <Feather name="alert-circle" size={12} color="#f59e0b" />
          <Text style={styles.limitWarningText}>{limitWarning}</Text>
        </View>
      ) : null}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask me anything..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isTyping}
        >
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  aiBackBtn: {
    padding: 4,
  },
  aiAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitleWrap: {
    flex: 1,
    gap: 2,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
  aiSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  completionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  completionBarTrack: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: 4,
    backgroundColor: '#ff6b5b',
    borderRadius: 2,
  },
  completionText: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  messagesList: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  messageWrapper: {
    marginBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  aiBubble: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  aiBubbleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#ff6b5b',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '78%',
    marginRight: 16,
    marginTop: 10,
  },
  userBubbleText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginLeft: 54,
    paddingRight: 16,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  quickActionsWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    marginLeft: 38,
  },
  quickActionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  quickCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  inputField: {
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,107,91,0.3)',
  },
  limitWarningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.2)',
  },
  limitWarningText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
});
