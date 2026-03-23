import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

export const CompanyGroupInviteScreen = () => {
  const route = useRoute<any>();
  const { listingId, groupId } = route.params || {};
  const { user } = useAuth();
  const { alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<any>(null);
  const [invite, setInvite] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [hostInfo, setHostInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const [listingRes, inviteRes, membersRes] = await Promise.all([
          supabase.from('listings').select('*').eq('id', listingId).single(),
          supabase.from('company_group_invites').select('*').eq('listing_id', listingId).eq('group_id', groupId).single(),
          supabase.from('group_members').select('user_id, users!group_members_user_id_fkey(full_name, avatar_url)').eq('group_id', groupId),
        ]);

        setListing(listingRes.data);
        setInvite(inviteRes.data);
        setMembers(membersRes.data?.map((m: any) => m.users) || []);

        if (listingRes.data?.host_id) {
          const { data: hostData } = await supabase
            .from('users')
            .select('full_name, company_name, avatar_url')
            .eq('id', listingRes.data.host_id)
            .single();
          setHostInfo(hostData);
        }
      } catch (e) {
        console.error('[CompanyGroupInvite] Error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleRespond = async (accept: boolean) => {
    setResponding(true);
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from('company_group_invites')
          .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
          .eq('listing_id', listingId)
          .eq('group_id', groupId);
      }

      if (accept) {
        navigation.replace('GroupApartmentSuggestions', { groupId, highlightListingId: listingId });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      showAlert({ title: 'Error', message: 'Could not respond. Try again.' });
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const pricePerPerson = listing
    ? Math.round(listing.price / Math.max(1, listing.bedrooms - (listing.host_lives_in ? 1 : 0)))
    : 0;
  const hostName = hostInfo?.company_name || hostInfo?.full_name || 'A property manager';

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <Feather name="arrow-left" size={20} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.headerSection}>
        <View style={styles.matchBadge}>
          <Feather name="zap" size={13} color={ACCENT} />
          <Text style={styles.matchBadgeText}>AI Matched Your Group</Text>
        </View>
        <Text style={styles.headline}>A Property Manager Selected Your Group</Text>
        <Text style={styles.subheadline}>
          {hostName} thinks your group is a great fit for their{' '}
          {listing?.neighborhood || 'available'} listing.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>THE APARTMENT</Text>
        <Text style={styles.cardAddress}>{listing?.address || 'Address not available'}</Text>
        <Text style={styles.cardNeighborhood}>{listing?.neighborhood || listing?.city || ''}</Text>
        <View style={styles.listingStats}>
          <View style={styles.stat}>
            <Feather name="home" size={16} color={ACCENT} />
            <Text style={styles.statText}>{listing?.bedrooms || '?'}BR</Text>
          </View>
          <View style={styles.stat}>
            <Feather name="dollar-sign" size={16} color={ACCENT} />
            <Text style={styles.statText}>${pricePerPerson}/mo each</Text>
          </View>
          <View style={styles.stat}>
            <Feather name="calendar" size={16} color={ACCENT} />
            <Text style={styles.statText}>
              Avail. {listing?.available_date
                ? new Date(listing.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'soon'}
            </Text>
          </View>
        </View>
      </View>

      {invite?.ai_reason ? (
        <View style={styles.aiReasonCard}>
          <Feather name="zap" size={14} color={ACCENT} />
          <Text style={styles.aiReasonText}>{invite.ai_reason}</Text>
        </View>
      ) : null}

      {invite?.match_score > 0 ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Group match score</Text>
          <Text style={styles.scoreValueText}>{invite.match_score}%</Text>
          <View style={styles.scoreTrack}>
            <View style={[styles.scoreFill, { width: `${invite.match_score}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>YOUR GROUP</Text>
        {members.map((m: any, i: number) => (
          <View key={i} style={styles.memberRow}>
            {m?.avatar_url ? (
              <Image source={{ uri: m.avatar_url }} style={styles.memberAvatar} />
            ) : (
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{m?.full_name?.[0] || '?'}</Text>
              </LinearGradient>
            )}
            <Text style={styles.memberName}>{m?.full_name || 'Member'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.acceptButton, responding ? { opacity: 0.6 } : null]}
          onPress={() => handleRespond(true)}
          disabled={responding}
        >
          {responding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.acceptText}>View This Apartment</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={styles.declineButton}
          onPress={() => handleRespond(false)}
          disabled={responding}
        >
          <Text style={styles.declineText}>Not Interested</Text>
        </Pressable>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 15, color: '#fff' },
  headerSection: { padding: 24, alignItems: 'center' },
  matchBadge: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: ACCENT + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  matchBadgeText: { color: ACCENT, fontSize: 12, fontWeight: '600' },
  headline: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subheadline: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: CARD_BG, margin: 16, marginBottom: 0, padding: 16, borderRadius: 16 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 10 },
  cardAddress: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cardNeighborhood: { fontSize: 13, color: '#888', marginTop: 2 },
  listingStats: { flexDirection: 'row', gap: 16, marginTop: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#ccc', fontWeight: '500' },
  aiReasonCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: ACCENT + '08',
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  aiReasonText: { flex: 1, fontSize: 13, color: '#ccc', lineHeight: 18 },
  scoreCard: {
    backgroundColor: CARD_BG,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreLabel: { fontSize: 13, color: '#888', flex: 1 },
  scoreValueText: { fontSize: 18, fontWeight: '800', color: ACCENT, width: 44 },
  scoreTrack: { flex: 2, height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 3 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  memberInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 14, color: '#fff', fontWeight: '500' },
  actions: { padding: 16, gap: 10 },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  declineButton: { padding: 14, alignItems: 'center' },
  declineText: { color: '#888', fontSize: 14 },
});
