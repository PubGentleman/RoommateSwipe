import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, Modal, TextInput, ScrollView, Switch, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { PricePickerPair, STANDARD_MAX_VALUE } from '../../components/PricePicker';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { WalkScoreBadge } from '../../components/WalkScoreBadge';
import { InterestConfirmationModal } from '../../components/InterestConfirmationModal';
import { PaywallSheet } from '../../components/PaywallSheet';
import { LockedFeatureOverlay, PlanBadgeInline } from '../../components/LockedFeatureOverlay';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useCityContext } from '../../contexts/CityContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { getListings, mapListingToProperty, recordListingView } from '../../services/listingService';
import { trackListingView, trackListingSave, trackInterestSent, trackSearchFilter, trackNeighborhoodSearch } from '../../utils/demandTracking';
import { getDiscoverableGroupsForListing } from '../../services/groupService';
import { getUserPreformedGroup, addToShortlist } from '../../services/preformedGroupService';
import { Property, PropertyFilter, User, RoommateProfile, InterestCard, Conversation, Group } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { formatMoveInDate, calculateCompatibility, getMatchQualityColor, getGenderSymbol, formatLocation } from '../../utils/matchingAlgorithm';
import { calculateListingMatchScore, ListingMatchInput } from '../../utils/listingMatchScore';
import { getNeighborhoodsByCity, getAllCities, NEIGHBORHOODS } from '../../utils/locationData';
import { fetchAreaInfo, formatNearestAmenity, AreaInfo, NearbyAmenity } from '../../services/neighborhoodService';
import { getZodiacSymbol } from '../../utils/zodiacUtils';
import { getBoostRotationIndex } from '../../utils/boostRotation';
import { getAgentsWithCriticalStatus } from '../../services/responseTrackingService';
import { shouldShowMatchScore, getHostBadgeLabel, getHostBadgeColor, getHostBadgeIcon } from '../../utils/hostTypeUtils';
import type { HostType } from '../../utils/hostTypeUtils';
import { PropertyMapView } from '../../components/PropertyMapView';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import { RhomeLogo } from '../../components/RhomeLogo';
import { NeighborhoodAISheet } from '../../components/NeighborhoodAISheet';
import { PropertyReviewsScreen } from '../shared/PropertyReviewsScreen';
import { WriteReviewSheet } from '../../components/WriteReviewSheet';
import { getReviewSummary, submitReview, checkReviewEligibility, ReviewSummary } from '../../services/reviewService';

import { useNotificationContext } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { shouldShowRoommateFeatures } from '../../utils/renterIntentUtils';
import {
  ALL_AMENITIES,
  AMENITY_CATEGORIES,
  AmenityCategory,
  normalizeLegacyAmenity,
} from '../../constants/amenities';
import { HostBadge } from '../../components/HostBadge';
import { useHostBadge, BADGE_CONFIG, HostBadgeType } from '../../hooks/useHostBadge';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

const QUICK_FILTERS = [
  { key: 'under2k', label: 'Under $2k', icon: 'dollar-sign' as const },
  { key: 'petFriendly', label: 'Pet Friendly', icon: 'heart' as const },
  { key: 'lease', label: 'Lease', icon: 'file-text' as const },
  { key: 'sublet', label: 'Sublet', icon: 'repeat' as const },
  { key: 'noFee', label: 'No Fee', icon: 'slash' as const },
  { key: 'availableNow', label: 'Available Now', icon: 'clock' as const },
];

const LISTING_TYPE_CHIPS: { key: string; label: string; icon: 'user' | 'home' | 'file-text' | 'clock' }[] = [
  { key: 'room', label: 'Private Room', icon: 'user' },
  { key: 'entire', label: 'Entire Unit', icon: 'home' },
];

const LEASE_TYPE_CHIPS: { key: string; label: string; icon: 'file-text' | 'clock' }[] = [
  { key: 'lease', label: 'Lease', icon: 'file-text' },
  { key: 'sublet', label: 'Sublet', icon: 'clock' },
];

const LISTING_TYPE_OPTIONS = [
  { key: 'any' as const, icon: 'grid' as const, label: 'Any Type' },
  { key: 'room' as const, icon: 'user' as const, label: 'Private Room' },
  { key: 'entire' as const, icon: 'home' as const, label: 'Entire Unit' },
  { key: 'sublet' as const, icon: 'clock' as const, label: 'Sublet' },
];

const AVATAR_GRADIENTS: [string, string][] = [
  ['#4a9eff', '#1e6fd4'],
  ['#e83a7a', '#9b1fad'],
  ['#ff6b5b', '#e83a2a'],
  ['#2ecc71', '#1aa355'],
  ['#ffd700', '#ff9500'],
  ['#9b59b6', '#6c3483'],
];

const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getAvatarGradient = (id: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

export const ExploreScreen = () => {
  const { theme } = useTheme();
  const { user, canSendInterest, canSendSuperInterest, canViewListing, useListingView } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useNotificationContext();
  const { alert: showAlert, confirm } = useConfirm();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<AmenityCategory>>(new Set(['unit_features']));
  const [filters, setFilters] = useState<PropertyFilter>({});
  const [tempFilters, setTempFilters] = useState<PropertyFilter>({});
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [criticalAgentIds, setCriticalAgentIds] = useState<string[]>([]);
  const [showPropertyDetail, setShowPropertyDetail] = useState(false);
  const [showNeighborhoodSheet, setShowNeighborhoodSheet] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMatchBreakdown, setShowMatchBreakdown] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'saved'>('all');
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const { activeCity, activeSubArea, recentCities, setActiveCity, setActiveSubArea } = useCityContext();
  const [hostProfiles, setHostProfiles] = useState<Map<string, User>>(new Map());
  const [interestMap, setInterestMap] = useState<Map<string, InterestCard>>(new Map());
  const [discoverableGroups, setDiscoverableGroups] = useState<Map<string, number>>(new Map());
  const [showUnifiedInterestSheet, setShowUnifiedInterestSheet] = useState(false);
  const [showInterestConfirmation, setShowInterestConfirmation] = useState(false);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [isSuperInterest, setIsSuperInterest] = useState(false);
  const [confirmationWasSuper, setConfirmationWasSuper] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState('');
  const [paywallPlan, setPaywallPlan] = useState<'plus' | 'elite'>('plus');
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set());
  const intentPref = user?.profileData?.listing_type_preference;
  const searchType = user?.profileData?.apartment_search_type;
  const isEntireApartmentSeeker = intentPref === 'entire_apartment' || (intentPref !== 'room' && (searchType === 'solo' || searchType === 'with_partner' || searchType === 'have_group'));
  const [listingTypeFilter, setListingTypeFilter] = useState<string[]>(() => {
    if (intentPref === 'room') return ['room'];
    if (intentPref === 'entire_apartment') return ['entire'];
    return [];
  });
  const [leaseTypeFilter, setLeaseTypeFilter] = useState<string[]>([]);
  const [showAISheet, setShowAISheet] = useState(false);
  const [interestNote, setInterestNote] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [showGroupPickerModal, setShowGroupPickerModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [canReviewListing, setCanReviewListing] = useState(false);
  const [reviewEligibilityLoaded, setReviewEligibilityLoaded] = useState(false);
  const [reviewSummaryCache, setReviewSummaryCache] = useState<Map<string, ReviewSummary>>(new Map());
  const [detailReviewSummary, setDetailReviewSummary] = useState<ReviewSummary | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{ label: string; city: string; neighborhood: string | null; type: 'city' | 'neighborhood' | 'zip' }>>([]);
  const [isGeocodingZip, setIsGeocodingZip] = useState(false);
  const [areaInfo, setAreaInfo] = useState<AreaInfo | null>(null);
  const [areaInfoLoading, setAreaInfoLoading] = useState(false);
  const [areaInfoError, setAreaInfoError] = useState(false);
  const [areaInfoListingId, setAreaInfoListingId] = useState<string | null>(null);
  const [areaDetailModal, setAreaDetailModal] = useState<{
    visible: boolean;
    category: 'transit' | 'restaurants' | 'grocery' | 'laundry' | 'parks' | null;
  }>({ visible: false, category: null });

  const COLLAPSIBLE_HEIGHT = 120;
  const exploreScrollY = useSharedValue(0);
  const exploreScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { exploreScrollY.value = event.contentOffset.y; },
  });
  const collapsibleAnimStyle = useAnimatedStyle(() => {
    const translateY = interpolate(exploreScrollY.value, [0, COLLAPSIBLE_HEIGHT], [0, -COLLAPSIBLE_HEIGHT], Extrapolation.CLAMP);
    const opacity = interpolate(exploreScrollY.value, [0, COLLAPSIBLE_HEIGHT * 0.6], [1, 0], Extrapolation.CLAMP);
    const maxH = interpolate(exploreScrollY.value, [0, COLLAPSIBLE_HEIGHT], [COLLAPSIBLE_HEIGHT, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity, maxHeight: maxH, overflow: 'hidden' as const };
  });
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  const eligibleGroups = userGroups.filter(g => {
    if (g.type !== 'roommate' && g.type) return false;
    if ((g as any).listingId) return false;
    const details = (g as any)?._memberDetails || [];
    const activeNonHost = details.filter((m: any) => !m.is_host && (m.status === 'active' || !m.status));
    const memberCount = activeNonHost.length || (Array.isArray(g.members) ? g.members.length : 0);
    if (memberCount < 1) return false;
    const hasCoupleOrMultiple = memberCount >= 2 || activeNonHost.some((m: any) => m.is_couple);
    return hasCoupleOrMultiple;
  });

  useEffect(() => {
    loadProperties();
    loadSavedProperties();
    loadHostProfiles();
    loadUserGroups();
  }, [activeCity]);

  useEffect(() => {
    const newPref = user?.profileData?.listing_type_preference;
    if (newPref === 'room') setListingTypeFilter(['room']);
    else if (newPref === 'entire_apartment') setListingTypeFilter(['entire']);
    else setListingTypeFilter([]);
  }, [user?.profileData?.listing_type_preference]);

  useEffect(() => {
    applyFilters();
  }, [properties, filters, viewMode, saved, activeCity, activeSubArea, selectedNeighborhood, activeQuickFilters, listingTypeFilter, leaseTypeFilter]);

  useEffect(() => {
    if (!showPropertyDetail || !selectedProperty) {
      return;
    }

    if (!selectedProperty.coordinates) {
      setAreaInfo(null);
      setAreaInfoLoading(false);
      setAreaInfoError(false);
      setAreaInfoListingId(selectedProperty.id);
      setAreaDetailModal({ visible: false, category: null });
      return;
    }

    if (selectedProperty.id === areaInfoListingId) return;

    let cancelled = false;
    const listingId = selectedProperty.id;
    setAreaInfoLoading(true);
    setAreaInfoError(false);
    setAreaInfo(null);
    setAreaInfoListingId(listingId);

    fetchAreaInfo(selectedProperty.coordinates.lat, selectedProperty.coordinates.lng)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setAreaInfo(result);
        } else {
          setAreaInfoError(true);
        }
        setAreaInfoLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAreaInfoError(true);
        setAreaInfoLoading(false);
      });

    return () => { cancelled = true; };
  }, [showPropertyDetail, selectedProperty?.id]);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await StorageService.initializeWithMockData();
      const localProperties = (await StorageService.getProperties())
        .filter((p: Property) => p.hostId !== user?.id);
      setProperties(localProperties);
      setFilteredProperties(localProperties);
      setIsLoading(false);

      try {
        const supabaseListings = await Promise.race([
          getListings({ ...(activeCity ? { city: activeCity } : {}) }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (supabaseListings && supabaseListings.length > 0) {
          const mapped: Property[] = supabaseListings
            .map((l: any) => mapListingToProperty(l))
            .filter((p: Property) => p.hostId !== user?.id);
          setProperties(mapped);
          setFilteredProperties(mapped);
          loadDiscoverableGroups(mapped);
          getAgentsWithCriticalStatus().then(setCriticalAgentIds).catch(() => {});
        }
      } catch (supabaseErr) {
        console.warn('Supabase getListings failed, using local data:', supabaseErr);
      }
    } catch (err) {
      setError('Failed to load properties');
      console.error('Error loading properties:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProperty && showPropertyDetail) {
      getReviewSummary(selectedProperty.id).then(setDetailReviewSummary).catch(() => {});

      if (user?.id) {
        setReviewEligibilityLoaded(false);
        setCanReviewListing(false);
        const propertyIdAtRequest = selectedProperty.id;
        checkReviewEligibility(user.id, selectedProperty.id)
          .then(({ eligible }) => {
            if (propertyIdAtRequest !== selectedProperty?.id) return;
            setCanReviewListing(eligible);
            setReviewEligibilityLoaded(true);
          })
          .catch(() => {
            if (propertyIdAtRequest !== selectedProperty?.id) return;
            setCanReviewListing(false);
            setReviewEligibilityLoaded(true);
          });
      } else {
        setCanReviewListing(false);
        setReviewEligibilityLoaded(true);
      }
    } else {
      setDetailReviewSummary(null);
      setCanReviewListing(false);
      setReviewEligibilityLoaded(false);
    }
  }, [selectedProperty?.id, showPropertyDetail]);

  const handleWriteReviewSubmit = async (data: { rating: number; reviewText: string; tags: string[] }) => {
    if (!user || !selectedProperty) return;
    const result = await submitReview({
      listingId: selectedProperty.id,
      reviewerId: user.id,
      rating: data.rating,
      reviewText: data.reviewText,
      tags: data.tags,
    });
    if (result.success) {
      setShowWriteReview(false);
      getReviewSummary(selectedProperty.id).then(setDetailReviewSummary).catch(() => {});
      await showAlert({ title: 'Review Submitted', message: 'Thank you for your review!' });
    } else {
      await showAlert({ title: 'Error', message: result.error || 'Could not submit review.' });
    }
  };

  const loadDiscoverableGroups = async (props: Property[]) => {
    const map = new Map<string, number>();
    await Promise.all(
      props.slice(0, 30).map(async (p) => {
        try {
          const groups = await getDiscoverableGroupsForListing(p.id);
          if (groups.length > 0) {
            const totalMembers = groups.reduce((s, g) => s + g.memberCount, 0);
            map.set(p.id, totalMembers);
          }
        } catch {}
      })
    );
    if (map.size > 0) setDiscoverableGroups(map);
  };

  const loadSavedProperties = async () => {
    if (!user?.id) return;
    try {
      const savedIds = await StorageService.getSavedProperties(user.id);
      setSaved(new Set(savedIds));
    } catch (err) {
      console.error('Error loading saved properties:', err);
    }
  };

  const loadHostProfiles = async () => {
    try {
      const users = await StorageService.getUsers();
      const profileMap = new Map<string, User>();
      users.forEach(u => {
        if (u.role === 'host') {
          profileMap.set(u.id, u);
        }
      });
      setHostProfiles(profileMap);
    } catch (err) {
      console.error('Error loading host profiles:', err);
    }

    try {
      const result = await Promise.race([
        supabase
          .from('users')
          .select('id, full_name, avatar_url, host_type, company_name, agency_name, license_verified, units_managed')
          .eq('role', 'host'),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      const supaUsers = result && typeof result === 'object' && 'data' in result ? (result as any).data : null;

      if (supaUsers && supaUsers.length > 0) {
        const profileMap = new Map<string, User>();
        supaUsers.forEach((u: any) => {
          const mapped: Partial<User> = {
            id: u.id,
            name: u.full_name || 'Host',
            profilePicture: u.avatar_url,
            hostType: u.host_type,
            companyName: u.company_name,
            agencyName: u.agency_name,
            licenseVerified: u.license_verified,
            unitsManaged: u.units_managed,
            role: 'host',
          };
          profileMap.set(u.id, mapped as User);
        });
        setHostProfiles(profileMap);
      }
    } catch (err) {
      console.warn('[ExploreScreen] Supabase host profiles sync skipped:', err);
    }
  };

  const loadUserGroups = async () => {
    try {
      if (!user?.id) { setUserGroups([]); return; }
      const { getMyGroups } = await import('../../services/groupService');
      const supabaseGroups = await getMyGroups('roommate');
      if (supabaseGroups && supabaseGroups.length > 0) {
        const mapped = supabaseGroups.map((g: any) => {
          const activeMembers = (g.members || []).filter((m: any) => m.status === 'active' || !m.status);
          return {
            id: g.id,
            name: g.name,
            type: 'roommate',
            members: activeMembers.map((m: any) => m.user_id),
            _memberDetails: activeMembers,
            listingId: g.listing_id || null,
            maxMembers: g.max_members || 4,
            createdBy: g.created_by,
          };
        });
        setUserGroups(mapped as any);
        return;
      }
    } catch {}
    try {
      const groups = await StorageService.getGroups();
      if (!user?.id) { setUserGroups([]); return; }
      const mine = groups.filter(g => g.createdBy === user.id);
      setUserGroups(mine);
    } catch {
      setUserGroups([]);
    }
  };

  const handleInquireAsGroup = async (group: Group) => {
    setShowGroupPickerModal(false);
    setShowPropertyDetail(false);
    if (!selectedProperty || !user) return;

    try {
      const { createListingInquiryGroup } = await import('../../services/groupService');
      await createListingInquiryGroup(
        selectedProperty.id,
        selectedProperty.hostId,
        selectedProperty.address || selectedProperty.title,
        group.id,
        group.name
      );
      await showAlert({
        title: 'Inquiry Sent!',
        message: `Your group "${group.name}" has sent an inquiry for ${selectedProperty.title}.`,
        variant: 'success',
      });
      await loadInterestCards();
    } catch (err) {
      await showAlert({ title: 'Error', message: 'Could not send group inquiry. Try again.', variant: 'warning' });
    }
  };

  const loadInterestCards = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cards = await StorageService.getInterestCardsForRenter(user.id);
      const map = new Map<string, InterestCard>();
      cards.forEach(c => map.set(c.propertyId, c));
      setInterestMap(map);
    } catch (err) {
      console.error('Error loading interest cards:', err);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadInterestCards();
      loadUserGroups();
    }, [loadInterestCards])
  );

  useEffect(() => {
    const viewListingId = route.params?.viewListingId;
    if (viewListingId && properties.length > 0) {
      const listing = properties.find(p => p.id === viewListingId);
      if (listing) {
        setSelectedProperty(listing);
        setPhotoIndex(0);
        setShowPropertyDetail(true);
      }
      navigation.setParams({ viewListingId: undefined } as any);
    }
  }, [route.params?.viewListingId, properties]);

  useEffect(() => {
    if (selectedProperty?.id) {
      recordListingView(selectedProperty.id);
      trackListingView({
        id: selectedProperty.id,
        city: selectedProperty.city,
        neighborhood: selectedProperty.neighborhood,
        zip_code: selectedProperty.zipCode,
        bedrooms: selectedProperty.bedrooms,
        rent: selectedProperty.price,
      });
    }
  }, [selectedProperty?.id]);

  const getPropertyCompatibility = (property: Property): number => {
    if (!property.hostProfileId || !user) return 0;
    const hostUser = hostProfiles.get(property.hostProfileId);
    if (!hostUser) return 0;
    const hostProfile = getUserAsRoommateProfile(hostUser);
    if (!hostProfile) return 0;
    return calculateCompatibility(user, hostProfile);
  };

  const handleInterestPress = async (property?: Property) => {
    const target = property || selectedProperty;
    if (!user || !target) return;
    if (property) setSelectedProperty(property);
    const result = await canSendInterest();
    if (!result.canSend) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPaywallFeature('Unlimited Interests');
      setPaywallPlan('plus');
      setShowPaywall(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInterestNote('');
    setShowUnifiedInterestSheet(true);
  };

  const handleSendUnifiedInterest = async (note: string) => {
    if (!user || !selectedProperty) return;
    setSendingInterest(true);
    try {
      const interestId = `interest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const conversationId = `conv-interest-${interestId}`;
      const budgetMin = user.profileData?.budget || 0;
      const budgetRange = budgetMin > 0 ? `$${budgetMin}/mo` : 'Not set';
      const moveIn = user.profileData?.preferences?.moveInDate || 'Flexible';
      const compatibility = getPropertyCompatibility(selectedProperty);
      const tags: string[] = [];
      if (user.profileData?.preferences?.cleanliness === 'very_tidy') tags.push('Clean');
      if (user.profileData?.preferences?.smoking === 'no') tags.push('Non-Smoker');
      if (user.profileData?.preferences?.pets === 'have_pets' || user.profileData?.preferences?.pets === 'open_to_pets') tags.push('Pet Friendly');
      if (user.profileData?.preferences?.sleepSchedule === 'early_sleeper') tags.push('Early Bird');
      if (user.profileData?.preferences?.sleepSchedule === 'late_sleeper') tags.push('Night Owl');
      if (user.profileData?.preferences?.workLocation === 'wfh_fulltime') tags.push('Remote Worker');

      const effectiveHostId = selectedProperty.assigned_agent_id || selectedProperty.hostId;
      const agentProfile = effectiveHostId !== selectedProperty.hostId
        ? hostProfiles.get(effectiveHostId)
        : null;
      const effectiveHostName = agentProfile?.name || selectedProperty.hostName || 'Host';
      const effectiveHostPhoto = agentProfile?.profilePicture || (selectedProperty.hostProfileId ? hostProfiles.get(selectedProperty.hostProfileId)?.profilePicture : undefined) || '';

      const interestRecord: InterestCard = {
        id: interestId,
        renterId: user.id,
        renterName: user.name,
        renterPhoto: user.profilePicture || '',
        hostId: effectiveHostId,
        propertyId: selectedProperty.id,
        propertyTitle: selectedProperty.title,
        compatibilityScore: compatibility,
        budgetRange,
        moveInDate: moveIn,
        lifestyleTags: tags.length > 0 ? tags : ['Flexible'],
        personalNote: note,
        status: 'pending',
        isSuperInterest,
        createdAt: new Date().toISOString(),
      };
      try {
        await supabase.from('interest_cards').insert({
          id: interestId,
          renter_id: user.id,
          host_id: effectiveHostId,
          property_id: selectedProperty.id,
          property_title: selectedProperty.title,
          compatibility_score: compatibility,
          budget_range: budgetRange,
          move_in_date: moveIn,
          lifestyle_tags: tags.length > 0 ? tags : ['Flexible'],
          personal_note: note,
          status: 'pending',
          is_super_interest: isSuperInterest,
          created_at: new Date().toISOString(),
        });
      } catch (supaErr) {
        console.warn('Supabase interest insert failed, using StorageService fallback:', supaErr);
      }
      await StorageService.addInterestCard(interestRecord);
      trackInterestSent({
        id: selectedProperty.id,
        city: selectedProperty.city,
        zip_code: selectedProperty.zipCode,
        bedrooms: selectedProperty.bedrooms,
        rent: selectedProperty.price,
      });

      const systemMessageText = isSuperInterest
        ? 'You sent a Super Interest. The host will see this at the top of their list.'
        : 'You expressed interest in this listing. Waiting for the host to respond.';
      const conversation: Conversation = {
        id: conversationId,
        participant: {
          id: effectiveHostId,
          name: effectiveHostName,
          photo: effectiveHostPhoto,
          online: false,
        },
        lastMessage: isSuperInterest ? 'Super Interest sent' : 'Interest sent — awaiting response',
        timestamp: new Date(),
        unread: 0,
        messages: [{
          id: `msg-${Date.now()}`,
          senderId: 'system',
          text: systemMessageText,
          content: systemMessageText,
          timestamp: new Date(),
          read: true,
        }],
        isInquiryThread: true,
        isSuperInterest,
        inquiryStatus: 'pending',
        inquiryId: interestId,
        listingTitle: selectedProperty.title,
        listingPhoto: selectedProperty.photos?.[0] || '',
        listingPrice: selectedProperty.price,
        hostName: effectiveHostName,
        hostId: effectiveHostId,
        propertyId: selectedProperty.id,
        isSoloInquiry: true,
      };
      await StorageService.addOrUpdateConversation(conversation);

      await StorageService.addNotification({
        id: `notif_interest_${Date.now()}`,
        userId: effectiveHostId,
        type: 'interest_received',
        title: isSuperInterest ? 'Super Interest!' : 'New Interest!',
        body: `${user.name} is interested in ${selectedProperty.title}`,
        isRead: false,
        createdAt: new Date(),
        data: {
          interestCardId: interestId,
          propertyId: selectedProperty.id,
          fromUserId: user.id,
          fromUserName: user.name,
          fromUserPhoto: user.profilePicture,
        },
      });

      await refreshUnreadCount();
      setShowUnifiedInterestSheet(false);
      setConfirmationWasSuper(isSuperInterest);
      setShowInterestConfirmation(true);
      await loadInterestCards();
    } catch (err) {
      await showAlert({ title: 'Error', message: 'Failed to send. Please try again.', variant: 'warning' });
    } finally {
      setSendingInterest(false);
      setIsSuperInterest(false);
    }
  };

  const getUserAsRoommateProfile = (user: User): RoommateProfile | null => {
    if (!user.profileData) return null;
    
    const profile = user.profileData;
    return {
      id: user.id,
      name: user.name,
      age: user.age || 25,
      bio: profile.bio || '',
      occupation: profile.occupation || '',
      budget: profile.budget || 0,
      photos: user.profilePicture ? [user.profilePicture] : [],
      gender: profile.gender || 'other',
      lifestyle: {
        cleanliness: profile.preferences?.cleanliness ? cleanlinessToNumber(profile.preferences.cleanliness) : 5,
        socialLevel: 5,
        workSchedule: profile.preferences?.workLocation || '',
        pets: profile.preferences?.pets === 'have_pets',
        smoking: profile.preferences?.smoking === 'yes',
      },
      preferences: {
        location: profile.neighborhood || profile.location || '',
        moveInDate: profile.preferences?.moveInDate || '',
        bedrooms: profile.preferences?.bedrooms || 1,
      },
    };
  };

  const cleanlinessToNumber = (cleanliness: string): number => {
    const map: Record<string, number> = {
      very_clean: 5,
      clean: 4,
      moderate: 3,
      relaxed: 2,
      very_relaxed: 1,
    };
    return map[cleanliness] || 5;
  };

  const handleLocationSearch = useCallback(async (query: string) => {
    setLocationSearchQuery(query);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setLocationSearchResults([]);
      return;
    }

    const results: Array<{ label: string; city: string; neighborhood: string | null; type: 'city' | 'neighborhood' | 'zip' }> = [];

    const allCities = getAllCities();
    allCities.forEach(city => {
      if (city.toLowerCase().includes(trimmed)) {
        results.push({ label: city, city, neighborhood: null, type: 'city' });
      }
    });

    Object.entries(NEIGHBORHOODS).forEach(([name, data]) => {
      if (name.toLowerCase().includes(trimmed)) {
        results.push({ label: `${name}, ${data.city}`, city: data.city, neighborhood: name, type: 'neighborhood' });
      }
    });

    if (/^\d{5}$/.test(trimmed)) {
      setIsGeocodingZip(true);
      try {
        const geocoded = await Location.geocodeAsync(trimmed);
        if (geocoded.length > 0) {
          const { latitude, longitude } = geocoded[0];
          const reverseResult = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverseResult.length > 0) {
            const place = reverseResult[0];
            const cityName = place.city || place.subregion || '';
            if (cityName) {
              results.unshift({ label: `${trimmed} - ${cityName}`, city: cityName, neighborhood: null, type: 'zip' });
            }
          }
        }
      } catch {}
      setIsGeocodingZip(false);
    }

    setLocationSearchResults(results.slice(0, 10));
  }, []);

  const selectLocationResult = useCallback((result: { label: string; city: string; neighborhood: string | null; type: 'city' | 'neighborhood' | 'zip' }) => {
    setActiveCity(result.city);
    setSelectedNeighborhood(result.neighborhood);
    setActiveSubArea(null);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setShowLocationSheet(false);
    trackNeighborhoodSearch(result.city, result.neighborhood || undefined);
  }, [setActiveCity, setActiveSubArea]);

  const propertyToMatchInput = (property: Property): ListingMatchInput => {
    const now = new Date();
    const created = (property as any).createdAt ? new Date((property as any).createdAt) : now;
    const daysListed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return {
      price: property.price || 0,
      bedrooms: property.bedrooms || 0,
      neighborhood: property.neighborhood || (property as any).area,
      city: property.city,
      amenities: property.amenities || [],
      roomType: property.roomType || (property as any).room_type,
      availableFrom: (property as any).availableFrom || (property as any).available_from,
      averageRating: (property as any).averageRating || (property as any).average_rating,
      reviewCount: (property as any).reviewCount || (property as any).review_count,
      hostBadge: (property as any).hostBadge || (property as any).host_badge || null,
      hostResponseRate: (property as any).hostResponseRate,
      daysListed,
      photoCount: (property as any).images?.length || property.photos?.length || 0,
    };
  };

  const applyFilters = () => {
    let filtered = [...properties];

    filtered = filtered.filter(p => p.available);

    if (isEntireApartmentSeeker) {
      filtered = filtered.filter(p => {
        const rt = (p.roomType || p.listing_type || p.type || '').toLowerCase();
        return ['entire', 'entire_unit', 'entire_apartment'].includes(rt);
      });
    }

    if (viewMode === 'saved') {
      filtered = filtered.filter(p => saved.has(p.id));
    }

    if (activeCity) {
      if (activeSubArea) {
        const { getNeighborhoodsBySubArea } = require('../../utils/locationData');
        const subAreaNeighborhoods = getNeighborhoodsBySubArea(activeCity, activeSubArea);
        filtered = filtered.filter(p =>
          p.city === activeCity && (
            subAreaNeighborhoods.length === 0 ||
            subAreaNeighborhoods.some((n: string) =>
              p.neighborhood?.toLowerCase().includes(n.toLowerCase()) ||
              p.address?.toLowerCase().includes(n.toLowerCase()) ||
              p.title?.toLowerCase().includes(n.toLowerCase())
            )
          )
        );
      } else {
        filtered = filtered.filter(p => p.city === activeCity);
      }
    }

    if (selectedNeighborhood) {
      filtered = filtered.filter(p =>
        p.neighborhood?.toLowerCase().includes(selectedNeighborhood.toLowerCase()) ||
        p.address?.toLowerCase().includes(selectedNeighborhood.toLowerCase()) ||
        p.title?.toLowerCase().includes(selectedNeighborhood.toLowerCase())
      );
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice!);
    }
    if (filters.minBedrooms !== undefined) {
      filtered = filtered.filter(p => p.bedrooms >= filters.minBedrooms!);
    }
    if (filters.minBathrooms !== undefined) {
      filtered = filtered.filter(p => p.bathrooms >= filters.minBathrooms!);
    }
    if (filters.amenities && filters.amenities.length > 0) {
      filtered = filtered.filter(p => {
        const raw = Array.isArray(p.amenities) ? p.amenities : [];
        const listingAmenityIds = raw.map(a => normalizeLegacyAmenity(a)).filter(Boolean);
        return filters.amenities!.every(filterId =>
          listingAmenityIds.includes(filterId)
        );
      }
      );
    }

    if (listingTypeFilter.length > 0) {
      const TYPE_MAP: Record<string, string[]> = {
        room:   ['room', 'private_room'],
        entire: ['entire', 'entire_unit', 'entire_apartment'],
        sublet: ['sublet'],
      };
      const allowedValues = listingTypeFilter.flatMap(type => TYPE_MAP[type] ?? []);
      filtered = filtered.filter(p => {
        const rt = (p.roomType || p.listing_type || p.type || '').toLowerCase();
        return allowedValues.some(v => rt === v.toLowerCase());
      });
    }

    if (leaseTypeFilter.length > 0) {
      filtered = filtered.filter(p => {
        const pt = ((p as any).propertyType || '').toLowerCase();
        return leaseTypeFilter.includes(pt);
      });
    }

    if (activeQuickFilters.has('under2k')) {
      filtered = filtered.filter(p => {
        const price = p.price ?? (p as any).rent ?? (p as any).monthly_price ?? 0;
        return price <= 2000;
      });
    }
    if (activeQuickFilters.has('petFriendly')) {
      filtered = filtered.filter(p =>
        p.amenities?.some(a => a.toLowerCase().includes('pet')) ||
        (p as any).petFriendly === true ||
        (p as any).pet_friendly === true ||
        (p as any).pets_allowed === true
      );
    }
    if (activeQuickFilters.has('noFee')) {
      filtered = filtered.filter(p => {
        const amenityIds = (p.amenities || []).map(a => normalizeLegacyAmenity(a));
        return amenityIds.includes('no_fee') || (p as any).noFee === true || (p as any).no_fee === true;
      });
    }
    if (activeQuickFilters.has('availableNow')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(p => {
        if (!p.availableDate) return p.available === true;
        const availDate = new Date(p.availableDate);
        availDate.setHours(0, 0, 0, 0);
        return availDate <= today;
      });
    }
    if (activeQuickFilters.has('lease')) {
      filtered = filtered.filter(p => {
        const pt = ((p as any).propertyType || '').toLowerCase();
        return pt === 'lease' || pt === '';
      });
    }
    if (activeQuickFilters.has('sublet')) {
      filtered = filtered.filter(p => {
        const pt = ((p as any).propertyType || '').toLowerCase();
        return pt === 'sublet';
      });
    }

    const PLACEMENT_PRIORITY: Record<string, number> = { featured: 4, top: 3, priority: 2, standard: 1 };
    const getHostPlanPriority = (property: Property) => {
      const host = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
      if (!host) return 0;
      const plan = (host as any).hostSubscription?.plan || (host as any).hostPlan || 'free';
      const limits = getPlanLimits(plan as HostPlan);
      return PLACEMENT_PRIORITY[limits.listingPlacement] || 1;
    };

    const isPropertyBoosted = (property: Property) => {
      if (property.listingBoost?.isActive && new Date(property.listingBoost.expiresAt) > new Date()) {
        return true;
      }
      const host = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
      if (!(host as any)?.purchases?.listingBoosts) return false;
      const now = new Date();
      return (host as any).purchases.listingBoosts.some(
        (boost: { propertyId: string; expiresAt: string }) =>
          boost.propertyId === property.id && new Date(boost.expiresAt) > now
      );
    };

    const isFeaturedBoosted = (property: Property) => {
      return isPropertyBoosted(property) && property.listingBoost?.includesFeaturedBadge === true;
    };

    const allBoostedIds = filtered.filter(p => isPropertyBoosted(p)).map(p => p.id);

    filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      const aFeatured = isFeaturedBoosted(a);
      const bFeatured = isFeaturedBoosted(b);
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;

      if (aFeatured && bFeatured && user && allBoostedIds.length > 1) {
        const rotA = getBoostRotationIndex(a.id, allBoostedIds, user.id);
        const rotB = getBoostRotationIndex(b.id, allBoostedIds, user.id);
        if (rotA !== rotB) return rotA - rotB;
      }

      const aBoosted = isPropertyBoosted(a) && !aFeatured;
      const bBoosted = isPropertyBoosted(b) && !bFeatured;
      if (aBoosted && !bBoosted) return -1;
      if (!aBoosted && bBoosted) return 1;

      if (aBoosted && bBoosted && user && allBoostedIds.length > 1) {
        const rotA = getBoostRotationIndex(a.id, allBoostedIds, user.id);
        const rotB = getBoostRotationIndex(b.id, allBoostedIds, user.id);
        if (rotA !== rotB) return rotA - rotB;
      }

      const planA = getHostPlanPriority(a);
      const planB = getHostPlanPriority(b);
      if (planA !== planB) return planB - planA;

      if (user) {
        const listingA = propertyToMatchInput(a);
        const listingB = propertyToMatchInput(b);

        let roommateCompA: number | undefined;
        let roommateCompB: number | undefined;

        const searchType = (user as any).apartmentSearchType || (user as any).apartment_search_type;
        if (searchType === 'with_roommates' || searchType === 'have_group') {
          const hostA = a.hostProfileId ? hostProfiles.get(a.hostProfileId) : null;
          const hostB = b.hostProfileId ? hostProfiles.get(b.hostProfileId) : null;
          const profileA = hostA ? getUserAsRoommateProfile(hostA) : null;
          const profileB = hostB ? getUserAsRoommateProfile(hostB) : null;
          roommateCompA = profileA ? calculateCompatibility(user, profileA) : undefined;
          roommateCompB = profileB ? calculateCompatibility(user, profileB) : undefined;
        }

        const scoreA = calculateListingMatchScore(user, listingA, roommateCompA);
        const scoreB = calculateListingMatchScore(user, listingB, roommateCompB);
        return scoreB - scoreA;
      }

      const createdA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const createdB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return createdB - createdA;
    });

    const seen = new Set<string>();
    const deduped = filtered.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    setFilteredProperties(deduped);
  };

  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);

  const handleFilterPress = () => {
    setTempFilters({ ...filters, listingTypes: [...listingTypeFilter] });
    setShowFilterModal(true);
  };

  const handleApplyFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (tempFilters.listingTypes) {
      setListingTypeFilter(tempFilters.listingTypes);
    }
    setFilters(tempFilters);
    setShowFilterModal(false);
    trackSearchFilter({
      city: activeCity || undefined,
      neighborhood: selectedNeighborhood || undefined,
      priceMin: tempFilters.minPrice,
      priceMax: tempFilters.maxPrice,
      bedrooms: tempFilters.minBedrooms,
      amenities: tempFilters.amenities,
    });
  };

  const handleClearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters({});
    setFilters({});
    setListingTypeFilter([]);
    setShowFilterModal(false);
  };

  const toggleAmenity = (amenity: string) => {
    const current = tempFilters.amenities || [];
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    setTempFilters({ ...tempFilters, amenities: updated });
  };

  const hasActiveFilters = () => {
    const hasModalFilters = Object.keys(filters).length > 0 && Object.values(filters).some(v => 
      v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
    );
    return hasModalFilters || listingTypeFilter.length > 0;
  };


  const toggleSave = async (id: string) => {
    if (!user?.id) return;
    
    const wasSaved = saved.has(id);
    
    const newSaved = new Set(saved);
    if (wasSaved) {
      newSaved.delete(id);
    } else {
      newSaved.add(id);
      const prop = properties.find(p => p.id === id);
      if (prop) {
        trackListingSave({
          id: prop.id,
          city: prop.city,
          neighborhood: prop.neighborhood,
          zip_code: prop.zipCode,
          bedrooms: prop.bedrooms,
          rent: prop.price,
        });
      }
    }
    setSaved(newSaved);

    try {
      if (wasSaved) {
        await StorageService.unsaveProperty(user.id, id);
      } else {
        await StorageService.saveProperty(user.id, id);
        const searchType = user.profileData?.apartment_search_type;
        if (searchType === 'have_group') {
          try {
            const myGroup = await getUserPreformedGroup();
            if (myGroup) {
              await addToShortlist(myGroup.id, id);
            }
          } catch (shortlistErr) {
            console.warn('Could not add to group shortlist:', shortlistErr);
          }
        }
      }
    } catch (err) {
      console.error('Error toggling save:', err);
      const rollbackSaved = new Set(newSaved);
      if (wasSaved) {
        rollbackSaved.add(id);
      } else {
        rollbackSaved.delete(id);
      }
      setSaved(rollbackSaved);
    }
  };

  const toggleQuickFilter = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (key === 'lease') next.delete('sublet');
        if (key === 'sublet') next.delete('lease');
        next.add(key);
      }
      return next;
    });
  };

  const handleListingTypeChip = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListingTypeFilter(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleLeaseTypeChip = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLeaseTypeFilter(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const isBasic = renterPlan === 'free';


  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const hostUser = item.hostProfileId ? hostProfiles.get(item.hostProfileId) : null;
    const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
    const compatibility = hostProfile && user ? calculateCompatibility(user, hostProfile) : null;
    const hostName = hostUser?.name || item.hostName || 'Host';
    const hostInitials = getInitials(hostName);
    const avatarGradient = getAvatarGradient(item.hostProfileId || item.id);
    const isPetFriendly = item.amenities?.some(a => a.toLowerCase().includes('pet'));
    const laundryType = item.amenities?.find(a =>
      a.toLowerCase().includes('in-unit') || a.toLowerCase().includes('in unit') ||
      a.toLowerCase().includes('washer') || a.toLowerCase().includes('dryer')
    )
      ? 'In-unit'
      : item.amenities?.find(a =>
          a.toLowerCase().includes('in-building') || a.toLowerCase().includes('laundry room') ||
          a.toLowerCase().includes('shared laundry') || a.toLowerCase() === 'laundry'
        )
        ? 'Laundry'
        : null;
    const itemHostType: HostType = (item.hostType || hostUser?.hostType || 'individual') as HostType;
    const showMatch = shouldShowMatchScore(itemHostType);

    return (
      <Pressable
        style={styles.propCard}
        onPress={() => {
          const viewCheck = canViewListing();
          if (!viewCheck.canView) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setPaywallFeature('Unlimited Listing Views');
            setPaywallPlan('plus');
            setShowPaywall(true);
            return;
          }
          useListingView();
          setSelectedProperty(item);
          setPhotoIndex(0);
          setShowPropertyDetail(true);
        }}
      >
        <View style={styles.cardPhoto}>
          <Image source={{ uri: item.photos[0] }} style={styles.photoBg} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.88)']}
            style={styles.photoGradient}
          />
          <View style={styles.photoTags}>
            {item.propertyType ? (
              <View style={item.propertyType === 'lease' ? styles.tagLease : styles.tagSublet}>
                <Text style={styles.tagText}>{item.propertyType.toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={item.roomType === 'entire' ? styles.tagEntire : styles.tagRoom}>
              <Text style={[styles.tagText, item.roomType === 'room' ? { color: '#2ecc71' } : { color: '#fff' }]}>
                {item.roomType === 'entire' ? 'ENTIRE UNIT' : 'PRIVATE ROOM'}
              </Text>
            </View>
            {item.featured ? (
              <View style={styles.tagFeatured}>
                <Feather name="star" size={9} color="#1a1200" />
                <Text style={[styles.tagText, { color: '#1a1200', marginLeft: 3 }]}>FEATURED</Text>
              </View>
            ) : null}
            {!item.featured &&
             item.listingBoost?.isActive &&
             item.listingBoost?.includesFeaturedBadge &&
             new Date(item.listingBoost.expiresAt) > new Date() ? (
              <View style={styles.boostFeaturedBadge}>
                <Feather name="star" size={9} color="#1a1200" />
                <Text style={[styles.tagText, { color: '#1a1200', marginLeft: 3 }]}>FEATURED</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            style={[styles.saveBtn, saved.has(item.id) ? styles.saveBtnActive : null]}
            onPress={() => toggleSave(item.id)}
          >
            <Feather
              name="heart"
              size={14}
              color={saved.has(item.id) ? ACCENT : 'rgba(255,255,255,0.65)'}
              fill={saved.has(item.id) ? ACCENT : 'none'}
            />
          </Pressable>
          <View style={styles.photoBottom}>
            <View style={styles.priceOverlay}>
              <Text style={styles.priceText}>${item.price.toLocaleString()}/mo</Text>
              <Text style={styles.propNameText} numberOfLines={1}>{item.title}</Text>
            </View>
            {showMatch && compatibility !== null ? (
              <View style={styles.matchScoreBadge}>
                <Feather name="heart" size={9} color="#ff8878" />
                <Text style={styles.matchScoreText}>{compatibility}% match</Text>
              </View>
            ) : null}
            {!showMatch ? (
              <View style={[styles.matchScoreBadge, { backgroundColor: getHostBadgeColor(itemHostType) + '25', borderColor: getHostBadgeColor(itemHostType) + '50' }]}>
                <Feather name={getHostBadgeIcon(itemHostType)} size={9} color={getHostBadgeColor(itemHostType)} />
                <Text style={[styles.matchScoreText, { color: getHostBadgeColor(itemHostType) }]}>{getHostBadgeLabel(itemHostType)}</Text>
              </View>
            ) : null}
            {item.average_rating && item.review_count ? (
              <View style={styles.ratingBadge}>
                <Feather name="star" size={10} color="#FFD700" />
                <Text style={styles.ratingBadgeText}>{item.average_rating.toFixed(1)}</Text>
                <Text style={styles.ratingBadgeCount}>({item.review_count})</Text>
              </View>
            ) : null}
            {item.host_badge ? (
              <HostBadge badge={item.host_badge} size="small" />
            ) : (item.average_rating || 0) >= 4.8 && (item.review_count || 0) >= 10 ? (
              <HostBadge badge="rhome_select" size="small" />
            ) : null}
            {item.assigned_agent_id && criticalAgentIds.includes(item.assigned_agent_id) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                <Feather name="clock" size={9} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>Response Delayed</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.cardDetails}>
          <View style={styles.detailsRow}>
            <View style={styles.detailChips}>
              <View style={styles.detailChip}>
                <Feather name="home" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.detailChipText}>{item.bedrooms} bd{item.rooms_available && item.rooms_available < item.bedrooms ? ` · ${item.rooms_available} avail` : ''}{item.roomType === 'room' ? ' total' : ''}</Text>
              </View>
              <View style={styles.detailChip}>
                <Feather name="droplet" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.detailChipText}>{item.bathrooms} ba{item.roomType === 'room' ? ' shared' : ''}</Text>
              </View>
              {item.sqft ? (
                <View style={styles.detailChip}>
                  <Feather name="maximize" size={13} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.detailChipText}>{item.sqft.toLocaleString()} sqft</Text>
                </View>
              ) : null}
            </View>
            {item.available ? (
              <View style={styles.availBadge}>
                <Text style={styles.availBadgeText}>Available now</Text>
              </View>
            ) : item.availableDate ? (
              <View style={[styles.availBadge, { borderColor: 'rgba(255,165,0,0.4)' }]}>
                <Text style={[styles.availBadgeText, { color: '#FFA500' }]}>
                  {formatMoveInDate(item.availableDate.toString())}
                </Text>
              </View>
            ) : null}
            {(() => {
              const amenityTags: string[] = [];
              if (laundryType) amenityTags.push(laundryType === 'In-unit' ? 'W/D In-unit' : 'Laundry');
              if (isPetFriendly) amenityTags.push('Pet OK');
              const dishwasher = item.amenities?.find(a => a.toLowerCase().includes('dishwasher'));
              if (dishwasher && amenityTags.length < 2) amenityTags.push('Dishwasher');
              const doorman = item.amenities?.find(a => a.toLowerCase().includes('doorman'));
              if (doorman && amenityTags.length < 2) amenityTags.push('Doorman');
              const gym = item.amenities?.find(a => a.toLowerCase().includes('gym') || a.toLowerCase().includes('fitness'));
              if (gym && amenityTags.length < 2) amenityTags.push('Gym');
              const totalAmenities = item.amenities?.length || 0;
              const shown = amenityTags.slice(0, 2);
              const extraCount = totalAmenities - shown.length;
              return (
                <>
                  {shown.map((tag, idx) => (
                    <View key={idx} style={styles.availBadge}>
                      <Text style={styles.availBadgeText}>{tag}</Text>
                    </View>
                  ))}
                  {extraCount > 0 ? (
                    <View style={[styles.availBadge, { borderColor: 'rgba(255,255,255,0.15)' }]}>
                      <Text style={[styles.availBadgeText, { color: 'rgba(255,255,255,0.4)' }]}>+{extraCount} more</Text>
                    </View>
                  ) : null}
                </>
              );
            })()}
          </View>
          <View style={styles.locationRow2}>
            <Feather name="map-pin" size={12} color="rgba(255,107,91,0.55)" />
            <Text style={styles.locationText}>{formatLocation(item)}</Text>
            <Pressable
              onPress={() => {
                setSelectedProperty(item);
                setShowNeighborhoodSheet(true);
              }}
              style={styles.areaInfoPill}
            >
              <Feather name="cpu" size={11} color="#ff6b5b" />
              <Text style={styles.areaInfoPillText}>Area info</Text>
            </Pressable>
          </View>
          <View style={styles.hostRow}>
            <LinearGradient colors={avatarGradient} style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>{hostInitials}</Text>
            </LinearGradient>
            <View style={styles.hostInfo}>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>
                  {itemHostType === 'company' && hostUser?.companyName
                    ? hostUser.companyName
                    : `${hostName.split(' ')[0]}${hostName.split(' ')[1]?.[0] ? ` ${hostName.split(' ')[1][0]}.` : ''}`}
                </Text>
                {hostUser?.licenseVerificationStatus === 'verified' ? (
                  <View style={styles.verifiedHostBadge}>
                    <Feather name="shield" size={10} color="#3ECF8E" />
                    <Text style={styles.verifiedHostText}>Verified Agent</Text>
                  </View>
                ) : hostUser?.licenseVerificationStatus === 'manual_review' || hostUser?.licenseVerificationStatus === 'pending' ? (
                  <View style={[styles.verifiedHostBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                    <Feather name="clock" size={10} color="#F59E0B" />
                    <Text style={[styles.verifiedHostText, { color: '#F59E0B' }]}>Pending</Text>
                  </View>
                ) : hostUser?.purchases?.hostVerificationBadge === true || hostUser?.verifiedBusiness || ((hostUser as any)?.hostSubscription?.plan && (hostUser as any).hostSubscription.plan !== 'free' && (hostUser as any).hostSubscription.plan !== 'none') || (hostUser?.hostPlan && hostUser.hostPlan !== 'free' && hostUser.hostPlan !== 'none') ? (
                  <View style={styles.verifiedHostBadge}>
                    <Feather name="shield" size={10} color="#3ECF8E" />
                    <Text style={styles.verifiedHostText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.hostStatus}>
                {itemHostType === 'company'
                  ? `${hostUser?.unitsManaged ?? 1} units managed`
                  : itemHostType === 'agent'
                    ? (() => {
                        const parts: string[] = [];
                        if (hostUser?.agencyName) parts.push(hostUser.agencyName);
                        const count = hostUser?.unitsManaged ?? 1;
                        parts.push(`${count} ${count === 1 ? 'listing' : 'listings'}`);
                        return parts.join(' · ');
                      })()
                    : (() => {
                        const count = hostUser?.unitsManaged ?? 1;
                        return `Host · ${count} ${count === 1 ? 'listing' : 'listings'}`;
                      })()}
              </Text>
            </View>
            {(hostUser?.licenseVerified || hostUser?.verifiedBusiness || (hostUser?.hostPlan && hostUser.hostPlan !== 'free' && hostUser.hostPlan !== 'none') || itemHostType === 'company' || itemHostType === 'agent') ? (
              <View style={styles.respBadge}>
                <Text style={styles.respBadgeText}>Fast reply</Text>
              </View>
            ) : null}
          </View>
          {discoverableGroups.has(item.id) ? (
            <Pressable
              style={styles.groupDiscoveryBadge}
              onPress={(e) => {
                e.stopPropagation?.();
                (navigation as any).navigate('Messages', {
                  screen: 'ListingGroups',
                  params: { listingId: item.id },
                });
              }}
            >
              <Feather name="users" size={12} color="#ff6b5b" />
              <Text style={styles.groupDiscoveryText}>
                {discoverableGroups.get(item.id)} {discoverableGroups.get(item.id) === 1 ? 'person' : 'people'} forming a group
              </Text>
            </Pressable>
          ) : null}
          {!isBasic ? (
            <Pressable
              style={styles.inquireTogetherBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleInterestPress(item);
              }}
            >
              <Feather name="heart" size={14} color={ACCENT} />
              <Text style={styles.inquireTogetherText}>I'm Interested</Text>
            </Pressable>
          ) : isBasic && (index % 4 === 3) ? (
            <View style={styles.premiumRow}>
              <Feather name="lock" size={13} color="rgba(255,215,0,0.6)" />
              <Text style={styles.premiumText}>Upgrade to Plus to contact host & schedule a tour</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={64} color={theme.error} />
          <ThemedText style={[Typography.h2, { marginTop: Spacing.xl }]}>{error}</ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: Spacing.xl }]}
            onPress={loadProperties}
          >
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="loader" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, { marginTop: Spacing.xl }]}>Loading properties...</ThemedText>
        </View>
      </View>
    );
  }

  const AREA_MODAL_CONFIG: Record<string, {
    title: string;
    icon: string;
    emptyText: string;
    items: NearbyAmenity[];
  }> = areaInfo ? {
    transit: {
      title: 'Nearby Transit',
      icon: 'navigation',
      emptyText: 'No transit stops found nearby.',
      items: areaInfo.transit,
    },
    restaurants: {
      title: 'Restaurants & Cafes',
      icon: 'coffee',
      emptyText: 'No restaurants found nearby.',
      items: areaInfo.restaurants,
    },
    grocery: {
      title: 'Grocery Stores',
      icon: 'shopping-bag',
      emptyText: 'No grocery stores found nearby.',
      items: areaInfo.grocery,
    },
    laundry: {
      title: 'Laundromats',
      icon: 'briefcase',
      emptyText: 'No laundromats found nearby.',
      items: areaInfo.laundry,
    },
    parks: {
      title: 'Parks',
      icon: 'sun',
      emptyText: 'No parks found nearby.',
      items: areaInfo.parks,
    },
  } : {};

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.exploreHeaderRow, { paddingTop: insets.top + 12 }]}>
        <RhomeLogo variant="icon-only" size="sm" />
        <Pressable style={styles.aiBtnWrap} onPress={() => setShowAISheet(true)}>
          <LinearGradient colors={['#ff6b5b', '#ff8c7a']} style={styles.aiBtn}>
            <Feather name="cpu" size={15} color="#fff" />
            <Text style={styles.aiBtnText}>AI</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.locationPickerBtn} onPress={() => setShowLocationSheet(true)}>
          <Feather name="map-pin" size={14} color={ACCENT} />
          <View style={styles.locationPickerText}>
            <Text style={styles.locationCity} numberOfLines={1}>{activeCity || 'Select City'}</Text>
            {selectedNeighborhood
              ? <Text style={styles.locationNeighborhood} numberOfLines={1}>{selectedNeighborhood}</Text>
              : <Text style={styles.locationNeighborhood}>{filteredProperties.length} listing{filteredProperties.length !== 1 ? 's' : ''}</Text>
            }
          </View>
          <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.4)" />
        </Pressable>

        <Pressable
          style={[styles.headerIconBtn, displayMode === 'map' && styles.headerIconBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDisplayMode(displayMode === 'list' ? 'map' : 'list');
          }}
        >
          <Feather
            name={displayMode === 'list' ? 'map' : 'list'}
            size={18}
            color={displayMode === 'map' ? '#ff6b5b' : 'rgba(255,255,255,0.6)'}
          />
        </Pressable>
        <Pressable style={[styles.headerIconBtn, hasActiveFilters() ? styles.headerIconBtnActive : null]} onPress={handleFilterPress}>
          <Feather name="sliders" size={18} color={hasActiveFilters() ? ACCENT : 'rgba(255,255,255,0.6)'} />
          {hasActiveFilters() ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>
      <Animated.View style={collapsibleAnimStyle}>

        <View style={styles.tabsRow}>
          <Pressable
            style={viewMode === 'all' ? styles.tabActive : styles.tabInactive}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setViewMode('all'); }}
          >
            {viewMode === 'all' ? (
              <LinearGradient colors={[ACCENT, '#e83a2a']} style={styles.tabGradient}>
                <Feather name="home" size={13} color="#fff" />
                <Text style={styles.tabActiveText}>All Listings</Text>
              </LinearGradient>
            ) : (
              <>
                <Feather name="home" size={13} color="rgba(255,255,255,0.4)" />
                <Text style={styles.tabInactiveText}>All Listings</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={viewMode === 'saved' ? styles.tabActive : styles.tabInactive}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setViewMode('saved'); }}
          >
            {viewMode === 'saved' ? (
              <LinearGradient colors={[ACCENT, '#e83a2a']} style={styles.tabGradient}>
                <View style={styles.tabLabelRow}>
                  <Feather name="heart" size={13} color="#fff" />
                  <Text style={styles.tabActiveText}>Saved</Text>
                  {saved.size > 0 ? (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedBadgeText}>{saved.size}</Text>
                    </View>
                  ) : null}
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.tabLabelRow}>
                <Feather name="heart" size={13} color="rgba(255,255,255,0.4)" />
                <Text style={styles.tabInactiveText}>Saved</Text>
                {saved.size > 0 ? (
                  <View style={styles.savedBadge}>
                    <Text style={styles.savedBadgeText}>{saved.size}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.chipScrollContent}
        >
          {isEntireApartmentSeeker ? (
            LEASE_TYPE_CHIPS.map(t => {
              const active = leaseTypeFilter.includes(t.key);
              return (
                <Pressable key={t.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => handleLeaseTypeChip(t.key)}>
                  <Feather name={t.icon} size={11} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} />
                  <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{t.label}</Text>
                </Pressable>
              );
            })
          ) : (
            LISTING_TYPE_CHIPS.map(t => {
              const active = listingTypeFilter.includes(t.key);
              return (
                <Pressable key={t.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => handleListingTypeChip(t.key)}>
                  <Feather name={t.icon} size={11} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} />
                  <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{t.label}</Text>
                </Pressable>
              );
            })
          )}
          {QUICK_FILTERS.map(f => {
            const active = activeQuickFilters.has(f.key);
            return (
              <Pressable key={f.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => toggleQuickFilter(f.key)}>
                {f.icon ? <Feather name={f.icon} size={10} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} /> : null}
                <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
      {displayMode === 'map' ? (
        <PropertyMapView
          properties={filteredProperties}
          saved={saved}
          hostProfiles={hostProfiles}
          currentUser={user || null}
          onPropertyPress={(property) => {
            const viewCheck = canViewListing();
            if (!viewCheck.canView) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setPaywallFeature('Unlimited Listing Views');
              setPaywallPlan('plus');
              setShowPaywall(true);
              return;
            }
            useListingView();
            setSelectedProperty(property);
            setPhotoIndex(0);
            setShowPropertyDetail(true);
          }}
          onToggleSave={toggleSave}
          bottomInset={insets.bottom}
        />
      ) : (
        <AnimatedFlatList
          data={filteredProperties}
          renderItem={renderProperty}
          keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100, paddingTop: Spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={exploreScrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={() => {
            const featuredListings = filteredProperties.filter(p => {
              const host = p.hostProfileId ? hostProfiles.get(p.hostProfileId) : null;
              return host && (host as any).hostPlan === 'business';
            });
            if (featuredListings.length === 0 || viewMode === 'saved') return null;
            return (
              <View style={styles.featuredSection}>
                <View style={styles.featuredHeader}>
                  <Feather name="star" size={14} color="#ffd700" />
                  <Text style={styles.featuredTitle}>Featured</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
                  {featuredListings.slice(0, 5).map(item => (
                    <Pressable
                      key={`featured-${item.id}`}
                      style={styles.featuredCard}
                      onPress={() => {
                        const viewCheck = canViewListing();
                        if (!viewCheck.canView) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          setPaywallFeature('Unlimited Listing Views');
                          setPaywallPlan('plus');
                          setShowPaywall(true);
                          return;
                        }
                        useListingView();
                        setSelectedProperty(item);
                        setPhotoIndex(0);
                        setShowPropertyDetail(true);
                      }}
                    >
                      <Image source={{ uri: item.photos[0] }} style={styles.featuredPhoto} />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.featuredGradient}>
                        <Text style={styles.featuredPrice}>${item.price?.toLocaleString()}/mo</Text>
                        <Text style={styles.featuredName} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.featuredBadge}>
                          <Feather name="star" size={8} color="#1a1200" />
                          <Text style={styles.featuredBadgeText}>FEATURED</Text>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyStateInline}>
              <Feather name={viewMode === 'saved' ? 'heart' : 'home'} size={64} color={theme.textSecondary} />
              <ThemedText style={[Typography.h2, { marginTop: Spacing.xl, textAlign: 'center' }]}>
                {viewMode === 'saved' ? 'No Saved Properties' : activeCity ? `No Properties in ${activeCity}` : 'No Properties Available'}
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                {viewMode === 'saved'
                  ? 'Save properties by tapping the heart icon'
                  : activeCity
                    ? 'Try browsing All Cities or a different city'
                    : 'Check back later for new listings'}
              </ThemedText>
            </View>
          }
        />
      )}

      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.fmContainer}>
          <View style={styles.fmHeader}>
            <Pressable onPress={() => setShowFilterModal(false)} hitSlop={12}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleClearFilters} hitSlop={12}>
              <Text style={styles.fmClearText}>Clear</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.fmScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.fmSectionTitle}>Listing Type</Text>
            <View style={styles.fmTypeGrid}>
              {LISTING_TYPE_OPTIONS.map((opt) => {
                const selectedTypes = tempFilters.listingTypes || [];
                const isActive = opt.key === 'any'
                  ? selectedTypes.length === 0
                  : selectedTypes.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.fmTypeCard, isActive && styles.fmTypeCardActive]}
                    onPress={() => {
                      if (opt.key === 'any') {
                        setTempFilters({ ...tempFilters, listingTypes: [] });
                      } else {
                        const current = tempFilters.listingTypes || [];
                        const updated = current.includes(opt.key)
                          ? current.filter((t: string) => t !== opt.key)
                          : [...current, opt.key];
                        setTempFilters({ ...tempFilters, listingTypes: updated });
                      }
                    }}
                  >
                    <View style={[styles.fmTypeIcon, isActive && styles.fmTypeIconActive]}>
                      <Feather
                        name={opt.icon as any}
                        size={20}
                        color={isActive ? '#fff' : 'rgba(255,255,255,0.4)'}
                      />
                    </View>
                    <Text style={[styles.fmTypeLabel, isActive && styles.fmTypeLabelActive]}>
                      {opt.label}
                    </Text>
                    {isActive ? (
                      <View style={styles.fmTypeCheck}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fmSectionTitle}>Budget Range</Text>
            <PricePickerPair
              minValue={tempFilters.minPrice || 500}
              maxValue={tempFilters.maxPrice || STANDARD_MAX_VALUE}
              onMinChange={val => setTempFilters(prev => ({ ...prev, minPrice: val > 500 ? val : undefined }))}
              onMaxChange={val => setTempFilters(prev => ({ ...prev, maxPrice: val < STANDARD_MAX_VALUE ? val : undefined }))}
              height={120}
            />

            <Text style={styles.fmSectionTitle}>Rooms</Text>
            <View style={styles.fmRoomsRow}>
              <View style={styles.fmRoomCol}>
                <Text style={styles.fmRoomLabel}>Bedrooms</Text>
                <View style={styles.fmCounterRow}>
                  <Pressable
                    style={styles.fmCounterBtn}
                    onPress={() => setTempFilters({ ...tempFilters, minBedrooms: Math.max(0, (tempFilters.minBedrooms || 0) - 1) })}
                  >
                    <Feather name="minus" size={18} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                  <Text style={styles.fmCounterValue}>{tempFilters.minBedrooms || 0}+</Text>
                  <Pressable
                    style={styles.fmCounterBtn}
                    onPress={() => setTempFilters({ ...tempFilters, minBedrooms: (tempFilters.minBedrooms || 0) + 1 })}
                  >
                    <Feather name="plus" size={18} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                </View>
              </View>
              <View style={styles.fmRoomCol}>
                <Text style={styles.fmRoomLabel}>Bathrooms</Text>
                <View style={styles.fmCounterRow}>
                  <Pressable
                    style={styles.fmCounterBtn}
                    onPress={() => setTempFilters({ ...tempFilters, minBathrooms: Math.max(0, (tempFilters.minBathrooms || 0) - 0.5) })}
                  >
                    <Feather name="minus" size={18} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                  <Text style={styles.fmCounterValue}>{tempFilters.minBathrooms || 0}+</Text>
                  <Pressable
                    style={styles.fmCounterBtn}
                    onPress={() => setTempFilters({ ...tempFilters, minBathrooms: (tempFilters.minBathrooms || 0) + 0.5 })}
                  >
                    <Feather name="plus" size={18} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                </View>
              </View>
            </View>

            <Text style={styles.fmSectionTitle}>Amenities</Text>
            {AMENITY_CATEGORIES.map(category => {
              const categoryAmenities = ALL_AMENITIES.filter(a => a.category === category.key);
              const selectedInCategory = categoryAmenities.filter(a =>
                tempFilters.amenities?.includes(a.id)
              ).length;

              return (
                <View key={category.key} style={styles.fmAmenityCategory}>
                  <Pressable
                    style={styles.fmCategoryHeader}
                    onPress={() => {
                      setExpandedCategories(prev => {
                        const next = new Set(prev);
                        if (next.has(category.key)) next.delete(category.key);
                        else next.add(category.key);
                        return next;
                      });
                    }}
                  >
                    <View style={styles.fmCategoryHeaderLeft}>
                      <Feather name={category.icon} size={16} color={theme.textSecondary} />
                      <Text style={[styles.fmCategoryLabel, { color: theme.text }]}>
                        {category.label}
                      </Text>
                      {selectedInCategory > 0 ? (
                        <View style={styles.fmCategoryBadge}>
                          <Text style={styles.fmCategoryBadgeText}>{selectedInCategory}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Feather
                      name={expandedCategories.has(category.key) ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.textSecondary}
                    />
                  </Pressable>

                  {expandedCategories.has(category.key) ? (
                    <View style={styles.fmAmenitiesWrap}>
                      {categoryAmenities.map(amenity => {
                        const isSelected = tempFilters.amenities?.includes(amenity.id) || false;
                        return (
                          <Pressable
                            key={amenity.id}
                            style={[styles.fmAmenityChip, isSelected && styles.fmAmenityChipActive]}
                            onPress={() => toggleAmenity(amenity.id)}
                          >
                            <Feather
                              name={amenity.icon}
                              size={14}
                              color={isSelected ? '#fff' : theme.textSecondary}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.fmAmenityText, isSelected && styles.fmAmenityTextActive]}>
                              {amenity.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {!renterLimits.hasAdvancedFilters ? (
              <Pressable
                style={styles.fmLockedSection}
                onPress={() => {
                  setShowFilterModal(false);
                  setPaywallFeature('Advanced Filters');
                  setPaywallPlan('plus');
                  setShowPaywall(true);
                }}
              >
                <View style={styles.fmLockedRow}>
                  <Text style={styles.fmSectionTitle}>Lifestyle Preferences</Text>
                  <PlanBadgeInline plan="Plus" locked />
                </View>
                <Text style={styles.fmLockedDesc}>Cleanliness, noise level, social habits, pet preferences, smoking</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.fmSectionTitle}>Lifestyle Preferences</Text>
                <View style={styles.fmAmenitiesWrap}>
                  {['Pet-Friendly', 'Non-Smoking', 'Quiet', 'Social', 'Clean', 'Early Bird', 'Night Owl'].map(tag => {
                    const isSelected = tempFilters.lifestyleTags?.includes(tag) || false;
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.fmAmenityChip, isSelected && styles.fmAmenityChipActive]}
                        onPress={() => {
                          const current = tempFilters.lifestyleTags || [];
                          const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
                          setTempFilters(prev => ({ ...prev, lifestyleTags: updated }));
                        }}
                      >
                        <Text style={[styles.fmAmenityText, isSelected && styles.fmAmenityTextActive]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {!renterLimits.hasTransitFiltering ? (
              <Pressable
                style={styles.fmLockedSection}
                onPress={() => {
                  setShowFilterModal(false);
                  setPaywallFeature('Transit Filtering');
                  setPaywallPlan('plus');
                  setShowPaywall(true);
                }}
              >
                <View style={styles.fmLockedRow}>
                  <Text style={styles.fmSectionTitle}>Transit Proximity</Text>
                  <PlanBadgeInline plan="Plus" locked />
                </View>
                <Text style={styles.fmLockedDesc}>Filter listings by subway, bus, and train stop proximity</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.fmSectionTitle}>Transit Proximity</Text>
                <View style={styles.fmAmenitiesWrap}>
                  {['Near Subway', 'Near Bus', 'Near Train', 'Under 10 min walk'].map(tag => {
                    const isSelected = tempFilters.transitTags?.includes(tag) || false;
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.fmAmenityChip, isSelected && styles.fmAmenityChipActive]}
                        onPress={() => {
                          const current = tempFilters.transitTags || [];
                          const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
                          setTempFilters(prev => ({ ...prev, transitTags: updated }));
                        }}
                      >
                        <Text style={[styles.fmAmenityText, isSelected && styles.fmAmenityTextActive]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View style={[styles.fmFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={styles.fmApplyBtn} onPress={handleApplyFilters}>
              <Text style={styles.fmApplyText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PaywallSheet
        visible={showPaywall}
        featureName={paywallFeature}
        requiredPlan={paywallPlan}
        role="renter"
        onUpgrade={() => {
          setShowPaywall(false);
          (navigation as any).navigate('Plans');
        }}
        onDismiss={() => setShowPaywall(false)}
      />

      <Modal
        visible={showUnifiedInterestSheet}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowUnifiedInterestSheet(false); setIsSuperInterest(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable
          style={styles.inquireModalOverlay}
          onPress={() => { setShowUnifiedInterestSheet(false); setIsSuperInterest(false); }}
        >
          <Pressable style={styles.inquireSheet} onPress={() => {}}>
            <View style={styles.inquireSheetHandle} />
            {isSuperInterest ? (
              <View style={styles.superInterestSheetBadge}>
                <Text style={styles.superInterestSheetBadgeText}>Super Interest</Text>
              </View>
            ) : null}
            <Text style={styles.inquireSheetTitle}>
              {isSuperInterest ? 'Send Super Interest' : "I'm Interested"}
            </Text>
            <Text style={styles.inquireSheetDesc}>
              Your profile info will be shared with the host
            </Text>
            {selectedProperty ? (
              <View style={styles.renterSnapshotCard}>
                <View style={styles.renterSnapshotRow}>
                  <View style={styles.renterSnapshotItem}>
                    <Feather name="dollar-sign" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.renterSnapshotLabel}>Budget</Text>
                    <Text style={styles.renterSnapshotValue}>
                      {user?.profileData?.budget ? `$${user.profileData.budget}/mo` : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.renterSnapshotDivider} />
                  <View style={styles.renterSnapshotItem}>
                    <Feather name="calendar" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.renterSnapshotLabel}>Move-in</Text>
                    <Text style={styles.renterSnapshotValue}>
                      {user?.profileData?.preferences?.moveInDate || 'Flexible'}
                    </Text>
                  </View>
                  <View style={styles.renterSnapshotDivider} />
                  <View style={styles.renterSnapshotItem}>
                    <Feather name="percent" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.renterSnapshotLabel}>Match</Text>
                    <Text style={styles.renterSnapshotValue}>
                      {getPropertyCompatibility(selectedProperty)}%
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
            <TextInput
              style={styles.inquireNoteInput}
              placeholder="Add a note to the host... (optional)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={interestNote}
              onChangeText={(t) => setInterestNote(t.slice(0, 150))}
              multiline
              maxLength={150}
              blurOnSubmit
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{interestNote?.length || 0}/150</Text>
            <Pressable
              style={[
                styles.inquireSendBtn,
                { opacity: sendingInterest ? 0.6 : 1 },
                isSuperInterest ? { backgroundColor: '#FFD700' } : null,
              ]}
              onPress={() => handleSendUnifiedInterest(interestNote || '')}
              disabled={sendingInterest}
            >
              <LinearGradient
                colors={isSuperInterest ? ['#FFD700', '#FFA500'] : [ACCENT, '#e83a2a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.inquireSendBtnGrad}
              >
                <Text style={[styles.inquireSendBtnText, isSuperInterest ? { color: '#000' } : null]}>
                  {sendingInterest ? 'Sending...' : isSuperInterest ? 'Send Super Interest' : 'Send Interest'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              style={styles.inquireCancelBtn}
              onPress={() => { setShowUnifiedInterestSheet(false); setIsSuperInterest(false); }}
            >
              <Text style={styles.inquireCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showPropertyDetail && selectedProperty != null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPropertyDetail(false)}
      >
        <View style={styles.pdOverlay}>
          <View style={styles.pdSheet}>

            {selectedProperty ? (() => {
              const photos = selectedProperty.photos?.length > 0
                ? selectedProperty.photos
                : ['https://via.placeholder.com/400x260'];

              return (
                <View style={styles.pdPhotoContainer}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                      setPhotoIndex(index);
                    }}
                    scrollEventThrottle={16}
                  >
                    {photos.map((photo: string, i: number) => (
                      <Image
                        key={i}
                        source={{ uri: photo }}
                        style={styles.pdPhoto}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={styles.pdPhotoGradient}
                  >
                    <View style={styles.pdPhotoInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <Text style={styles.pdPrice}>${selectedProperty.price?.toLocaleString()}/mo</Text>
                        {selectedProperty.featured ? (
                          <View style={styles.pdFeaturedBadge}>
                            <Feather name="star" size={10} color="#FFD700" />
                            <Text style={styles.pdFeaturedText}>FEATURED</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.pdTitle} numberOfLines={2}>{selectedProperty.title}</Text>
                      <Text style={styles.pdLocation}>
                        <Feather name="map-pin" size={11} color="rgba(255,255,255,0.6)" /> {formatLocation(selectedProperty)}
                      </Text>
                    </View>
                  </LinearGradient>

                  {photos.length > 1 ? (
                    <View style={styles.pdDots}>
                      {photos.map((_: string, i: number) => (
                        <View
                          key={i}
                          style={[styles.pdDot, i === photoIndex && styles.pdDotActive]}
                        />
                      ))}
                    </View>
                  ) : null}

                  <Pressable
                    style={styles.pdCloseBtn}
                    onPress={() => setShowPropertyDetail(false)}
                    hitSlop={8}
                  >
                    <Feather name="x" size={18} color="#fff" />
                  </Pressable>
                </View>
              );
            })() : null}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.pdScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedProperty ? (() => {

                const detailHostUser = selectedProperty.hostProfileId
                  ? hostProfiles.get(selectedProperty.hostProfileId)
                  : null;
                const detailHostPhoto = detailHostUser?.profilePicture;
                const detailHostType: HostType = (selectedProperty.hostType || detailHostUser?.hostType || 'individual') as HostType;
                const detailShowMatch = shouldShowMatchScore(detailHostType);
                const detailHostProfile = detailHostUser ? getUserAsRoommateProfile(detailHostUser) : null;
                const detailCompatibility = detailHostProfile && user ? calculateCompatibility(user, detailHostProfile) : null;

                return (
                  <>
                    <View style={styles.pdStatStrip}>
                      <View style={styles.pdStat}>
                        <Feather name="home" size={15} color="#ff6b5b" />
                        <Text style={styles.pdStatValue}>{selectedProperty.bedrooms}</Text>
                        <Text style={styles.pdStatLabel}>Bed{selectedProperty.bedrooms !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.pdStatDivider} />
                      <View style={styles.pdStat}>
                        <Feather name="droplet" size={15} color="#ff6b5b" />
                        <Text style={styles.pdStatValue}>{selectedProperty.bathrooms}</Text>
                        <Text style={styles.pdStatLabel}>Bath{selectedProperty.bathrooms !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.pdStatDivider} />
                      <View style={styles.pdStat}>
                        <Feather name="maximize" size={15} color="#ff6b5b" />
                        <Text style={styles.pdStatValue}>{selectedProperty.sqft?.toLocaleString()}</Text>
                        <Text style={styles.pdStatLabel}>sqft</Text>
                      </View>
                      <View style={styles.pdStatDivider} />
                      <View style={styles.pdStat}>
                        <Feather name={selectedProperty.roomType === 'entire' ? 'key' : 'user'} size={15} color="#ff6b5b" />
                        <Text style={[styles.pdStatValue, { fontSize: 11 }]} numberOfLines={1}>
                          {selectedProperty.roomType === 'entire' ? 'Entire' : 'Room'}
                        </Text>
                        <Text style={styles.pdStatLabel}>Type</Text>
                      </View>
                    </View>

                    <View style={styles.pdHostCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {detailHostPhoto ? (
                          <Image source={{ uri: detailHostPhoto }} style={styles.pdHostAvatar} />
                        ) : (
                          <View style={[styles.pdHostAvatar, styles.pdHostAvatarFallback]}>
                            <Feather
                              name={detailHostType === 'company' ? 'briefcase' : detailHostType === 'agent' ? 'award' : 'user'}
                              size={20}
                              color="rgba(255,255,255,0.4)"
                            />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pdHostLabel}>
                            {detailHostType === 'company' ? 'Property Management' : detailHostType === 'agent' ? 'Licensed Agent' : 'Host'}
                          </Text>
                          <Text style={styles.pdHostName}>
                            {detailHostType === 'company' && detailHostUser?.companyName
                              ? detailHostUser.companyName
                              : selectedProperty.hostName}
                          </Text>
                          {detailHostType === 'company' && detailHostUser?.unitsManaged ? (
                            <Text style={styles.pdHostMeta}>{detailHostUser.unitsManaged} units managed</Text>
                          ) : detailHostType === 'agent' && detailHostUser?.agencyName ? (
                            <Text style={styles.pdHostMeta}>{detailHostUser.agencyName}</Text>
                          ) : null}
                          {detailHostType === 'agent' && detailHostUser?.licenseVerified ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Feather name="check-circle" size={10} color="#3b82f6" />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#3b82f6' }}>Verified Agent</Text>
                            </View>
                          ) : null}
                        </View>
                        {detailHostType !== 'individual' ? (
                          <View style={[styles.pdHostBadge, { backgroundColor: getHostBadgeColor(detailHostType) + '20', borderColor: getHostBadgeColor(detailHostType) + '40' }]}>
                            <Feather name={getHostBadgeIcon(detailHostType)} size={10} color={getHostBadgeColor(detailHostType)} />
                            <Text style={[styles.pdHostBadgeText, { color: getHostBadgeColor(detailHostType) }]}>
                              {getHostBadgeLabel(detailHostType)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {selectedProperty.host_badge ? (
                        <HostBadge badge={selectedProperty.host_badge} size="large" />
                      ) : (selectedProperty.average_rating || 0) >= 4.8 && (selectedProperty.review_count || 0) >= 10 ? (
                        <HostBadge badge="rhome_select" size="large" />
                      ) : null}

                      {detailShowMatch && detailCompatibility !== null ? (
                        <Pressable
                          style={styles.pdMatchPill}
                          onPress={() => {
                            if (!renterLimits.hasMatchBreakdown) {
                              setPaywallFeature('Match Breakdown');
                              setPaywallPlan('elite');
                              setShowPaywall(true);
                            } else {
                              setShowMatchBreakdown(true);
                            }
                          }}
                        >
                          <Feather name="heart" size={13} color="#ff6b5b" />
                          <Text style={styles.pdMatchPillText}>{detailCompatibility}% Match</Text>
                          {renterLimits.hasMatchBreakdown ? (
                            <Feather name="chevron-right" size={14} color="#ff6b5b" />
                          ) : (
                            <PlanBadgeInline plan="Elite" locked />
                          )}
                        </Pressable>
                      ) : null}

                      {detailHostUser?.verifiedBusiness || detailHostUser?.purchases?.hostVerificationBadge || ((detailHostUser as any)?.hostSubscription?.plan && (detailHostUser as any).hostSubscription.plan !== 'free' && (detailHostUser as any).hostSubscription.plan !== 'none') || (detailHostUser?.hostPlan && detailHostUser.hostPlan !== 'free' && detailHostUser.hostPlan !== 'none') ? (
                        <View style={styles.pdChipRow}>
                          <View style={styles.pdVerifiedChip}>
                            <Feather name="check-circle" size={11} color="#22C55E" />
                            <Text style={styles.pdVerifiedChipText}>Verified Business</Text>
                          </View>
                          {detailHostUser?.avgResponseHours !== undefined ? (
                            <View style={styles.pdResponseChip}>
                              <Feather name="clock" size={11} color="rgba(255,255,255,0.4)" />
                              <Text style={styles.pdResponseChipText}>
                                Responds in {detailHostUser.avgResponseHours < 1 ? '< 1hr' : `${Math.round(detailHostUser.avgResponseHours)}hrs`}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    {selectedProperty.description ? (
                      <View style={styles.pdSection}>
                        <Text style={styles.pdSectionTitle}>About</Text>
                        <Text style={styles.pdDescriptionText}>{selectedProperty.description}</Text>
                      </View>
                    ) : null}

                    {selectedProperty.availableDate ? (
                      <View style={styles.pdAvailRow}>
                        <Feather name="calendar" size={14} color="#22C55E" />
                        <Text style={styles.pdAvailText}>
                          Available {formatMoveInDate(selectedProperty.availableDate.toString())}
                        </Text>
                      </View>
                    ) : null}

                    {selectedProperty.walkScore ? (
                      <View style={styles.pdSection}>
                        {(() => {
                          const userPlan = user?.subscription?.plan || 'basic';
                          const hasWalkScoreAccess = userPlan === 'plus' || userPlan === 'elite';
                          return hasWalkScoreAccess ? (
                            <View style={styles.pdWalkRow}>
                              <WalkScoreBadge score={selectedProperty.walkScore} size="large" />
                              <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={styles.pdWalkLabel}>
                                  {selectedProperty.walkScore >= 90 ? "Walker's Paradise" :
                                   selectedProperty.walkScore >= 70 ? "Very Walkable" :
                                   selectedProperty.walkScore >= 50 ? "Somewhat Walkable" : "Car-Dependent"}
                                </Text>
                                <Text style={styles.pdWalkSub}>Daily errands do not require a car</Text>
                              </View>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.pdWalkLock}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowPropertyDetail(false);
                                setPaywallFeature('Walk Score');
                                setPaywallPlan('plus');
                                setShowPaywall(true);
                              }}
                            >
                              <Feather name="lock" size={16} color="rgba(255,255,255,0.3)" />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.pdWalkLabel}>Walk Score</Text>
                                <Text style={[styles.pdWalkSub, { color: '#ff6b5b' }]}>Upgrade to Plus to unlock</Text>
                              </View>
                            </Pressable>
                          );
                        })()}

                      </View>
                    ) : null}

                    <View style={styles.pdSection}>
                      <Text style={styles.pdSectionTitle}>Area Info</Text>
                      {areaInfoLoading ? (
                        <View style={styles.pdAreaInfoGrid}>
                          {[0, 1, 2, 3, 4].map(i => (
                            <View key={i} style={styles.pdAreaInfoCard}>
                              <View style={[styles.pdAreaInfoIconWrap, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
                              <View style={{ width: '60%', height: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 6 }} />
                              <View style={{ width: '80%', height: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
                            </View>
                          ))}
                        </View>
                      ) : areaInfoError || !areaInfo ? (
                        <View style={styles.pdAreaInfoGrid}>
                          {[
                            { icon: 'navigation', label: 'Transit', text: 'Transit info unavailable' },
                            { icon: 'coffee', label: 'Restaurants', text: 'Restaurant info unavailable' },
                            { icon: 'shopping-bag', label: 'Grocery', text: 'Grocery info unavailable' },
                            { icon: 'briefcase', label: 'Laundromat', text: 'Laundry info unavailable' },
                            { icon: 'sun', label: 'Parks', text: 'Park info unavailable' },
                          ].map((card) => (
                            <View key={card.label} style={styles.pdAreaInfoCard}>
                              <View style={[styles.pdAreaInfoIconWrap, { opacity: 0.4 }]}>
                                <Feather name={card.icon as any} size={16} color={ACCENT} />
                              </View>
                              <Text style={styles.pdAreaInfoLabel}>{card.label}</Text>
                              <Text style={[styles.pdAreaInfoValue, { opacity: 0.5 }]}>{card.text}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.pdAreaInfoGrid}>
                          <Pressable
                            style={styles.pdAreaInfoCard}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAreaDetailModal({ visible: true, category: 'transit' });
                            }}
                          >
                            <View style={styles.pdAreaInfoIconWrap}>
                              <Feather name="navigation" size={16} color={ACCENT} />
                            </View>
                            <Text style={styles.pdAreaInfoLabel}>Transit</Text>
                            <Text style={styles.pdAreaInfoValue}>
                              {areaInfo.transit.length > 0
                                ? `${areaInfo.transit.length} stop${areaInfo.transit.length !== 1 ? 's' : ''} nearby`
                                : 'None found nearby'}
                            </Text>
                            {areaInfo.transit.length > 0 ? (
                              <Text style={styles.pdAreaInfoTapHint}>Tap to explore</Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            style={styles.pdAreaInfoCard}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAreaDetailModal({ visible: true, category: 'restaurants' });
                            }}
                          >
                            <View style={styles.pdAreaInfoIconWrap}>
                              <Feather name="coffee" size={16} color={ACCENT} />
                            </View>
                            <Text style={styles.pdAreaInfoLabel}>Restaurants</Text>
                            <Text style={styles.pdAreaInfoValue}>
                              {areaInfo.restaurants.length > 0 ? `${areaInfo.restaurants.length} nearby` : 'None found nearby'}
                            </Text>
                            {areaInfo.restaurants.length > 0 ? (
                              <Text style={styles.pdAreaInfoTapHint}>Tap to explore</Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            style={styles.pdAreaInfoCard}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAreaDetailModal({ visible: true, category: 'grocery' });
                            }}
                          >
                            <View style={styles.pdAreaInfoIconWrap}>
                              <Feather name="shopping-bag" size={16} color={ACCENT} />
                            </View>
                            <Text style={styles.pdAreaInfoLabel}>Grocery</Text>
                            <Text style={styles.pdAreaInfoValue}>{formatNearestAmenity(areaInfo.grocery)}</Text>
                            {areaInfo.grocery.length > 0 ? (
                              <Text style={styles.pdAreaInfoTapHint}>Tap to explore</Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            style={styles.pdAreaInfoCard}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAreaDetailModal({ visible: true, category: 'laundry' });
                            }}
                          >
                            <View style={styles.pdAreaInfoIconWrap}>
                              <Feather name="briefcase" size={16} color={ACCENT} />
                            </View>
                            <Text style={styles.pdAreaInfoLabel}>Laundromat</Text>
                            <Text style={styles.pdAreaInfoValue}>
                              {selectedProperty.amenities?.some(a =>
                                a.toLowerCase().includes('laundry') && a.toLowerCase().includes('unit')
                              )
                                ? 'In building'
                                : formatNearestAmenity(areaInfo.laundry)}
                            </Text>
                            {areaInfo.laundry.length > 0 ? (
                              <Text style={styles.pdAreaInfoTapHint}>Tap to explore</Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            style={styles.pdAreaInfoCard}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAreaDetailModal({ visible: true, category: 'parks' });
                            }}
                          >
                            <View style={styles.pdAreaInfoIconWrap}>
                              <Feather name="sun" size={16} color={ACCENT} />
                            </View>
                            <Text style={styles.pdAreaInfoLabel}>Parks</Text>
                            <Text style={styles.pdAreaInfoValue}>{formatNearestAmenity(areaInfo.parks)}</Text>
                            {areaInfo.parks.length > 0 ? (
                              <Text style={styles.pdAreaInfoTapHint}>Tap to explore</Text>
                            ) : null}
                          </Pressable>
                        </View>
                      )}
                    </View>

                    <Pressable
                      onPress={() => setShowNeighborhoodSheet(true)}
                      style={styles.pdNeighborhoodBtn}
                    >
                      <Feather name="cpu" size={16} color="#ff6b5b" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pdNeighborhoodBtnTitle}>
                          Get detailed neighborhood insights
                        </Text>
                        <Text style={styles.pdNeighborhoodBtnSub}>
                          Safety, walkability, transit, nearby spots
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
                    </Pressable>

                    {selectedProperty.amenities?.length > 0 ? (
                      <View style={styles.pdSection}>
                        <Text style={styles.pdSectionTitle}>Amenities</Text>
                        <View style={styles.pdAmenitiesWrap}>
                          {selectedProperty.amenities.map((amenity: string, index: number) => (
                            <View key={index} style={styles.pdAmenityChip}>
                              <Text style={styles.pdAmenityChipText}>{amenity}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {selectedProperty.roomType === 'room' &&
                     selectedProperty.existingRoommates?.filter((rm: any) => rm.onApp && rm.userId).length > 0 ? (
                      <View style={styles.pdSection}>
                        <Text style={styles.pdSectionTitle}>Roommates on App</Text>
                        {selectedProperty.existingRoommates.filter((rm: any) => rm.onApp && rm.userId).map((rm: any, idx: number) => {
                          const roommateUser = hostProfiles.get(rm.userId!);
                          return (
                            <View key={idx} style={styles.pdRoommateRow}>
                              {roommateUser?.profilePicture ? (
                                <Image source={{ uri: roommateUser.profilePicture }} style={styles.pdRoommateAvatar} />
                              ) : (
                                <View style={[styles.pdRoommateAvatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                  <Feather name="user" size={16} color="rgba(255,255,255,0.4)" />
                                </View>
                              )}
                              <Text style={styles.pdRoommateName}>{roommateUser?.name || 'User'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={styles.pdSection}>
                      <View style={styles.pdReviewsHeader}>
                        <Text style={styles.pdSectionTitle}>Reviews</Text>
                        {detailReviewSummary && detailReviewSummary.reviewCount > 0 ? (
                          <View style={styles.pdReviewsSummaryBadge}>
                            <Feather name="star" size={14} color="#FFD700" />
                            <Text style={styles.pdReviewsAvg}>{detailReviewSummary.averageRating?.toFixed(1)}</Text>
                            <Text style={styles.pdReviewsCount}>({detailReviewSummary.reviewCount})</Text>
                          </View>
                        ) : null}
                      </View>

                      {detailReviewSummary && detailReviewSummary.reviewCount > 0 ? (
                        <Pressable
                          style={styles.pdReviewsBtn}
                          onPress={() => setShowReviewsModal(true)}
                        >
                          <Feather name="message-square" size={16} color="#ff6b5b" />
                          <Text style={styles.pdReviewsBtnText}>
                            See all {detailReviewSummary.reviewCount} review{detailReviewSummary.reviewCount !== 1 ? 's' : ''}
                          </Text>
                          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      ) : null}

                      {reviewEligibilityLoaded ? (
                        canReviewListing ? (
                          <Pressable
                            style={[styles.pdReviewsBtn, { marginTop: detailReviewSummary?.reviewCount ? 8 : 0 }]}
                            onPress={() => setShowWriteReview(true)}
                          >
                            <Feather name="edit-3" size={16} color="#ff6b5b" />
                            <Text style={styles.pdReviewsBtnText}>
                              {detailReviewSummary && detailReviewSummary.reviewCount > 0
                                ? 'Write a review'
                                : 'Be the first to review'}
                            </Text>
                            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
                          </Pressable>
                        ) : (
                          detailReviewSummary?.reviewCount === 0 ? (
                            <View style={styles.pdReviewsLocked}>
                              <Feather name="lock" size={14} color="rgba(255,255,255,0.25)" />
                              <Text style={styles.pdReviewsLockedText}>
                                Reviews can only be left after a confirmed stay or showing
                              </Text>
                            </View>
                          ) : null
                        )
                      ) : null}
                    </View>

                    <View style={{ height: 100 }} />
                  </>
                );
              })() : null}
            </ScrollView>

            {selectedProperty ? (
              <Modal visible={showReviewsModal} animationType="slide" presentationStyle="pageSheet">
                <PropertyReviewsScreen
                  listingId={selectedProperty.id}
                  listingTitle={selectedProperty.title}
                  hostId={selectedProperty.hostId || selectedProperty.hostProfileId || ''}
                  onClose={() => {
                    setShowReviewsModal(false);
                    getReviewSummary(selectedProperty.id).then(setDetailReviewSummary).catch(() => {});
                  }}
                />
              </Modal>
            ) : null}

            <WriteReviewSheet
              visible={showWriteReview}
              onClose={() => setShowWriteReview(false)}
              onSubmit={handleWriteReviewSubmit}
            />

            {selectedProperty ? (() => {
              const interest = interestMap.get(selectedProperty.id);

              if (interest?.status === 'pending') {
                return (
                  <View style={styles.pdActionBar}>
                    <View style={[styles.pdActionStatusBadge, { borderColor: '#FFA500', backgroundColor: 'rgba(255,165,0,0.08)' }]}>
                      <Feather name="clock" size={16} color="#FFA500" />
                      <Text style={[styles.pdActionStatusText, { color: '#FFA500' }]}>Pending Response</Text>
                    </View>
                  </View>
                );
              }
              if (interest?.status === 'accepted') {
                return (
                  <View style={styles.pdActionBar}>
                    <Pressable
                      style={[styles.pdActionPrimary, { backgroundColor: '#22c55e' }]}
                      onPress={() => { setShowPropertyDetail(false); navigation.navigate('Messages' as never); }}
                    >
                      <Feather name="message-circle" size={18} color="#fff" />
                      <Text style={styles.pdActionPrimaryText}>Accepted — Chat Now</Text>
                    </Pressable>
                  </View>
                );
              }
              if (interest?.status === 'passed') {
                return (
                  <View style={styles.pdActionBar}>
                    <View style={[styles.pdActionStatusBadge, { borderColor: '#555', backgroundColor: 'rgba(100,100,100,0.08)' }]}>
                      <Feather name="x-circle" size={16} color="#666" />
                      <Text style={[styles.pdActionStatusText, { color: '#666' }]}>Passed</Text>
                    </View>
                  </View>
                );
              }

              return (
                <View style={styles.pdActionBar}>
                  <Pressable
                    style={[styles.pdActionPrimary, { backgroundColor: isSuperInterest ? '#FFD700' : '#ff6b5b', flex: eligibleGroups.length > 0 ? 1.4 : 1 }]}
                    onPress={handleInterestPress}
                  >
                    <Feather name={isSuperInterest ? 'star' : 'heart'} size={18} color={isSuperInterest ? '#000' : '#fff'} />
                    <Text style={[styles.pdActionPrimaryText, { color: isSuperInterest ? '#000' : '#fff' }]}>
                      {isSuperInterest ? 'Super Interest' : "I'm Interested"}
                    </Text>
                    {canSendSuperInterest().canSend ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setIsSuperInterest(!isSuperInterest);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={[styles.pdSuperToggle, isSuperInterest ? { backgroundColor: 'rgba(0,0,0,0.15)' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                      >
                        <Feather name="star" size={13} color={isSuperInterest ? '#000' : '#fff'} />
                      </Pressable>
                    ) : null}
                  </Pressable>

                  {eligibleGroups.length > 0 && shouldShowRoommateFeatures(user?.profileData?.apartment_search_type) ? (() => {
                    const roomsAvail = selectedProperty?.rooms_available ?? selectedProperty?.bedrooms ?? null;
                    const firstGroup = eligibleGroups[0];
                    const memberDetails = (firstGroup as any)?._memberDetails || [];
                    const activeNonHost = memberDetails.filter((m: any) => !m.is_host);
                    const unitsNeeded = activeNonHost.length || (Array.isArray(firstGroup.members) ? firstGroup.members.length : 0);
                    const tooBig = roomsAvail != null && roomsAvail > 0 && unitsNeeded > roomsAvail;

                    return (
                      <Pressable
                        style={[styles.pdActionSecondary, tooBig ? { opacity: 0.45 } : undefined]}
                        onPress={() => {
                          if (tooBig) {
                            showAlert({
                              title: 'Group Too Large',
                              message: `Your group needs ${unitsNeeded} room${unitsNeeded !== 1 ? 's' : ''} but this listing only has ${roomsAvail} available.`,
                              variant: 'warning',
                            });
                            return;
                          }
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (eligibleGroups.length === 1) {
                            confirm({
                              title: 'Send Group Inquiry?',
                              message: `Send inquiry to "${selectedProperty?.title}" on behalf of "${firstGroup.name}" (${unitsNeeded} room${unitsNeeded !== 1 ? 's' : ''} needed)?`,
                              confirmText: 'Send Inquiry',
                              cancelText: 'Cancel',
                            }).then((yes) => { if (yes) handleInquireAsGroup(firstGroup); });
                          } else {
                            setShowGroupPickerModal(true);
                          }
                        }}
                      >
                        <Feather name="users" size={17} color={tooBig ? '#888' : '#ff6b5b'} />
                        <Text style={[styles.pdActionSecondaryText, tooBig ? { color: '#888' } : undefined]}>Group</Text>
                      </Pressable>
                    );
                  })() : null}
                </View>
              );
            })() : null}

            {isBasic && selectedProperty ? (
              <Pressable
                style={styles.pdUpgradeBanner}
                onPress={() => {
                  setPaywallFeature('Unlimited Messaging');
                  setPaywallPlan('plus');
                  setShowPaywall(true);
                }}
              >
                <Feather name="lock" size={14} color="#fff" />
                <Text style={styles.pdUpgradeBannerText}>
                  Upgrade to Plus to message {selectedProperty.hostName || 'this host'} & schedule a tour
                </Text>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : null}

            <Pressable
              style={styles.askPiFab}
              onPress={() => {
                if (!selectedProperty) return;
                setShowPropertyDetail(false);
                (navigation as any).navigate('Messages', {
                  screen: 'AIMatchAssistant',
                  params: {
                    listingContext: {
                      listingId: selectedProperty.id,
                      title: selectedProperty.title,
                      price: selectedProperty.price,
                      location: formatLocation(selectedProperty),
                      zipCode: selectedProperty.zipCode,
                      city: selectedProperty.city || user?.city,
                      bedrooms: selectedProperty.bedrooms,
                      bathrooms: selectedProperty.bathrooms,
                      sqft: selectedProperty.sqft,
                      amenities: selectedProperty.amenities,
                      description: selectedProperty.description,
                      hostName: selectedProperty.hostName,
                    },
                    mode: 'listing_advisor',
                  },
                });
              }}
            >
              <Feather name="message-circle" size={20} color="#fff" />
              <Text style={styles.askPiFabLabel}>Ask Pi</Text>
            </Pressable>

          </View>
        </View>
      </Modal>

      <Modal
        visible={showMatchBreakdown && selectedProperty != null}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMatchBreakdown(false)}
      >
        <View style={styles.breakdownOverlay}>
          <View style={[styles.breakdownContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.breakdownHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={[Typography.h3]}>Match Breakdown</ThemedText>
              <Pressable onPress={() => setShowMatchBreakdown(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {(() => {
                if (!selectedProperty || !user) return null;
                const bHostUser = selectedProperty.hostProfileId ? hostProfiles.get(selectedProperty.hostProfileId) : null;
                const bHostProfile = bHostUser ? getUserAsRoommateProfile(bHostUser) : null;
                const totalScore = bHostProfile ? calculateCompatibility(user, bHostProfile) : 0;

                const budgetScore = (() => {
                  if (!user.profileData?.budget || !selectedProperty.price) return 70;
                  return user.profileData.budget >= selectedProperty.price
                    ? 100
                    : Math.max(0, Math.round(100 - ((selectedProperty.price - user.profileData.budget) / selectedProperty.price) * 100));
                })();

                const locationScore = (() => {
                  if (user.profileData?.neighborhood === selectedProperty.neighborhood) return 100;
                  if (user.profileData?.city === selectedProperty.city) return 60;
                  return 30;
                })();

                const moveInScore = (() => {
                  if (!user.profileData?.moveInDate || !selectedProperty.availableDate) return 70;
                  const diffDays = Math.abs(
                    (new Date(user.profileData.moveInDate).getTime() - new Date(selectedProperty.availableDate).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  if (diffDays <= 7) return 100;
                  if (diffDays <= 14) return 85;
                  if (diffDays <= 30) return 65;
                  if (diffDays <= 60) return 40;
                  return 10;
                })();

                const lifestyleScore = bHostProfile ? Math.min(100, Math.max(0, 70 + Math.floor(Math.random() * 30))) : 70;
                const zodiacScore = bHostUser?.zodiacSign && user.zodiacSign ? 75 : 50;
                const verifiedScore = user.verification?.phoneVerified ? 100 : 50;

                const factors = [
                  { label: 'Budget Match', score: budgetScore, icon: 'dollar-sign', weight: '30%' },
                  { label: 'Location', score: locationScore, icon: 'map-pin', weight: '20%' },
                  { label: 'Move-in Date', score: moveInScore, icon: 'calendar', weight: '20%' },
                  { label: 'Lifestyle', score: lifestyleScore, icon: 'home', weight: '15%' },
                  { label: 'Zodiac', score: zodiacScore, icon: 'star', weight: '10%' },
                  { label: 'Verified', score: verifiedScore, icon: 'check-circle', weight: '5%' },
                ];

                return (
                  <>
                    <View style={[styles.breakdownHero, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                      <Feather name="heart" size={24} color={theme.primary} />
                      <ThemedText style={[Typography.h1, { color: theme.primary, marginTop: 4 }]}>
                        {totalScore}%
                      </ThemedText>
                      <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                        Overall Match Score
                      </ThemedText>
                    </View>

                    {factors.map(factor => (
                      <View key={factor.label} style={[styles.breakdownFactorRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={[styles.breakdownFactorIcon, { backgroundColor: theme.primary + '20' }]}>
                          <Feather name={factor.icon} size={15} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{factor.label}</ThemedText>
                            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>{factor.weight}</ThemedText>
                          </View>
                          <View style={[styles.breakdownBarTrack, { backgroundColor: theme.border }]}>
                            <View
                              style={[styles.breakdownBarFill, {
                                width: `${factor.score}%`,
                                backgroundColor: factor.score >= 80 ? '#22C55E' : factor.score >= 50 ? theme.primary : '#FF6B6B',
                              }]}
                            />
                          </View>
                        </View>
                        <ThemedText style={[Typography.body, { fontWeight: '700', width: 38, textAlign: 'right' }]}>
                          {factor.score}%
                        </ThemedText>
                      </View>
                    ))}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLocationSheet}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowLocationSheet(false); setLocationSearchQuery(''); setLocationSearchResults([]); }}
      >
        <Pressable style={styles.locSheetOverlay} onPress={() => { setShowLocationSheet(false); setLocationSearchQuery(''); setLocationSearchResults([]); }} />
        <View style={styles.locSheet}>
          <View style={styles.locSheetHandle} />
          <Text style={styles.locSheetTitle}>Search Location</Text>

          <View style={styles.locSearchInputWrap}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.locSearchInput}
              placeholder="City, neighborhood, or zip code"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={locationSearchQuery}
              onChangeText={handleLocationSearch}
              autoFocus
              returnKeyType="search"
            />
            {locationSearchQuery.length > 0 ? (
              <Pressable onPress={() => { setLocationSearchQuery(''); setLocationSearchResults([]); }}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            ) : null}
          </View>

          {isGeocodingZip ? (
            <View style={styles.locSearchLoading}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.locSearchLoadingText}>Looking up zip code...</Text>
            </View>
          ) : null}

          {locationSearchResults.length > 0 ? (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {locationSearchResults.map((result, idx) => (
                <Pressable key={`${result.label}-${idx}`} style={styles.locSearchResult} onPress={() => selectLocationResult(result)}>
                  <Feather
                    name={result.type === 'city' ? 'map' : result.type === 'zip' ? 'hash' : 'map-pin'}
                    size={16}
                    color={ACCENT}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.locSearchResultLabel}>{result.label}</Text>
                    <Text style={styles.locSearchResultType}>
                      {result.type === 'city' ? 'City' : result.type === 'zip' ? 'Zip Code' : 'Neighborhood'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
                </Pressable>
              ))}
            </ScrollView>
          ) : locationSearchQuery.length === 0 ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={styles.locSheetSectionLabel}>Popular Cities</Text>
              <View style={styles.locNeighborhoodGrid}>
                {getAllCities().slice(0, 8).map((city) => (
                  <Pressable
                    key={city}
                    style={[styles.locCityChip, activeCity === city && styles.locCityChipActive]}
                    onPress={() => selectLocationResult({ label: city, city, neighborhood: null, type: 'city' })}
                  >
                    <Text style={[styles.locCityText, activeCity === city && styles.locCityTextActive]}>{city}</Text>
                  </Pressable>
                ))}
              </View>

              {activeCity ? (
                <Pressable
                  style={styles.locClearBtn}
                  onPress={() => {
                    setActiveCity(null);
                    setSelectedNeighborhood(null);
                    setActiveSubArea(null);
                    setShowLocationSheet(false);
                  }}
                >
                  <Feather name="x-circle" size={14} color={ACCENT} />
                  <Text style={styles.locClearBtnText}>Clear location filter</Text>
                </Pressable>
              ) : null}
            </View>
          ) : !isGeocodingZip ? (
            <View style={styles.locSearchEmpty}>
              <Feather name="search" size={24} color="rgba(255,255,255,0.15)" />
              <Text style={styles.locSearchEmptyText}>No results found</Text>
              <Text style={styles.locSearchEmptyHint}>Try a different city, neighborhood, or 5-digit zip code</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <InterestConfirmationModal
        visible={showInterestConfirmation}
        onClose={() => setShowInterestConfirmation(false)}
        isSuperInterest={confirmationWasSuper}
      />
      <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="explore"
        contextData={{
          explore: {
            budget: user?.profileData?.budget || 0,
            city: activeCity || undefined,
            totalListings: properties.length,
            filteredCount: filteredProperties.length,
            activeFilters: filters,
            onApplyFilters: (suggested) => {
              setFilters(prev => ({ ...prev, ...suggested }));
            },
          },
        }}
      />

      {(() => {
        const config = areaDetailModal.category
          ? AREA_MODAL_CONFIG[areaDetailModal.category]
          : null;

        return (
          <Modal
            visible={areaDetailModal.visible}
            transparent
            animationType="slide"
            onRequestClose={() => setAreaDetailModal({ visible: false, category: null })}
          >
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
              onPress={() => setAreaDetailModal({ visible: false, category: null })}
            />
            <View style={{
              backgroundColor: '#1e1e1e',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingBottom: 40,
              maxHeight: '75%',
            }}>
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignSelf: 'center', marginTop: 12, marginBottom: 20,
              }} />
              {config ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: 'rgba(255,77,77,0.15)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Feather name={config.icon as any} size={15} color={ACCENT} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>
                      {config.title}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                    {selectedProperty?.neighborhood
                      ? `${selectedProperty.neighborhood}, ${selectedProperty.city}`
                      : selectedProperty?.city}
                  </Text>
                  {config.items.length === 0 ? (
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingVertical: 40 }}>
                      {config.emptyText}
                    </Text>
                  ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {config.items.map((place, index) => (
                        <View
                          key={index}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.07)',
                            gap: 14,
                          }}
                        >
                          {place.photoUrl ? (
                            <Image
                              source={{ uri: place.photoUrl }}
                              style={{
                                width: 48, height: 48, borderRadius: 12,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={{
                              width: 48, height: 48, borderRadius: 12,
                              backgroundColor: 'rgba(255,77,77,0.12)',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Text style={{
                                fontSize: 18, fontWeight: '700',
                                color: ACCENT, textTransform: 'uppercase',
                              }}>
                                {place.name?.charAt(0) || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}
                              numberOfLines={1}
                            >
                              {place.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                              {place.type}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>
                            {place.distanceMi} mi
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </>
              ) : null}
            </View>
          </Modal>
        );
      })()}

      {selectedProperty ? (
        <NeighborhoodAISheet
          visible={showNeighborhoodSheet}
          onClose={() => setShowNeighborhoodSheet(false)}
          listingId={selectedProperty.id}
          address={`${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}`}
          neighborhood={selectedProperty.neighborhood}
          areaInfo={areaInfo}
        />
      ) : null}
      <Modal
        visible={showGroupPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupPickerModal(false)}
      >
        <Pressable style={styles.groupPickerOverlay} onPress={() => setShowGroupPickerModal(false)}>
          <Pressable style={[styles.groupPickerSheet, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={styles.groupPickerHandle} />
            <ThemedText style={styles.groupPickerTitle}>Choose a Group</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Select which group to inquire with
            </ThemedText>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {eligibleGroups.map((g) => {
                const details = (g as any)?._memberDetails || [];
                const nonHost = details.filter((m: any) => !m.is_host);
                const memberCount = nonHost.length || (Array.isArray(g.members) ? g.members.length : 0);
                const couples = nonHost.filter((m: any) => m.is_couple).length;
                const singles = memberCount - couples;
                const roomsAvail = selectedProperty?.rooms_available ?? selectedProperty?.bedrooms ?? null;
                const tooBig = roomsAvail != null && roomsAvail > 0 && memberCount > roomsAvail;

                return (
                  <Pressable
                    key={g.id}
                    style={[styles.groupPickerItem, { borderColor: theme.border }, tooBig ? { opacity: 0.45 } : undefined]}
                    onPress={() => {
                      if (tooBig) {
                        showAlert({
                          title: 'Group Too Large',
                          message: `This group needs ${memberCount} room${memberCount !== 1 ? 's' : ''} but the listing only has ${roomsAvail} available.`,
                          variant: 'warning',
                        });
                        return;
                      }
                      confirm({
                        title: 'Send Group Inquiry?',
                        message: `Send inquiry to "${selectedProperty?.title}" on behalf of "${g.name}" (${memberCount} room${memberCount !== 1 ? 's' : ''} needed)?`,
                        confirmText: 'Send Inquiry',
                        cancelText: 'Cancel',
                      }).then((yes) => { if (yes) handleInquireAsGroup(g); });
                    }}
                  >
                    <View style={styles.groupPickerItemLeft}>
                      <View style={[styles.groupPickerIcon, { backgroundColor: tooBig ? 'rgba(136,136,136,0.12)' : 'rgba(255,107,91,0.12)' }]}>
                        <Feather name="users" size={16} color={tooBig ? '#888' : '#ff6b5b'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>{g.name}</ThemedText>
                        <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          {couples > 0 ? ` (${couples} couple${couples > 1 ? 's' : ''}, ${singles} single${singles !== 1 ? 's' : ''})` : ''}
                          {' · '}{memberCount} room{memberCount !== 1 ? 's' : ''} needed
                        </ThemedText>
                        {tooBig ? (
                          <ThemedText style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>
                            Needs {memberCount} rooms — listing has {roomsAvail}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                    <Feather name={tooBig ? 'x-circle' : 'chevron-right'} size={18} color={tooBig ? '#888' : theme.textSecondary} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={[styles.groupPickerCancel, { borderColor: theme.border }]}
              onPress={() => setShowGroupPickerModal(false)}
            >
              <ThemedText style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  exploreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  aiBtnWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    flexShrink: 0,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  locationPickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  locationPickerText: {
    flex: 1,
  },
  locationCity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  locationNeighborhood: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIconBtnActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  locSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  locSheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  locSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  locSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  locSheetSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  locCityScroll: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
    marginBottom: 20,
  },
  locCityChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  locCityChipActive: {
    backgroundColor: '#ff6b5b',
    borderColor: 'transparent',
  },
  locCityText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  locCityTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  locNeighborhoodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
  },
  locHoodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  locHoodChipActive: {
    backgroundColor: '#ff6b5b',
    borderColor: 'transparent',
  },
  locHoodChipAll: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  locHoodText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  locHoodTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  locSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  locSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  locSearchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  locSearchResultLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  locSearchResultType: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  locSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  locSearchLoadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  locSearchEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  locSearchEmptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '600',
  },
  locSearchEmptyHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    fontWeight: '500',
  },
  locClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  locClearBtnText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  pdAreaInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pdAreaInfoCard: {
    width: '47%' as any,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pdAreaInfoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pdAreaInfoLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  pdAreaInfoValue: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  pdAreaInfoTapHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  pdAreaInfoFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pdAreaInfoFallbackText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '500',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tabActive: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabInactive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 14,
  },
  tabActiveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabInactiveText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  savedBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  filterScrollView: {
    flexGrow: 0,
    marginBottom: 6,
  },
  chipScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ff6b5b',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5,
  },
  chipUnselected: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 5,
  },
  chipSelectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chipUnselectedText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
  },
  propCard: {
    borderRadius: 22,
    backgroundColor: CARD_BG,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  cardPhoto: {
    height: 185,
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTags: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  tagLease: {
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagSublet: {
    backgroundColor: 'rgba(255,107,91,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagEntire: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagRoom: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  boostFeaturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c518',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagFeatured: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c518',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  saveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnActive: {
    backgroundColor: 'rgba(255,107,91,0.28)',
    borderColor: ACCENT,
  },
  photoBottom: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceOverlay: {
    flex: 1,
    marginRight: 8,
  },
  priceText: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  propNameText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  matchScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  matchScoreText: {
    color: '#ff8878',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDetails: {
    padding: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailChips: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 1,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailChipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  availBadge: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  availBadgeText: {
    color: '#2ecc71',
    fontSize: 10.5,
    fontWeight: '700',
  },
  locationRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  areaInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderRadius: 100,
    marginLeft: 'auto',
  },
  areaInfoPillText: {
    color: '#ff6b5b',
    fontSize: 11,
    fontWeight: '600',
  },
  locationText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  hostAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  hostInfo: {
    flex: 1,
  },
  hostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hostName: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  verifiedHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(62,207,142,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  verifiedHostText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3ECF8E',
  },
  hostStatus: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10.5,
    marginTop: 1,
  },
  respBadge: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  respBadgeText: {
    color: '#2ecc71',
    fontSize: 10,
    fontWeight: '600',
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.12)',
  },
  premiumText: {
    color: 'rgba(255,215,0,0.6)',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyStateInline: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
  },
  featuredSection: {
    marginBottom: Spacing.lg,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  featuredTitle: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featuredScroll: {
    gap: 12,
  },
  featuredCard: {
    width: 200,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  featuredPhoto: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    justifyContent: 'flex-end',
  },
  featuredPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  featuredName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    backgroundColor: '#f5c518',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  featuredBadgeText: {
    color: '#1a1200',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  fmContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  fmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  fmClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  fmScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fmSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 24,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  fmTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fmTypeCard: {
    width: '47%' as any,
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
    position: 'relative' as const,
  },
  fmTypeCardActive: {
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  fmTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  fmTypeIconActive: {
    backgroundColor: '#ff6b5b',
  },
  fmTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  fmTypeLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  fmTypeCheck: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b5b',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  fmBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fmBudgetBox: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 14,
  },
  fmBudgetLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
    marginBottom: 4,
  },
  fmBudgetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  fmBudgetDash: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
  },
  fmRoomsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  fmRoomCol: {
    flex: 1,
  },
  fmRoomLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
  },
  fmCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fmCounterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fmCounterValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    minWidth: 36,
    textAlign: 'center' as const,
  },
  fmAmenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fmAmenityCategory: {
    marginBottom: 8,
  },
  fmCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  fmCategoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fmCategoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fmCategoryBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fmCategoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  fmAmenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fmAmenityChipActive: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
  },
  fmAmenityText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  fmAmenityTextActive: {
    color: '#fff',
  },
  fmLockedSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  fmLockedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  fmLockedDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  fmFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  fmApplyBtn: {
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  fmApplyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  upgradeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  upgradeModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.large,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  upgradeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeFeatures: {
    width: '100%',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  upgradeFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButton: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  pdOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pdSheet: {
    height: '93%',
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  pdPhotoContainer: {
    height: 260,
    position: 'relative',
  },
  pdPhoto: {
    width: Dimensions.get('window').width,
    height: 260,
  },
  pdPhotoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  pdPhotoInfo: {
    gap: 3,
  },
  pdPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pdFeaturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pdFeaturedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  pdTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  pdLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  pdDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  pdDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pdDotActive: {
    backgroundColor: '#fff',
    width: 14,
    borderRadius: 3,
  },
  pdCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdScrollContent: {
    paddingBottom: 20,
  },
  pdStatStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
  },
  pdStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  pdStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  pdStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  pdStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pdHostCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  pdHostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  pdHostAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdHostLabel: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    marginBottom: 1,
  },
  pdHostName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  pdHostMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  pdHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pdHostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pdMatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pdMatchPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b5b',
    flex: 1,
  },
  pdChipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pdVerifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pdVerifiedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },
  pdResponseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pdResponseChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  pdNeighborhoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  pdNeighborhoodBtnTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  pdNeighborhoodBtnSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  pdSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  pdSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  pdDescriptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },
  pdAvailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pdAvailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  pdWalkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pdWalkLock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pdWalkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  pdWalkSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  pdAmenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdAmenityChip: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pdAmenityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff8070',
  },
  pdRoommateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pdRoommateAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pdRoommateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  pdUpgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  pdUpgradeBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,215,0,0.85)',
  },
  askPiFab: {
    position: 'absolute',
    right: 16,
    bottom: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  askPiFabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  pdActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111',
  },
  pdActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  pdActionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  pdSuperToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  pdActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  pdActionSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  pdActionStatusBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pdActionStatusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupDiscoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    alignSelf: 'flex-start',
  },
  groupDiscoveryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ff6b5b',
    marginLeft: 4,
  },
  inquireTogetherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    backgroundColor: 'rgba(255,107,91,0.06)',
  },
  inquireTogetherText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ff6b5b',
  },
  groupPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  groupPickerSheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    paddingTop: 12,
  },
  groupPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  groupPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  groupPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  groupPickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  groupPickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPickerCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  inquireModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end' as const,
  },
  inquireSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  inquireSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center' as const,
    marginBottom: 20,
  },
  inquireSheetTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  inquireSheetDesc: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 16,
  },
  renterSnapshotCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  renterSnapshotRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  renterSnapshotItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 3,
  },
  renterSnapshotDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  renterSnapshotLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },
  renterSnapshotValue: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 13,
  },
  superInterestSheetBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  superInterestSheetBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  inquireNoteInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top' as const,
    marginBottom: 4,
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'right' as const,
    marginBottom: 14,
  },
  inquireSendBtn: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginTop: 4,
  },
  inquireSendBtnGrad: {
    height: 50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 14,
  },
  inquireSendBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  inquireCancelBtn: {
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  inquireCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
  },
  matchBreakdownPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    gap: 4,
  },
  statChipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  detailStatChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  breakdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  breakdownContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%' as any,
  },
  breakdownHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
  },
  breakdownHero: {
    alignItems: 'center' as const,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    margin: 16,
  },
  breakdownFactorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 16,
    gap: 10,
  },
  breakdownFactorIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  breakdownBarTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    overflow: 'hidden' as const,
  },
  breakdownBarFill: {
    height: '100%' as any,
    borderRadius: 3,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
  },
  ratingBadgeCount: {
    fontSize: 10,
    color: 'rgba(255,215,0,0.7)',
  },
  pdReviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pdReviewsSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pdReviewsAvg: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  pdReviewsCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  pdReviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  pdReviewsBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  pdReviewsLocked: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  pdReviewsLockedText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 18,
  },
});
