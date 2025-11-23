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
      text: `Hi ${user?.name?.split(' ')[0]}! I'm your AI Match Assistant. I can help you find roommates, discover great neighborhoods, recommend restaurants, suggest activities, and give home decor tips. What would you like to explore?`,
      isUser: false,
      timestamp: new Date(),
      suggestions: [
        'Find roommates in my budget',
        'Best neighborhoods for me',
        'What to do around here',
        'Restaurant recommendations',
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
      suggestions = ['Find my matches', 'Best neighborhoods for me'];
    } else if (lowerMessage.includes('apartment') || lowerMessage.includes('neighborhood') || lowerMessage.includes('area') || lowerMessage.includes('where to live')) {
      const occupation = user?.name?.includes('Software') ? 'tech professional' : 'young professional';
      responseText = `Based on your profile as a ${occupation}, here are the best neighborhoods:\n\n`;
      responseText += `📍 Downtown District\n   Great for: Work commute, nightlife, dining\n   Avg rent: $1,800-2,500/mo\n   Vibe: Urban, fast-paced, convenient\n\n`;
      responseText += `📍 Arts Quarter\n   Great for: Culture, cafes, creative scene\n   Avg rent: $1,400-2,000/mo\n   Vibe: Trendy, artistic, laid-back\n\n`;
      responseText += `📍 University District\n   Great for: Young crowd, affordable, social\n   Avg rent: $1,200-1,800/mo\n   Vibe: Energetic, diverse, budget-friendly\n\n`;
      responseText += `Each area has unique perks for your lifestyle!`;
      suggestions = ['Tell me about nightlife', 'Show me restaurants', 'What about transportation?'];
    } else if (lowerMessage.includes('nightlife') || lowerMessage.includes('bar') || lowerMessage.includes('club') || lowerMessage.includes('things to do') || lowerMessage.includes('activities')) {
      responseText = `Here's what's happening around the city:\n\n`;
      responseText += `🎉 Nightlife & Entertainment:\n`;
      responseText += `• The Velvet Room - Upscale cocktail lounge\n`;
      responseText += `• Electric Avenue - Dance club, open till 3am\n`;
      responseText += `• Rooftop 360 - Panoramic views, live DJ\n\n`;
      responseText += `🎭 Things to Do:\n`;
      responseText += `• Weekend farmers market (Saturdays 8am-2pm)\n`;
      responseText += `• Live music at The Underground (Wed-Sun)\n`;
      responseText += `• Art galleries open late on First Fridays\n`;
      responseText += `• Outdoor cinema in Central Park (summer)\n\n`;
      responseText += `There's always something happening!`;
      suggestions = ['Restaurant suggestions', 'Best coffee shops', 'Fitness & activities'];
    } else if (lowerMessage.includes('restaurant') || lowerMessage.includes('food') || lowerMessage.includes('eat') || lowerMessage.includes('dining') || lowerMessage.includes('coffee')) {
      responseText = `Top picks for dining and cafes:\n\n`;
      responseText += `🍽️ Restaurants:\n`;
      responseText += `• Harvest Kitchen - Farm-to-table, $$$\n`;
      responseText += `• Spice & Soul - Asian fusion, $$\n`;
      responseText += `• Burger Bar - Casual, great happy hour, $\n`;
      responseText += `• Pasta Paradiso - Italian, date night spot, $$$\n\n`;
      responseText += `☕ Coffee & Cafes:\n`;
      responseText += `• Bean There - Artisan coffee, cozy workspace\n`;
      responseText += `• Morning Ritual - Breakfast all day\n`;
      responseText += `• The Daily Grind - Student favorite, wifi\n\n`;
      responseText += `Most offer delivery through local apps!`;
      suggestions = ['Tell me about nightlife', 'Home decor ideas', 'Best neighborhoods'];
    } else if (lowerMessage.includes('decor') || lowerMessage.includes('decorat') || lowerMessage.includes('furnish') || lowerMessage.includes('home') || lowerMessage.includes('apartment style')) {
      responseText = `Home decor tips for shared spaces:\n\n`;
      responseText += `🎨 Color & Style:\n`;
      responseText += `• Keep common areas neutral (white, gray, beige)\n`;
      responseText += `• Add personality with removable decals or art\n`;
      responseText += `• Coordinate with roommate on major pieces\n\n`;
      responseText += `🛋️ Furniture Ideas:\n`;
      responseText += `• Multi-functional: Storage ottomans, fold-out desks\n`;
      responseText += `• Budget-friendly: IKEA, Facebook Marketplace, Wayfair\n`;
      responseText += `• Space-savers: Wall shelves, under-bed storage\n\n`;
      responseText += `💡 Pro Tips:\n`;
      responseText += `• Invest in good lighting (string lights, lamps)\n`;
      responseText += `• Plants make any space feel homey\n`;
      responseText += `• Define personal vs shared spaces clearly\n\n`;
      responseText += `A well-decorated home = happy roommates!`;
      suggestions = ['Budget furniture ideas', 'Plant recommendations', 'Storage solutions'];
    } else {
      responseText = `I can help you with:\n\n`;
      responseText += `🏠 Roommate Matching:\n`;
      responseText += `• Find compatible roommates\n`;
      responseText += `• Budget-based recommendations\n`;
      responseText += `• Lifestyle compatibility analysis\n\n`;
      responseText += `📍 Location & Living:\n`;
      responseText += `• Best neighborhoods for your occupation\n`;
      responseText += `• Apartment hunting tips\n`;
      responseText += `• Transportation and commute advice\n\n`;
      responseText += `🎉 Lifestyle & Fun:\n`;
      responseText += `• Nightlife and entertainment spots\n`;
      responseText += `• Restaurant and cafe recommendations\n`;
      responseText += `• Things to do and activities\n\n`;
      responseText += `🎨 Home Tips:\n`;
      responseText += `• Decor ideas for shared spaces\n`;
      responseText += `• Furniture and budget tips\n`;
      responseText += `• Organization hacks\n\n`;
      responseText += `What would you like to explore?`;
      suggestions = ['Find roommates', 'Best neighborhoods', 'Things to do', 'Decor tips'];
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
      <View style={[styles.header, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.lg }]}>
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
