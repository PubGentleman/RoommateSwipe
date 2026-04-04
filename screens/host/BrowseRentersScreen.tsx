import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  AgentGroup,
  getShortlistedRenterIds,
  addToShortlist,
  removeFromShortlist,
  generateAISuggestions,
  generateBestGroupSuggestion,
  calculateRenterRelevance,
  createAgentGroup,
  sendAgentInvites,
  getAgentGroups,
  calculatePairMatrix,
} from '../../services/agentMatchmakerService';
import { calculateListingLocationScore } from '../../utils/listingMatchUtils';
import { getHostRecommendations, getMonthlyUsageCount, getHostPiMonthlyLimit } from '../../services/piMatchingService';
import { PiHostRecommendation } from '../../types/models';
import {
  getAgentPlanLimits,
  canAgentShortlist,
  canAgentCreateGroup,
  getCompatibilityMatrixAccess,
  type AgentPlan,
} from '../../constants/planLimits';
import {
  filterRentersForListing,
  TransitFilterSummary,
} from '../../utils/transitMatching';
import { getRecencyMultiplier } from '../../utils/activityDecay';
import {
  shortlistRenter as companyShortlistRenter,
  removeFromShortlist as companyRemoveFromShortlist,
} from '../../services/companyMatchmakerService';
import { NEIGHBORHOOD_TRAINS } from '../../constants/transitData';
import { resolveEffectiveAgentPlan, resolveEffectiveCompanyPlan } from '../../utils/planResolver';
import { InvitePreviewSheet } from '../../components/InvitePreviewSheet';
import { AppHeader, HeaderActionButton } from '../../components/AppHeader';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';
const GREEN = '#22c55e';
const RED = '#ef4444';

const ROOM_FILTER_OPTIONS: Record<string, string[]> = {
  budget: ['Under $1K', '$1K-$1.5K', '$1.5K-$2K', '$2K+'],
  moveIn: ['This month', 'Next month', 'Flexible'],
  lifestyle: ['Non-smoker', 'Has pets', 'No pets', 'Early bird', 'Night owl'],
  clean: ['8+ (Very clean)', '6-7 (Average)', 'Under 6'],
};

const ENTIRE_FILTER_OPTIONS: Record<string, string[]> = {
  budget: ['Under $2K', '$2K-$3K', '$3K-$4K', '$4K+'],
  moveIn: ['This month', 'Next month', 'Flexible'],
  bedrooms: ['1BR', '2BR', '3BR+'],
};

function isEntireSeekerFn(renter: AgentRenter) {
  return renter.roomType === 'entire_apartment' || renter.roomType === 'entire' || renter.roomType === 'apartment';
}

function suggestGroupName(members: AgentRenter[], listing?: Property | null): string {
  if (listing) {
    const hood = listing.neighborhood || listing.city || '';
    const size = members.length === 2 ? 'Duo' : members.length === 3 ? 'Trio' : `${members.length}-Group`;
    if (hood) return `${hood} ${size}`;
    return `${listing.title?.split(' ')[0] || ''} ${size}`.trim();
  }
  const hoods = members.map(m => m.neighborhood || m.preferredNeighborhoods?.[0]).filter(Boolean) as string[];
  if (hoods.length > 0) {
    const freq: Record<string, number> = {};
    hoods.forEach(h => { freq[h] = (freq[h] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    const size = members.length === 2 ? 'Duo' : members.length === 3 ? 'Trio' : `${members.length}-Group`;
    return `${top} ${size}`;
  }
  if (members.length <= 3) {
    return members.map(m => m.name?.split(' ')[0]).join(' & ');
  }
  return `New Group (${members.length})`;
}

function getQuickTags(renter: AgentRenter) {
  const tags: { label: string; color: string }[] = [];

  if (isEntireSeekerFn(renter)) {
    if (renter.desiredBedrooms) {
      tags.push({ label: `${renter.desiredBedrooms}BR+`, color: '#3b82f6' });
    }
    if (renter.preferredNeighborhoods && renter.preferredNeighborhoods.length > 0) {
      renter.preferredNeighborhoods.slice(0, 2).forEach(n => {
        tags.push({ label: n, color: '#888' });
      });
    }
    if (renter.locationFlexible) {
      tags.push({ label: 'Flexible location', color: GREEN });
    }
    if ((renter as any).responseRate != null && (renter as any).responseRate >= 90) {
      tags.push({ label: `${(renter as any).responseRate}% response`, color: GREEN });
    }
    return tags;
  }

  if (renter.cleanliness != null) {
    tags.push({
      label: `Clean: ${renter.cleanliness}/10`,
      color: renter.cleanliness >= 8 ? GREEN : renter.cleanliness <= 5 ? '#f97316' : '#888',
    });
  }
  if (renter.workLocation) {
    const workMap: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', office: 'Office', shifts: 'Shifts', wfh: 'Remote' };
    tags.push({ label: workMap[renter.workLocation] || renter.workLocation, color: '#888' });
  }
  const smokingVal = typeof renter.smoking === 'string' ? renter.smoking : (renter.smoking ? 'yes' : 'no');
  if (smokingVal === 'no' || smokingVal === 'never') tags.push({ label: 'Non-smoker', color: '#888' });
  else if (smokingVal) tags.push({ label: 'Smoker', color: '#f97316' });

  if (renter.hasPets || renter.pets) tags.push({ label: 'Has pets', color: ACCENT });
  else if (renter.noPetsAllergy) tags.push({ label: 'Pet allergy', color: RED });
  else tags.push({ label: 'No pets', color: '#888' });
  if ((renter as any).responseRate != null && (renter as any).responseRate >= 90) {
    tags.push({ label: `${(renter as any).responseRate}% response`, color: GREEN });
  }
  return tags;
}

function getLastActiveLabel(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const BrowseRentersScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user, getHostPlan } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();
  const routeListingId = route.params?.listingId as string | undefined;

  const [renters, setRenters] = useState<AgentRenter[]>([]);
  const [filteredRenters, setFilteredRenters] = useState<AgentRenter[]>([]);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Property[]>([]);
  const [selectedListing, setSelectedListing] = useState<Property | null>(null);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('room');
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
  const [sendingNow, setSendingNow] = useState(false);
  const piRequestId = useRef(0);

  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [sortBy, setSortBy] = useState<'recent' | 'budget' | 'moveIn' | 'name'>('recent');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [matrixRenters, setMatrixRenters] = useState<Set<string>>(new Set());
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [groupInviteSent, setGroupInviteSent] = useState(false);
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupNameAction, setGroupNameAction] = useState<'build' | 'invite'>('build');
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteSheetMembers, setInviteSheetMembers] = useState<AgentRenter[]>([]);
  const [inviteSheetGroupName, setInviteSheetGroupName] = useState('');
  const [matrixViewsRemaining, setMatrixViewsRemaining] = useState<number | null>(null);

  const hostType = user?.hostType || (user as any)?.host_type;
  const agentPlan = resolveEffectiveAgentPlan(user) as AgentPlan;
  const planLimits = getAgentPlanLimits(agentPlan);
  const effectivePlan = hostType === 'company' ? resolveEffectiveCompanyPlan(user) : agentPlan;
  const matrixAccess = getCompatibilityMatrixAccess(effectivePlan, hostType);

  useEffect(() => {
    if (matrixAccess.hasAccess && matrixAccess.limit !== -1 && user?.id) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      supabase
        .from('pi_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('feature', 'compatibility_matrix')
        .gte('created_at', monthStart.toISOString())
        .then(({ count }) => {
          setMatrixViewsRemaining(Math.max(0, matrixAccess.limit - (count ?? 0)));
        });
    }
  }, [matrixAccess.hasAccess, matrixAccess.limit, user?.id]);

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
              preferred_neighborhoods, zip_code,
              guest_policy, noise_tolerance, work_location, no_pets_allergy
            )
          `)
          .eq('role', 'renter')
          .eq('onboarding_step', 'complete')
          .neq('id', user?.id || '');

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        query = query
          .gte('last_active_at', cutoffDate.toISOString())
          .order('last_active_at', { ascending: false })
          .limit(100);

        if (user?.city) {
          query = query.eq('city', user.city);
        }

        const { data: supaRenters } = await query;

        const renterData = supaRenters || [];
        renterData.sort((a: any, b: any) => {
          const scoreA = getRecencyMultiplier(a.last_active_at);
          const scoreB = getRecencyMultiplier(b.last_active_at);
          return scoreB - scoreA;
        });
        mapped = renterData.map((u: any) => {
          const p = Array.isArray(u.profile) ? (u.profile[0] ?? null) : (u.profile ?? null);
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || (u.avatar_url ? [u.avatar_url] : []),
            city: u.city,
            preferredNeighborhoods: p?.preferred_neighborhoods || [],
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
            acceptAgentOffers: u.accept_agent_offers !== false,
            lastActiveAt: u.last_active_at,
            guestPolicy: p?.guest_policy,
            noiseTolerance: p?.noise_tolerance,
            workLocation: p?.work_location || (p?.wfh ? 'remote' : undefined),
            hasPets: p?.pets === 'yes' || p?.pets === true,
            noPetsAllergy: p?.no_pets_allergy,
            desiredBedrooms: p?.desired_bedrooms,
            locationFlexible: p?.location_flexible,
            apartmentPrefsComplete: p?.apartment_prefs_complete,
          };
        });

        profiles = renterData.map((u: any) => {
          const p = Array.isArray(u.profile) ? (u.profile[0] ?? null) : (u.profile ?? null);
          return {
            id: u.id,
            name: u.full_name || 'Unknown',
            age: u.age || 0,
            occupation: u.occupation || '',
            photos: p?.photos || [],
            bio: p?.bio || u.bio || '',
            gender: u.gender || '',
            lookingFor: p?.room_type || '',
            budget: p?.budget_max ?? 0,
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
          desiredBedrooms: p.apartmentPrefs?.desiredBedrooms,
          locationFlexible: p.apartmentPrefs?.locationFlexible,
          apartmentPrefsComplete: p.apartmentPrefs?.apartmentPrefsComplete,
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
          const rawPlan = getHostPlan();
          const hostType = user.hostType;
          const limit = getHostPiMonthlyLimit(rawPlan, hostType);
          setPiQuotaLimit(limit);
          if (!shouldLoadMockData()) {
            const used = await Promise.race([
              getMonthlyUsageCount(user.id),
              new Promise<number>(resolve => setTimeout(() => resolve(0), 5000)),
            ]);
            setPiQuotaUsed(used);
          }
        } catch {}
      }

      if (user) {
        try {
          const ids = await getShortlistedRenterIds(user.id);
          setShortlistedIds(new Set(ids));
        } catch {}
      }
    } catch (e) {
      console.warn('[BrowseRenters] Load error:', e);
      showAlert({ title: 'Load Error', message: 'Failed to load renters. Pull down to retry.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedListing, roomTypeFilter, neighborhoodFilter, renters, allProfiles, piSortActive, piRecommendedIds, searchText, sortBy, activeFilters]);

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
      const { filtered: transitFiltered, summary } = filterRentersForListing(allProfiles, selectedListing);
      setTransitFilterSummary(summary);
      const transitCompatibleIds = new Set(transitFiltered.map(r => r.id));
      filtered = filtered.filter(r => transitCompatibleIds.has(r.id));
    } else {
      setTransitFilterSummary(null);
    }

    filtered = filtered.filter(r => {
      if (roomTypeFilter === 'entire_apartment') {
        return r.roomType === 'entire_apartment' || r.roomType === 'entire' || r.roomType === 'apartment';
      }
      return r.roomType !== 'entire_apartment' && r.roomType !== 'entire' && r.roomType !== 'apartment';
    });

    if (neighborhoodFilter) {
      const nfLower = neighborhoodFilter.toLowerCase();
      filtered = filtered.filter(r =>
        r.neighborhood?.toLowerCase().includes(nfLower) ||
        r.preferredNeighborhoods?.some(n => n.toLowerCase().includes(nfLower))
      );
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.occupation?.toLowerCase().includes(q) ||
        r.neighborhood?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.preferredNeighborhoods?.some(n => n.toLowerCase().includes(q))
      );
    }

    for (const key of activeFilters) {
      const [cat, val] = key.split(':');
      if (cat === 'budget') {
        if (val === 'Under $1K') filtered = filtered.filter(r => (r.budgetMax ?? Infinity) < 1000);
        else if (val === '$1K-$1.5K') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 1000 && (r.budgetMin ?? 0) <= 1500);
        else if (val === '$1.5K-$2K') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 1500 && (r.budgetMin ?? 0) <= 2000);
        else if (val === '$2K+') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 2000);
        else if (val === 'Under $2K') filtered = filtered.filter(r => (r.budgetMax ?? Infinity) < 2000);
        else if (val === '$2K-$3K') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 2000 && (r.budgetMin ?? 0) <= 3000);
        else if (val === '$3K-$4K') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 3000 && (r.budgetMin ?? 0) <= 4000);
        else if (val === '$4K+') filtered = filtered.filter(r => (r.budgetMax ?? 0) >= 4000);
      } else if (cat === 'lifestyle') {
        if (val === 'Non-smoker') filtered = filtered.filter(r => !r.smoking || r.smoking === 'no' || r.smoking === 'never');
        else if (val === 'Has pets') filtered = filtered.filter(r => r.hasPets || r.pets);
        else if (val === 'No pets') filtered = filtered.filter(r => !r.hasPets && !r.pets);
        else if (val === 'Early bird') filtered = filtered.filter(r => r.sleepSchedule === 'early');
        else if (val === 'Night owl') filtered = filtered.filter(r => r.sleepSchedule === 'late');
      } else if (cat === 'moveIn') {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        if (val === 'This month') filtered = filtered.filter(r => {
          if (!r.moveInDate) return false;
          const d = new Date(r.moveInDate);
          return d <= endOfMonth;
        });
        else if (val === 'Next month') filtered = filtered.filter(r => {
          if (!r.moveInDate) return false;
          const d = new Date(r.moveInDate);
          return d > endOfMonth && d <= endOfNextMonth;
        });
        else if (val === 'Flexible') filtered = filtered.filter(r => !r.moveInDate);
      } else if (cat === 'clean') {
        if (val === '8+ (Very clean)') filtered = filtered.filter(r => (r.cleanliness ?? 0) >= 8);
        else if (val === '6-7 (Average)') filtered = filtered.filter(r => (r.cleanliness ?? 0) >= 6 && (r.cleanliness ?? 10) <= 7);
        else if (val === 'Under 6') filtered = filtered.filter(r => (r.cleanliness ?? 10) < 6);
      } else if (cat === 'bedrooms') {
        if (val === '1BR') filtered = filtered.filter(r => r.desiredBedrooms === 1);
        else if (val === '2BR') filtered = filtered.filter(r => r.desiredBedrooms === 2);
        else if (val === '3BR+') filtered = filtered.filter(r => (r.desiredBedrooms ?? 0) >= 3);
      }
    }

    if (piSortActive && piRecommendedIds.size > 0) {
      filtered.sort((a, b) => {
        const aPi = piRecommendedIds.has(a.id) ? 1 : 0;
        const bPi = piRecommendedIds.has(b.id) ? 1 : 0;
        return bPi - aPi;
      });
    } else if (sortBy === 'budget') {
      filtered.sort((a, b) => (a.budgetMin ?? 0) - (b.budgetMin ?? 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    } else if (sortBy === 'moveIn') {
      filtered.sort((a, b) => {
        const da = a.moveInDate ? new Date(a.moveInDate).getTime() : Infinity;
        const db = b.moveInDate ? new Date(b.moveInDate).getTime() : Infinity;
        return da - db;
      });
    } else if (selectedListing) {
      filtered.sort((a, b) => calculateRenterRelevance(b, selectedListing) - calculateRenterRelevance(a, selectedListing));
    }

    setFilteredRenters(filtered);
  };

  const isCompanyHost = user?.hostType === 'company';

  const shortlistingRef = useRef(new Set<string>());
  const handleShortlist = async (renter: AgentRenter) => {
    if (!user) return;
    if (shortlistingRef.current.has(renter.id)) return;
    shortlistingRef.current.add(renter.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (shortlistedIds.has(renter.id)) {
        const prevIds = new Set(shortlistedIds);
        setShortlistedIds(prev => { const next = new Set(prev); next.delete(renter.id); return next; });
        try {
          await removeFromShortlist(user.id, renter.id);
          if (isCompanyHost) { try { await companyRemoveFromShortlist(user.id, renter.id, selectedListing?.id); } catch {} }
        } catch (e) {
          setShortlistedIds(prevIds);
          Alert.alert('Error', 'Failed to update shortlist. Please try again.');
        }
        return;
      }

      if (!canAgentShortlist(agentPlan, shortlistedIds.size)) {
        showAlert({ title: 'Shortlist Limit Reached', message: `Your ${planLimits.label} plan allows up to ${planLimits.shortlistLimit} shortlisted renters. Upgrade to shortlist more.` });
        return;
      }

      const prevIds = new Set(shortlistedIds);
      setShortlistedIds(prev => new Set(prev).add(renter.id));
      try {
        const result = await addToShortlist(user.id, renter.id, selectedListing?.id);
        if (!result.success) {
          setShortlistedIds(prevIds);
          if (result.error) Alert.alert('Cannot Shortlist', result.error);
          return;
        }
        if (isCompanyHost) {
          try { await companyShortlistRenter(user.id, renter.id, selectedListing?.id); } catch (e) {
            console.warn('Company shortlist failed:', e);
          }
        }
      } catch (e) {
        setShortlistedIds(prevIds);
        Alert.alert('Error', 'Failed to update shortlist. Please try again.');
      }
    } catch (e) {
      console.error('[BrowseRenters] Shortlist error:', e);
    } finally {
      shortlistingRef.current.delete(renter.id);
    }
  };

  const toggleGroup = useCallback((id: string) => {
    setSelectedForGroup(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGroupInviteSent(false);
  }, []);

  const toggleMatrix = useCallback((id: string) => {
    setMatrixRenters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isEntireSeeker = isEntireSeekerFn;
  const isRoomSeeker = (renter: AgentRenter) => !isEntireSeeker(renter);

  const openGroupNamePrompt = (action: 'build' | 'invite') => {
    if (!user || selectedForGroup.size < 2) return;
    const members = renters.filter(r => selectedForGroup.has(r.id));
    const suggested = suggestGroupName(members, selectedListing);
    setGroupNameInput(suggested);
    setGroupNameAction(action);
    setShowGroupNameModal(true);
  };

  const handleGroupNameConfirm = async () => {
    if (!user || !groupNameInput.trim()) return;
    setShowGroupNameModal(false);
    const members = renters.filter(r => selectedForGroup.has(r.id));
    const eligible = members.filter(r => r.acceptAgentOffers !== false);
    if (eligible.length < 2) {
      showAlert({ title: 'Not Enough', message: 'Not enough eligible renters.' });
      return;
    }
    setSendingNow(true);
    try {
      const { groups: existingGroups } = await getAgentGroups(user.id);
      const activeCount = existingGroups.filter(g => g.groupStatus !== 'dissolved' && g.groupStatus !== 'placed').length;
      if (!canAgentCreateGroup(agentPlan, activeCount)) {
        showAlert({ title: 'Group Limit', message: 'Upgrade your plan to create more groups.' });
        setSendingNow(false);
        return;
      }
      const matrix = calculatePairMatrix(eligible);
      const avgCompat = matrix.length > 0 ? Math.round(matrix.reduce((s, p) => s + p.score, 0) / matrix.length) : 0;
      const status: 'assembling' | 'invited' = groupNameAction === 'build' ? 'assembling' : 'invited';
      const group: AgentGroup = {
        id: `ag_${Date.now()}`,
        name: groupNameInput.trim(),
        agentId: user.id,
        targetListingId: selectedListing?.id,
        targetListing: selectedListing || undefined,
        members: eligible,
        memberIds: eligible.map(r => r.id),
        groupStatus: status,
        avgCompatibility: avgCompat,
        combinedBudgetMin: eligible.reduce((s, r) => s + (r.budgetMin ?? 0), 0),
        combinedBudgetMax: eligible.reduce((s, r) => s + (r.budgetMax ?? 0), 0),
        coversRent: selectedListing ? eligible.reduce((s, r) => s + (r.budgetMax ?? 0), 0) >= selectedListing.price : false,
        invites: [],
        createdAt: new Date().toISOString(),
      };
      const created = await createAgentGroup(group);

      if (groupNameAction === 'invite') {
        setInviteSheetGroupName(groupNameInput.trim());
        setInviteSheetMembers(eligible);
        setSelectedForGroup(new Set());
        setGroupInviteSent(false);
        setSendingNow(false);
        setInviteSheetVisible(true);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedForGroup(new Set());
      setGroupInviteSent(false);
      showAlert({ title: 'Group Saved', message: `"${groupNameInput.trim()}" saved to My Groups \u2192 Assembling` });
    } catch (e) {
      showAlert({ title: 'Error', message: groupNameAction === 'build' ? 'Failed to save group.' : 'Failed to send invites.' });
    }
    setSendingNow(false);
  };

  const handleInviteSheetSend = async (messages: Record<string, string>) => {
    if (!user) return;
    const memberIds = inviteSheetMembers.map(m => m.id);
    const firstMsg = Object.values(messages)[0] || '';
    await sendAgentInvites(
      user.id, user.name ?? '', `ag_${Date.now()}`,
      memberIds, selectedListing || null, firstMsg,
      inviteSheetMembers.map(r => ({ id: r.id, name: r.name, photo: r.photos?.[0] }))
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setInviteSheetVisible(false);
    showAlert({ title: 'Invites Sent', message: `"${inviteSheetGroupName}" created and invites sent to ${inviteSheetMembers.length} renters.` });
  };

  const handleSendNow = async () => {
    if (!user || !bestGroupSuggestion || !selectedListing) return;
    const groupMembers: AgentRenter[] = bestGroupSuggestion.group;
    const eligible = groupMembers.filter(r => r.acceptAgentOffers !== false);
    if (eligible.length < 2) {
      showAlert({ title: 'Not Enough', message: 'Not enough eligible renters to form a group.' });
      return;
    }
    const ok = await confirm({
      title: 'Send Invites Now',
      message: `Create a group and send invites to ${eligible.length} renters for "${selectedListing.title}"?`,
    });
    if (!ok) return;
    setSendingNow(true);
    try {
      const { groups: existingGroups } = await getAgentGroups(user.id);
      const activeCount = existingGroups.filter(g => g.groupStatus !== 'dissolved' && g.groupStatus !== 'placed').length;
      if (!canAgentCreateGroup(agentPlan, activeCount)) {
        showAlert({ title: 'Group Limit', message: 'Upgrade your plan to create more groups.' });
        setSendingNow(false);
        return;
      }
      const matrix = calculatePairMatrix(eligible);
      const avgCompat = matrix.length > 0 ? Math.round(matrix.reduce((s, p) => s + p.score, 0) / matrix.length) : 0;
      const group: AgentGroup = {
        id: `ag_${Date.now()}`,
        name: `${selectedListing.title} - Agent Group`,
        agentId: user.id,
        targetListingId: selectedListing.id,
        targetListing: selectedListing,
        members: eligible,
        memberIds: eligible.map(r => r.id),
        groupStatus: 'invited',
        avgCompatibility: avgCompat,
        combinedBudgetMin: eligible.reduce((s, r) => s + (r.budgetMin ?? 0), 0),
        combinedBudgetMax: eligible.reduce((s, r) => s + (r.budgetMax ?? 0), 0),
        coversRent: eligible.reduce((s, r) => s + (r.budgetMax ?? 0), 0) >= selectedListing.price,
        invites: [],
        createdAt: new Date().toISOString(),
      };
      const created = await createAgentGroup(group);
      await sendAgentInvites(
        user.id, user.name ?? '', created.id,
        eligible.map(r => r.id), selectedListing, '',
        eligible.map(r => ({ id: r.id, name: r.name, photo: r.photos?.[0] }))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ title: 'Invites Sent', message: `Group created and invites sent to ${eligible.length} renters.` });
    } catch (e) {
      showAlert({ title: 'Error', message: 'Failed to create group. Please try again.' });
    }
    setSendingNow(false);
  };

  const renderCompactRow = (item: AgentRenter) => {
    const inGroup = selectedForGroup.has(item.id);
    const inMatrix = matrixRenters.has(item.id);
    const photo = item.photos?.[0];
    const wantsEntire = isEntireSeeker(item);

    return (
      <View key={item.id} style={st.compactRow}>
        <Pressable onPress={() => toggleGroup(item.id)} style={[st.checkbox, inGroup ? st.checkboxActive : null]}>
          {inGroup ? <Feather name="check" size={14} color="#000" /> : null}
        </Pressable>
        {photo ? (
          <Image source={{ uri: photo }} style={st.compactAvatar} />
        ) : (
          <View style={[st.compactAvatar, { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="user" size={18} color="#666" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: '#fff' }}>{item.name?.split(' ')[0]}</Text>
            <Text style={{ fontSize: 12, color: '#888' }}>{item.age}</Text>
          </View>
          <Text style={{ fontSize: 12, color: GREEN, fontWeight: '600' }}>
            {item.budgetMin != null && item.budgetMax != null
              ? `$${item.budgetMin.toLocaleString()} - $${item.budgetMax.toLocaleString()}`
              : ''}
          </Text>
        </View>
        {wantsEntire ? (
          item.desiredBedrooms ? (
            <View style={{ backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>{item.desiredBedrooms}BR+</Text>
            </View>
          ) : null
        ) : (
          <Pressable
            onPress={() => toggleMatrix(item.id)}
            style={[st.matrixToggle, inMatrix ? st.matrixToggleActive : null]}
          >
            <Feather name="grid" size={14} color={inMatrix ? GREEN : '#555'} />
            <Text style={{ fontSize: 10, color: inMatrix ? GREEN : '#555', fontWeight: '600' }}>
              {inMatrix ? 'In Matrix' : 'Match'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderRenterCard = ({ item }: { item: AgentRenter }) => {
    const inMatrix = matrixRenters.has(item.id);
    const photo = item.photos?.[0];
    const optedOut = item.acceptAgentOffers === false;
    const wantsEntire = isEntireSeeker(item);
    const inGroup = selectedForGroup.has(item.id);
    const isExpanded = expandedCard === item.id;
    const tags = getQuickTags(item);
    const lastActive = getLastActiveLabel(item.lastActiveAt);

    if (viewMode === 'compact') return renderCompactRow(item);

    return (
      <View style={[st.card, inGroup ? { borderColor: ACCENT + '40' } : null, optedOut ? { opacity: 0.5 } : null]}>
        <View style={{ padding: 16, paddingBottom: 0, flexDirection: 'row', gap: 14 }}>
          <View style={{ position: 'relative', flexShrink: 0 }}>
            {photo ? (
              <Image source={{ uri: photo }} style={st.cardAvatar} />
            ) : (
              <View style={[st.cardAvatar, { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="user" size={28} color="#666" />
              </View>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={st.cardName}>{item.name}</Text>
              <Text style={{ fontSize: 13, color: '#888' }}>{item.age}</Text>
              <View style={{ marginLeft: 'auto' }}>
                <View style={{ backgroundColor: wantsEntire ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: wantsEntire ? '#3b82f6' : ACCENT }}>
                    {wantsEntire ? 'Entire' : 'Room'}
                  </Text>
                </View>
              </View>
            </View>
            {item.occupation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Feather name="briefcase" size={12} color="#666" />
                <Text style={{ fontSize: 13, color: '#aaa' }}>{item.occupation}</Text>
              </View>
            ) : null}
            {item.preferredNeighborhoods && item.preferredNeighborhoods.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Feather name="map-pin" size={12} color="#666" />
                <Text style={{ fontSize: 13, color: '#aaa' }} numberOfLines={1}>{item.preferredNeighborhoods.slice(0, 2).join(', ')}</Text>
              </View>
            ) : item.city ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Feather name="map-pin" size={12} color="#666" />
                <Text style={{ fontSize: 13, color: '#aaa' }}>{item.city}</Text>
              </View>
            ) : null}
            {item.budgetMin != null && item.budgetMax != null ? (
              <Text style={{ fontSize: 15, fontWeight: '700', color: GREEN, marginTop: 4 }}>
                ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}/mo
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {item.moveInDate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Feather name="calendar" size={11} color="#888" />
                  <Text style={{ fontSize: 12, color: '#888' }}>
                    Move-in: {new Date(item.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ) : null}
              {lastActive ? <Text style={{ fontSize: 12, color: '#666' }}>{lastActive}</Text> : null}
            </View>
          </View>

          {!wantsEntire ? (
            <Pressable
              onPress={() => optedOut ? showAlert({ title: 'Not Available', message: 'This renter is not accepting offers from agents.' }) : toggleMatrix(item.id)}
              style={[st.matrixToggle, inMatrix ? st.matrixToggleActive : null, { alignSelf: 'flex-start' }]}
            >
              <Feather name="grid" size={18} color={inMatrix ? GREEN : '#555'} />
              <Text style={{ fontSize: 9, color: inMatrix ? GREEN : '#555', fontWeight: '600' }}>
                {inMatrix ? 'In Matrix' : 'Match'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {piRecommendedIds.has(item.id) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(168,85,247,0.1)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginHorizontal: 16, marginTop: 6, alignSelf: 'flex-start' }}>
            <Feather name="cpu" size={10} color="#a855f7" />
            <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: '600' }}>{'\u03C0'} Pi Pick</Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <View key={tag.label} style={[st.quickTag, { borderColor: tag.color + '20' }]}>
              <Text style={{ fontSize: 11, color: tag.color }}>{tag.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ padding: 12, paddingTop: 12, flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          <Pressable
            style={st.actionBtn}
            onPress={() => {
              navigation.navigate('Chat', {
                conversationId: `agent-${user?.id}-${item.id}`,
                otherUser: { id: item.id, name: item.name, photos: item.photos },
              });
            }}
          >
            <Feather name="message-circle" size={16} color="#ccc" />
            <Text style={st.actionBtnText}>Message</Text>
          </Pressable>
          <Pressable
            style={[st.actionBtn, inGroup ? st.actionBtnAccent : st.actionBtnAccentOutline]}
            onPress={() => toggleGroup(item.id)}
          >
            <Feather name={inGroup ? 'check' : 'user-plus'} size={16} color={inGroup ? '#000' : ACCENT} />
            <Text style={[st.actionBtnText, { color: inGroup ? '#000' : ACCENT }]}>
              {inGroup ? 'In Group' : 'Add to Group'}
            </Text>
          </Pressable>
          <Pressable
            style={[st.actionBtn, { paddingHorizontal: 12 }]}
            onPress={() => setExpandedCard(isExpanded ? null : item.id)}
          >
            <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#888" />
          </Pressable>
        </View>

        {isExpanded ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 14 }}>
            {wantsEntire ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {item.desiredBedrooms ? (
                  <View style={st.detailItem}>
                    <Feather name="home" size={13} color="#3b82f6" />
                    <Text style={st.detailText}>Bedrooms: {item.desiredBedrooms}+</Text>
                  </View>
                ) : null}
                {item.preferredNeighborhoods && item.preferredNeighborhoods.length > 0 ? (
                  <View style={st.detailItem}>
                    <Feather name="map-pin" size={13} color="#3b82f6" />
                    <Text style={st.detailText} numberOfLines={1}>
                      {item.preferredNeighborhoods.join(', ')}
                    </Text>
                  </View>
                ) : null}
                {item.moveInDate ? (
                  <View style={st.detailItem}>
                    <Feather name="calendar" size={13} color="#888" />
                    <Text style={st.detailText}>
                      Move-in: {new Date(item.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                ) : null}
                {item.locationFlexible ? (
                  <View style={st.detailItem}>
                    <Feather name="navigation" size={13} color={GREEN} />
                    <Text style={st.detailText}>Flexible on location</Text>
                  </View>
                ) : null}
                {item.budgetMax ? (
                  <View style={st.detailItem}>
                    <Feather name="dollar-sign" size={13} color="#888" />
                    <Text style={st.detailText}>Max budget: ${item.budgetMax.toLocaleString()}/mo</Text>
                  </View>
                ) : null}
                {item.workLocation ? (
                  <View style={st.detailItem}>
                    <Feather name="briefcase" size={13} color="#888" />
                    <Text style={st.detailText}>
                      {({ remote: 'Remote', hybrid: 'Hybrid', office: 'In-office', shifts: 'Shift work', wfh: 'Remote' } as Record<string, string>)[item.workLocation] || item.workLocation}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {item.sleepSchedule ? (
                  <View style={st.detailItem}>
                    <Feather name="moon" size={13} color="#888" />
                    <Text style={st.detailText}>Sleep: {item.sleepSchedule}</Text>
                  </View>
                ) : null}
                {item.cleanliness != null ? (
                  <View style={st.detailItem}>
                    <Feather name="star" size={13} color="#888" />
                    <Text style={st.detailText}>Clean: {item.cleanliness}/10</Text>
                  </View>
                ) : null}
                {item.noiseTolerance != null ? (
                  <View style={st.detailItem}>
                    <Feather name="volume-2" size={13} color="#888" />
                    <Text style={st.detailText}>Noise: {item.noiseTolerance}/10</Text>
                  </View>
                ) : null}
                {item.guestPolicy ? (
                  <View style={st.detailItem}>
                    <Feather name="home" size={13} color="#888" />
                    <Text style={st.detailText}>Guests: {item.guestPolicy}</Text>
                  </View>
                ) : null}
                <View style={st.detailItem}>
                  <Feather name="heart" size={13} color="#888" />
                  <Text style={st.detailText}>
                    {item.hasPets || item.pets ? 'Has pets' : item.noPetsAllergy ? 'Pet allergy' : 'No pets'}
                  </Text>
                </View>
                <View style={st.detailItem}>
                  <Feather name="wind" size={13} color="#888" />
                  <Text style={st.detailText}>
                    {typeof item.smoking === 'string' ? (item.smoking === 'no' || item.smoking === 'never' ? 'Non-smoker' : item.smoking) : (item.smoking ? 'Smoker' : 'Non-smoker')}
                  </Text>
                </View>
              </View>
            )}
            {!wantsEntire && item.interests && item.interests.length > 0 ? (
              <View style={{ marginTop: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#666' }}>Interests:</Text>
                {item.interests.slice(0, 6).map(i => (
                  <View key={i} style={{ backgroundColor: SURFACE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, color: '#aaa' }}>{i}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderAIPanel = () => {
    if (!planLimits.hasAISuggestions || !selectedListing || aiSuggestions.length === 0) return null;
    return (
      <View style={st.aiPanel}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Feather name="zap" size={18} color={ACCENT} />
          <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '700', flex: 1 }}>
            Pi -- Top picks for "{selectedListing.title}"
          </Text>
        </View>
        {aiSuggestions.map(s => (
          <View key={s.renter.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {s.renter.photos?.[0] ? <Image source={{ uri: s.renter.photos[0] }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{s.renter.name}</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>{s.reason}</Text>
              </View>
              <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: s.listingFitScore >= 80 ? GREEN : ACCENT }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{s.listingFitScore}%</Text>
              </View>
            </View>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' }} onPress={() => handleShortlist(s.renter)}>
              <Feather name="plus" size={14} color={shortlistedIds.has(s.renter.id) ? ACCENT : '#fff'} />
              <Text style={{ color: shortlistedIds.has(s.renter.id) ? ACCENT : '#fff', fontSize: 12, fontWeight: '600' }}>
                {shortlistedIds.has(s.renter.id) ? 'Shortlisted' : 'Shortlist'}
              </Text>
            </Pressable>
          </View>
        ))}
        {bestGroupSuggestion ? (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 12, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="users" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '700' }}>Best group suggestion</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 4 }}>{bestGroupSuggestion.names.join(' + ')}</Text>
            <Text style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>{bestGroupSuggestion.avgCompatibility}% avg compatibility</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                onPress={() => navigation.navigate('AgentGroupBuilder', {
                  preselectedIds: bestGroupSuggestion.group.map((r: AgentRenter) => r.id),
                  listingId: selectedListing?.id,
                })}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Build & Review</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                onPress={handleSendNow}
                disabled={sendingNow}
              >
                {sendingNow ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Now</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      <View style={st.searchRow}>
        <View style={st.searchInput}>
          <Feather name="search" size={18} color="#666" />
          <TextInput
            placeholder="Search by name, job, or neighborhood..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
            style={st.searchField}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <Feather name="x" size={16} color="#666" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[st.filterBtn, (showFilters || activeFilters.size > 0) ? st.filterBtnActive : null]}
        >
          <Feather name="sliders" size={20} color={(showFilters || activeFilters.size > 0) ? ACCENT : '#888'} />
          {activeFilters.size > 0 ? (
            <View style={st.filterBadge}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#000' }}>{activeFilters.size}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {showFilters ? (
        <View style={st.filterPanel}>
          {Object.entries(roomTypeFilter === 'entire_apartment' ? ENTIRE_FILTER_OPTIONS : ROOM_FILTER_OPTIONS).map(([category, options]) => (
            <View key={category} style={{ marginBottom: 12 }}>
              <Text style={st.filterCatLabel}>{category.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {options.map(opt => {
                  const key = `${category}:${opt}`;
                  const active = activeFilters.has(key);
                  return (
                    <Pressable key={key} onPress={() => toggleFilter(key)} style={[st.filterChip, active ? st.filterChipActive : null]}>
                      <Text style={[st.filterChipText, active ? st.filterChipTextActive : null]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {activeFilters.size > 0 ? (
            <Pressable onPress={() => setActiveFilters(new Set())}>
              <Text style={{ fontSize: 12, color: ACCENT }}>Clear all filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        style={[st.listingSelector, selectedListing ? { borderColor: ACCENT + '50', backgroundColor: ACCENT + '08' } : null]}
        onPress={() => setShowListingPicker(true)}
      >
        <Feather name="home" size={18} color={ACCENT} />
        <Text style={{ flex: 1, fontSize: 14, color: selectedListing ? '#fff' : '#888' }} numberOfLines={1}>
          {selectedListing ? selectedListing.title : 'Select a listing to filter renters'}
        </Text>
        <Feather name="chevron-down" size={16} color="#666" />
      </Pressable>

      <Pressable
        style={st.piGroupsBanner}
        onPress={() => navigation.navigate('PiMatchedGroups', { listing: selectedListing || undefined })}
      >
        <View style={st.piGroupsIcon}>
          <Feather name="zap" size={20} color="#a855f7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: '#fff' }}>{'\u03C0'} Pi Matched Groups</Text>
          <Text style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>Browse pre-vetted roommate groups</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#666" />
      </Pressable>

      {selectedListing && piRecommendedIds.size > 0 ? (
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: piSortActive ? '#a855f7' : 'rgba(168,85,247,0.1)', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: piSortActive ? '#a855f7' : 'rgba(168,85,247,0.3)' }}
          onPress={() => setPiSortActive(!piSortActive)}
        >
          <Feather name="cpu" size={12} color={piSortActive ? '#fff' : '#a855f7'} />
          <Text style={{ color: piSortActive ? '#fff' : '#a855f7', fontSize: 12, fontWeight: '600' }}>
            {'\u03C0'} Pi Recommended ({piRecommendedIds.size})
          </Text>
        </Pressable>
      ) : null}

      <View style={st.controlsRow}>
        <View style={st.roomToggle}>
          {['room', 'entire_apartment'].map(type => (
            <Pressable
              key={type}
              onPress={() => { setRoomTypeFilter(type); setActiveFilters(new Set()); }}
              style={[st.roomToggleBtn, roomTypeFilter === type ? st.roomToggleBtnActive : null]}
            >
              <Text style={[st.roomToggleBtnText, roomTypeFilter === type ? st.roomToggleBtnTextActive : null]}>
                {type === 'room' ? 'Room' : 'Entire'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }} />

        <Pressable onPress={() => setShowSortDropdown(!showSortDropdown)} style={st.sortBtn}>
          <Feather name="bar-chart-2" size={14} color="#aaa" />
          <Text style={{ fontSize: 12, color: '#aaa' }}>
            {sortBy === 'recent' ? 'Recent' : sortBy === 'budget' ? 'Budget' : sortBy === 'name' ? 'Name' : 'Move-in'}
          </Text>
        </Pressable>

        <View style={st.viewToggle}>
          <Pressable onPress={() => setViewMode('cards')} style={[st.viewToggleBtn, viewMode === 'cards' ? st.viewToggleBtnActive : null]}>
            <Feather name="grid" size={14} color={viewMode === 'cards' ? '#fff' : '#666'} />
          </Pressable>
          <Pressable onPress={() => setViewMode('compact')} style={[st.viewToggleBtn, viewMode === 'compact' ? st.viewToggleBtnActive : null]}>
            <Feather name="list" size={14} color={viewMode === 'compact' ? '#fff' : '#666'} />
          </Pressable>
        </View>
      </View>

      {showSortDropdown ? (
        <View style={st.sortDropdown}>
          {[
            { key: 'recent', label: 'Recently active' },
            { key: 'budget', label: 'Budget: low to high' },
            { key: 'moveIn', label: 'Move-in date' },
            { key: 'name', label: 'Name: A to Z' },
          ].map(opt => (
            <Pressable
              key={opt.key}
              onPress={() => { setSortBy(opt.key as any); setShowSortDropdown(false); }}
              style={[st.sortOption, sortBy === opt.key ? { backgroundColor: 'rgba(245,158,11,0.1)' } : null]}
            >
              <Text style={{ fontSize: 13, color: sortBy === opt.key ? ACCENT : '#ccc' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: '#888' }}>{filteredRenters.length} renters</Text>
        {roomTypeFilter !== 'entire_apartment' ? (
          <Pressable
            onPress={async () => {
              if (!matrixAccess.hasAccess) {
                const isCompany = hostType === 'company';
                const upgradeTo = isCompany ? 'Company Pro' : 'Agent Pro';
                showAlert({ title: 'Pro Feature', message: `Compatibility Matrix is available on ${upgradeTo} and above plans.` });
                return;
              }
              if (matrixAccess.limit !== -1) {
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
                const { count } = await supabase
                  .from('pi_usage_log')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', user!.id)
                  .eq('feature', 'compatibility_matrix')
                  .gte('created_at', monthStart.toISOString());
                const used = count ?? 0;
                if (used >= matrixAccess.limit) {
                  showAlert({ title: 'Monthly Limit Reached', message: `You've used all ${matrixAccess.limit} Compatibility Matrix views this month. Upgrade to Pro for unlimited access.` });
                  return;
                }
              }
              let matrixList = renters.filter(r => matrixRenters.has(r.id));
              if (selectedListing) {
                const perPersonRent = selectedListing.bedrooms > 0
                  ? Math.ceil(selectedListing.price / selectedListing.bedrooms)
                  : selectedListing.price;
                matrixList = matrixList.filter(r => {
                  const canAfford = !r.budgetMax || r.budgetMax >= perPersonRent * 0.7;
                  const rightType = !r.roomType || r.roomType === 'room' || r.roomType === 'private_room' || r.roomType === 'shared_room';
                  return canAfford && rightType;
                });
              }
              if (matrixList.length < 2) {
                showAlert({
                  title: 'Not Enough Matches',
                  message: 'Tap "Match" on at least 2 renters to compare them in the compatibility matrix.',
                });
                return;
              }
              if (matrixAccess.limit !== -1 && user?.id) {
                await supabase.from('pi_usage_log').insert({
                  user_id: user.id,
                  feature: 'compatibility_matrix',
                  created_at: new Date().toISOString(),
                });
                setMatrixViewsRemaining(prev => prev !== null ? Math.max(0, prev - 1) : null);
              }
              navigation.navigate('RenterCompatibility', { renters: matrixList, listingId: selectedListing?.id, listing: selectedListing });
            }}
            style={st.matrixNavBtn}
          >
            <Feather name="grid" size={14} color={GREEN} />
            <Text style={{ color: GREEN, fontSize: 13, fontWeight: '600' }}>Matrix ({matrixRenters.size})</Text>
            {matrixAccess.hasAccess && matrixAccess.limit !== -1 && matrixViewsRemaining !== null ? (
              <View style={{ backgroundColor: matrixViewsRemaining > 0 ? '#22c55e22' : '#ef444422', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 4 }}>
                <Text style={{ color: matrixViewsRemaining > 0 ? GREEN : '#ef4444', fontSize: 10, fontWeight: '700' }}>{matrixViewsRemaining} left</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {selectedForGroup.size > 0 ? (
        <View style={st.groupBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Feather name="users" size={14} color={ACCENT} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: ACCENT }}>Group: {selectedForGroup.size} selected</Text>
            <Pressable onPress={() => { setSelectedForGroup(new Set()); setGroupInviteSent(false); }} style={{ marginLeft: 'auto' }}>
              <Text style={{ color: '#666', fontSize: 11 }}>Clear</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {renters.filter(r => selectedForGroup.has(r.id)).map(r => (
                <View key={r.id} style={st.groupChip}>
                  {r.photos?.[0] ? (
                    <Image source={{ uri: r.photos[0] }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                  ) : (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#888' }}>{r.name?.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, color: '#ccc' }}>{r.name?.split(' ')[0]}</Text>
                  <Pressable onPress={() => toggleGroup(r.id)}>
                    <Feather name="x" size={12} color="#666" />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => openGroupNamePrompt('build')}
              disabled={sendingNow || selectedForGroup.size < 2}
              style={[st.sendInviteBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ACCENT }]}
            >
              <Feather name="folder-plus" size={15} color={ACCENT} />
              <Text style={[st.sendInviteBtnText, { color: ACCENT }]}>
                Build Group ({selectedForGroup.size})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openGroupNamePrompt('invite')}
              disabled={sendingNow || selectedForGroup.size < 2}
              style={[st.sendInviteBtn, { flex: 1 }]}
            >
              {sendingNow ? <ActivityIndicator color="#000" size="small" /> : (
                <>
                  <Feather name="send" size={15} color="#000" />
                  <Text style={st.sendInviteBtnText}>
                    Send Invite ({selectedForGroup.size})
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {transitFilterSummary && selectedListing ? (
        <View style={st.transitSummary}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Feather name="cpu" size={14} color={ACCENT} />
            <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600', flex: 1 }}>
              Filtered for "{selectedListing.bedrooms}BR {selectedListing.neighborhood ?? selectedListing.city} - ${selectedListing.price?.toLocaleString()}/mo"
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Started with {transitFilterSummary.total} renters</Text>
          {transitFilterSummary.afterTransit < transitFilterSummary.total ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {transitFilterSummary.afterTransit} have {(NEIGHBORHOOD_TRAINS[selectedListing.neighborhood ?? ''] ?? []).slice(0, 4).join('/')} train access
              </Text>
            </View>
          ) : null}
          {transitFilterSummary.afterBudget < transitFilterSummary.afterTransit ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Feather name="check" size={12} color={GREEN} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {transitFilterSummary.afterBudget} can afford ${Math.round(selectedListing.price / selectedListing.bedrooms).toLocaleString()}/person share
              </Text>
            </View>
          ) : null}
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
            Showing {transitFilterSummary.afterDate} pre-qualified renters
          </Text>
        </View>
      ) : null}

      {piQuotaLimit !== 0 && selectedListing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(168,85,247,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="cpu" size={12} color="#a855f7" />
            <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: '600' }}>
              {piQuotaLimit === -1 ? 'Unlimited Pi calls' : `${Math.max(0, piQuotaLimit - piQuotaUsed)}/${piQuotaLimit} Pi calls left`}
            </Text>
          </View>
        </View>
      ) : null}

      {renderAIPanel()}
    </View>
  );

  return (
    <View style={[st.container, { paddingTop: 0 }]}>
      <AppHeader
        title="Browse Renters"
        hideSeparator
        rightActions={
          selectedForGroup.size > 0 ? (
            <HeaderActionButton
              label={`Build Group (${selectedForGroup.size})`}
              icon="users"
              onPress={() => openGroupNamePrompt('build')}
            />
          ) : null
        }
      />

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
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                No renters match your filters
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Try adjusting your search or selecting a different listing
              </Text>
              {(selectedListing || neighborhoodFilter || activeFilters.size > 0 || searchText) ? (
                <Pressable
                  onPress={() => { setSelectedListing(null); setRoomTypeFilter('room'); setNeighborhoodFilter(''); setSearchText(''); setActiveFilters(new Set()); }}
                  style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: ACCENT, borderRadius: 10 }}
                >
                  <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>Clear all filters</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}

      <Modal visible={showListingPicker} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Your Listings</Text>
              <Pressable onPress={() => setShowListingPicker(false)} style={{ padding: 4 }}>
                <Feather name="x" size={22} color="#aaa" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              <Pressable
                style={[st.listingPickerRow, !selectedListing ? { borderColor: GREEN + '50', backgroundColor: GREEN + '08' } : null]}
                onPress={() => { setSelectedListing(null); setShowListingPicker(false); }}
              >
                <View style={[st.listingPickerThumb, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="globe" size={14} color="#888" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>All Renters</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>No listing filter applied</Text>
                </View>
                {!selectedListing ? <Feather name="check-circle" size={18} color={GREEN} /> : null}
              </Pressable>

              {listings.map(l => {
                const isActive = selectedListing?.id === l.id;
                return (
                  <Pressable
                    key={l.id}
                    style={[st.listingPickerRow, isActive ? { borderColor: ACCENT + '50', backgroundColor: ACCENT + '08' } : null]}
                    onPress={() => { setSelectedListing(l); setShowListingPicker(false); }}
                  >
                    {l.photos?.[0] ? (
                      <Image source={{ uri: l.photos[0] }} style={st.listingPickerPhoto} />
                    ) : (
                      <View style={[st.listingPickerPhoto, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="home" size={20} color="#666" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{l.title}</Text>
                      <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600', marginTop: 2 }}>${l.price?.toLocaleString()}/mo</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <Text style={{ color: '#888', fontSize: 12 }}>{l.bedrooms}BR{l.bathrooms ? ` ${l.bathrooms}BA` : ''}</Text>
                        {l.neighborhood ? <Text style={{ color: '#888', fontSize: 12 }}>{l.neighborhood}</Text> : null}
                      </View>
                    </View>
                    {isActive ? <Feather name="check-circle" size={18} color={GREEN} /> : null}
                  </Pressable>
                );
              })}
              {listings.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Feather name="home" size={32} color="#444" />
                  <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>No active listings</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <InvitePreviewSheet
        visible={inviteSheetVisible}
        onClose={() => setInviteSheetVisible(false)}
        onSend={handleInviteSheetSend}
        members={inviteSheetMembers}
        groupName={inviteSheetGroupName}
        listing={selectedListing ? { id: selectedListing.id, title: selectedListing.title, price: selectedListing.price, bedrooms: selectedListing.bedrooms, neighborhood: selectedListing.neighborhood } : null}
        agentName={user?.name || 'Your Agent'}
      />

      <Modal visible={showGroupNameModal} transparent animationType="fade" onRequestClose={() => setShowGroupNameModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1a1a1a', borderRadius: 18, width: '100%', maxWidth: 360, padding: 24, borderWidth: 1, borderColor: '#333' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
              {groupNameAction === 'build' ? 'Name Your Group' : 'Name & Send Invites'}
            </Text>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {groupNameAction === 'build'
                ? 'Save this group to Assembling. You can add more members and send invites later.'
                : `Create group and send invites to ${selectedForGroup.size} renters immediately.`}
            </Text>
            <TextInput
              value={groupNameInput}
              onChangeText={setGroupNameInput}
              placeholder="Group name..."
              placeholderTextColor="#555"
              style={{ backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333', color: '#fff', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}
              autoFocus
              selectTextOnFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowGroupNameModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' }}
              >
                <Text style={{ color: '#888', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleGroupNameConfirm}
                disabled={!groupNameInput.trim() || sendingNow}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: groupNameAction === 'build' ? ACCENT : ACCENT, alignItems: 'center', opacity: !groupNameInput.trim() ? 0.5 : 1 }}
              >
                {sendingNow ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>
                    {groupNameAction === 'build' ? 'Save Group' : 'Send Invites'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  buildGroupGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  matrixNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  searchField: { flex: 1, color: '#fff', paddingVertical: 13, paddingHorizontal: 10, fontSize: 14 },
  filterBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(245,158,11,0.15)' },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },

  filterPanel: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: '#222', padding: 16, marginBottom: 14 },
  filterCatLabel: { fontSize: 11, fontWeight: '600', color: '#888', letterSpacing: 1, marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: SURFACE },
  filterChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(245,158,11,0.15)' },
  filterChipText: { fontSize: 12, color: '#aaa' },
  filterChipTextActive: { color: ACCENT },

  listingSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#222', padding: 12, marginBottom: 14 },

  piGroupsBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)', padding: 14, marginBottom: 14 },
  piGroupsIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.2)', alignItems: 'center', justifyContent: 'center' },

  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  roomToggle: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 10, padding: 3 },
  roomToggleBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  roomToggleBtnActive: { backgroundColor: ACCENT },
  roomToggleBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
  roomToggleBtnTextActive: { color: '#000' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  viewToggle: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 8, padding: 2 },
  viewToggleBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  viewToggleBtnActive: { backgroundColor: '#333' },

  sortDropdown: { backgroundColor: SURFACE, borderRadius: 10, borderWidth: 1, borderColor: '#333', overflow: 'hidden', marginBottom: 12 },
  sortOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },

  groupBar: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#222', padding: 14, marginBottom: 10 },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  sendInviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 11 },
  sendInviteBtnSent: { backgroundColor: '#1a3a1a' },
  sendInviteBtnText: { fontWeight: '700', fontSize: 13, color: '#000' },

  card: { backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: '#222', marginBottom: 14, overflow: 'hidden' },
  cardAvatar: { width: 64, height: 64, borderRadius: 16 },
  cardName: { fontWeight: '700', fontSize: 16, color: '#fff' },

  quickTag: { backgroundColor: SURFACE, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },

  matrixToggle: { alignItems: 'center', gap: 2, borderWidth: 1, borderColor: 'transparent', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  matrixToggleActive: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' },

  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#333' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#ccc' },
  actionBtnAccent: { backgroundColor: ACCENT, borderColor: ACCENT },
  actionBtnAccentOutline: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: ACCENT + '40' },

  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '48%' },
  detailText: { fontSize: 12, color: '#aaa' },

  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SURFACE },
  compactAvatar: { width: 40, height: 40, borderRadius: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: ACCENT, borderColor: ACCENT },

  transitSummary: { backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  aiPanel: { backgroundColor: 'rgba(26,26,46,1)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: SURFACE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  listingPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: CARD_BG, borderWidth: 1, borderColor: '#2a2a2a' },
  listingPickerThumb: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden' },
  listingPickerPhoto: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden' },
});
