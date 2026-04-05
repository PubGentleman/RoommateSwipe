import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Keyboard } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

interface MentionMember {
  id: string;
  name: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  members: MentionMember[];
  onMentionsChanged: (mentionedIds: string[]) => void;
  placeholder?: string;
  editable?: boolean;
  inputRef?: React.RefObject<TextInput>;
  style?: any;
  multiline?: boolean;
}

export function MentionInput({
  value,
  onChangeText,
  members,
  onMentionsChanged,
  placeholder,
  editable = true,
  inputRef,
  style,
  multiline = true,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState<MentionMember[]>([]);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const localRef = useRef<TextInput>(null);
  const ref = inputRef || localRef;

  const detectMention = useCallback((text: string) => {
    const atIndex = text.lastIndexOf('@');
    if (atIndex === -1) {
      setShowSuggestions(false);
      return;
    }

    const afterAt = text.substring(atIndex + 1);
    if (afterAt.includes(' ') && afterAt.split(' ').length > 2) {
      setShowSuggestions(false);
      return;
    }

    const query = afterAt.toLowerCase();
    setMentionQuery(query);

    const everyoneOption: MentionMember = { id: 'everyone', name: 'Everyone', isAdmin: false };
    const filtered = [everyoneOption, ...members].filter(m =>
      m.name.toLowerCase().includes(query) || (m.id === 'everyone' && 'everyone'.includes(query))
    );

    setFilteredMembers(filtered.slice(0, 6));
    setShowSuggestions(filtered.length > 0);
  }, [members]);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    detectMention(text);
  }, [onChangeText, detectMention]);

  const selectMention = useCallback((member: MentionMember) => {
    const atIndex = value.lastIndexOf('@');
    if (atIndex === -1) return;

    const before = value.substring(0, atIndex);
    const newText = `${before}@${member.name} `;
    onChangeText(newText);
    setShowSuggestions(false);

    let newIds: string[];
    if (member.id === 'everyone') {
      newIds = members.map(m => m.id);
    } else {
      newIds = [...mentionedIds.filter(id => id !== member.id), member.id];
    }
    setMentionedIds(newIds);
    onMentionsChanged(newIds);
  }, [value, mentionedIds, members, onChangeText, onMentionsChanged]);

  useEffect(() => {
    const ids: string[] = [];
    members.forEach(m => {
      if (value.includes(`@${m.name}`)) {
        ids.push(m.id);
      }
    });
    if (value.includes('@Everyone')) {
      members.forEach(m => { if (!ids.includes(m.id)) ids.push(m.id); });
    }
    if (JSON.stringify(ids) !== JSON.stringify(mentionedIds)) {
      setMentionedIds(ids);
      onMentionsChanged(ids);
    }
  }, [value]);

  return (
    <View style={styles.container}>
      {showSuggestions ? (
        <Animated.View entering={FadeInDown.duration(150)} exiting={FadeOutDown.duration(100)} style={styles.suggestionsContainer}>
          <FlatList
            data={filteredMembers}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionsList}
            renderItem={({ item }) => (
              <Pressable style={styles.suggestionRow} onPress={() => selectMention(item)}>
                {item.id === 'everyone' ? (
                  <View style={styles.everyoneAvatar}>
                    <Feather name="users" size={14} color="#ff6b5b" />
                  </View>
                ) : item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Feather name="user" size={14} color="#ff6b5b" />
                  </View>
                )}
                <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
                {item.isAdmin ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminText}>Admin</Text>
                  </View>
                ) : null}
              </Pressable>
            )}
          />
        </Animated.View>
      ) : null}

      <TextInput
        ref={ref}
        style={[styles.input, style]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder || 'Type a message...'}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline={multiline}
        editable={editable}
        maxLength={2000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26,26,26,0.98)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
    maxHeight: 220,
    zIndex: 100,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 220,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  everyoneAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  adminBadge: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminText: {
    fontSize: 9,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    paddingVertical: 8,
  },
});
