import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StorageService } from '../utils/storage';
import { calculateCompatibility } from '../utils/matchingAlgorithm';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Props {
  onAccepted?: (groupId: string) => void;
  onDismissed?: () => void;
}

interface Suggestion {
  id: string;
  suggested_member_ids: string[];
  suggested_member_names: string[];
  avg_compatibility: number;
  reason: string;
  status: string;
}

export function AIGroupSuggestionCard({ onAccepted, onDismissed }: Props) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [memberPhotos, setMemberPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadSuggestion();
  }, [user]);

  const loadSuggestion = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('ai_group_suggestions')
          .select('*')
          .eq('suggested_to_user_id', user.id)
          .eq('status', 'pending')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setSuggestion(data);
          const { data: members } = await supabase
            .from('users')
            .select('avatar_url, profile:profiles(photos)')
            .in('id', data.suggested_member_ids);
          setMemberPhotos(
            (members ?? []).map((m: any) => m.profile?.photos?.[0] || m.avatar_url || '')
          );
        }
      } else {
        const profiles = await StorageService.getRoommateProfiles();
        const myProfile = profiles.find((p: any) => p.id === user.id);
        if (!myProfile || profiles.length < 3) {
          setLoading(false);
          return;
        }

        const groups = await StorageService.getGroups();
        const myGroupIds = groups
          .filter((g: any) => {
            const memberIds = (g.members || []).map((m: any) =>
              typeof m === 'string' ? m : m.id || m.user_id
            );
            return memberIds.includes(user.id);
          })
          .map((g: any) => g.id);

        if (myGroupIds.length > 2) {
          setLoading(false);
          return;
        }

        const candidates = profiles
          .filter((p: any) => p.id !== user.id)
          .map(p => ({
            profile: p,
            score: calculateCompatibility(myProfile as any, p as any),
          }))
          .filter(c => c.score >= 65)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);

        if (candidates.length >= 1) {
          const avgScore = Math.round(
            candidates.reduce((s, c) => s + c.score, 0) / candidates.length
          );
          setSuggestion({
            id: `local-suggestion-${Date.now()}`,
            suggested_member_ids: candidates.map(c => (c.profile as any).id),
            suggested_member_names: candidates.map(c => (c.profile as any).name || 'Renter'),
            avg_compatibility: avgScore,
            reason: 'Strong compatibility across lifestyle and budget',
            status: 'pending',
          });
          setMemberPhotos(
            candidates.map(c => (c.profile as any).photos?.[0] || '')
          );
        }
      }
    } catch (err) {
      console.warn('[AIGroupSuggestionCard] Error loading:', err);
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!suggestion || !user) return;
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isSupabaseConfigured) {
        const { data: group } = await supabase
          .from('groups')
          .insert({
            name: `${user.fullName?.split(' ')[0] || 'My'}'s Group`,
            created_by: user.id,
            status: 'active',
          })
          .select()
          .single();

        if (!group) throw new Error('Failed to create group');

        await supabase.from('group_members').insert({
          group_id: group.id,
          user_id: user.id,
          role: 'admin',
        });

        for (const memberId of suggestion.suggested_member_ids) {
          await supabase.from('group_invites').insert({
            group_id: group.id,
            inviter_id: user.id,
            invited_user_id: memberId,
            message: `Hey! Our AI matched us based on compatibility. Want to look for a place together?`,
          });

          await supabase.from('notifications').insert({
            user_id: memberId,
            type: 'group_invite',
            title: `${user.fullName?.split(' ')[0] || 'Someone'} invited you to a group`,
            body: `Pi matched you as compatible roommates. Tap to join the group!`,
            data: JSON.stringify({ group_id: group.id }),
          });
        }

        await supabase
          .from('ai_group_suggestions')
          .update({ status: 'accepted', group_id: group.id })
          .eq('id', suggestion.id);

        onAccepted?.(group.id);
        navigation.navigate('Groups', {
          screen: 'GroupInfo',
          params: { groupId: group.id, groupName: group.name },
        });
      } else {
        const newGroup = {
          id: `grp-ai-${Date.now()}`,
          name: `${user.fullName?.split(' ')[0] || 'My'}'s Group`,
          createdBy: user.id,
          members: [user.id, ...suggestion.suggested_member_ids],
          type: 'roommate' as const,
          maxMembers: suggestion.suggested_member_ids.length + 1,
          createdAt: new Date().toISOString(),
          location: '',
          description: `AI-suggested group: ${suggestion.reason}`,
        };

        const existingGroups = await StorageService.getGroups();
        await StorageService.saveGroups([...existingGroups, newGroup]);

        onAccepted?.(newGroup.id);
        navigation.navigate('Groups', {
          screen: 'GroupInfo',
          params: { groupId: newGroup.id, groupName: newGroup.name },
        });
      }

      setDismissed(true);
    } catch (e) {
      console.error('Failed to accept suggestion:', e);
    }
    setAccepting(false);
  };

  const handleDecline = async () => {
    if (!suggestion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isSupabaseConfigured) {
      await supabase
        .from('ai_group_suggestions')
        .update({ status: 'declined' })
        .eq('id', suggestion.id);
    }

    setDismissed(true);
    onDismissed?.();
  };

  if (loading || !suggestion || dismissed) return null;

  const firstNames = (suggestion.suggested_member_names ?? [])
    .map((n: string) => n.split(' ')[0])
    .join(' & ');

  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutUp}>
      <LinearGradient
        colors={['#1a0a00', '#1a1a1a']}
        style={styles.card}
      >
        <View style={styles.header}>
          <Feather name="zap" size={14} color="#ff6b5b" />
          <Text style={styles.headerLabel}>AI ROOMMATE MATCH</Text>
          <Pressable onPress={handleDecline} style={styles.dismissBtn}>
            <Feather name="x" size={16} color="#555" />
          </Pressable>
        </View>

        <View style={styles.photosRow}>
          {memberPhotos.map((photo, i) => (
            <View key={i} style={[styles.photoWrapper, { marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i }]}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Feather name="user" size={18} color="#555" />
                </View>
              )}
            </View>
          ))}
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreCircleText}>{suggestion.avg_compatibility}%</Text>
          </View>
        </View>

        <Text style={styles.namesText}>
          You + {firstNames}
        </Text>
        <Text style={styles.reasonText}>{suggestion.reason}</Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="users" size={16} color="#fff" />
                <Text style={styles.acceptText}>Create Group & Invite</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.declineButton} onPress={handleDecline}>
            <Text style={styles.declineText}>Not now</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Invites sent automatically · Powered by Pi
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ff6b5b33',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  headerLabel: {
    color: '#ff6b5b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    flex: 1,
  },
  dismissBtn: { padding: 4 },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoWrapper: {
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 24,
  },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoPlaceholder: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scoreCircleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  namesText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonText: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 16,
  },
  actions: { gap: 8 },
  acceptButton: {
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  declineButton: {
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  declineText: { color: '#555', fontSize: 14 },
  footer: {
    color: '#444',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
  },
});
