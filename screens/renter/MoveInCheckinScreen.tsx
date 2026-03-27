import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { supabase } from '../../lib/supabase';

const BG = '#111';

export default function MoveInCheckinScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};
  const [submitting, setSubmitting] = useState(false);

  const handleResponse = async (response: 'great' | 'okay' | 'no') => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('bookings')
        .update({ checkin_response: response })
        .eq('id', bookingId);

      if (response === 'great' || response === 'okay') {
        if (user) {
          await supabase.from('profiles')
            .update({
              search_paused: true,
              search_paused_at: new Date().toISOString(),
              search_paused_reason: 'moved_in',
            })
            .eq('user_id', user.id);
        }
        navigation.replace('MoveInSuccess');
      } else {
        navigation.goBack();
      }
    } catch (e) {
      console.error('[MoveInCheckin] Error:', e);
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.iconWrap}>
        <Feather name="home" size={56} color="#667eea" />
      </View>
      <ThemedText style={styles.title}>How's your new apartment?</ThemedText>
      <ThemedText style={styles.subtitle}>
        Hope the move went smoothly! Let us know how you're settling in.
      </ThemedText>

      {submitting ? (
        <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.options}>
          <Pressable style={styles.optionGreat} onPress={() => handleResponse('great')}>
            <Feather name="heart" size={18} color="#4CAF50" />
            <ThemedText style={styles.optionTextGreen}>Love it!</ThemedText>
          </Pressable>

          <Pressable style={styles.optionOkay} onPress={() => handleResponse('okay')}>
            <Feather name="thumbs-up" size={18} color="#667eea" />
            <ThemedText style={styles.optionTextBlue}>It's good</ThemedText>
          </Pressable>

          <Pressable style={styles.optionNo} onPress={() => handleResponse('no')}>
            <ThemedText style={styles.optionTextMuted}>Actually, it didn't work out</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(102,126,234,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
    marginBottom: 40,
  },
  options: {
    width: '100%',
    gap: 12,
  },
  optionGreat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
    borderRadius: 14,
    paddingVertical: 16,
  },
  optionOkay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(102,126,234,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    borderRadius: 14,
    paddingVertical: 16,
  },
  optionNo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  optionTextGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  optionTextBlue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  optionTextMuted: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
