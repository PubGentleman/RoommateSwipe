import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet, Modal, Pressable,
} from 'react-native';
import { Feather } from './VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  targetProfileId: string;
  targetName: string;
  targetAge?: number;
  entryPoint: 'swipe_card' | 'match_screen' | 'chat_screen';
  compatibilityScore?: number;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  swipe_card: [
    'Are we actually compatible?',
    'What are the red flags?',
    'What should I ask them?',
    'How similar are our schedules?',
  ],
  match_screen: [
    "What's a good first message?",
    'What do we have in common?',
    'Any concerns I should know?',
    'What should I ask before meeting?',
  ],
  chat_screen: [
    'Help me bring up chores',
    'How do I ask about their schedule?',
    'Draft a message about the lease',
    'How do I bring up my dealbreakers?',
  ],
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lnjupgvvsbdooomvdjho.supabase.co';

export function AskAboutPersonModal({
  visible, onClose, targetProfileId, targetName, targetAge, entryPoint, compatibilityScore,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      const openingMessages: Record<string, string> = {
        swipe_card: `I've pulled up ${targetName}'s profile. What do you want to know?`,
        match_screen: `You matched with ${targetName}! ${compatibilityScore ? `You're ${compatibilityScore}% compatible. ` : ''}What do you want to know before reaching out?`,
        chat_screen: `I can see your conversation with ${targetName}. What do you want help with?`,
      };

      setMessages([{
        id: 'opening',
        role: 'assistant',
        content: openingMessages[entryPoint],
      }]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setMessages([]);
        setConversationHistory([]);
        setInput('');
      }, 300);
    }
  }, [visible]);

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/match-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: messageText,
            matchedUserId: targetProfileId,
            conversationHistory,
            entryPoint,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, aiMsg]);

      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: messageText },
        { role: 'assistant', content: data.reply },
      ]);

    } catch (error) {
      console.error('[AskAboutPerson] error:', error);
      const fallbackMsg = `I'm having trouble connecting right now, but I can still help. Try asking me about ${targetName}'s budget, schedule, lifestyle compatibility, or what you two have in common — I'll answer based on their profile data.`;
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: fallbackMsg,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const quickPrompts = QUICK_PROMPTS[entryPoint] || QUICK_PROMPTS.swipe_card;
  const showQuickPrompts = messages.length <= 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: '#0e0e0e' }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.aiDot} />
            <View>
              <Text style={styles.headerTitle}>
                Ask about {targetName}{targetAge ? `, ${targetAge}` : ''}
              </Text>
              <Text style={styles.headerSubtitle}>
                {compatibilityScore ? `${compatibilityScore}% compatible  ` : ''}Pi
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.role === 'user'
                ? styles.userBubble
                : styles.aiBubble,
            ]}>
              <Text style={[
                styles.messageText,
                { color: item.role === 'user' ? '#fff' : 'rgba(255,255,255,0.9)' },
              ]}>
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={loading ? (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#ff6b5b" />
            </View>
          ) : null}
        />

        {showQuickPrompts ? (
          <View style={styles.quickPromptsContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={quickPrompts}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.quickPromptsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => sendMessage(item)}
                  style={styles.quickPrompt}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickPromptText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Ask anything about ${targetName}...`}
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={[styles.sendBtn, { backgroundColor: input.trim() ? '#ff6b5b' : 'rgba(255,255,255,0.15)' }]}
            activeOpacity={0.7}
          >
            <Feather name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff6b5b' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, marginTop: 2, color: 'rgba(255,255,255,0.5)' },
  closeBtn: { padding: 4 },
  messageList: { padding: 16, gap: 10, paddingBottom: 4 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    backgroundColor: '#ff6b5b',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  quickPromptsContainer: { paddingVertical: 10 },
  quickPromptsList: { paddingHorizontal: 16, gap: 8 },
  quickPrompt: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  quickPromptText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
