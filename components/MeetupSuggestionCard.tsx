import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Linking, ActivityIndicator,
} from 'react-native';
import { Feather } from './VectorIcons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

interface MeetupSuggestion {
  id: string;
  suggestedVenueName?: string;
  suggestedVenueAddress?: string;
  suggestedVenueMapsUrl?: string;
  midpointNeighborhood?: string;
  triggerType: string;
  status: string;
  user1Response?: string;
  user2Response?: string;
}

interface Props {
  suggestion: MeetupSuggestion;
  currentUserId: string;
  userId1: string;
  otherUserName: string;
  onDismiss: () => void;
}

export default function MeetupSuggestionCard({
  suggestion,
  currentUserId,
  userId1,
  otherUserName,
  onDismiss,
}: Props) {
  const [responding, setResponding] = useState(false);
  const [myResponse, setMyResponse] = useState<string | null>(null);
  const { theme } = useTheme();

  const isUser1 = currentUserId === userId1;
  const myResponseField = isUser1 ? 'user_1_response' : 'user_2_response';
  const theirResponse = isUser1 ? suggestion.user2Response : suggestion.user1Response;
  const existingMyResponse = isUser1 ? suggestion.user1Response : suggestion.user2Response;

  const handleRespond = async (response: 'yes' | 'no') => {
    setResponding(true);
    setMyResponse(response);

    try {
      const update: any = { [myResponseField]: response };

      const bothSaidYes =
        (isUser1 && response === 'yes' && theirResponse === 'yes') ||
        (!isUser1 && response === 'yes' && suggestion.user1Response === 'yes');

      if (bothSaidYes) update.status = 'accepted_both';
      else if (response === 'yes') update.status = 'accepted_one';
      else if (response === 'no') update.status = 'dismissed';

      await supabase
        .from('meetup_suggestions')
        .update(update)
        .eq('id', suggestion.id);

      if (response === 'no') onDismiss();
    } catch (e) {
      console.error(e);
    } finally {
      setResponding(false);
    }
  };

  const openMaps = () => {
    if (suggestion.suggestedVenueMapsUrl) {
      Linking.openURL(suggestion.suggestedVenueMapsUrl);
    }
  };

  if (suggestion.status === 'accepted_both') {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: 'rgba(76,175,80,0.25)' }]}>
        <View style={styles.confirmedHeader}>
          <Feather name="check-circle" size={20} color="#4CAF50" />
          <Text style={[styles.confirmedTitle, { color: '#4CAF50' }]}>Meetup confirmed!</Text>
        </View>
        {suggestion.suggestedVenueName ? (
          <Pressable style={[styles.venueRow, { backgroundColor: theme.backgroundRoot }]} onPress={openMaps}>
            <Feather name="map-pin" size={16} color="#ff6b5b" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.venueName, { color: theme.text }]}>{suggestion.suggestedVenueName}</Text>
              <Text style={[styles.venueAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                {suggestion.suggestedVenueAddress}
              </Text>
            </View>
            <Text style={styles.mapsLink}>Open Maps</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (myResponse === 'yes' || existingMyResponse === 'yes') {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: 'rgba(255,107,91,0.2)' }]}>
        <View style={styles.header}>
          <Feather name="coffee" size={22} color="#ff6b5b" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.title, { color: theme.text }]}>You're down to meet!</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Waiting for {otherUserName} to respond...
            </Text>
          </View>
        </View>
        {suggestion.suggestedVenueName ? (
          <Pressable style={[styles.venueRow, { backgroundColor: theme.backgroundRoot }]} onPress={openMaps}>
            <Feather name="map-pin" size={16} color="#ff6b5b" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.venueName, { color: theme.text }]}>{suggestion.suggestedVenueName}</Text>
              <Text style={[styles.venueAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                {suggestion.suggestedVenueAddress}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: 'rgba(255,107,91,0.2)' }]}>
      <View style={styles.header}>
        <Feather name="coffee" size={22} color="#ff6b5b" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.title, { color: theme.text }]}>You two seem like a great fit!</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Want to meet {otherUserName} in person?
            {suggestion.midpointNeighborhood
              ? ` We found a spot ${suggestion.midpointNeighborhood}.`
              : ''}
          </Text>
        </View>
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {suggestion.suggestedVenueName ? (
        <Pressable style={[styles.venueRow, { backgroundColor: theme.backgroundRoot }]} onPress={openMaps}>
          <Feather name="map-pin" size={16} color="#ff6b5b" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.venueName, { color: theme.text }]}>{suggestion.suggestedVenueName}</Text>
            <Text style={[styles.venueAddress, { color: theme.textSecondary }]} numberOfLines={1}>
              {suggestion.suggestedVenueAddress}
            </Text>
          </View>
          <Text style={styles.mapsLink}>View</Text>
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.yesButton, responding && { opacity: 0.6 }]}
          onPress={() => handleRespond('yes')}
          disabled={responding}
        >
          {responding
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
              <Feather name="coffee" size={16} color="#fff" />
              <Text style={styles.yesText}>Yes, let's meet!</Text>
            </>
          }
        </Pressable>
        <Pressable
          style={[styles.noButton, { borderColor: theme.border }]}
          onPress={() => handleRespond('no')}
          disabled={responding}
        >
          <Text style={[styles.noText, { color: theme.textSecondary }]}>Not yet</Text>
        </Pressable>
      </View>

      {theirResponse === 'yes' ? (
        <View style={styles.theyRespondedBanner}>
          <Feather name="heart" size={12} color="#ff6b5b" />
          <Text style={styles.theyRespondedText}>
            {otherUserName} already said yes!
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  confirmedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  confirmedTitle: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  dismissButton: { padding: 2 },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  venueName: { fontSize: 13, fontWeight: '600' },
  venueAddress: { fontSize: 11, marginTop: 1 },
  mapsLink: { fontSize: 12, color: '#ff6b5b', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8 },
  yesButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ff6b5b',
  },
  yesText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  noText: { fontSize: 13 },
  theyRespondedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  theyRespondedText: { fontSize: 12, color: '#ff6b5b', fontWeight: '500' },
});
