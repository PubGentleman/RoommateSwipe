import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image,
  ActivityIndicator, Modal, TextInput, ScrollView,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Property, RoommateProfile } from '../../types/models';
import {
  AgentRenter,
  getShortlistedRenterIds,
  addToShortlist,
  removeFromShortlist,
  generateAISuggestions,
  generateBestGroupSuggestion,
} from '../../services/agentMatchmakerService';
import {
  getAgentPlanLimits,
  canAgentShortlist,
  type AgentPlan,
} from '../../constants/planLimits';
import {
  filterRentersForListing,
  TransitFilterSummary,
} from '../../utils/transitMatching';
import { NEIGHBORHOOD_TRAINS } from '../../constants/transitData';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const YELLOW = '#f39c12';

export const BrowseRentersScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();

  const [renters, setRenters] = useState<AgentRenter[]>([]);
  const [filteredRenters, setFilteredRenters] = useState<AgentRenter[]>([]);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Property[]>([]);
  const [selectedListing, setSelectedListing] = useState<Property | null>(null);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('any');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('');
  const [transitFilterSummary, setTransitFilterSummary] = useState<TransitFilterSummary | null>(null);
  const [allProfiles, setAllProfiles] = useState<RoommateProfile[]>([]);

  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    renter: AgentRenter; listingFitScore: number; reason: string;
  }>>([]);
  const [bestGroupSuggestion, setBestGroupSuggestion] = useState<any>(null);

  const agentPlan: AgentPlan = (user?.agentPlan as AgentPlan) || 'pay_per_use';
  const planLimits = getAgentPlanLimits(agentPlan);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      let mapped: AgentRenter[] = [];
      let profiles: RoommateProfile[] = [];
      let myListings: Property[] = [];

      if (isSupabaseConfigured) {
        const { data: supaRenters } = await supabase
          .from('users')
          .select(`
            id, full_name, avatar_url, age, city, occupation, last_active_at, bio, gender,
            profile:profiles(
              budget_max, budget_min, move_in_date, room_type, cleanliness,
              sleep_schedule, smoking, pets, interests, photos, bio,
              preferred_trains, budget_per_person_min, budget_per_person_max,
              desired_bedrooms, location_flexible, wfh, apartment_prefs_complete
            )
          `)
          .eq('role', 'renter')
          .eq('onboarding_step', 'complete')
          .neq('id', user?.id || '')
          .limit(100);

        const renterData = supaRenters || [];
        mapped = renterData.map((u: any) => {
          const p = Array.isArray(u.profile) ? u.profile[0] : u.profile;
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || (u.avatar_url ? [u.avatar_url] : []),
            city: u.city,
            budgetMin: p?.budget_per_person_min || (p?.budget_max ? p.budget_max * 0.8 : undefined),
            budgetMax: p?.budget_per_person_max || p?.budget_max,
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

        profiles = renterData.map((u: any) => {
          const p = Array.isArray(u.profile) ? u.profile[0] : u.profile;
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || [],
            bio: p?.bio || u.bio || '',
            gender: u.gender || '',
            lookingFor: p?.room_type || '',
            budget: p?.budget_max || 0,
            preferences: { location: u.city || '' },
            lifestyle: {
              cleanliness: p?.cleanliness,
              workSchedule: p?.sleep_schedule,
              smoking: p?.smoking,
              pets: p?.pets,
            },
            apartmentPrefs: p?.apartment_prefs_complete ? {
              desiredBedrooms: p.desired_bedrooms,
              budgetPerPersonMin: p.budget_per_person_min,
              budgetPerPersonMax: p.budget_per_person_max,
              preferredTrains: p.preferred_trains || [],
              locationFlexible: p.location_flexible,
              wfh: p.wfh,
              apartmentPrefsComplete: true,
            } : undefined,
          } as RoommateProfile;
        });

        const { data: supaListings } = await supabase
          .from('listings')
          .select('*')
          .eq('host_id', user?.id || '')
          .eq('available', true);

        myListings = (supaListings || []).map((l: any) => ({
          id: l.id,
          title: l.title,
          price: l.price,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          city: l.city,
          neighborhood: l.neighborhood,
          address: l.address,
          description: l.description,
          photos: l.photos || [],
          amenities: l.amenities || [],
          available: l.available,
          hostId: l.host_id,
          availableDate: l.available_date ? new Date(l.available_date) : undefined,
          latitude: l.latitude,
          longitude: l.longitude,
        }));
      } else {
        const storedProfiles: RoommateProfile[] = await StorageService.getRoommateProfiles();
        profiles = storedProfiles;
        mapped = storedProfiles.map(p => ({
          id: p.id,
          name: p.name,
          age: p.age,
          occupation: p.occupation,
          photos: p.photos || [],
          city: p.preferences?.location,
          neighborhood: p.preferences?.location,
          budgetMin: p.budget ? p.budget * 0.8 : undefined,
          budgetMax: p.budget,
          moveInDate: p.preferences?.moveInDate,
          cleanliness: p.lifestyle?.cleanliness,
          sleepSchedule: p.lifestyle?.workSchedule,
          smoking: p.lifestyle?.smoking,
          pets: p.lifestyle?.pets,
          interests: p.profileData?.interests || [],
          roomType: p.lookingFor,
          gender: p.gender,
          bio: p.bio,
        }));

        const props = await StorageService.getProperties();
        myListings = props.filter(p => p.hostId === user?.id && p.available);
      }

      setAllProfiles(profiles);
      setRenters(mapped);
      setFilteredRenters(mapped);
      setListings(myListings);

      if (user) {
        const ids = await getShortlistedRenterIds(user.id);
        setShortlistedIds(new Set(ids));
      }
    } catch (e) {
      console.warn('[BrowseRenters] Load error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedListing, roomTypeFilter, neighborhoodFilter, renters, allProfiles]);

  useEffect(() => {
    if (planLimits.hasAISuggestions && selectedListing && renters.length > 0) {
      const suggestions = generateAISuggestions(renters, selectedListing);
      setAiSuggestions(suggestions);

      const shortlisted = renters.filter(r => shortlistedIds.has(r.id));
      if (shortlisted.length >= 2 && planLimits.hasAIGroupSuggestions) {
        setBestGroupSuggestion(generateBestGroupSuggestion(shortlisted, selectedListing));
      }
    } else {
      setAiSuggestions([]);
      setBestGroupSuggestion(null);
    }
  }, [selectedListing, shortlistedIds, renters]);

  const applyFilters = () => {
    let filtered = [...renters];

    if (selectedListing) {
      const { filtered: transitFiltered, summary } = filterRentersForListing(
        allProfiles, selectedListing
      );
      setTransitFilterSummary(summary);

      const transitCompatibleIds = new Set(transitFiltered.map(r => r.id));
      filtered = filtered.filter(r => transitCompatibleIds.has(r.id));
    } else {
      setTransitFilterSummary(null);
    }

    if (roomTypeFilter !== 'any') {
      filtered = filtered.filter(r => r.roomType === roomTypeFilter);
    }

    if (neighborhoodFilter) {
      filtered = filtered.filter(r =>
        r.neighborhood?.toLowerCase().includes(neighborhoodFilter.toLowerCase())
      );
    }

    setFilteredRenters(filtered);
  };

  const handleShortlist = async (renter: AgentRenter) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (shortlistedIds.has(renter.id)) {
      await removeFromShortlist(user.id, renter.id);
      setShortlistedIds(prev => {
        const next = new Set(prev);
        next.delete(renter.id);
        return next;
      });
      return;
    }

    if (!canAgentShortlist(agentPlan, shortlistedIds.size)) {
      showAlert({
        title: 'Shortlist Limit Reached',
        message: `Your ${planLimits.label} plan allows up to ${planLimits.shortlistLimit} shortlisted renters. Upgrade to shortlist more.`,
      });
      return;
    }

    await addToShortlist(user.id, renter.id, selectedListing?.id);
    setShortlistedIds(prev => new Set(prev).add(renter.id));
  };

  const renderRenterCard = ({ item }: { item: AgentRenter }) => {
    const isShortlisted = shortlistedIds.has(item.id);
    const photo = item.photos?.[0];

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Feather name="user" size={24} color="#666" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}, {item.age}</Text>
            <Text style={styles.cardOccupation}>{item.occupation}</Text>
            {item.budgetMin != null && item.budgetMax != null ? (
              <Text style={styles.cardBudget}>
                ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}/mo
              </Text>
            ) : null}
            {item.moveInDate ? (
              <Text style={styles.cardMeta}>
                Move-in: {new Date(item.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => handleShortlist(item)}
            style={[styles.shortlistBtn, isShortlisted ? styles.shortlistBtnActive : null]}
          >
            <Feather
              name={isShortlisted ? 'heart' : 'heart'}
              size={20}
              color={isShortlisted ? ACCENT : '#666'}
            />
          </Pressable>
        </View>

        <View style={styles.tagRow}>
          {item.cleanliness != null ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Clean: {item.cleanliness}/10</Text>
            </View>
          ) : null}
          {item.sleepSchedule ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.sleepSchedule}</Text>
            </View>
          ) : null}
          {item.smoking != null ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.smoking ? 'Smoker' : 'Non-smoker'}</Text>
            </View>
          ) : null}
          {item.pets != null ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.pets ? 'Has pets' : 'No pets'}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={styles.viewProfileBtn}
          onPress={() => navigation.navigate('RenterProfileDetail', { renter: item })}
        >
          <Text style={styles.viewProfileText}>View Profile</Text>
          <Feather name="chevron-right" size={16} color={ACCENT} />
        </Pressable>
      </View>
    );
  };

  const renderAIPanel = () => {
    if (!planLimits.hasAISuggestions || !selectedListing || aiSuggestions.length === 0) return null;

    return (
      <View style={styles.aiPanel}>
        <View style={styles.aiPanelHeader}>
          <Feather name="zap" size={18} color={YELLOW} />
          <Text style={styles.aiPanelTitle}>
            Rhome AI — Top picks for "{selectedListing.title}"
          </Text>
        </View>

        {aiSuggestions.map(s => (
          <View key={s.renter.id} style={styles.aiCard}>
            <View style={styles.aiCardRow}>
              {s.renter.photos?.[0] ? (
                <Image source={{ uri: s.renter.photos[0] }} style={styles.aiAvatar} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.aiName}>{s.renter.name}</Text>
                <Text style={styles.aiReason}>{s.reason}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: s.listingFitScore >= 80 ? GREEN : YELLOW }]}>
                <Text style={styles.scoreText}>{s.listingFitScore}%</Text>
              </View>
            </View>
            <Pressable
              style={styles.aiShortlistBtn}
              onPress={() => handleShortlist(s.renter)}
            >
              <Feather
                name="plus"
                size={14}
                color={shortlistedIds.has(s.renter.id) ? ACCENT : '#fff'}
              />
              <Text style={[styles.aiShortlistText, shortlistedIds.has(s.renter.id) ? { color: ACCENT } : null]}>
                {shortlistedIds.has(s.renter.id) ? 'Shortlisted' : 'Shortlist'}
              </Text>
            </Pressable>
          </View>
        ))}

        {bestGroupSuggestion ? (
          <View style={styles.bestGroupBox}>
            <View style={styles.aiPanelHeader}>
              <Feather name="users" size={16} color={ACCENT} />
              <Text style={styles.bestGroupTitle}>Best group suggestion</Text>
            </View>
            <Text style={styles.bestGroupNames}>{bestGroupSuggestion.names.join(' + ')}</Text>
            <Text style={styles.bestGroupMeta}>
              {bestGroupSuggestion.avgCompatibility}% avg compatibility
            </Text>
            <Text style={styles.bestGroupMeta}>
              Combined budget: ${bestGroupSuggestion.combinedBudgetMin.toLocaleString()}-${bestGroupSuggestion.combinedBudgetMax.toLocaleString()}/mo
            </Text>
            <Text style={[styles.bestGroupMeta, { color: bestGroupSuggestion.coversRent ? GREEN : ACCENT }]}>
              {bestGroupSuggestion.coversRent ? 'Covers rent' : 'May not cover rent'}
            </Text>
            <Pressable
              style={styles.buildGroupBtn}
              onPress={() => navigation.navigate('AgentGroupBuilder', {
                preselectedIds: bestGroupSuggestion.group.map((r: AgentRenter) => r.id),
                listingId: selectedListing?.id,
              })}
            >
              <Text style={styles.buildGroupText}>Build This Group</Text>
            </Pressable>
          </View>
        ) : null}

        {planLimits.hasAIGroupSuggestions && shortlistedIds.size >= 2 && selectedListing ? (
          <Pressable
            style={styles.fullAiPairButton}
            onPress={() => navigation.navigate('AgentGroupBuilder', {
              preselectedIds: Array.from(shortlistedIds),
              listingId: selectedListing.id,
              openAIPairing: true,
            })}
          >
            <Feather name="zap" size={16} color="#fff" />
            <Text style={styles.fullAiPairText}>
              Ask Claude: Who should I group? ({shortlistedIds.size} shortlisted)
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      <Pressable
        style={styles.listingSelector}
        onPress={() => setShowListingPicker(true)}
      >
        <Feather name="home" size={16} color="#999" />
        <Text style={styles.listingSelectorText}>
          {selectedListing ? selectedListing.title : 'Select a listing to filter renters'}
        </Text>
        <Feather name="chevron-down" size={16} color="#999" />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['any', 'room', 'entire_apartment'].map(type => (
          <Pressable
            key={type}
            style={[styles.filterChip, roomTypeFilter === type ? styles.filterChipActive : null]}
            onPress={() => setRoomTypeFilter(type)}
          >
            <Text style={[styles.filterChipText, roomTypeFilter === type ? styles.filterChipTextActive : null]}>
              {type === 'any' ? 'All' : type === 'room' ? 'Room' : 'Entire'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{filteredRenters.length} renters</Text>
        <Pressable
          onPress={() => {
            if (planLimits.hasCompatibilityMatrix && shortlistedIds.size >= 2) {
              const shortlisted = renters.filter(r => shortlistedIds.has(r.id));
              navigation.navigate('RenterCompatibility', { renters: shortlisted });
            } else if (!planLimits.hasCompatibilityMatrix) {
              showAlert({ title: 'Pro Feature', message: 'Compatibility Matrix is available on Pro and Business plans.' });
            } else {
              showAlert({ title: 'Need More Renters', message: 'Shortlist at least 2 renters to view the compatibility matrix.' });
            }
          }}
          style={styles.matrixBtn}
        >
          <Feather name="grid" size={14} color={ACCENT} />
          <Text style={styles.matrixBtnText}>Matrix ({shortlistedIds.size})</Text>
        </Pressable>
      </View>

      {transitFilterSummary && selectedListing ? (
        <View style={styles.transitSummary}>
          <View style={styles.transitSummaryHeader}>
            <Feather name="cpu" size={14} color={ACCENT} />
            <Text style={styles.transitSummaryTitle}>
              Filtered for "{selectedListing.bedrooms}BR {selectedListing.neighborhood ?? selectedListing.city} - ${selectedListing.price?.toLocaleString()}/mo"
            </Text>
          </View>
          <View style={styles.transitFunnelRow}>
            <Text style={styles.transitFunnelText}>Started with {transitFilterSummary.total} renters</Text>
          </View>
          {transitFilterSummary.afterTransit < transitFilterSummary.total ? (
            <View style={styles.transitFunnelRow}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={styles.transitFunnelText}>
                {transitFilterSummary.afterTransit} have {(NEIGHBORHOOD_TRAINS[selectedListing.neighborhood ?? ''] ?? []).slice(0, 4).join('/')} train access
              </Text>
            </View>
          ) : null}
          {transitFilterSummary.afterBudget < transitFilterSummary.afterTransit ? (
            <View style={styles.transitFunnelRow}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={styles.transitFunnelText}>
                {transitFilterSummary.afterBudget} can afford ${Math.round(selectedListing.price / selectedListing.bedrooms).toLocaleString()}/person share
              </Text>
            </View>
          ) : null}
          {transitFilterSummary.afterBedrooms < transitFilterSummary.afterBudget ? (
            <View style={styles.transitFunnelRow}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={styles.transitFunnelText}>
                {transitFilterSummary.afterBedrooms} are looking for a {selectedListing.bedrooms}BR
              </Text>
            </View>
          ) : null}
          {transitFilterSummary.afterDate < transitFilterSummary.afterBedrooms ? (
            <View style={styles.transitFunnelRow}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={styles.transitFunnelText}>
                {transitFilterSummary.afterDate} are available by listing date
              </Text>
            </View>
          ) : null}
          <Text style={styles.transitFunnelResult}>
            Showing {transitFilterSummary.afterDate} pre-qualified renters
          </Text>
        </View>
      ) : null}

      {renderAIPanel()}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Renters</Text>
        <Pressable
          style={styles.buildBtn}
          onPress={() => {
            if (shortlistedIds.size < 2) {
              showAlert({ title: 'Need More', message: 'Shortlist at least 2 renters to build a group.' });
              return;
            }
            const shortlisted = renters.filter(r => shortlistedIds.has(r.id));
            navigation.navigate('AgentGroupBuilder', {
              preselectedIds: shortlisted.map(r => r.id),
              listingId: selectedListing?.id,
            });
          }}
        >
          <Feather name="users" size={16} color="#fff" />
          <Text style={styles.buildBtnText}>Build Group</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredRenters}
          keyExtractor={item => item.id}
          renderItem={renderRenterCard}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showListingPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Listing</Text>
              <Pressable onPress={() => setShowListingPicker(false)}>
                <Feather name="x" size={24} color="#fff" />
              </Pressable>
            </View>
            <Pressable
              style={styles.listingOption}
              onPress={() => { setSelectedListing(null); setShowListingPicker(false); }}
            >
              <Text style={styles.listingOptionText}>All Renters (no filter)</Text>
            </Pressable>
            {listings.map(l => (
              <Pressable
                key={l.id}
                style={[styles.listingOption, selectedListing?.id === l.id ? styles.listingOptionActive : null]}
                onPress={() => { setSelectedListing(l); setShowListingPicker(false); }}
              >
                <Text style={styles.listingOptionText}>{l.title}</Text>
                <Text style={styles.listingOptionMeta}>
                  ${l.price.toLocaleString()}/mo - {l.bedrooms}BR
                </Text>
              </Pressable>
            ))}
            {listings.length === 0 ? (
              <Text style={styles.emptyText}>No active listings. Create a listing first.</Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  buildBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  buildBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  listingSelector: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 12 },
  listingSelectorText: { flex: 1, color: '#ccc', fontSize: 14 },
  filterRow: { marginBottom: 12 },
  filterChip: { backgroundColor: CARD_BG, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  filterChipActive: { backgroundColor: ACCENT },
  filterChipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statsText: { color: '#999', fontSize: 13 },
  matrixBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matrixBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardOccupation: { color: '#999', fontSize: 13, marginTop: 2 },
  cardBudget: { color: GREEN, fontSize: 13, fontWeight: '600', marginTop: 4 },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  shortlistBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  shortlistBtnActive: { backgroundColor: 'rgba(255,107,91,0.15)' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: '#aaa', fontSize: 11 },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8 },
  viewProfileText: { color: ACCENT, fontSize: 14, fontWeight: '600', marginRight: 4 },
  aiPanel: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(248,195,49,0.2)' },
  aiPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiPanelTitle: { color: YELLOW, fontSize: 14, fontWeight: '700', flex: 1 },
  aiCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8 },
  aiCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiAvatar: { width: 40, height: 40, borderRadius: 20 },
  aiName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  aiReason: { color: '#aaa', fontSize: 12, marginTop: 2 },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  aiShortlistBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
  aiShortlistText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bestGroupBox: { backgroundColor: 'rgba(255,107,91,0.08)', borderRadius: 12, padding: 12, marginTop: 8 },
  bestGroupTitle: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  bestGroupNames: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 },
  bestGroupMeta: { color: '#aaa', fontSize: 13, marginTop: 4 },
  buildGroupBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  buildGroupText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  listingOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  listingOptionActive: { backgroundColor: 'rgba(255,107,91,0.1)', borderRadius: 8 },
  listingOptionText: { color: '#fff', fontSize: 15 },
  listingOptionMeta: { color: '#888', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 20 },
  transitSummary: { backgroundColor: 'rgba(255,107,91,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)' },
  transitSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  transitSummaryTitle: { color: ACCENT, fontSize: 13, fontWeight: '600', flex: 1 },
  transitFunnelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  transitFunnelText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  transitFunnelResult: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8 },
  fullAiPairButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  fullAiPairText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
});
