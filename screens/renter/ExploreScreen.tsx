import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, Modal, TextInput, ScrollView, Switch, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
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
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useCityContext } from '../../contexts/CityContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { getListings, mapListingToProperty, recordListingView } from '../../services/listingService';
import { getDiscoverableGroupsForListing } from '../../services/groupService';
import { Property, PropertyFilter, User, RoommateProfile, InterestCard, Conversation, Group } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { formatMoveInDate, calculateCompatibility, getMatchQualityColor, getGenderSymbol, formatLocation } from '../../utils/matchingAlgorithm';
import { getNeighborhoodsByCity, getAllCities } from '../../utils/locationData';
import { getZodiacSymbol } from '../../utils/zodiacUtils';
import { getBoostRotationIndex } from '../../utils/boostRotation';
import { shouldShowMatchScore, getHostBadgeLabel, getHostBadgeColor, getHostBadgeIcon } from '../../utils/hostTypeUtils';
import type { HostType } from '../../utils/hostTypeUtils';
import { PropertyMapView } from '../../components/PropertyMapView';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';

import { useNotificationContext } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';

const COMMON_AMENITIES = [
  'Parking', 'Gym', 'Pool', 'Laundry', 'Pet Friendly',
  'Air Conditioning', 'Dishwasher', 'Balcony',
];

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

const QUICK_FILTERS = [
  { key: 'bestMatch', label: 'Best Match', icon: 'heart' as const },
  { key: 'under2k', label: 'Under $2k' },
  { key: 'petFriendly', label: 'Pet Friendly' },
  { key: 'availableNow', label: 'Available Now' },
];

const LISTING_TYPE_CHIPS: { key: 'room' | 'entire' | 'sublet'; label: string; icon: 'user' | 'home' }[] = [
  { key: 'room', label: 'Private Room', icon: 'user' },
  { key: 'entire', label: 'Entire Unit', icon: 'home' },
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
  const { alert: showAlert } = useConfirm();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<PropertyFilter>({});
  const [tempFilters, setTempFilters] = useState<PropertyFilter>({});
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showPropertyDetail, setShowPropertyDetail] = useState(false);
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
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set(['bestMatch']));
  const [listingTypeFilter, setListingTypeFilter] = useState<'any' | 'room' | 'entire' | 'sublet'>('any');
  const [showAISheet, setShowAISheet] = useState(false);
  const [interestNote, setInterestNote] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [showGroupPickerModal, setShowGroupPickerModal] = useState(false);

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

  const eligibleGroups = userGroups.filter(g =>
    (g.type === 'roommate' || !g.type) && !g.listingId
  );

  useEffect(() => {
    loadProperties();
    loadSavedProperties();
    loadHostProfiles();
    loadUserGroups();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, filters, viewMode, saved, activeCity, activeSubArea, selectedNeighborhood, activeQuickFilters, listingTypeFilter]);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);

      try {
        const supabaseListings = await getListings(
          activeCity ? { city: activeCity } : undefined
        );
        if (supabaseListings && supabaseListings.length > 0) {
          const mapped: Property[] = supabaseListings.map((l: any) => mapListingToProperty(l));
          setProperties(mapped);
          setFilteredProperties(mapped);
          loadDiscoverableGroups(mapped);
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase getListings failed, falling back to StorageService:', supabaseErr);
      }

      await StorageService.initializeWithMockData();
      const allProperties = await StorageService.getProperties();
      setProperties(allProperties);
      setFilteredProperties(allProperties);
    } catch (err) {
      setError('Failed to load properties');
      console.error('Error loading properties:', err);
    } finally {
      setIsLoading(false);
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
      console.log('[ExploreScreen] Total users loaded:', users.length);
      const profileMap = new Map<string, User>();
      users.forEach(u => {
        console.log('[ExploreScreen] User:', u.id, 'role:', u.role, 'has profileData:', !!u.profileData, 'has profilePicture:', !!u.profilePicture);
        if ((u.role === 'renter' || u.role === 'host') && u.profileData) {
          profileMap.set(u.id, u);
        }
      });
      console.log('[ExploreScreen] Loaded host profiles:', profileMap.size, 'profiles');
      console.log('[ExploreScreen] Profile IDs:', Array.from(profileMap.keys()));
      setHostProfiles(profileMap);
    } catch (err) {
      console.error('Error loading host profiles:', err);
    }
  };

  const loadUserGroups = async () => {
    try {
      const groups = await StorageService.getGroups();
      if (!user?.id) { setUserGroups([]); return; }
      const mine = groups.filter(g => {
        const memberIds = Array.isArray(g.members)
          ? g.members.map((m: any) => typeof m === 'string' ? m : m.userId || m.id)
          : [];
        return g.createdBy === user.id || memberIds.includes(user.id);
      });
      setUserGroups(mine);
    } catch (err) {
      setUserGroups([]);
    }
  };

  const handleInquireAsGroup = (group: Group) => {
    setShowGroupPickerModal(false);
    setShowPropertyDetail(false);
    if (selectedProperty) {
      navigation.navigate('CreateGroup' as never, {
        listingId: selectedProperty.id,
        listingTitle: selectedProperty.title,
        listingBedrooms: selectedProperty.bedrooms || null,
        groupType: 'listing_inquiry',
        existingGroupId: group.id,
        existingGroupName: group.name,
      } as never);
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

      const interestRecord: InterestCard = {
        id: interestId,
        renterId: user.id,
        renterName: user.name,
        renterPhoto: user.profilePicture || '',
        hostId: selectedProperty.hostId,
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
      await StorageService.addInterestCard(interestRecord);

      const systemMessageText = isSuperInterest
        ? 'You sent a Super Interest. The host will see this at the top of their list.'
        : 'You expressed interest in this listing. Waiting for the host to respond.';
      const conversation: Conversation = {
        id: conversationId,
        participant: {
          id: selectedProperty.hostId,
          name: selectedProperty.hostName || 'Host',
          photo: selectedProperty.hostProfilePhoto || '',
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
        hostName: selectedProperty.hostName || 'Host',
        hostId: selectedProperty.hostId,
        propertyId: selectedProperty.id,
        isSoloInquiry: true,
      };
      await StorageService.addOrUpdateConversation(conversation);

      await StorageService.addNotification({
        id: `notif_interest_${Date.now()}`,
        userId: selectedProperty.hostId,
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

  const applyFilters = () => {
    let filtered = [...properties];

    filtered = filtered.filter(p => p.available);

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
      filtered = filtered.filter(p =>
        filters.amenities!.every(amenity =>
          p.amenities.some(a => a.toLowerCase() === amenity.toLowerCase())
        )
      );
    }

    if (listingTypeFilter !== 'any') {
      const TYPE_MAP: Record<string, string[]> = {
        room:   ['room', 'private_room', 'Private Room'],
        entire: ['entire', 'entire_unit', 'Entire Unit'],
        sublet: ['sublet', 'Sublet'],
      };
      const allowedValues = TYPE_MAP[listingTypeFilter] ?? [];
      filtered = filtered.filter(p =>
        allowedValues.some(v =>
          p.roomType?.toLowerCase() === v.toLowerCase() ||
          (p as any).listing_type?.toLowerCase() === v.toLowerCase() ||
          (p as any).type?.toLowerCase() === v.toLowerCase()
        )
      );
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
    if (activeQuickFilters.has('availableNow')) {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(p =>
        p.available === true ||
        (p as any).available_now === true ||
        (p as any).status === 'available' ||
        (p as any).status === 'active' ||
        ((p as any).move_in_date && (p as any).move_in_date <= today)
      );
    }

    const getHostPlanPriority = (property: Property) => {
      const host = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
      if (!host) return 0;
      const plan = (host as any).hostPlan || 'starter';
      if (plan === 'business') return 3;
      if (plan === 'pro') return 2;
      return 1;
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

      if (activeQuickFilters.has('bestMatch')) {
        if (user) {
          const hostA = a.hostProfileId ? hostProfiles.get(a.hostProfileId) : null;
          const hostB = b.hostProfileId ? hostProfiles.get(b.hostProfileId) : null;
          const profileA = hostA ? getUserAsRoommateProfile(hostA) : null;
          const profileB = hostB ? getUserAsRoommateProfile(hostB) : null;
          const compA = profileA ? calculateCompatibility(user, profileA) : 0;
          const compB = profileB ? calculateCompatibility(user, profileB) : 0;
          return compB - compA;
        }
        const scoreA = (a as any).matchScore ?? (a as any).match_score ?? (a as any).score ?? 0;
        const scoreB = (b as any).matchScore ?? (b as any).match_score ?? (b as any).score ?? 0;
        return scoreB - scoreA;
      }
      return 0;
    });

    const seen = new Set<string>();
    const deduped = filtered.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    setFilteredProperties(deduped);
  };

  const handleFilterPress = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    const hasActiveSubscription = (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
    
    if (!hasActiveSubscription) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPaywallFeature('Advanced Filters');
      setPaywallPlan('plus');
      setShowPaywall(true);
    } else {
      setTempFilters({ ...filters, listingType: listingTypeFilter });
      setShowFilterModal(true);
    }
  };

  const handleApplyFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (tempFilters.listingType) {
      setListingTypeFilter(tempFilters.listingType);
    }
    setFilters(tempFilters);
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters({});
    setFilters({});
    setListingTypeFilter('any');
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
    return hasModalFilters || listingTypeFilter !== 'any';
  };


  const toggleSave = async (id: string) => {
    if (!user?.id) return;
    
    const wasSaved = saved.has(id);
    
    const newSaved = new Set(saved);
    if (wasSaved) {
      newSaved.delete(id);
    } else {
      newSaved.add(id);
    }
    setSaved(newSaved);

    try {
      if (wasSaved) {
        await StorageService.unsaveProperty(user.id, id);
      } else {
        await StorageService.saveProperty(user.id, id);
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleListingTypeChip = (type: 'room' | 'entire' | 'sublet') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListingTypeFilter(prev => prev === type ? 'any' : type);
  };

  const isBasic = (user?.subscription?.plan || 'basic') === 'basic';


  const renderProperty = ({ item }: { item: Property }) => {
    const hostUser = item.hostProfileId ? hostProfiles.get(item.hostProfileId) : null;
    const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
    const compatibility = hostProfile && user ? calculateCompatibility(user, hostProfile) : null;
    const hostName = hostUser?.name || item.hostName || 'Host';
    const hostInitials = getInitials(hostName);
    const avatarGradient = getAvatarGradient(item.hostProfileId || item.id);
    const isPetFriendly = item.amenities?.some(a => a.toLowerCase().includes('pet'));
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
          </View>
        </View>
        <View style={styles.cardDetails}>
          <View style={styles.detailsRow}>
            <View style={styles.detailChips}>
              <View style={styles.detailChip}>
                <Feather name="home" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.detailChipText}>{item.bedrooms} bd{item.roomType === 'room' ? ' total' : ''}</Text>
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
            {isPetFriendly ? (
              <View style={styles.availBadge}>
                <Text style={styles.availBadgeText}>Pet OK</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.locationRow2}>
            <Feather name="map-pin" size={12} color="rgba(255,107,91,0.55)" />
            <Text style={styles.locationText}>{formatLocation(item)}</Text>
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
                {hostUser?.purchases?.hostVerificationBadge === true || hostUser?.verifiedBusiness ? (
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
                    ? hostUser?.agencyName ?? 'Licensed Agent'
                    : `Member · ${hostUser ? Math.max(1, (item.hostProfileId?.charCodeAt(0) || 0) % 6 + 1) : 1} listings`}
              </Text>
            </View>
            <View style={styles.respBadge}>
              <Text style={styles.respBadgeText}>Fast reply</Text>
            </View>
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
          ) : (
            <View style={styles.premiumRow}>
              <Feather name="lock" size={13} color="rgba(255,215,0,0.6)" />
              <Text style={styles.premiumText}>Upgrade to Plus to contact host & schedule a tour</Text>
            </View>
          )}
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

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.exploreHeaderRow, { paddingTop: insets.top + 12 }]}>
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
          style={styles.headerIconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDisplayMode(displayMode === 'list' ? 'map' : 'list');
          }}
        >
          <Feather name={displayMode === 'list' ? 'map' : 'list'} size={18} color="rgba(255,255,255,0.6)" />
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
          {QUICK_FILTERS.slice(0, 2).map(f => {
            const active = activeQuickFilters.has(f.key);
            return (
              <Pressable key={f.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => toggleQuickFilter(f.key)}>
                {f.icon ? <Feather name={f.icon} size={10} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} /> : null}
                <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{f.label}</Text>
              </Pressable>
            );
          })}
          {LISTING_TYPE_CHIPS.map(t => {
            const active = listingTypeFilter === t.key;
            return (
              <Pressable key={t.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => handleListingTypeChip(t.key)}>
                <Feather name={t.icon} size={11} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} />
                <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{t.label}</Text>
              </Pressable>
            );
          })}
          {QUICK_FILTERS.slice(2).map(f => {
            const active = activeQuickFilters.has(f.key);
            return (
              <Pressable key={f.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => toggleQuickFilter(f.key)}>
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
                const isActive = (tempFilters.listingType || 'any') === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.fmTypeCard, isActive && styles.fmTypeCardActive]}
                    onPress={() => setTempFilters({ ...tempFilters, listingType: opt.key })}
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
            <View style={styles.fmBudgetRow}>
              <View style={styles.fmBudgetBox}>
                <Text style={styles.fmBudgetLabel}>Min</Text>
                <TextInput
                  style={styles.fmBudgetValue}
                  placeholder="$0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  value={tempFilters.minPrice ? `$${tempFilters.minPrice}` : ''}
                  onChangeText={text => {
                    const num = text.replace(/[^0-9]/g, '');
                    setTempFilters({ ...tempFilters, minPrice: num ? parseInt(num) : undefined });
                  }}
                />
              </View>
              <Text style={styles.fmBudgetDash}>—</Text>
              <View style={styles.fmBudgetBox}>
                <Text style={styles.fmBudgetLabel}>Max</Text>
                <TextInput
                  style={styles.fmBudgetValue}
                  placeholder="$5000"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  value={tempFilters.maxPrice ? `$${tempFilters.maxPrice}` : ''}
                  onChangeText={text => {
                    const num = text.replace(/[^0-9]/g, '');
                    setTempFilters({ ...tempFilters, maxPrice: num ? parseInt(num) : undefined });
                  }}
                />
              </View>
            </View>

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
            <View style={styles.fmAmenitiesWrap}>
              {COMMON_AMENITIES.map(amenity => {
                const isSelected = tempFilters.amenities?.includes(amenity) || false;
                return (
                  <Pressable
                    key={amenity}
                    style={[styles.fmAmenityChip, isSelected && styles.fmAmenityChipActive]}
                    onPress={() => toggleAmenity(amenity)}
                  >
                    <Text style={[styles.fmAmenityText, isSelected && styles.fmAmenityTextActive]}>
                      {amenity}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
          (navigation as any).navigate('Payment');
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

                      {detailShowMatch && detailCompatibility !== null ? (
                        <Pressable
                          style={styles.pdMatchPill}
                          onPress={() => setShowMatchBreakdown(true)}
                        >
                          <Feather name="heart" size={13} color="#ff6b5b" />
                          <Text style={styles.pdMatchPillText}>{detailCompatibility}% Match</Text>
                          <Feather name="chevron-right" size={14} color="#ff6b5b" />
                        </Pressable>
                      ) : null}

                      {detailHostUser?.verifiedBusiness || detailHostUser?.purchases?.hostVerificationBadge ? (
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

                        {selectedProperty.transitInfo?.stops?.length > 0 ? (
                          <View style={styles.pdTransitSection}>
                            <Text style={styles.pdTransitTitle}>Nearby Transit</Text>
                            {selectedProperty.transitInfo.stops.slice(0, 3).map((stop: any, index: number) => (
                              <View key={index} style={styles.pdTransitRow}>
                                <Text style={{ fontSize: 15, width: 22 }}>
                                  {stop.type === 'subway' ? '\u{1F687}' : stop.type === 'bus' ? '\u{1F68C}' : stop.type === 'train' ? '\u{1F686}' : '\u{1F68F}'}
                                </Text>
                                <Text style={styles.pdTransitName} numberOfLines={1}>{stop.name}</Text>
                                <Text style={styles.pdTransitDist}>{stop.distanceMiles} mi</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

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

                    <View style={{ height: 100 }} />
                  </>
                );
              })() : null}
            </ScrollView>

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

                  {eligibleGroups.length > 0 ? (
                    <Pressable
                      style={styles.pdActionSecondary}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (eligibleGroups.length === 1) handleInquireAsGroup(eligibleGroups[0]);
                        else setShowGroupPickerModal(true);
                      }}
                    >
                      <Feather name="users" size={17} color="#ff6b5b" />
                      <Text style={styles.pdActionSecondaryText}>Group</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })() : null}

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
        onRequestClose={() => setShowLocationSheet(false)}
      >
        <Pressable style={styles.locSheetOverlay} onPress={() => setShowLocationSheet(false)} />
        <View style={styles.locSheet}>
          <View style={styles.locSheetHandle} />
          <Text style={styles.locSheetTitle}>Choose Location</Text>

          <Text style={styles.locSheetSectionLabel}>City</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
            contentContainerStyle={styles.locCityScroll}
          >
            <Pressable
              style={[styles.locCityChip, !activeCity && styles.locCityChipActive]}
              onPress={() => {
                setActiveCity(null);
                setSelectedNeighborhood(null);
                setActiveSubArea(null);
              }}
            >
              <Text style={[styles.locCityText, !activeCity && styles.locCityTextActive]}>All Cities</Text>
            </Pressable>
            {getAllCities().map((city) => (
              <Pressable
                key={city}
                style={[styles.locCityChip, activeCity === city && styles.locCityChipActive]}
                onPress={() => {
                  setActiveCity(city);
                  setSelectedNeighborhood(null);
                  setActiveSubArea(null);
                }}
              >
                <Text style={[styles.locCityText, activeCity === city && styles.locCityTextActive]}>
                  {city}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.locSheetSectionLabel}>Neighborhood</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.locNeighborhoodGrid}
            style={{ maxHeight: 300 }}
          >
            <Pressable
              style={[
                styles.locHoodChip,
                styles.locHoodChipAll,
                selectedNeighborhood === null && styles.locHoodChipActive,
              ]}
              onPress={() => {
                setSelectedNeighborhood(null);
                setShowLocationSheet(false);
              }}
            >
              <Text style={[styles.locHoodText, selectedNeighborhood === null && styles.locHoodTextActive]}>
                All Neighborhoods
              </Text>
            </Pressable>
            {(activeCity ? getNeighborhoodsByCity(activeCity) : []).map((hood) => (
              <Pressable
                key={hood}
                style={[
                  styles.locHoodChip,
                  selectedNeighborhood === hood && styles.locHoodChipActive,
                ]}
                onPress={() => {
                  setSelectedNeighborhood(hood);
                  setShowLocationSheet(false);
                }}
              >
                <Text style={[styles.locHoodText, selectedNeighborhood === hood && styles.locHoodTextActive]}>
                  {hood}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <InterestConfirmationModal
        visible={showInterestConfirmation}
        onClose={() => setShowInterestConfirmation(false)}
        isSuperInterest={confirmationWasSuper}
      />
      <RoomdrAISheet
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
                const memberCount = Array.isArray(g.members) ? g.members.length : 0;
                return (
                  <Pressable
                    key={g.id}
                    style={[styles.groupPickerItem, { borderColor: theme.border }]}
                    onPress={() => handleInquireAsGroup(g)}
                  >
                    <View style={styles.groupPickerItemLeft}>
                      <View style={[styles.groupPickerIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
                        <Feather name="users" size={16} color="#ff6b5b" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>{g.name}</ThemedText>
                        <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          {g.city ? ` \u00B7 ${g.city}` : ''}
                        </ThemedText>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
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
  fmAmenityChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  pdTransitSection: {
    marginTop: 8,
  },
  pdTransitTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  pdTransitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  pdTransitName: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  pdTransitDist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
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
});
