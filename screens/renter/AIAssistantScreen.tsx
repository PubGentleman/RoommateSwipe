import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';
import { RoommateProfile } from '../../types/models';
import { getZodiacSymbol, getZodiacCompatibilityScore, getZodiacCompatibilityLevel, getZodiacElement } from '../../utils/zodiacUtils';
import { shouldAskMicroQuestion, getNextMicroQuestion, parseAnswerAndUpdatePreferences, markQuestionAsAsked, MicroQuestion } from '../../utils/aiMicroQuestions';
import { LinearGradient } from 'expo-linear-gradient';
import { sendAIMessage, createSessionId } from '../../utils/aiService';

type AIMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestions?: string[];
  isMicroQuestion?: boolean;
  microQuestionData?: MicroQuestion;
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

const TAB_BAR_HEIGHT = 80;

export const AIAssistantScreen = ({ navigation }: AIAssistantScreenProps) => {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingMicroQuestion, setPendingMicroQuestion] = useState<MicroQuestion | null>(null);
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

  const generateAIResponse = async (userMessage: string): Promise<AIMessage> => {
    const profiles = await StorageService.getRoommateProfiles();
    const userBudget = 1500;
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
      responseText += `Similar budget range (within $200)\n`;
      responseText += `Compatible lifestyles and habits\n`;
      responseText += `Aligned location preferences\n`;
      responseText += `Matching cleanliness standards\n`;
      responseText += `Similar schedules (work, sleep, social)\n\n`;
      responseText += `I analyze all these factors to find your perfect match!`;
      suggestions = ['Find my matches', 'Best neighborhoods for me'];
    } else if (lowerMessage.includes('apartment') || lowerMessage.includes('neighborhood') || lowerMessage.includes('area') || lowerMessage.includes('where to live')) {
      const occupation = user?.name?.includes('Software') ? 'tech professional' : 'young professional';
      responseText = `Based on your profile as a ${occupation}, here are the best neighborhoods:\n\n`;
      responseText += `Downtown District\nGreat for: Work commute, nightlife, dining\nAvg rent: $1,800-2,500/mo\nVibe: Urban, fast-paced, convenient\n\n`;
      responseText += `Arts Quarter\nGreat for: Culture, cafes, creative scene\nAvg rent: $1,400-2,000/mo\nVibe: Trendy, artistic, laid-back\n\n`;
      responseText += `University District\nGreat for: Young crowd, affordable, social\nAvg rent: $1,200-1,800/mo\nVibe: Energetic, diverse, budget-friendly\n\n`;
      responseText += `Each area has unique perks for your lifestyle!`;
      suggestions = ['Tell me about nightlife', 'Show me restaurants', 'What about transportation?'];
    } else if (lowerMessage.includes('nightlife') || lowerMessage.includes('bar') || lowerMessage.includes('club') || lowerMessage.includes('things to do') || lowerMessage.includes('activities')) {
      responseText = `Here's what's happening around the city:\n\n`;
      responseText += `Nightlife & Entertainment:\n`;
      responseText += `The Velvet Room - Upscale cocktail lounge\n`;
      responseText += `Electric Avenue - Dance club, open till 3am\n`;
      responseText += `Rooftop 360 - Panoramic views, live DJ\n\n`;
      responseText += `Things to Do:\n`;
      responseText += `Weekend farmers market (Saturdays 8am-2pm)\n`;
      responseText += `Live music at The Underground (Wed-Sun)\n`;
      responseText += `Art galleries open late on First Fridays\n`;
      responseText += `Outdoor cinema in Central Park (summer)\n\n`;
      responseText += `There's always something happening!`;
      suggestions = ['Restaurant suggestions', 'Best coffee shops', 'Fitness & activities'];
    } else if (lowerMessage.includes('restaurant') || lowerMessage.includes('food') || lowerMessage.includes('eat') || lowerMessage.includes('dining') || lowerMessage.includes('coffee')) {
      responseText = `Top picks for dining and cafes:\n\n`;
      responseText += `Restaurants:\n`;
      responseText += `Harvest Kitchen - Farm-to-table, $$$\n`;
      responseText += `Spice & Soul - Asian fusion, $$\n`;
      responseText += `Burger Bar - Casual, great happy hour, $\n`;
      responseText += `Pasta Paradiso - Italian, date night spot, $$$\n\n`;
      responseText += `Coffee & Cafes:\n`;
      responseText += `Bean There - Artisan coffee, cozy workspace\n`;
      responseText += `Morning Ritual - Breakfast all day\n`;
      responseText += `The Daily Grind - Student favorite, wifi\n\n`;
      responseText += `Most offer delivery through local apps!`;
      suggestions = ['Tell me about nightlife', 'Home decor ideas', 'Best neighborhoods'];
    } else if (lowerMessage.includes('decor') || lowerMessage.includes('decorat') || lowerMessage.includes('furnish') || lowerMessage.includes('home') || lowerMessage.includes('apartment style')) {
      responseText = `Home decor tips for shared spaces:\n\n`;
      responseText += `Color & Style:\n`;
      responseText += `Keep common areas neutral (white, gray, beige)\n`;
      responseText += `Add personality with removable decals or art\n`;
      responseText += `Coordinate with roommate on major pieces\n\n`;
      responseText += `Furniture Ideas:\n`;
      responseText += `Multi-functional: Storage ottomans, fold-out desks\n`;
      responseText += `Budget-friendly: IKEA, Facebook Marketplace, Wayfair\n`;
      responseText += `Space-savers: Wall shelves, under-bed storage\n\n`;
      responseText += `Pro Tips:\n`;
      responseText += `Invest in good lighting (string lights, lamps)\n`;
      responseText += `Plants make any space feel homey\n`;
      responseText += `Define personal vs shared spaces clearly\n\n`;
      responseText += `A well-decorated home = happy roommates!`;
      suggestions = ['Budget furniture ideas', 'Plant recommendations', 'Storage solutions'];
    } else if (lowerMessage.includes('zodiac') || lowerMessage.includes('astrology') || lowerMessage.includes('star sign') || lowerMessage.includes('horoscope')) {
      const userPlan = user?.subscription?.plan || 'basic';
      const isPremium = userPlan === 'plus' || userPlan === 'elite';
      if (!isPremium) {
        responseText = `Zodiac compatibility insights are available for Plus and Elite members!\n\n`;
        responseText += `Upgrade to unlock:\n`;
        responseText += `Detailed zodiac compatibility analysis\n`;
        responseText += `Element-based matching explanations\n`;
        responseText += `Personalized astrological insights\n`;
        responseText += `See zodiac signs on all profiles\n\n`;
        responseText += `Plus members get full access to these premium features!`;
        suggestions = ['Upgrade to Plus', 'Tell me about compatibility', 'Find roommates'];
      } else {
        const zodiacProfiles = profiles.filter(p => p.zodiacSign).slice(0, 3);
        responseText = `Let me analyze zodiac compatibility for you!\n\n`;
        if (user?.zodiacSign) {
          const userSign = user.zodiacSign;
          const userElement = getZodiacElement(userSign);
          responseText += `You're ${getZodiacSymbol(userSign)} ${userSign} (${userElement} sign)\n\n`;
          if (zodiacProfiles.length > 0) {
            responseText += `Top zodiac-compatible matches:\n\n`;
            zodiacProfiles.forEach((p, i) => {
              if (p.zodiacSign) {
                const score = getZodiacCompatibilityScore(userSign, p.zodiacSign);
                const explanation = getZodiacCompatibilityLevel(userSign, p.zodiacSign);
                const compatLevel = score === 2 ? 'Excellent' : score === 1 ? 'Good' : 'Neutral';
                responseText += `${i + 1}. ${p.name} ${getZodiacSymbol(p.zodiacSign)} ${p.zodiacSign}\n`;
                responseText += `   ${compatLevel} - ${explanation}\n\n`;
              }
            });
          }
          responseText += `Zodiac signs add an extra dimension to roommate compatibility!`;
        } else {
          responseText += `You haven't set your zodiac sign yet!\n\n`;
          responseText += `Add your zodiac sign to unlock:\n`;
          responseText += `Personalized zodiac compatibility scores\n`;
          responseText += `Element-based matching insights\n`;
          responseText += `See how your sign aligns with others\n\n`;
          responseText += `Go to your profile to add your zodiac sign!`;
        }
        suggestions = ['Find compatible roommates', 'Tell me about elements', 'Profile tips'];
      }
    } else if (lowerMessage.includes('element') && (lowerMessage.includes('fire') || lowerMessage.includes('earth') || lowerMessage.includes('air') || lowerMessage.includes('water') || lowerMessage.includes('zodiac'))) {
      responseText = `Zodiac elements explain compatibility patterns:\n\n`;
      responseText += `Fire Signs (Aries, Leo, Sagittarius):\n`;
      responseText += `Passionate, energetic, spontaneous\nBest with: Fire & Air signs\n\n`;
      responseText += `Earth Signs (Taurus, Virgo, Capricorn):\n`;
      responseText += `Practical, stable, grounded\nBest with: Earth & Water signs\n\n`;
      responseText += `Air Signs (Gemini, Libra, Aquarius):\n`;
      responseText += `Social, intellectual, communicative\nBest with: Air & Fire signs\n\n`;
      responseText += `Water Signs (Cancer, Scorpio, Pisces):\n`;
      responseText += `Emotional, intuitive, empathetic\nBest with: Water & Earth signs\n\n`;
      responseText += `Elements that complement each other create harmonious living environments!`;
      suggestions = ['Find zodiac matches', 'What\'s my compatibility?', 'Profile tips'];
    } else {
      responseText = `I can help you with:\n\n`;
      responseText += `Roommate Matching:\n`;
      responseText += `Find compatible roommates\nBudget-based recommendations\nLifestyle compatibility analysis\nZodiac compatibility insights (Plus/Elite)\n\n`;
      responseText += `Location & Living:\n`;
      responseText += `Best neighborhoods for your occupation\nApartment hunting tips\nTransportation and commute advice\n\n`;
      responseText += `Lifestyle & Fun:\n`;
      responseText += `Nightlife and entertainment spots\nRestaurant and cafe recommendations\nThings to do and activities\n\n`;
      responseText += `Home Tips:\n`;
      responseText += `Decor ideas for shared spaces\nFurniture and budget tips\nOrganization hacks\n\n`;
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
    if (profile.zodiacSign && user?.zodiacSign) {
      const zodiacScore = getZodiacCompatibilityScore(user.zodiacSign, profile.zodiacSign);
      if (zodiacScore === 2) {
        reasons.push('Excellent zodiac compatibility with aligned energies');
      }
    }
    return reasons[Math.floor(Math.random() * reasons.length)];
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
      await handleSendFallback(messageText);
    }
  };

  const handleSendFallback = async (messageText: string) => {
    setTimeout(async () => {
      if (pendingMicroQuestion) {
        const updatedUser = await parseAnswerAndUpdatePreferences(
          user!, messageText, pendingMicroQuestion.category
        );
        updateUser(updatedUser);
        const confirmationResponse: AIMessage = {
          id: `ai_${Date.now()}`,
          text: `Got it! I've updated your preferences based on your answer. Your match suggestions will be more accurate now!`,
          isUser: false,
          timestamp: new Date(),
          suggestions: ['Find my matches', 'What else can you help with?'],
        };
        setMessages(prev => [...prev, confirmationResponse]);
        setPendingMicroQuestion(null);
        setIsTyping(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        const aiResponse = await generateAIResponse(messageText);
        setMessages(prev => [...prev, aiResponse]);
        if (user && shouldAskMicroQuestion(user)) {
          const microQuestion = getNextMicroQuestion(user);
          if (microQuestion) {
            setTimeout(async () => {
              const updatedUser = await markQuestionAsAsked(user!, microQuestion.id);
              updateUser(updatedUser);
              const microQuestionMessage: AIMessage = {
                id: `ai_micro_${Date.now()}`,
                text: `Quick question to help improve your matches: ${microQuestion.question}`,
                isUser: false,
                timestamp: new Date(),
                isMicroQuestion: true,
                microQuestionData: microQuestion,
              };
              setMessages(prev => [...prev, microQuestionMessage]);
              setPendingMicroQuestion(microQuestion);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }, 2000);
          }
        }
        setIsTyping(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }, 1000);
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
      keyboardVerticalOffset={TAB_BAR_HEIGHT}
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
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) + TAB_BAR_HEIGHT }]}>
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
