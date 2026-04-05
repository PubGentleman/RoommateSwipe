import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, TextInput, ActivityIndicator, Linking, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getEventById,
  getEventAttendees,
  getEventComments,
  rsvpToEvent,
  cancelEvent,
  postEventComment,
  getEventTypeInfo,
  formatEventDateLong,
  formatEventTime,
  type RhomeEvent,
} from '../../services/eventService';

export function EventDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const eventId = route.params?.eventId;

  const [event, setEvent] = useState<RhomeEvent | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!eventId || !user?.id) return;
    try {
      const [ev, att, com] = await Promise.all([
        getEventById(eventId, user.id),
        getEventAttendees(eventId),
        getEventComments(eventId),
      ]);
      setEvent(ev);
      setAttendees(att);
      setComments(com);
    } catch (err) {
      console.error('[EventDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, user?.id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleRsvp = async (status: 'going' | 'maybe' | 'not_going') => {
    if (!user?.id || !eventId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await rsvpToEvent(eventId, user.id, status);
      await loadEvent();
    } catch {}
  };

  const handleCancel = async () => {
    if (!user?.id || !eventId) return;
    Alert.alert('Cancel Event', 'Are you sure you want to cancel this event?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Event',
        style: 'destructive',
        onPress: async () => {
          await cancelEvent(eventId, user.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user?.id || !eventId) return;
    setPosting(true);
    try {
      await postEventComment(eventId, user.id, commentText.trim());
      setCommentText('');
      const com = await getEventComments(eventId);
      setComments(com);
    } catch {} finally {
      setPosting(false);
    }
  };

  const openMaps = () => {
    if (!event?.locationAddress) return;
    const q = encodeURIComponent(event.locationAddress);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#ff6b5b" />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.loadingCenter}>
          <Text style={styles.emptyText}>Event not found</Text>
        </View>
      </View>
    );
  }

  const typeInfo = getEventTypeInfo(event.eventType);
  const isCreator = event.creatorId === user?.id;
  const goingList = attendees.filter((a: any) => a.status === 'going');
  const maybeList = attendees.filter((a: any) => a.status === 'maybe');
  const isFull = event.maxAttendees ? event.attendeeCount >= event.maxAttendees : false;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.coverWrap}>
          {event.coverPhoto ? (
            <Image source={{ uri: event.coverPhoto }} style={styles.coverImage} />
          ) : (
            <LinearGradient
              colors={[typeInfo.color + '44', typeInfo.color + '11']}
              style={styles.coverPlaceholder}
            >
              <View style={[styles.coverIconWrap, { backgroundColor: typeInfo.color + '55' }]}>
                <Feather name={typeInfo.icon} size={36} color={typeInfo.color} />
              </View>
            </LinearGradient>
          )}
          <View style={styles.headerOverlay}>
            <Pressable onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            {isCreator ? (
              <Pressable onPress={handleCancel} style={styles.headerIconBtn}>
                <Feather name="more-horizontal" size={20} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.typePill, { backgroundColor: typeInfo.color + '22' }]}>
            <Feather name={typeInfo.icon} size={12} color={typeInfo.color} />
            <Text style={[styles.typePillText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.creatorRow}>
            <View style={styles.avatarCircle}>
              {event.creatorPhoto ? (
                <Image source={{ uri: event.creatorPhoto }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>
                  {event.creatorName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.creatorLabel}>Hosted by</Text>
              <Text style={styles.creatorName}>{event.creatorName}</Text>
            </View>
          </View>

          {event.groupName ? (
            <View style={styles.groupRow}>
              <Feather name="users" size={12} color="#6C5CE7" />
              <Text style={styles.groupText}>In {event.groupName}</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color="#ff6b5b" />
              <Text style={styles.infoText}>{formatEventDateLong(event.startsAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="clock" size={16} color="#ff6b5b" />
              <Text style={styles.infoText}>
                {formatEventTime(event.startsAt)}
                {event.endsAt ? ` - ${formatEventTime(event.endsAt)}` : ''}
              </Text>
            </View>
          </View>

          {event.locationName ? (
            <Pressable style={styles.infoCard} onPress={openMaps}>
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color="#22C55E" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoText}>{event.locationName}</Text>
                  {event.locationAddress ? (
                    <Text style={styles.infoSubText}>{event.locationAddress}</Text>
                  ) : null}
                </View>
                <Feather name="external-link" size={14} color="rgba(255,255,255,0.3)" />
              </View>
            </Pressable>
          ) : null}

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.descText}>{event.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Attendees · {goingList.length} Going{maybeList.length > 0 ? ` · ${maybeList.length} Maybe` : ''}
            </Text>
            <View style={styles.attendeeGrid}>
              {goingList.slice(0, 8).map((a: any, i: number) => (
                <View key={i} style={styles.attendeeItem}>
                  <View style={styles.attendeeAvatar}>
                    {a.user?.avatar_url ? (
                      <Image source={{ uri: a.user.avatar_url }} style={styles.attendeeAvatarImg} />
                    ) : (
                      <Text style={styles.attendeeAvatarLetter}>
                        {(a.user?.full_name || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.attendeeName} numberOfLines={1}>
                    {a.user?.full_name || 'Unknown'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comments</Text>
            {comments.length === 0 ? (
              <Text style={styles.emptyComments}>Be the first to comment!</Text>
            ) : (
              comments.map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarLetter}>
                      {(c.user?.full_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentAuthor}>{c.user?.full_name || 'Unknown'}</Text>
                    <Text style={styles.commentContent}>{c.content}</Text>
                  </View>
                </View>
              ))
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={commentText}
                onChangeText={setCommentText}
              />
              <Pressable
                onPress={handleComment}
                disabled={posting || !commentText.trim()}
                style={[styles.commentSendBtn, (!commentText.trim() || posting) && { opacity: 0.4 }]}
              >
                <Feather name="send" size={16} color="#ff6b5b" />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.rsvpBar, { paddingBottom: insets.bottom + 8 }]}>
        {isFull && event.myRsvp !== 'going' ? (
          <View style={styles.fullBanner}>
            <Feather name="alert-circle" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.fullText}>This event is full</Text>
          </View>
        ) : (
          <View style={styles.rsvpRow}>
            <Pressable
              style={[styles.rsvpButton, event.myRsvp === 'going' && styles.rsvpButtonActive]}
              onPress={() => handleRsvp('going')}
            >
              <Feather name="check" size={14} color={event.myRsvp === 'going' ? '#fff' : '#ff6b5b'} />
              <Text style={[styles.rsvpButtonText, event.myRsvp === 'going' && styles.rsvpButtonTextActive]}>
                Going
              </Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, event.myRsvp === 'maybe' && styles.rsvpMaybeActive]}
              onPress={() => handleRsvp('maybe')}
            >
              <Feather name="help-circle" size={14} color={event.myRsvp === 'maybe' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.rsvpButtonText, event.myRsvp === 'maybe' && { color: '#fff' }]}>
                Maybe
              </Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, event.myRsvp === 'not_going' && { backgroundColor: '#333' }]}
              onPress={() => handleRsvp('not_going')}
            >
              <Feather name="x" size={14} color="rgba(255,255,255,0.4)" />
              <Text style={[styles.rsvpButtonText, { color: 'rgba(255,255,255,0.4)' }]}>
                Can't Go
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    padding: 16,
  },
  coverWrap: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    gap: 16,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  creatorLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupText: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
  },
  infoSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },
  attendeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attendeeItem: {
    alignItems: 'center',
    width: 60,
    gap: 4,
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendeeAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  attendeeAvatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  attendeeName: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyComments: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarLetter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  commentContent: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  rsvpButtonActive: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
  },
  rsvpMaybeActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  rsvpButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  rsvpButtonTextActive: {
    color: '#fff',
  },
  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  fullText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
});
