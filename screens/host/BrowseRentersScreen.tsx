import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { shouldLoadMockData } from '../../utils/dataUtils';
import { Property, RoommateProfile } from '../../types/models';
import {
  AgentRenter,
  getShortlistedRenterIds,
  addToShortlist,
  removeFromShortlist,
  generateAISuggestions,
  generateBestGroupSuggestion,
} from '../../services/agentMatchmakerService';
import { calculateListingLocationScore } from '../../utils/listingMatchUtils';
import { getHostRecommendations, getMonthlyUsageCount, getHostPiMonthlyLimit } from '../../services/piMatchingService';
import { PiHostRecommendation } from '../../types/models';
import {
  getAgentPlanLimits,
  canAgentShortlist,
  type AgentPlan,
} from '../../constants/planLimits';
import {
  filterRentersForListing,
  TransitFilterSummary,
} from '../../utils/transitMatching';
import { isWithinActivityCutoff, getRecencyMultiplier } from '../../utils/activityDecay';
import {
  shortlistRenter as companyShortlistRenter,
  removeFromShortlist as companyRemoveFromShortlist,
} from '../../services/companyMatchmakerService';
import { NEIGHBORHOOD_TRAINS } from '../../constants/transitData';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const YELLOW = '#f39c12';

export const BrowseRentersScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();
  const routeListingId = route.params?.listingId as string | undefined;

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
  const [piRecommendedIds, setPiRecommendedIds] = useState<Map<string, string>>(new Map());
  const [piSortActive, setPiSortActive] = useState(false);
  const [piLoading, setPiLoading] = useState(false);
  const [piQuotaUsed, setPiQuotaUsed] = useState(0);
  const [piQuotaLimit, setPiQuotaLimit] = useState(0);
  const piRequestId = useRef(0);

  const rawAgentPlan = user?.agentPlan || (user as any)?.agent_plan || '';
  const subPlan = user?.hostSubscription?.plan || '';
  const effectivePlan = (rawAgentPlan && rawAgentPlan !== 'pay_per_use' && rawAgentPlan !== 'free') ? rawAgentPlan : subPlan;
  const agentPlan: AgentPlan = (effectivePlan as AgentPlan) || 'pay_per_use';
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

      if (isSupabaseConfigured && !shouldLoadMockData()) {
        let query = supabase
          .from('users')
          .select(`
            id, full_name, avatar_url, age, city, occupation, last_active_at, bio, gender, accept_agent_offers,
            profile:profiles(
              budget_max, budget_min, move_in_date, room_type, cleanliness,
              sleep_schedule, smoking, pets, interests, photos, bio,
              preferred_trains, budget_per_person_min, budget_per_person_max,
              desired_bedrooms, location_flexible, wfh, apartment_prefs_complete,
              preferred_neighborhoods, zip_code
            )
          `)
          .eq('role', 'renter')
          .eq('onboarding_step', 'complete')
          .neq('id', user?.id || '')
          .limit(100);

        if (user?.city) {
          query = query.eq('city', user.city);
        }

        const { data: supaRenters } = await query;

        const renterData = (supaRenters || []).filter((u: any) => isWithinActivityCutoff(u.last_active_at));
        renterData.sort((a: any, b: any) => {
          const scoreA = getRecencyMultiplier(a.last_active_at);
          const scoreB = getRecencyMultiplier(b.last_active_at);
          return scoreB - scoreA;
        });
        mapped = renterData.map((u: any) => {
          const p = Array.isArray(u.profile) ? u.profile[0] : u.profile;
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || (u.avatar_url ? [u.avatar_url] : []),
            city: u.city,
            preferredNeighborhoods: p?.preferred_neighborhoods || [],
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
            acceptAgentOffers: u.accept_agent_offers !== false,
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
            preferredNeighborhoods: p?.preferred_neighborhoods || [],
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
          .eq('created_by', user?.id || '')
          .eq('is_active', true)
          .eq('is_rented', false)
          .eq('is_paused', false);

        myListings = (supaListings || []).map((l: any) => ({
          id: l.id,
          title: l.title,
          price: l.rent || l.price || 0,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          city: l.city,
          neighborhood: l.neighborhood,
          address: l.address,
          description: l.description,
          photos: l.photos || [],
          amenities: l.amenities || [],
          available: l.is_active,
          hostId: l.created_by,
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
          preferredNeighborhoods: p.preferredNeighborhoods || p.profileData?.preferred_neighborhoods || [],
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

      if (user?.city) {
        const agentCityLower = user.city.toLowerCase();
        mapped = mapped.filter(r =>
          r.city?.toLowerCase().includes(agentCityLower) ||
          r.preferredNeighborhoods?.some(n => n.toLowerCase().includes(agentCityLower))
        );
      }

      setAllProfiles(profiles);
      setRenters(mapped);
      setFilteredRenters(mapped);
      setListings(myListings);

      if (routeListingId && myListings.length > 0) {
        const match = myListings.find(l => l.id === routeListingId);
        if (match) {
          setSelectedListing(match);
          setPiSortActive(true);
        }
      }

      if (user) {
        try {
          const sub = await StorageService.getHostSubscription(user.id);
          const rawPlan = sub?.plan || 'free';
          const hostType = user.hostType;
          const limit = getHostPiMonthlyLimit(rawPlan, hostType);
          setPiQuotaLimit(limit);
          const used = await getMonthlyUsageCount(user.id);
          setPiQuotaUsed(used);
        } catch {}
      }

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
  }, [selectedListing, roomTypeFilter, neighborhoodFilter, renters, allProfiles, piSortActive, piRecommendedIds]);

  useEffect(() => {
    if (selectedListing) {
      const thisRequestId = ++piRequestId.current;
      setPiLoading(true);
      getHostRecommendations(selectedListing.id).then(rec => {
        if (piRequestId.current !== thisRequestId) return;
        if (rec?.recommendations) {
          const map = new Map<string, string>();
          rec.recommendations.forEach((r: any) => {
            if (r.type === 'renter' && r.target_id) {
              map.set(r.target_id, r.reason || '');
            }
          });
          setPiRecommendedIds(map);
        } else {
          setPiRecommendedIds(new Map());
        }
      }).catch(() => {
        if (piRequestId.current === thisRequestId) setPiRecommendedIds(new Map());
      }).finally(() => {
        if (piRequestId.current === thisRequestId) setPiLoading(false);
      });
    } else {
      piRequestId.current++;
      setPiRecommendedIds(new Map());
      setPiSortActive(false);
    }
  }, [selectedListing]);

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
      const nfLower = neighborhoodFilter.toLowerCase();
      filtered = filtered.filter(r =>
        r.neighborhood?.toLowerCase().includes(nfLower) ||
        r.preferredNeighborhoods?.some(n => n.toLowerCase().includes(nfLower))
      );
    }

    if (piSortActive && piRecommendedIds.size > 0) {
      filtered.sort((a, b) => {
        const aPi = piRecommendedIds.has(a.id) ? 1 : 0;
        const bPi = piRecommendedIds.has(b.id) ? 1 : 0;
        return bPi - aPi;
      });
    }

    setFilteredRenters(filtered);
  };

  const isCompanyHost = user?.hostType === 'company';

  const handleShortlist = async (renter: AgentRenter) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (shortlistedIds.has(renter.id)) {
      try {
        await removeFromShortlist(user.id, renter.id);
        if (isCompanyHost) {
          await companyRemoveFromShortlist(user.id, renter.id, selectedListing?.id);
        }
        setShortlistedIds(prev => {
          const next = new Set(prev);
          next.delete(renter.id);
          return next;
        });
      } catch (e) {
        console.error('[BrowseRenters] Remove shortlist error:', e);
      }
      return;
    }

    if (!canAgentShortlist(agentPlan, shortlistedIds.size)) {
      showAlert({
        title: 'Shortlist Limit Reached',
        message: `Your ${planLimits.label} plan allows up to ${planLimits.shortlistLimit} shortlisted renters. Upgrade to shortlist more.`,
      });
      return;
    }

    try {
      const result = await addToShortlist(user.id, renter.id, selectedListing?.id);
      if (!result.success) {
        if (result.error) {
          Alert.alert('Cannot Shortlist', result.error);
        }
        return;
      }
      if (isCompanyHost) {
        await companyShortlistRenter(user.id, renter.id, selectedListing?.id);
      }
      setShortlistedIds(prev => new Set(prev).add(renter.id));
    } catch (e) {
      console.error('[BrowseRenters] Shortlist error:', e);
    }
  };

  const renderRenterCard = ({ item }: { item: AgentRenter }) => {
    const isShortlisted = shortlistedIds.has(item.id);
    const photo = item.photos?.[0];
    const optedOut = item.acceptAgentOffers === false;

    return (
      <View style={[styles.card, optedOut ? { opacity: 0.5 } : undefined]}>
        <View style={styles.cardRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Feather name="user" size={24} color="#666" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardName}>{item.name}, {item.age}</Text>
              {piRecommendedIds.has(item.id) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#a855f7' + '20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Feather name="cpu" size={10} color="#a855f7" />
                  <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: '600' }}>{'\u03C0'} Pi Pick</Text>
                </View>
              ) : null}
              {optedOut ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e74c3c20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Feather name="slash" size={10} color="#e74c3c" />
                  <Text style={{ color: '#e74c3c', fontSize: 10, fontWeight: '600' }}>Not accepting</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardOccupation}>{item.occupation}</Text>
            {item.preferredNeighborhoods && item.preferredNeighborhoods.length > 0 ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.preferredNeighborhoods.slice(0, 2).join(', ')}
              </Text>
            ) : item.city ? (
              <Text style={styles.cardMeta} numberOfLines={1}>{item.city}</Text>
            ) : null}
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
            onPress={() => optedOut ? showAlert({ title: 'Not Available', message: 'This renter is not accepting offers from agents.' }) : handleShortlist(item)}
            style={[styles.shortlistBtn, isShortlisted ? styles.shortlistBtnActive : null]}
            disabled={optedOut && !isShortlisted}
          >
            <Feather
              name="heart"
              size={20}
              color={optedOut ? '#444' : isShortlisted ? ACCENT : '#666'}
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

        {piRecommendedIds.has(item.id) && piRecommendedIds.get(item.id) ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
            <Feather name="cpu" size={11} color="#a855f7" />
            <Text style={{ color: '#a855f7', fontSize: 11, flex: 1, lineHeight: 15 }} numberOfLines={2}>
              {piRecommendedIds.get(item.id)}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable
            style={styles.cardActionBtn}
            onPress={() => {
              navigation.navigate('Chat', {
                conversationId: `agent-${user?.id}-${item.id}`,
                otherUser: { id: item.id, name: item.name, photos: item.photos },
              });
            }}
          >
            <Feather name="message-circle" size={14} color="#fff" />
            <Text style={styles.cardActionText}>Message</Text>
          </Pressable>
          <Pressable
            style={[styles.cardActionBtn, { backgroundColor: ACCENT }]}
            onPress={async () => {
              if (!shortlistedIds.has(item.id) && user) {
                try {
                  const result = await addToShortlist(user.id, item.id, selectedListing?.id);
                  if (result.success) {
                    if (isCompanyHost) {
                      await companyShortlistRenter(user.id, item.id, selectedListing?.id);
                    }
                    setShortlistedIds(prev => new Set(prev).add(item.id));
                  }
                } catch (_e) {}
              }
              navigation.navigate('AgentGroupBuilder', {
                preselectedIds: [item.id],
                listingId: selectedListing?.id,
              });
            }}
          >
            <Feather name="users" size={14} color="#fff" />
            <Text style={styles.cardActionText}>Add to Group</Text>
          </Pressable>
          <Pressable
            style={styles.cardActionBtn}
            onPress={() => navigation.navigate('RenterProfileDetail', {
              renter: item,
              isShortlisted: isShortlisted,
            })}
          >
            <Feather name="chevron-right" size={14} color="#fff" />
          </Pressable>
        </View>
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

      <Pressable
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#a855f7' + '12', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#a855f7' + '30' }}
        onPress={() => navigation.navigate('PiMatchedGroups')}
      >
        <Feather name="users" size={16} color="#a855f7" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{'\u03C0'} Pi Matched Groups</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Browse pre-vetted roommate groups</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#a855f7" />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {selectedListing && piRecommendedIds.size > 0 ? (
          <Pressable
            style={[styles.filterChip, piSortActive ? { backgroundColor: '#a855f7', borderColor: '#a855f7' } : null]}
            onPress={() => setPiSortActive(!piSortActive)}
          >
            <Feather name="cpu" size={12} color={piSortActive ? '#fff' : '#a855f7'} />
            <Text style={[styles.filterChipText, piSortActive ? { color: '#fff' } : { color: '#a855f7' }]}>
              {'\u03C0'} Pi Recommended
            </Text>
          </Pressable>
        ) : null}
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

      {piQuotaLimit !== 0 && selectedListing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#a855f7' + '10', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="cpu" size={12} color="#a855f7" />
            <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: '600' }}>
              {piQuotaLimit === -1 ? 'Unlimited Pi calls' : `${Math.max(0, piQuotaLimit - piQuotaUsed)}/${piQuotaLimit} Pi calls left`}
            </Text>
          </View>
          {piQuotaLimit !== -1 && piQuotaUsed >= piQuotaLimit ? (
            <Pressable onPress={() => navigation.navigate('HostSubscription')}>
              <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: '700' }}>Upgrade</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{filteredRenters.length} renters{user?.city ? ` in ${user.city}` : ''}</Text>
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
              showAlert({ title: 'Need More', message: 'Tap the heart icon on at least 2 renters to shortlist them, then tap Build Group.' });
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
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
              <Feather name="search" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                No renters match your filters
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Try adjusting your search criteria or selecting a different listing
              </Text>
              {(selectedListing || roomTypeFilter !== 'any' || neighborhoodFilter) ? (
                <Pressable
                  onPress={() => { setSelectedListing(null); setRoomTypeFilter('any'); setNeighborhoodFilter(''); }}
                  style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: ACCENT, borderRadius: 10 }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                    Clear all filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
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
            <ScrollView showsVerticalScrollIndicator={false}>
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
            </ScrollView>
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
  filterChip: { backgroundColor: CARD_BG, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
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
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cardActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#222', borderRadius: 10, paddingVertical: 10 },
  cardActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
