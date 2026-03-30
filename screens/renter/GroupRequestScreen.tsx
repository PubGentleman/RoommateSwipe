import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { requestToJoin } from '../../services/groupJoinService';
import { OpenGroupListing } from '../../types/models';
import { Image } from 'expo-image';
import { Spacing } from '../../constants/theme';

export default function GroupRequestScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const group = (route.params as any)?.group as OpenGroupListing;

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 60 }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>Group not found</Text>
      </View>
    );
  }

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await requestToJoin(user.id, group.id, group.groupType, message);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send request';
      Alert.alert('Request Failed', msg);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.centeredContent, { paddingTop: insets.top + 80 }]}>
          <View style={[styles.successCircle, { backgroundColor: '#22C55E20' }]}>
            <Feather name="check-circle" size={48} color="#22C55E" />
          </View>
          <Text style={[styles.successTitle, { color: theme.text }]}>Request Sent!</Text>
          <Text style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            The group has 48 hours to respond. We'll notify you either way.
          </Text>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const typeBadge = group.groupType === 'pi_auto'
    ? { label: 'Pi Matched', color: '#8B5CF6' }
    : { label: 'Friends', color: '#22C55E' };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Request to Join</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, { backgroundColor: typeBadge.color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
                {typeBadge.label}
              </Text>
            </View>
            <Text style={[styles.spotsText, { color: theme.primary }]}>
              {group.spotsOpen} spot{group.spotsOpen !== 1 ? 's' : ''} open
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Members</Text>
          {group.members.map(m => (
            <View key={m.user_id} style={styles.memberRow}>
              {m.photo ? (
                <Image source={{ uri: m.photo }} style={styles.memberPhoto} />
              ) : (
                <View style={[styles.memberPhotoPlaceholder, { backgroundColor: theme.border }]}>
                  <Feather name="user" size={16} color={theme.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: theme.text }]}>{m.name}</Text>
                {m.occupation ? (
                  <Text style={[styles.memberOcc, { color: theme.textSecondary }]}>{m.occupation}</Text>
                ) : null}
              </View>
              {m.age ? (
                <Text style={[styles.memberAge, { color: theme.textSecondary }]}>{m.age}</Text>
              ) : null}
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.detailsGrid}>
            {group.city ? (
              <View style={styles.detailItem}>
                <Feather name="map-pin" size={14} color={theme.textSecondary} />
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {group.neighborhoods?.join(', ') || group.city}
                </Text>
              </View>
            ) : null}
            {group.budgetMin || group.budgetMax ? (
              <View style={styles.detailItem}>
                <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  ${group.budgetMin?.toLocaleString() || '?'}-${group.budgetMax?.toLocaleString() || '?'}/mo
                </Text>
              </View>
            ) : null}
            {group.desiredBedrooms ? (
              <View style={styles.detailItem}>
                <Feather name="home" size={14} color={theme.textSecondary} />
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {group.desiredBedrooms} Bedroom{group.desiredBedrooms !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {group.compatibility ? (
          <View style={[styles.compatCard, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
            <View style={styles.compatHeader}>
              <Feather name="zap" size={18} color="#F59E0B" />
              <Text style={[styles.compatScore, { color: '#F59E0B' }]}>
                {Math.round(group.compatibility)}% Compatible
              </Text>
            </View>
            {group.piTake ? (
              <Text style={[styles.piTake, { color: theme.text }]}>{group.piTake}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20, marginBottom: 8 }]}>
          Say hi (optional)
        </Text>
        <TextInput
          style={[styles.messageInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          placeholder="Tell them a bit about yourself..."
          placeholderTextColor={theme.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: theme.textSecondary }]}>
          {message.length}/200
        </Text>

        <Pressable
          style={[styles.sendBtn, { backgroundColor: '#22C55E' }, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.sendBtnText}>Send Request</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  errorText: { fontSize: 16, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  groupCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  spotsText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberPhoto: { width: 40, height: 40, borderRadius: 20 },
  memberPhotoPlaceholder: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberOcc: { fontSize: 12, marginTop: 2 },
  memberAge: { fontSize: 13 },
  divider: { height: 1, marginVertical: 14 },
  detailsGrid: { gap: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailValue: { fontSize: 14 },
  compatCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 4 },
  compatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  compatScore: { fontSize: 16, fontWeight: '700' },
  piTake: { fontSize: 14, lineHeight: 20 },
  messageInput: {
    borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15,
    minHeight: 80, maxHeight: 120,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginBottom: 20 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 16, marginBottom: 12,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 14 },
  centeredContent: { alignItems: 'center', paddingHorizontal: 40 },
  successCircle: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  doneBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
