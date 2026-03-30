import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  getGroupRequests,
  voteOnRequest,
  decideOnRequest,
} from '../../services/groupJoinService';
import { GroupJoinRequest } from '../../types/models';
import { Image } from 'expo-image';
import { Spacing } from '../../constants/theme';

export default function GroupRequestReviewScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as {
    groupId: string;
    groupType: 'pi_auto' | 'preformed';
    isLead?: boolean;
    memberCount?: number;
  };

  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [params.groupId]);

  const loadRequests = async () => {
    setLoading(true);
    const data = await getGroupRequests(params.groupId, params.groupType);
    setRequests(data);
    setLoading(false);
  };

  const handleVote = async (requestId: string, vote: 'approve' | 'decline') => {
    if (!user) return;
    setProcessing(requestId);
    try {
      if (params.groupType === 'preformed' && params.isLead) {
        await decideOnRequest(user.id, requestId, vote);
        Alert.alert(
          vote === 'approve' ? 'Approved' : 'Declined',
          vote === 'approve'
            ? 'They have been added to your group!'
            : 'The request has been declined.'
        );
      } else {
        const result = await voteOnRequest(user.id, requestId, vote);
        if (result.result === 'approved') {
          Alert.alert('Approved!', 'The group voted to accept this person.');
        } else if (result.result === 'declined') {
          Alert.alert('Declined', 'The group voted to decline this request.');
        } else {
          Alert.alert('Vote Recorded', 'Your vote has been recorded. Waiting for other members.');
        }
      }
      await loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setProcessing(null);
    }
  };

  const getTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return '';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h remaining`;
    const mins = Math.floor(ms / (1000 * 60));
    return `${mins}m remaining`;
  };

  const renderRequest = ({ item }: { item: GroupJoinRequest }) => {
    const req = item;
    const requester = req.requester;
    const alreadyVoted = req.approved_by?.includes(user?.id || '') || req.declined_by?.includes(user?.id || '');
    const votesIn = (req.approved_by?.length || 0) + (req.declined_by?.length || 0);
    const totalVoters = params.memberCount || 2;
    const isProcessing = processing === req.id;

    return (
      <View style={[styles.requestCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.requesterHeader}>
          {requester?.photos?.[0] ? (
            <Image source={{ uri: requester.photos[0] }} style={styles.requesterPhoto} />
          ) : (
            <View style={[styles.requesterPhotoPlaceholder, { backgroundColor: theme.border }]}>
              <Feather name="user" size={22} color={theme.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.requesterName, { color: theme.text }]}>
              {requester?.name || 'Someone'}
            </Text>
            {requester?.age ? (
              <Text style={[styles.requesterDetail, { color: theme.textSecondary }]}>
                {requester.age}{requester.occupation ? ` - ${requester.occupation}` : ''}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.timeRemaining, { color: theme.textSecondary }]}>
            {getTimeRemaining(req.expires_at)}
          </Text>
        </View>

        {requester?.bio ? (
          <Text style={[styles.requesterBio, { color: theme.text }]} numberOfLines={3}>
            {requester.bio}
          </Text>
        ) : null}

        {req.compatibility_score ? (
          <View style={styles.compatRow}>
            <Feather name="zap" size={14} color="#F59E0B" />
            <Text style={[styles.compatText, { color: '#F59E0B' }]}>
              {Math.round(req.compatibility_score)}% compatible
            </Text>
          </View>
        ) : null}

        {req.pi_take ? (
          <View style={[styles.piTakeBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.piTakeLabel, { color: '#8B5CF6' }]}>Pi's Take</Text>
            <Text style={[styles.piTakeText, { color: theme.text }]}>{req.pi_take}</Text>
          </View>
        ) : null}

        {req.requester_message ? (
          <View style={[styles.messageBox, { backgroundColor: theme.background }]}>
            <Feather name="message-circle" size={14} color={theme.textSecondary} />
            <Text style={[styles.messageText, { color: theme.text }]}>
              "{req.requester_message}"
            </Text>
          </View>
        ) : null}

        {params.groupType === 'pi_auto' && !params.isLead ? (
          <View style={styles.votingProgress}>
            <Text style={[styles.votingText, { color: theme.textSecondary }]}>
              {votesIn} of {totalVoters} members voted
            </Text>
          </View>
        ) : null}

        {alreadyVoted ? (
          <View style={[styles.votedBanner, { backgroundColor: theme.background }]}>
            <Feather name="check" size={16} color="#22C55E" />
            <Text style={[styles.votedText, { color: '#22C55E' }]}>You've voted</Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.declineBtn, { borderColor: theme.border }]}
              onPress={() => handleVote(req.id, 'decline')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Text style={[styles.declineBtnText, { color: theme.textSecondary }]}>Decline</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.approveBtn, { backgroundColor: '#22C55E' }]}
              onPress={() => handleVote(req.id, 'approve')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.approveBtnText}>Approve</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Join Requests</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending requests</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            When someone requests to join your group, it will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  requestCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  requesterHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  requesterPhoto: { width: 50, height: 50, borderRadius: 25 },
  requesterPhotoPlaceholder: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
  },
  requesterName: { fontSize: 17, fontWeight: '700' },
  requesterDetail: { fontSize: 13, marginTop: 2 },
  timeRemaining: { fontSize: 12 },
  requesterBio: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  compatText: { fontSize: 13, fontWeight: '600' },
  piTakeBox: { borderRadius: 10, padding: 12, marginBottom: 10 },
  piTakeLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  piTakeText: { fontSize: 14, lineHeight: 20 },
  messageBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  messageText: { fontSize: 14, lineHeight: 20, flex: 1, fontStyle: 'italic' },
  votingProgress: { marginBottom: 12 },
  votingText: { fontSize: 12 },
  votedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 12,
  },
  votedText: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center',
  },
  declineBtnText: { fontSize: 15, fontWeight: '600' },
  approveBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
