import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, StyleSheet, Modal, KeyboardAvoidingView, Platform,
  Pressable,
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
  listingId: string;
  address: string;
  neighborhood?: string;
}

const QUICK_PROMPTS = [
  'Is it safe at night?',
  "How's the commute?",
  'Good for young professionals?',
  "What's the nightlife like?",
  'Is it walkable for groceries?',
  'Any downsides I should know?',
];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lnjupgvvsbdooomvdjho.supabase.co';

export function NeighborhoodAISheet({ visible, onClose, listingId, address, neighborhood }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [briefingLoaded, setBriefingLoaded] = useState(false);
  const [walkScore, setWalkScore] = useState<number | null>(null);
  const [transitScore, setTransitScore] = useState<number | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && !briefingLoaded) {
      loadBriefing();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setMessages([]);
        setConversationHistory([]);
        setBriefingLoaded(false);
        setWalkScore(null);
        setTransitScore(null);
        setInput('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  async function callFunction(requestType: 'briefing' | 'chat', userMessage?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-neighborhood-info`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId,
          userMessage,
          conversationHistory,
          requestType,
        }),
      }
    );

    return await response.json();
  }

  async function loadBriefing() {
    setLoading(true);
    setBriefingLoaded(true);
    setMessages([{ id: 'loading', role: 'assistant', content: '...' }]);

    try {
      const data = await callFunction('briefing');
      if (data?.reply) {
        setMessages([{ id: 'briefing', role: 'assistant', content: data.reply }]);
        if (data.walkScore !== null && data.walkScore !== undefined) setWalkScore(data.walkScore);
        if (data.transitScore !== null && data.transitScore !== undefined) setTransitScore(data.transitScore);
        setConversationHistory([
          { role: 'user', content: 'Give me a neighborhood briefing for this listing.' },
          { role: 'assistant', content: data.reply },
        ]);
      } else {
        setMessages([{ id: 'error', role: 'assistant', content: 'Could not load neighborhood data. Try asking a specific question below.' }]);
      }
    } catch {
      setMessages([{ id: 'error', role: 'assistant', content: 'Could not load neighborhood data. Try asking a specific question below.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: messageText }]);
    setLoading(true);

    try {
      const data = await callFunction('chat', messageText);
      if (data?.reply) {
        const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply };
        setMessages(prev => [...prev, aiMsg]);
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: messageText },
          { role: 'assistant', content: data.reply },
        ]);
      } else {
        setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: 'Something went wrong. Try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function ScorePill({ label, score, iconName }: { label: string; score: number; iconName: string }) {
    const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <View style={[styles.scorePill, { backgroundColor: color + '20', borderColor: color }]}>
        <Feather name={iconName as any} size={14} color={color} />
        <Text style={[styles.scoreLabel, { color }]}>{score}</Text>
        <Text style={[styles.scoreSublabel, { color: 'rgba(255,255,255,0.5)' }]}>{label}</Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: '#0e0e0e' }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTop}>
              <Feather name="map-pin" size={16} color="#ff6b5b" />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {neighborhood || address}
              </Text>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              {address}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        {(walkScore !== null || transitScore !== null) ? (
          <View style={styles.scoreRow}>
            {walkScore !== null ? <ScorePill label="Walk" score={walkScore} iconName="navigation" /> : null}
            {transitScore !== null ? <ScorePill label="Transit" score={transitScore} iconName="truck" /> : null}
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            if (item.content === '...') {
              return (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <ActivityIndicator size="small" color="#ff6b5b" />
                </View>
              );
            }
            return (
              <View style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}>
                <Text style={[
                  styles.bubbleText,
                  { color: item.role === 'user' ? '#fff' : 'rgba(255,255,255,0.9)' },
                ]}>
                  {item.content}
                </Text>
              </View>
            );
          }}
          ListFooterComponent={loading && messages[messages.length - 1]?.content !== '...' ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#ff6b5b" />
            </View>
          ) : null}
        />

        {messages.length <= 1 && !loading ? (
          <View style={styles.quickPromptsWrap}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUICK_PROMPTS}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.quickPromptsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => sendMessage(item)}
                  style={styles.quickChip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickChipText}>{item}</Text>
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
            placeholder="Ask about this neighborhood..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={300}
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  headerSub: { fontSize: 12, marginTop: 2, color: 'rgba(255,255,255,0.5)' },
  closeBtn: { padding: 4 },
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  scoreLabel: { fontSize: 16, fontWeight: '800' },
  scoreSublabel: { fontSize: 11, fontWeight: '500' },
  messageList: { padding: 16, gap: 10, paddingBottom: 4 },
  bubble: { maxWidth: '82%', padding: 13, borderRadius: 16 },
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
  bubbleText: { fontSize: 15, lineHeight: 22 },
  quickPromptsWrap: { paddingVertical: 10 },
  quickPromptsList: { paddingHorizontal: 16, gap: 8 },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  quickChipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
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
