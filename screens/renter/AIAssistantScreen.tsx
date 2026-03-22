import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { sendAIMessage, createSessionId } from '../../utils/aiService';

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
  { icon: 'users' as const, label: 'Find roommates\nin my budget', action: 'budget' },
  { icon: 'star' as const, label: 'Zodiac\ncompatibility', action: 'zodiac' },
  { icon: 'map-pin' as const, label: 'Best neighborhoods\nfor me', action: 'hoods' },
  { icon: 'coffee' as const, label: 'Restaurant\nrecommendations', action: 'food' },
];

const QUICK_ACTION_PROMPTS: Record<string, string> = {
  budget: 'Find me roommates within my budget',
  zodiac: 'Check my zodiac compatibility with potential roommates',
  hoods: 'What are the best neighborhoods for me?',
  food: 'Recommend some restaurants near my area',
};

export const AIAssistantScreen = ({ navigation }: AIAssistantScreenProps) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const sessionId = useRef(createSessionId());

  useEffect(() => {
    sendWelcomeMessage();
  }, []);

  const sendWelcomeMessage = () => {
    const userName = user?.name?.split(' ')[0] || 'there';
    const welcomeMessage: AIMessage = {
      id: 'welcome',
      text: `Hi ${userName}! I'm your AI Match Assistant. I can help you find roommates, discover great neighborhoods, recommend restaurants, suggest activities, analyze zodiac compatibility, and give home decor tips.\n\nWhat would you like to explore?`,
      isUser: false,
      timestamp: new Date(),
      isWelcome: true,
    };
    setMessages([welcomeMessage]);
  };

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

    try {
      const { reply, remainingMessages } = await sendAIMessage(
        messageText,
        sessionId.current
      );

      setMessages(prev => [...prev, {
        id: `ai_${Date.now()}`,
        text: reply,
        isUser: false,
        timestamp: new Date(),
      }]);

      if (remainingMessages <= 2) {
        setLimitWarning(`${remainingMessages} message${remainingMessages !== 1 ? 's' : ''} left today`);
      }

      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      const errorResponse: AIMessage = {
        id: `ai_error_${Date.now()}`,
        text: `I'm having trouble connecting right now. Please check your internet connection and try again in a moment.`,
        isUser: false,
        timestamp: new Date(),
        suggestions: ['Try again'],
      };
      setMessages(prev => [...prev, errorResponse]);
      setIsTyping(false);
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
          <Text style={styles.aiSubtitle}>Powered by RoomDrx AI</Text>
        </View>
      </View>

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
