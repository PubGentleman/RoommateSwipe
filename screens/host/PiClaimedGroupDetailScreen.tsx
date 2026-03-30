import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Image,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { PiAutoGroup, PiAutoGroupMember, PiGroupClaim, Property } from '../../types/models';
import {
  getAutoGroupMembers,
  getGroupClaims,
  releaseGroup,
} from '../../services/piAutoMatchService';
import { sendGroupMessage } from '../../services/groupService';
import { supabase } from '../../lib/supabase';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const PURPLE = '#a855f7';
const GOLD = '#ffd700';

type ClaimProgress = 'Claimed' | 'Contacted' | 'Applied' | 'Placed';
const CLAIM_STEPS: ClaimProgress[] = ['Claimed', 'Contacted', 'Applied', 'Placed'];

interface MemberProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  age?: number;
  bio?: string;
  occupation?: string;
  city?: string;
  compatibility_score?: number;
  pi_reason?: string;
}

export const PiClaimedGroupDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();

  const groupId = route.params?.groupId as string;

  const [group, setGroup] = useState<PiAutoGroup | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [claim, setClaim] = useState<PiGroupClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [claimStep, setClaimStep] = useState<ClaimProgress>('Claimed');
  const [listings, setListings] = useState<Property[]>([]);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [matchedListingId, setMatchedListingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId || !user) return;
    try {
      const [groupData, memberData, claimData] = await Promise.all([
        supabase.from('pi_auto_groups').select('*').eq('id', groupId).single(),
        getAutoGroupMembers(groupId),
        getGroupClaims(groupId),
      ]);

      if (groupData.data) setGroup(groupData.data as PiAutoGroup);

      const myClaim = claimData.find(c => c.host_id === user.id && c.status === 'pending');
      if (myClaim) {
        setClaim(myClaim);
        setMatchedListingId(myClaim.listing_id || null);
      }

      const memberUserIds = memberData.map(m => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, age, bio, occupation, city')
          .in('user_id', memberUserIds);

        const enriched: MemberProfile[] = (profileData || []).map(p => {
          const memberRow = memberData.find(m => m.user_id === p.user_id);
          return {
            id: p.user_id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            age: p.age,
            bio: p.bio,
            occupation: p.occupation,
            city: p.city,
            compatibility_score: memberRow?.compatibility_score,
            pi_reason: memberRow?.pi_reason,
          };
        });
        setMembers(enriched);
      }

      const { data: hostListings } = await supabase
        .from('listings')
        .select('id, title, rent, bedrooms, city, neighborhood, photos')
        .eq('host_id', user.id)
        .eq('is_active', true)
        .eq('is_rented', false);

      if (hostListings) {
        setListings(hostListings.map((l: any) => ({
          id: l.id,
          title: l.title,
          price: l.rent,
          bedrooms: l.bedrooms,
          city: l.city,
          neighborhood: l.neighborhood,
          photos: l.photos || [],
          bathrooms: 0, sqft: 0, address: '', state: '',
          amenities: [], description: '', available: true,
          hostId: user.id, hostName: '', propertyType: 'lease' as const,
          roomType: 'entire' as const,
        })));
      }
    } catch (e) {
      console.warn('[PiClaimedGroupDetail] load error:', e);
    }
    setLoading(false);
  }, [groupId, user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const handleRelease = async () => {
    if (!user || !groupId) return;
    const confirmed = await confirm({
      title: 'Release Group',
      message: 'Are you sure you want to release this group? It will become available for other hosts to claim.',
      confirmText: 'Release',
      cancelText: 'Keep',
    });
    if (!confirmed) return;

    setReleasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await releaseGroup(groupId, user.id);
    if (success) {
      navigation.goBack();
    } else {
      showAlert({
        title: 'Error',
        message: 'Could not release the group. Please try again.',
      });
    }
    setReleasing(false);
  };

  const handleSendIntro = async () => {
    if (!user || !groupId || members.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const introMessage = `Hi! I'm ${user.name || 'your potential host'} and I'd love to connect with your group about a place I have available. Looking forward to chatting!`;

    try {
      const { data: existingGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('pi_auto_group_id', groupId)
        .maybeSingle();

      let linkedGroupId: string;

      if (existingGroup) {
        linkedGroupId = existingGroup.id;
      } else {
        const memberIds = members.map(m => m.id);
        const { data: newGroup, error: groupError } = await supabase
          .from('groups')
          .insert({
            name: `Pi Group - ${group?.city || 'Roommates'}`,
            type: 'roommate',
            created_by: members[0]?.id || user.id,
            member_ids: [...memberIds, user.id],
            pi_auto_group_id: groupId,
          })
          .select()
          .single();

        if (groupError || !newGroup) {
          showAlert({
            title: 'Error',
            message: 'Could not start group conversation. Please try again.',
          });
          return;
        }
        linkedGroupId = newGroup.id;
      }

      await sendGroupMessage(linkedGroupId, introMessage);

      if (claimStep === 'Claimed') setClaimStep('Contacted');

      navigation.navigate('Messages', {
        screen: 'Chat',
        params: { conversationId: `group-${linkedGroupId}` },
      });
    } catch (e) {
      console.warn('[handleSendIntro] error:', e);
      showAlert({
        title: 'Error',
        message: 'Could not send introduction. Please try again.',
      });
    }
  };

  const handleMatchListing = (listing: Property) => {
    setMatchedListingId(listing.id);
    setShowListingPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (claim) {
      supabase
        .from('pi_group_claims')
        .update({ listing_id: listing.id })
        .eq('id', claim.id)
        .then(() => {});
    }
  };

  const getStepIndex = (step: ClaimProgress) => CLAIM_STEPS.indexOf(step);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
          <Text style={styles.loadingText}>Loading group details...</Text>
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Group Not Found</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>This group may no longer be available.</Text>
        </View>
      </View>
    );
  }

  const matchedListing = listings.find(l => l.id === matchedListingId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{'\u03C0'} Claimed Group</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusTracker}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.stepRow}>
            {CLAIM_STEPS.map((step, idx) => {
              const currentIdx = getStepIndex(claimStep);
              const isActive = idx <= currentIdx;
              const isLast = idx === CLAIM_STEPS.length - 1;
              return (
                <View key={step} style={styles.stepItem}>
                  <Pressable
                    style={[
                      styles.stepDot,
                      isActive ? { backgroundColor: PURPLE, borderColor: PURPLE } : null,
                    ]}
                    onPress={() => {
                      if (idx <= currentIdx + 1) {
                        setClaimStep(CLAIM_STEPS[Math.min(idx, CLAIM_STEPS.length - 1)]);
                      }
                    }}
                  >
                    {isActive ? (
                      <Feather name="check" size={10} color="#fff" />
                    ) : null}
                  </Pressable>
                  <Text style={[styles.stepLabel, isActive ? { color: PURPLE } : null]}>
                    {step}
                  </Text>
                  {!isLast ? (
                    <View style={[styles.stepLine, isActive ? { backgroundColor: PURPLE } : null]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>GROUP SUMMARY</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Feather name="users" size={16} color={PURPLE} />
              <Text style={styles.summaryValue}>{members.length}</Text>
              <Text style={styles.summaryLabel}>Members</Text>
            </View>
            {group.budget_min > 0 && group.budget_max > 0 ? (
              <View style={styles.summaryItem}>
                <Feather name="dollar-sign" size={16} color={GREEN} />
                <Text style={styles.summaryValue}>
                  ${Math.round(group.budget_min)}-${Math.round(group.budget_max)}
                </Text>
                <Text style={styles.summaryLabel}>Budget/mo</Text>
              </View>
            ) : null}
            {group.desired_bedrooms > 0 ? (
              <View style={styles.summaryItem}>
                <Feather name="home" size={16} color="#3b82f6" />
                <Text style={styles.summaryValue}>
                  {group.desired_bedrooms === -1 ? 'Studio' : `${group.desired_bedrooms}BR`}
                </Text>
                <Text style={styles.summaryLabel}>Target</Text>
              </View>
            ) : null}
            <View style={styles.summaryItem}>
              <Feather name="bar-chart-2" size={16} color={GOLD} />
              <Text style={styles.summaryValue}>{group.match_score || 0}</Text>
              <Text style={styles.summaryLabel}>Score</Text>
            </View>
          </View>

          {group.neighborhoods && group.neighborhoods.length > 0 ? (
            <View style={styles.neighborhoodRow}>
              <Feather name="map-pin" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={styles.neighborhoodText}>
                {group.neighborhoods.join(', ')}
              </Text>
            </View>
          ) : null}

          {group.pi_rationale ? (
            <View style={styles.rationaleBox}>
              <Feather name="cpu" size={13} color={PURPLE} />
              <Text style={styles.rationaleText}>{group.pi_rationale}</Text>
            </View>
          ) : null}
        </View>

        {group.amenity_preferences && group.amenity_preferences.length > 0 ? (
          <View style={[styles.summaryCard, { marginTop: 12 }]}>
            <Text style={styles.sectionLabel}>AMENITY NEEDS</Text>
            <View style={styles.amenityGrid}>
              {group.amenity_preferences.map(amenity => {
                const iconMap: Record<string, string> = {
                  laundry: 'wind', dishwasher: 'disc', parking: 'truck',
                  gym: 'activity', pool: 'droplet', doorman: 'shield',
                  elevator: 'arrow-up', ac: 'thermometer', pets: 'heart',
                  wifi: 'wifi', storage: 'archive', balcony: 'sun',
                  rooftop: 'sunrise',
                };
                const icon = iconMap[amenity.toLowerCase()] || 'check';
                return (
                  <View key={amenity} style={styles.amenityTag}>
                    <Feather name={icon as string} size={12} color={PURPLE} />
                    <Text style={styles.amenityTagText}>{amenity}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {group.location_preferences && group.location_preferences.length > 0 ? (
          <View style={[styles.summaryCard, { marginTop: 12 }]}>
            <Text style={styles.sectionLabel}>LOCATION PREFERENCES</Text>
            <View style={styles.amenityGrid}>
              {group.location_preferences.map(pref => (
                <View key={pref} style={styles.amenityTag}>
                  <Feather name="navigation" size={12} color="#3b82f6" />
                  <Text style={[styles.amenityTagText, { color: '#3b82f6' }]}>{pref}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 12 }]}>
          MEMBERS ({members.length})
        </Text>
        {members.map(member => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              {member.avatar_url ? (
                <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                  <Feather name="user" size={20} color="#666" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {member.full_name}{member.age ? `, ${member.age}` : ''}
                </Text>
                {member.occupation ? (
                  <Text style={styles.memberOccupation}>{member.occupation}</Text>
                ) : null}
                {member.city ? (
                  <Text style={styles.memberCity}>{member.city}</Text>
                ) : null}
              </View>
              {member.compatibility_score != null ? (
                <View style={[styles.memberScore, {
                  borderColor: member.compatibility_score >= 80 ? GREEN
                    : member.compatibility_score >= 60 ? GOLD : ACCENT
                }]}>
                  <Text style={[styles.memberScoreText, {
                    color: member.compatibility_score >= 80 ? GREEN
                      : member.compatibility_score >= 60 ? GOLD : ACCENT
                  }]}>
                    {member.compatibility_score}
                  </Text>
                </View>
              ) : null}
            </View>

            {member.bio ? (
              <Text style={styles.memberBio} numberOfLines={3}>{member.bio}</Text>
            ) : null}

            {member.pi_reason ? (
              <View style={styles.memberPiRow}>
                <Feather name="cpu" size={11} color={PURPLE} />
                <Text style={styles.memberPiText} numberOfLines={2}>{member.pi_reason}</Text>
              </View>
            ) : null}
          </View>
        ))}

        {matchedListing ? (
          <View style={[styles.matchedListingCard, { marginTop: 20 }]}>
            <Text style={styles.sectionLabel}>MATCHED LISTING</Text>
            <View style={styles.listingPreview}>
              {matchedListing.photos?.[0] ? (
                <Image source={{ uri: matchedListing.photos[0] }} style={styles.listingThumb} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.listingTitle}>{matchedListing.title}</Text>
                <Text style={styles.listingMeta}>
                  {matchedListing.bedrooms}BR  {matchedListing.neighborhood || matchedListing.city}
                </Text>
                <Text style={styles.listingPrice}>${matchedListing.price?.toLocaleString()}/mo</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <Pressable style={styles.primaryBtn} onPress={handleSendIntro}>
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Send Introduction</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setShowListingPicker(true)}
          >
            <Feather name="home" size={16} color={PURPLE} />
            <Text style={styles.secondaryBtnText}>
              {matchedListingId ? 'Change Listing' : 'Match to Listing'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.releaseBtn}
            onPress={handleRelease}
            disabled={releasing}
          >
            {releasing ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <>
                <Feather name="x-circle" size={16} color={ACCENT} />
                <Text style={styles.releaseBtnText}>Release Group</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={showListingPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select a Listing</Text>
            {listings.length === 0 ? (
              <Text style={styles.noListingsText}>
                No active listings found. Create a listing first.
              </Text>
            ) : (
              <FlatList
                data={listings}
                keyExtractor={item => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.listingOption,
                      matchedListingId === item.id ? styles.listingOptionActive : null,
                    ]}
                    onPress={() => handleMatchListing(item)}
                  >
                    {item.photos?.[0] ? (
                      <Image source={{ uri: item.photos[0] }} style={styles.listingOptionThumb} />
                    ) : (
                      <View style={[styles.listingOptionThumb, { backgroundColor: '#333' }]}>
                        <Feather name="home" size={16} color="#666" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listingOptionTitle}>{item.title}</Text>
                      <Text style={styles.listingOptionMeta}>
                        {item.bedrooms}BR  ${item.price?.toLocaleString()}/mo
                      </Text>
                    </View>
                    {matchedListingId === item.id ? (
                      <Feather name="check-circle" size={18} color={PURPLE} />
                    ) : null}
                  </Pressable>
                )}
              />
            )}
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowListingPicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  statusTracker: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: 10,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },
  stepLine: {
    position: 'absolute', top: 11, left: '60%', right: '-40%',
    height: 2, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12,
  },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  summaryLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  neighborhoodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  neighborhoodText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, flex: 1 },
  rationaleBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: PURPLE + '10', borderRadius: 10, padding: 12, marginTop: 4,
  },
  rationaleText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17, flex: 1,
    fontStyle: 'italic',
  },
  amenityGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
  },
  amenityTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  amenityTagText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  memberCard: {
    backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberAvatarPlaceholder: {
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  memberName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  memberOccupation: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 },
  memberCity: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  memberScore: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  memberScoreText: { fontSize: 12, fontWeight: '700' },
  memberBio: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17, marginBottom: 6 },
  memberPiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  memberPiText: { color: PURPLE, fontSize: 11, flex: 1, lineHeight: 15 },
  matchedListingCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  listingPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listingThumb: { width: 60, height: 60, borderRadius: 10 },
  listingTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listingMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  listingPrice: { color: GREEN, fontSize: 13, fontWeight: '600', marginTop: 2 },
  actionSection: { marginTop: 24, gap: 10 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE + '15', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: PURPLE + '30',
  },
  secondaryBtnText: { color: PURPLE, fontSize: 15, fontWeight: '600' },
  releaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,107,91,0.2)',
  },
  releaseBtnText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  noListingsText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center',
    paddingVertical: 30,
  },
  listingOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 10, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  listingOptionActive: {
    backgroundColor: PURPLE + '15', borderWidth: 1, borderColor: PURPLE + '30',
  },
  listingOptionThumb: {
    width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  listingOptionTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listingOptionMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  modalCloseText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
