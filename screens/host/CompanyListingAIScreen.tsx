import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Image, Modal,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  getShortlistedRenters,
  removeFromShortlist,
  runAIPairing,
  sendAutoInvite,
  CompanyShortlistedRenter,
} from '../../services/companyMatchmakerService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

export const CompanyListingAIScreen = () => {
  const route = useRoute<any>();
  const { listingId, autoRunPairing } = route.params || {};
  const { user } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<any>(null);
  const [shortlisted, setShortlisted] = useState<CompanyShortlistedRenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingResult, setPairingResult] = useState<any>(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let listingData: any = null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.from('listings').select('*').eq('id', listingId).single();
        listingData = data;
      }
      const renters = await getShortlistedRenters(user!.id, listingId);
      setListing(listingData);
      setShortlisted(renters);
    } catch (e) {
      console.error('[CompanyListingAI] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [listingId, user]);

  useEffect(() => {
    loadData();
    if (autoRunPairing) {
      setTimeout(() => handleAIPairing(), 1000);
    }
  }, []);

  const handleAIPairing = async () => {
    if (shortlisted.length < 2) {
      showAlert({ title: 'Need More Candidates', message: 'Shortlist at least 2 renters for this unit before running AI pairing.' });
      return;
    }
    setPairingLoading(true);
    setShowPairingModal(true);
    try {
      const result = await runAIPairing(user!.id, listingId);
      setPairingResult(result);
    } catch (e) {
      showAlert({ title: 'AI Pairing Failed', message: 'Could not run AI pairing. Please try again.' });
      setShowPairingModal(false);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleSendInvite = async () => {
    const profiles = pairingResult?.recommendedGroupProfiles;
    if (!profiles?.length) return;

    const confirmed = await confirm({
      title: 'Send Group Invite',
      message: `This will create a renter group with ${profiles.length} recommended candidates and send them an invite for your listing.`,
      confirmText: 'Send Invites',
    });
    if (!confirmed) return;

    setInviteSending(true);
    try {
      const memberIds = profiles.map((p: any) => p.id).filter(Boolean);
      if (!memberIds.length) {
        showAlert({ title: 'Error', message: 'No valid candidates found.' });
        return;
      }

      if (isSupabaseConfigured) {
        const { data: newGroup, error: groupError } = await supabase
          .from('groups')
          .insert({
            name: `${listing?.neighborhood || 'Listing'} Group`,
            type: 'listing_inquiry',
            listing_id: listingId,
            host_id: user!.id,
            created_by: user!.id,
            max_members: memberIds.length,
          })
          .select('id')
          .single();

        if (groupError || !newGroup) {
          throw new Error(groupError?.message || 'Failed to create group');
        }

        const memberRows = memberIds.map((mid: string) => ({
          group_id: newGroup.id,
          user_id: mid,
          role: 'member',
          status: 'pending',
        }));
        await supabase.from('group_members').insert(memberRows);

        await sendAutoInvite(
          user!.id,
          listingId,
          newGroup.id,
          pairingResult.confidence || 0,
          pairingResult.recommendation
        );
      }

      showAlert({ title: 'Invites Sent', message: 'The renter group has been created and notified about your property.' });
      setShowPairingModal(false);
      loadData();
    } catch (e: any) {
      console.error('[CompanyListingAI] Invite error:', e);
      showAlert({ title: 'Error', message: e.message || 'Could not send invite. Try again.' });
    } finally {
      setInviteSending(false);
    }
  };

  const handleRemove = async (renterId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeFromShortlist(user!.id, renterId, listingId);
    setShortlisted(prev => prev.filter(r => r.renterId !== renterId));
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const bedroomsNeeded = listing ? listing.bedrooms - (listing.host_lives_in ? 1 : 0) : 2;
  const isReadyToPair = shortlisted.length >= bedroomsNeeded;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>AI Group Pairing</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {listing ? (
          <View style={styles.listingHeader}>
            <Text style={styles.listingAddress}>{listing.address || 'Listing'}</Text>
            <Text style={styles.listingDetails}>
              {listing.bedrooms}BR  ·  ${listing.price}/mo  ·  {listing.neighborhood || listing.city}
            </Text>
            <View style={styles.needRow}>
              <Feather name="users" size={14} color={ACCENT} />
              <Text style={styles.needText}>
                Need {bedroomsNeeded} renter{bedroomsNeeded !== 1 ? 's' : ''} to fill this unit
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.aiSection}>
          <Pressable
            style={[styles.aiButton, !isReadyToPair ? styles.aiButtonDisabled : null]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleAIPairing();
            }}
            disabled={!isReadyToPair}
          >
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.aiButtonText}>
              {isReadyToPair
                ? 'Ask Claude: Who Should Move In?'
                : `Add ${bedroomsNeeded - shortlisted.length} more to run AI pairing`}
            </Text>
          </Pressable>
          {shortlisted.length > 0 ? (
            <Text style={styles.aiSubtext}>
              {shortlisted.length} candidate{shortlisted.length !== 1 ? 's' : ''} shortlisted
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Shortlisted for This Unit</Text>

        {shortlisted.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="user-plus" size={40} color="#444" />
            <Text style={styles.emptyText}>No renters shortlisted yet.</Text>
            <Text style={styles.emptySubtext}>
              Browse renters and tap the bookmark icon to shortlist them for this unit.
            </Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => navigation.navigate('BrowseRenters', { targetListingId: listingId })}
            >
              <Text style={styles.browseButtonText}>Browse Renters</Text>
              <Feather name="arrow-right" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {shortlisted.map(renter => (
          <View key={renter.id} style={styles.renterCard}>
            {renter.avatarUrl ? (
              <Image source={{ uri: renter.avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {renter.fullName?.[0]?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.renterInfo}>
              <Text style={styles.renterName}>{renter.fullName}</Text>
              <Text style={styles.renterOccupation}>{renter.occupation || 'No occupation listed'}</Text>
              <View style={styles.renterTags}>
                {renter.budgetPerPersonMax ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>${renter.budgetPerPersonMax}/mo</Text>
                  </View>
                ) : null}
                {renter.moveInDate ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      Move {new Date(renter.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                ) : null}
                {renter.smoking ? <View style={[styles.tag, styles.tagWarning]}><Text style={styles.tagText}>Smoker</Text></View> : null}
                {renter.pets ? <View style={[styles.tag, styles.tagWarning]}><Text style={styles.tagText}>Has pets</Text></View> : null}
              </View>
            </View>
            <Pressable onPress={() => handleRemove(renter.renterId)} style={styles.removeButton}>
              <Feather name="x-circle" size={20} color="#555" />
            </Pressable>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showPairingModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Group Recommendation</Text>
            <Pressable onPress={() => setShowPairingModal(false)} style={styles.modalClose}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          {pairingLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.loadingText}>Claude is analyzing your candidates...</Text>
            </View>
          ) : pairingResult ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceCircle}>
                  <Text style={styles.confidenceNumber}>{pairingResult.confidence || 0}%</Text>
                  <Text style={styles.confidenceLabel}>confidence</Text>
                </View>
                <View style={[styles.confidenceCircle, { borderColor: '#2ecc71' }]}>
                  <Text style={styles.confidenceNumber}>{pairingResult.fillScore || 0}%</Text>
                  <Text style={styles.confidenceLabel}>fill score</Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  {pairingResult.estimatedFillTime ? (
                    <Text style={styles.estimatedFill}>Est. fill: {pairingResult.estimatedFillTime}</Text>
                  ) : null}
                  <Text style={styles.aiRec}>{pairingResult.recommendation}</Text>
                </View>
              </View>

              <Text style={styles.groupLabel}>Recommended Group</Text>
              {pairingResult.recommendedGroupProfiles?.map((profile: any, i: number) => (
                <View key={i} style={styles.profileRow}>
                  <LinearGradient colors={[ACCENT + '40', ACCENT + '20']} style={styles.profileAvatar}>
                    <Text style={styles.profileInitial}>{profile.full_name?.[0] || profile.first_name?.[0] || '?'}</Text>
                  </LinearGradient>
                  <Text style={styles.profileName}>{profile.full_name || `${profile.first_name} ${profile.last_name}`}</Text>
                  <Text style={styles.profileBudget}>${profile.budget_per_person_max || profile.budget_max || '?'}/mo</Text>
                </View>
              ))}

              <Text style={styles.groupLabel}>Why This Group</Text>
              {pairingResult.reasons?.map((r: string, i: number) => (
                <View key={i} style={styles.reasonRow}>
                  <Feather name="check-circle" size={14} color="#2ecc71" />
                  <Text style={styles.reasonText}>{r}</Text>
                </View>
              ))}

              {pairingResult.concerns?.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>Watch Out For</Text>
                  {pairingResult.concerns.map((c: string, i: number) => (
                    <View key={i} style={styles.reasonRow}>
                      <Feather name="alert-triangle" size={14} color="#FF8C00" />
                      <Text style={styles.reasonText}>{c}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <Pressable
                style={[styles.inviteButton, inviteSending ? { opacity: 0.6 } : null]}
                onPress={handleSendInvite}
                disabled={inviteSending}
              >
                {inviteSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.inviteButtonText}>Invite This Group to Your Listing</Text>
                  </>
                )}
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  listingHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  listingAddress: { fontSize: 18, fontWeight: '700', color: '#fff' },
  listingDetails: { fontSize: 13, color: '#888', marginTop: 4 },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  needText: { fontSize: 13, color: ACCENT, fontWeight: '500' },
  aiSection: { padding: 16 },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    padding: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  aiButtonDisabled: { backgroundColor: '#333' },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiSubtext: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 4, paddingHorizontal: 32 },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: ACCENT,
    borderRadius: 20,
  },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  renterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  renterInfo: { flex: 1 },
  renterName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  renterOccupation: { fontSize: 12, color: '#888', marginTop: 2 },
  renterTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#222', borderRadius: 10 },
  tagWarning: { backgroundColor: '#3d2b00' },
  tagText: { fontSize: 11, color: '#ccc' },
  removeButton: { padding: 4 },
  modal: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, padding: 16 },
  loadingText: { marginTop: 16, color: '#888', fontSize: 14, textAlign: 'center' },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    marginBottom: 16,
  },
  confidenceCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  confidenceNumber: { fontSize: 18, fontWeight: '800', color: '#fff' },
  confidenceLabel: { fontSize: 9, color: '#888', textAlign: 'center' },
  estimatedFill: { fontSize: 12, color: '#FF8C00', fontWeight: '600', marginBottom: 4 },
  aiRec: { fontSize: 13, color: '#ccc', lineHeight: 18 },
  groupLabel: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 8 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    marginBottom: 6,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: { fontSize: 14, fontWeight: '700', color: ACCENT },
  profileName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  profileBudget: { fontSize: 13, color: '#888' },
  reasonRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontSize: 13, color: '#ccc', lineHeight: 18 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 24,
  },
  inviteButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
