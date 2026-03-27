import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { Property, RoommateProfile } from '../../types/models';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  AgentRenter,
  AgentGroup,
  getShortlistedRenterIds,
  getAgentGroups,
  createAgentGroup,
  sendAgentInvites,
  calculatePairMatrix,
} from '../../services/agentMatchmakerService';
import { canAgentCreateGroup, getAgentPlanLimits, type AgentPlan } from '../../constants/planLimits';
import { useAgentPairing } from '../../hooks/useAgentPairing';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const YELLOW = '#f39c12';

export const AgentGroupBuilderScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();

  const preselectedIds: string[] = route.params?.preselectedIds ?? [];
  const preselectedListingId: string | undefined = route.params?.listingId;
  const openAIPairing: boolean = route.params?.openAIPairing ?? false;

  const [allRenters, setAllRenters] = useState<AgentRenter[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedIds));
  const [listings, setListings] = useState<Property[]>([]);
  const [selectedListing, setSelectedListing] = useState<Property | null>(null);
  const [agentMessage, setAgentMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<'select' | 'review'>('select');
  const [showPairingModal, setShowPairingModal] = useState(false);

  const agentPlan: AgentPlan = (user?.agentPlan as AgentPlan) || 'pay_per_use';
  const planLimits = getAgentPlanLimits(agentPlan);
  const { getPairing, loading: pairingLoading, result: pairingResult, error: pairingError, reset: resetPairing } = useAgentPairing();

  const handleAIPairing = async () => {
    if (!selectedListing || selectedIds.size < 2) return;
    setShowPairingModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await getPairing(Array.from(selectedIds), selectedListing.id);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openAIPairing && selectedListing && selectedIds.size >= 2) {
      handleAIPairing();
    }
  }, [openAIPairing, selectedListing]);

  const loadData = async () => {
    if (!user) return;
    const shortlistedIds = await getShortlistedRenterIds(user.id);

    if (shortlistedIds.length > 0 && isSupabaseConfigured) {
      try {
        const { data: supaRenters } = await supabase
          .from('users')
          .select(`
            id, full_name, avatar_url, age, occupation, gender, bio,
            profile:profiles(
              budget_max, budget_min, budget_per_person_min, budget_per_person_max,
              move_in_date, room_type, cleanliness, sleep_schedule, smoking, pets, interests, photos, bio
            )
          `)
          .in('id', shortlistedIds);

        const mapped: AgentRenter[] = (supaRenters || []).map((u: any) => {
          const p = Array.isArray(u.profile) ? u.profile[0] : u.profile;
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || (u.avatar_url ? [u.avatar_url] : []),
            budgetMin: p?.budget_per_person_min ?? (p?.budget_max ? p.budget_max * 0.8 : undefined),
            budgetMax: p?.budget_per_person_max ?? p?.budget_max,
            moveInDate: p?.move_in_date,
            cleanliness: p?.cleanliness,
            sleepSchedule: p?.sleep_schedule,
            smoking: p?.smoking,
            pets: p?.pets === 'yes' || p?.pets === true,
            interests: p?.interests || [],
            roomType: p?.room_type,
            gender: u.gender,
            bio: p?.bio || u.bio,
          };
        });
        setAllRenters(mapped);
      } catch (e) {
        console.warn('[AgentGroupBuilder] Supabase renter load failed, falling back:', e);
        const profiles: RoommateProfile[] = await StorageService.getRoommateProfiles();
        const mapped: AgentRenter[] = profiles
          .filter(p => shortlistedIds.includes(p.id))
          .map(p => ({
            id: p.id, name: p.name, age: p.age, occupation: p.occupation,
            photos: p.photos || [], budgetMin: p.budget ? p.budget * 0.8 : undefined,
            budgetMax: p.budget, moveInDate: p.preferences?.moveInDate,
            cleanliness: p.lifestyle?.cleanliness, sleepSchedule: p.lifestyle?.workSchedule,
            smoking: p.lifestyle?.smoking, pets: p.lifestyle?.pets,
            interests: p.profileData?.interests || [], roomType: p.lookingFor,
            bio: p.bio, gender: p.gender,
          }));
        setAllRenters(mapped);
      }
    } else if (shortlistedIds.length > 0) {
      const profiles: RoommateProfile[] = await StorageService.getRoommateProfiles();
      const mapped: AgentRenter[] = profiles
        .filter(p => shortlistedIds.includes(p.id))
        .map(p => ({
          id: p.id, name: p.name, age: p.age, occupation: p.occupation,
          photos: p.photos || [], budgetMin: p.budget ? p.budget * 0.8 : undefined,
          budgetMax: p.budget, moveInDate: p.preferences?.moveInDate,
          cleanliness: p.lifestyle?.cleanliness, sleepSchedule: p.lifestyle?.workSchedule,
          smoking: p.lifestyle?.smoking, pets: p.lifestyle?.pets,
          interests: p.profileData?.interests || [], roomType: p.lookingFor,
          bio: p.bio, gender: p.gender,
        }));
      setAllRenters(mapped);
    }

    let myListings: Property[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data: supaListings } = await supabase
          .from('listings')
          .select('id, title, rent, bedrooms, bathrooms, city, neighborhood, address, photos, amenities, host_id, available_date, coordinates, is_active, is_paused, is_rented')
          .eq('host_id', user.id)
          .eq('is_active', true)
          .eq('is_rented', false);

        myListings = (supaListings || []).map((l: any) => ({
          id: l.id, title: l.title, price: l.rent || 0, bedrooms: l.bedrooms,
          bathrooms: l.bathrooms, city: l.city, neighborhood: l.neighborhood,
          address: l.address, photos: l.photos || [], amenities: l.amenities || [],
          hostId: l.host_id, available: true,
          availableDate: l.available_date ? new Date(l.available_date) : undefined,
          latitude: l.coordinates?.lat ?? l.coordinates?.latitude,
          longitude: l.coordinates?.lng ?? l.coordinates?.longitude,
        }));
      } catch (e) {
        console.warn('[AgentGroupBuilder] Supabase listings failed, falling back:', e);
        const props = await StorageService.getProperties();
        myListings = props.filter(p => p.hostId === user.id && p.available);
      }
    } else {
      const props = await StorageService.getProperties();
      myListings = props.filter(p => p.hostId === user.id && p.available);
    }
    setListings(myListings);

    if (preselectedListingId) {
      const found = myListings.find(l => l.id === preselectedListingId);
      if (found) setSelectedListing(found);
    }
  };

  const selectedRenters = allRenters.filter(r => selectedIds.has(r.id));

  const matrix = calculatePairMatrix(selectedRenters);
  const avgCompatibility = matrix.length > 0
    ? Math.round(matrix.reduce((sum, p) => sum + p.score, 0) / matrix.length)
    : 0;

  const combinedBudgetMin = selectedRenters.reduce((sum, r) => sum + (r.budgetMin ?? 0), 0);
  const combinedBudgetMax = selectedRenters.reduce((sum, r) => sum + (r.budgetMax ?? 0), 0);
  const coversRent = selectedListing ? combinedBudgetMax >= selectedListing.price : false;

  const toggleRenter = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendInvites = async () => {
    if (!user || !selectedListing || selectedRenters.length < 2) return;

    const existingGroups = await getAgentGroups(user.id);
    const activeGroupCount = existingGroups.filter(
      g => g.groupStatus !== 'dissolved' && g.groupStatus !== 'placed'
    ).length;
    if (!canAgentCreateGroup(agentPlan, activeGroupCount)) {
      showAlert({ title: 'Group Limit', message: 'Upgrade your plan to create more groups.' });
      return;
    }

    setSending(true);
    try {
      const group: AgentGroup = {
        id: `ag_${Date.now()}`,
        name: `${selectedListing.title} - Agent Group`,
        agentId: user.id,
        targetListingId: selectedListing.id,
        targetListing: selectedListing,
        members: selectedRenters,
        memberIds: selectedRenters.map(r => r.id),
        groupStatus: 'invited',
        avgCompatibility,
        combinedBudgetMin,
        combinedBudgetMax,
        coversRent,
        invites: [],
        createdAt: new Date().toISOString(),
        agentMessage,
      };

      const createdGroup = await createAgentGroup(group);
      await sendAgentInvites(
        user.id,
        user.name,
        createdGroup.id,
        selectedRenters.map(r => r.id),
        selectedListing,
        agentMessage,
        selectedRenters.map(r => ({ id: r.id, name: r.name, photo: r.photos?.[0] }))
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ title: 'Invites Sent', message: `Group invites sent to ${selectedRenters.length} renters.` });
      navigation.goBack();
    } catch (e) {
      showAlert({ title: 'Error', message: 'Failed to send invites. Please try again.' });
    }
    setSending(false);
  };

  if (step === 'review') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setStep('select')} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Review Group</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}>
          {selectedListing ? (
            <View style={styles.listingCard}>
              <Text style={styles.listingLabel}>Group for:</Text>
              <Text style={styles.listingName}>"{selectedListing.title}"</Text>
              <Text style={styles.listingMeta}>
                ${selectedListing.price.toLocaleString()}/mo - {selectedListing.bedrooms}BR
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Members ({selectedRenters.length})</Text>
          {selectedRenters.map(r => (
            <View key={r.id} style={styles.memberRow}>
              {r.photos?.[0] ? (
                <Image source={{ uri: r.photos[0] }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={18} color="#666" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{r.name}</Text>
                <Text style={styles.memberMeta}>
                  ${r.budgetMin?.toLocaleString()}-${r.budgetMax?.toLocaleString()}/mo
                  {r.moveInDate ? ` | ${new Date(r.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Group compatibility:</Text>
              <Text style={[styles.summaryValue, { color: avgCompatibility >= 70 ? GREEN : YELLOW }]}>
                {avgCompatibility}%
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Combined budget:</Text>
              <Text style={styles.summaryValue}>
                ${combinedBudgetMin.toLocaleString()}-${combinedBudgetMax.toLocaleString()}/mo
              </Text>
            </View>
            {selectedListing ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Covers rent:</Text>
                <Text style={[styles.summaryValue, { color: coversRent ? GREEN : ACCENT }]}>
                  {coversRent ? 'Yes' : 'May not cover'}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Your Message (optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a personal note to your invites..."
            placeholderTextColor="#555"
            multiline
            value={agentMessage}
            onChangeText={setAgentMessage}
          />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.sendBtn, sending ? styles.sendBtnDisabled : null]}
            onPress={handleSendInvites}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={styles.sendBtnText}>Send Invites to All</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Build Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}>
        <Text style={styles.sectionTitle}>Select Target Listing</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {listings.map(l => (
            <Pressable
              key={l.id}
              style={[styles.listingChip, selectedListing?.id === l.id ? styles.listingChipActive : null]}
              onPress={() => setSelectedListing(l)}
            >
              <Text style={[styles.listingChipText, selectedListing?.id === l.id ? { color: '#fff' } : null]}>
                {l.title} ({l.bedrooms}BR)
              </Text>
            </Pressable>
          ))}
          {listings.length === 0 ? (
            <Text style={styles.emptyText}>No active listings</Text>
          ) : null}
        </ScrollView>

        {planLimits.hasAIGroupSuggestions && selectedListing && selectedIds.size >= 2 ? (
          <Pressable style={styles.aiPairButton} onPress={handleAIPairing}>
            <Feather name="zap" size={16} color="#fff" />
            <Text style={styles.aiPairButtonText}>AI Pair Group</Text>
          </Pressable>
        ) : !planLimits.hasAIGroupSuggestions ? (
          <Pressable
            style={styles.aiPairButtonLocked}
            onPress={() => navigation.navigate('Plans')}
          >
            <Feather name="lock" size={14} color={ACCENT} />
            <Text style={styles.aiPairLockedText}>Upgrade to Pro for AI Pairing</Text>
          </Pressable>
        ) : null}

        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            Selected: {selectedIds.size} renters
          </Text>
          {selectedIds.size >= 2 ? (
            <Text style={[styles.statsText, { color: avgCompatibility >= 70 ? GREEN : YELLOW }]}>
              Avg compatibility: {avgCompatibility}%
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Select Renters from Shortlist</Text>
        {allRenters.map(r => {
          const isSelected = selectedIds.has(r.id);
          return (
            <Pressable
              key={r.id}
              style={[styles.renterSelectCard, isSelected ? styles.renterSelectCardActive : null]}
              onPress={() => toggleRenter(r.id)}
            >
              <View style={[styles.checkCircle, isSelected ? styles.checkCircleActive : null]}>
                {isSelected ? <Feather name="check" size={14} color="#fff" /> : null}
              </View>
              {r.photos?.[0] ? (
                <Image source={{ uri: r.photos[0] }} style={styles.selectAvatar} />
              ) : (
                <View style={[styles.selectAvatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={16} color="#666" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.selectName}>{r.name}, {r.age}</Text>
                <Text style={styles.selectMeta}>{r.occupation}</Text>
                {r.budgetMax ? (
                  <Text style={styles.selectBudget}>${r.budgetMax.toLocaleString()}/mo max</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {allRenters.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={40} color="#555" />
            <Text style={styles.emptyTitle}>No Shortlisted Renters</Text>
            <Text style={styles.emptyDesc}>Browse renters and shortlist some first.</Text>
          </View>
        ) : null}
      </ScrollView>

      {selectedIds.size >= 2 && selectedListing ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.reviewBtn} onPress={() => setStep('review')}>
            <Text style={styles.reviewBtnText}>Review Group ({selectedIds.size} members)</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={showPairingModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowPairingModal(false); resetPairing(); }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Group Pairing</Text>
            <Pressable onPress={() => { setShowPairingModal(false); resetPairing(); }}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          {pairingLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.loadingText}>Claude is analyzing your shortlist...</Text>
              <Text style={styles.loadingSubtext}>Checking budgets, schedules, and transit</Text>
            </View>
          ) : null}

          {!pairingLoading && pairingResult ? (
            <ScrollView style={styles.resultScroll}>
              <View style={styles.headlineCard}>
                <View style={styles.confidenceRow}>
                  <Feather name="zap" size={14} color={ACCENT} />
                  <Text style={styles.confidenceText}>
                    {pairingResult.confidence}% confidence
                  </Text>
                </View>
                <Text style={styles.headline}>{pairingResult.headline}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Recommended Group</Text>
                {(pairingResult.groupNames ?? []).map((name, i) => (
                  <View key={i} style={styles.modalMemberRow}>
                    <Feather name="user" size={14} color={ACCENT} />
                    <Text style={styles.modalMemberName}>{name}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Why this group works</Text>
                {(pairingResult.reasons ?? []).map((reason, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <Text style={styles.reasonBullet}>{'\u2022'}</Text>
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>

              {(pairingResult.concerns ?? []).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Things to confirm</Text>
                  {(pairingResult.concerns ?? []).map((concern, i) => (
                    <View key={i} style={styles.concernRow}>
                      <Feather name="alert-circle" size={13} color={YELLOW} />
                      <Text style={styles.concernText}>{concern}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {pairingResult.alternativeGroup ? (
                <View style={styles.altSection}>
                  <Text style={styles.altTitle}>Alternative Option</Text>
                  <Text style={styles.altReason}>{pairingResult.alternativeReason}</Text>
                </View>
              ) : null}

              {(pairingResult.excludedRenters ?? []).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Not recommended for this listing</Text>
                  {(pairingResult.excludedRenters ?? []).map((r, i) => (
                    <View key={i} style={styles.excludedRow}>
                      <Text style={styles.excludedName}>{r.name}</Text>
                      <Text style={styles.excludedReason}>{r.reason}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.useGroupButton}
                  onPress={() => {
                    setSelectedIds(new Set(pairingResult.recommendedGroup));
                    setShowPairingModal(false);
                    resetPairing();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Text style={styles.useGroupText}>Use This Group</Text>
                </Pressable>

                {pairingResult.alternativeGroup ? (
                  <Pressable
                    style={styles.useAltButton}
                    onPress={() => {
                      setSelectedIds(new Set(pairingResult.alternativeGroup!));
                      setShowPairingModal(false);
                      resetPairing();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  >
                    <Text style={styles.useAltText}>Use Alternative</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.aiFooter}>Powered by Claude AI</Text>
            </ScrollView>
          ) : null}

          {!pairingLoading && pairingError ? (
            <View style={styles.errorState}>
              <Feather name="alert-circle" size={32} color="#e74c3c" />
              <Text style={styles.errorText}>{pairingError}</Text>
              <Pressable style={styles.retryButton} onPress={handleAIPairing}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  listingChip: { backgroundColor: CARD_BG, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, borderWidth: 1, borderColor: '#333' },
  listingChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(255,107,91,0.15)' },
  listingChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  emptyText: { color: '#666', fontSize: 14 },
  statsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statsText: { color: '#999', fontSize: 13, fontWeight: '600' },
  renterSelectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: 'transparent' },
  renterSelectCardActive: { borderColor: ACCENT, backgroundColor: 'rgba(255,107,91,0.08)' },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { borderColor: ACCENT, backgroundColor: ACCENT },
  selectAvatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  selectName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  selectMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  selectBudget: { color: '#2ecc71', fontSize: 12, marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: '#222' },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14 },
  reviewBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listingCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 16 },
  listingLabel: { color: '#888', fontSize: 12 },
  listingName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  listingMeta: { color: '#aaa', fontSize: 14, marginTop: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD_BG, borderRadius: 12, padding: 12, marginBottom: 8 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  summaryCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginTop: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: '#aaa', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  messageInput: { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyDesc: { color: '#888', fontSize: 14, marginTop: 4 },
  aiPairButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  aiPairButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  aiPairButtonLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,107,91,0.08)', borderRadius: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,107,91,0.2)' },
  aiPairLockedText: { color: '#888', fontSize: 13, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: BG },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingSubtext: { color: '#888', fontSize: 13 },
  resultScroll: { flex: 1 },
  headlineCard: { margin: 16, padding: 16, backgroundColor: CARD_BG, borderRadius: 12 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  confidenceText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  headline: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSection: { marginHorizontal: 16, marginBottom: 16 },
  modalSectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  modalMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  modalMemberName: { color: '#fff', fontSize: 14 },
  reasonRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  reasonBullet: { color: ACCENT, fontSize: 14 },
  reasonText: { color: '#ccc', fontSize: 13, flex: 1 },
  concernRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  concernText: { color: YELLOW, fontSize: 13, flex: 1 },
  altSection: { marginHorizontal: 16, marginBottom: 16, padding: 14, backgroundColor: CARD_BG, borderRadius: 12 },
  altTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  altReason: { color: '#aaa', fontSize: 13 },
  excludedRow: { marginBottom: 8 },
  excludedName: { color: '#888', fontSize: 13, fontWeight: '600' },
  excludedReason: { color: '#555', fontSize: 12 },
  actionButtons: { marginTop: 8 },
  useGroupButton: { backgroundColor: ACCENT, borderRadius: 12, padding: 16, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  useGroupText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  useAltButton: { borderWidth: 1, borderColor: ACCENT, borderRadius: 12, padding: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  useAltText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  aiFooter: { color: '#444', fontSize: 10, textAlign: 'center', marginBottom: 32 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: '#e74c3c', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryButton: { backgroundColor: CARD_BG, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
