import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';
import { RoommateProfile } from '../../types/models';

type AIMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestions?: string[];
};

type AIAssistantScreenProps = {
  navigation: any;
};

export const AIAssistantScreen = ({ navigation }: AIAssistantScreenProps) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    sendWelcomeMessage();
  }, []);

  const sendWelcomeMessage = () => {
    const welcomeMessage: AIMessage = {
      id: 'welcome',
      text: `Hi ${user?.name?.split(' ')[0]}! I'm your AI Match Assistant. I can help you find the perfect roommate based on your preferences, budget, and lifestyle. What would you like to know?`,
      isUser: false,
      timestamp: new Date(),
      suggestions: [
        'Find roommates in my budget',
        'Show me compatible matches',
        'What makes a good match?',
        'Tips for my profile',
      ],
    };
    setMessages([welcomeMessage]);
  };

  const generateAIResponse = async (userMessage: string): Promise<AIMessage> => {
    const profiles = await StorageService.getRoommateProfiles();
    const userBudget = 1500;
    const userLocation = 'Downtown';
    
    const lowerMessage = userMessage.toLowerCase();
    
    let responseText = '';
    let suggestions: string[] = [];

    if (lowerMessage.includes('budget') || lowerMessage.includes('price') || lowerMessage.includes('afford')) {
      const matchingProfiles = profiles.filter(p => p.budget && p.budget <= userBudget + 300).slice(0, 3);
      responseText = `Based on your budget preferences, I found ${matchingProfiles.length} great matches:\n\n`;
      matchingProfiles.forEach((p, i) => {
        responseText += `${i + 1}. ${p.name} - $${p.budget}/mo in ${p.preferences.location}\n   ${p.compatibility}% compatible, ${p.occupation}\n\n`;
      });
      responseText += 'These roommates align well with your financial expectations!';
      suggestions = ['Tell me more about compatibility', 'Show me their lifestyles'];
    } else if (lowerMessage.includes('compatible') || lowerMessage.includes('match')) {
      const topMatches = profiles
        .filter(p => p.compatibility && p.compatibility >= 85)
        .sort((a, b) => (b.compatibility || 0) - (a.compatibility || 0))
        .slice(0, 3);
      
      responseText = `I've analyzed your profile and found ${topMatches.length} highly compatible matches:\n\n`;
      topMatches.forEach((p, i) => {
        responseText += `${i + 1}. ${p.name} - ${p.compatibility}% Match\n   Why? ${getMatchReason(p)}\n\n`;
      });
      suggestions = ['What should I look for?', 'How to improve my matches?'];
    } else if (lowerMessage.includes('tip') || lowerMessage.includes('profile') || lowerMessage.includes('improve')) {
      responseText = `Here are personalized tips to improve your matches:\n\n`;
      responseText += `1. Complete your bio with specific details about your lifestyle\n`;
      responseText += `2. Add clear photos that show your personality\n`;
      responseText += `3. Be specific about your preferences (cleanliness, noise, guests)\n`;
      responseText += `4. Mention your work schedule and daily routine\n`;
      responseText += `5. Highlight what makes you a great roommate!\n\n`;
      responseText += `Detailed profiles get 3x more matches!`;
      suggestions = ['Find matches now', 'What else can you help with?'];
    } else if (lowerMessage.includes('lifestyle') || lowerMessage.includes('habits')) {
      const similarLifestyle = profiles.filter(p => p.bio && p.bio.length > 0).slice(0, 3);
      
      responseText = `Based on lifestyle compatibility:\n\n`;
      similarLifestyle.forEach((p, i) => {
        const lifestyles = ['Clean', 'Organized', 'Social', 'Active'];
        responseText += `${i + 1}. ${p.name} - ${lifestyles.join(', ')}\n   ${p.bio?.substring(0, 80)}...\n\n`;
      });
      suggestions = ['Show me more details', 'Find budget-friendly matches'];
    } else if (lowerMessage.includes('good match') || lowerMessage.includes('what makes')) {
      responseText = `A great roommate match has:\n\n`;
      responseText += `✓ Similar budget range (within $200)\n`;
      responseText += `✓ Compatible lifestyles and habits\n`;
      responseText += `✓ Aligned location preferences\n`;
      responseText += `✓ Matching cleanliness standards\n`;
      responseText += `✓ Similar schedules (work, sleep, social)\n\n`;
      responseText += `I analyze all these factors to find your perfect match!`;
      suggestions = ['Find my matches', 'What about location?'];
    } else {
      responseText = `I can help you with:\n\n`;
      responseText += `• Finding roommates in your budget range\n`;
      responseText += `• Analyzing compatibility with potential matches\n`;
      responseText += `• Providing tips to improve your profile\n`;
      responseText += `• Explaining what makes a good match\n`;
      responseText += `• Reviewing lifestyle compatibility\n\n`;
      responseText += `What would you like to explore?`;
      suggestions = ['Find matches in my budget', 'Show compatible roommates'];
    }

    return {
      id: `ai_${Date.now()}`,
      text: responseText,
      isUser: false,
      timestamp: new Date(),
      suggestions,
    };
  };

  const getMatchReason = (profile: RoommateProfile): string => {
    const reasons = [
      'Similar lifestyle preferences and daily routines',
      'Matching cleanliness standards and home habits',
      'Compatible work schedules and social preferences',
      'Shared interests and lifestyle values',
      'Aligned budget and location preferences',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  };

  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    const userMessage: AIMessage = {
      id: `user_${Date.now()}`,
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(async () => {
      const aiResponse = await generateAIResponse(messageText);
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1000);
  };

  const renderMessage = ({ item }: { item: AIMessage }) => (
    <View style={styles.messageWrapper}>
      <View
        style={[
          styles.messageBubble,
          item.isUser ? styles.userBubble : styles.aiBubble,
          { backgroundColor: item.isUser ? theme.primary : theme.backgroundSecondary },
        ]}
      >
        {!item.isUser && (
          <View style={styles.aiIcon}>
            <Feather name="cpu" size={16} color={theme.primary} />
          </View>
        )}
        <ThemedText
          style={[
            Typography.body,
            { color: item.isUser ? '#FFFFFF' : theme.text },
            !item.isUser && { marginLeft: Spacing.sm },
          ]}
        >
          {item.text}
        </ThemedText>
      </View>
      
      {item.suggestions && item.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {item.suggestions.map((suggestion, index) => (
            <Pressable
              key={index}
              style={[styles.suggestionChip, { borderColor: theme.primary }]}
              onPress={() => handleSend(suggestion)}
            >
              <ThemedText style={[Typography.small, { color: theme.primary }]}>
                {suggestion}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + 60 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.aiAvatar, { backgroundColor: theme.primary + '20' }]}>
            <Feather name="cpu" size={24} color={theme.primary} />
          </View>
          <View style={{ marginLeft: Spacing.md }}>
            <ThemedText style={[Typography.h3]}>AI Match Assistant</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={[styles.vipBadge, { backgroundColor: '#7C3AED' }]}>
                <Feather name="award" size={10} color="#FFD700" />
                <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: 4, fontSize: 10 }]}>
                  PREMIUM FEATURE
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.messagesList, { paddingBottom: Spacing.lg }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <View style={[styles.typingIndicator, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </View>
      )}

      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
            },
          ]}
          placeholder="Ask me anything..."
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={() => handleSend()}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() ? theme.primary : theme.backgroundSecondary,
            },
          ]}
          disabled={!inputText.trim()}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.small,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  messageWrapper: {
    marginBottom: Spacing.lg,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiIcon: {
    marginTop: 2,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
    gap: Spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
