import React, { useState, useMemo } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, ScrollView, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from './VectorIcons';
import { AgentRenter } from '../services/agentMatchmakerService';
import { generateAllInviteMessages } from '../utils/inviteMessageGenerator';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';

interface ListingInfo {
  id?: string;
  title?: string;
  price?: number;
  bedrooms?: number;
  neighborhood?: string;
}

interface InvitePreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  onSend: (messages: Record<string, string>) => Promise<void>;
  members: AgentRenter[];
  groupName: string;
  listing?: ListingInfo | null;
  agentName: string;
}

export const InvitePreviewSheet: React.FC<InvitePreviewSheetProps> = ({
  visible, onClose, onSend, members, groupName, listing, agentName,
}) => {
  const defaultMessages = useMemo(
    () => generateAllInviteMessages(members, listing, agentName),
    [members, listing, agentName]
  );

  const [messages, setMessages] = useState<Record<string, string>>(defaultMessages);
  const [activeTab, setActiveTab] = useState(members[0]?.id || '');
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (visible) {
      const msgs = generateAllInviteMessages(members, listing, agentName);
      setMessages(msgs);
      setActiveTab(members[0]?.id || '');
      setSending(false);
    }
  }, [visible, members, listing, agentName]);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(messages);
    } catch {
      setSending(false);
    }
  };

  const handleReset = () => {
    if (activeTab && defaultMessages[activeTab]) {
      setMessages(prev => ({ ...prev, [activeTab]: defaultMessages[activeTab] }));
    }
  };

  const updateMessage = (text: string) => {
    setMessages(prev => ({ ...prev, [activeTab]: text }));
  };

  if (!visible || members.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{
            backgroundColor: CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '90%', minHeight: '60%',
          }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              <View style={{ paddingHorizontal: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Feather name="send" size={18} color={ACCENT} />
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Send Group Invite</Text>
                </View>

                <View style={{
                  backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 16,
                  borderWidth: 1, borderColor: '#2a2a2a',
                }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{groupName}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: listing ? 8 : 0 }}>
                    {members.map(m => (
                      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {m.photos?.[0] ? (
                          <Image source={{ uri: m.photos[0] }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                        ) : (
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, color: '#888' }}>{m.name?.charAt(0)}</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 12, color: '#ccc' }}>{m.name?.split(' ')[0]}</Text>
                      </View>
                    ))}
                  </View>
                  {listing?.title ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="home" size={12} color="#888" />
                      <Text style={{ fontSize: 12, color: '#888' }}>
                        {listing.bedrooms ? `${listing.bedrooms}BR \u2014 ` : ''}{listing.title}
                        {listing.price ? ` \u00b7 $${listing.price.toLocaleString()}/mo` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {members.map(m => {
                    const isActive = activeTab === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setActiveTab(m.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          backgroundColor: isActive ? ACCENT + '20' : SURFACE,
                          borderWidth: 1.5, borderColor: isActive ? ACCENT : '#333',
                        }}
                      >
                        {m.photos?.[0] ? (
                          <Image source={{ uri: m.photos[0] }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                        ) : (
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, color: '#888' }}>{m.name?.charAt(0)}</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? ACCENT : '#aaa' }}>
                          {m.name?.split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={{
                  backgroundColor: SURFACE, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a',
                  padding: 14, marginBottom: 8, minHeight: 200,
                }}>
                  <TextInput
                    value={messages[activeTab] || ''}
                    onChangeText={updateMessage}
                    multiline
                    style={{ color: '#ccc', fontSize: 14, lineHeight: 20, textAlignVertical: 'top', minHeight: 180 }}
                    placeholderTextColor="#555"
                    placeholder="Invite message..."
                  />
                </View>

                {messages[activeTab] !== defaultMessages[activeTab] ? (
                  <Pressable onPress={handleReset} style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
                    <Text style={{ color: '#888', fontSize: 12 }}>Reset to default ↩</Text>
                  </Pressable>
                ) : (
                  <View style={{ height: 28 }} />
                )}
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingBottom: 34, paddingTop: 10 }}>
              <Pressable
                onPress={handleSend}
                disabled={sending}
                style={{
                  backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#000" />
                    <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>
                      Send All Invites ({members.length})
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable onPress={onClose} style={{ alignItems: 'center', paddingTop: 14 }}>
                <Text style={{ color: '#888', fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
