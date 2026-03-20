import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, Modal, TextInput, ScrollView, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
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
import { CityPickerModal, CityPillButton } from '../../components/CityPickerModal';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { getListings, mapListingToProperty } from '../../services/listingService';
import { getDiscoverableGroupsForListing } from '../../services/groupService';
import { Property, PropertyFilter, User, RoommateProfile, InterestCard, Conversation } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { formatMoveInDate, calculateCompatibility, getMatchQualityColor, getGenderSymbol, formatLocation } from '../../utils/matchingAlgorithm';
import { getZodiacSymbol } from '../../utils/zodiacUtils';
import { PropertyMapView } from '../../components/PropertyMapView';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import { useNotificationContext } from '../../contexts/NotificationContext';

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
  { key: 'privateRoom', label: 'Private Room' },
  { key: 'petFriendly', label: 'Pet Friendly' },
  { key: 'availableNow', label: 'Available Now' },
  { key: 'nearTransit', label: 'Near Transit' },
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
  const [viewMode, setViewMode] = useState<'all' | 'saved'>('all');
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const { activeCity, recentCities, setActiveCity } = useCityContext();
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
  const [showAISheet, setShowAISheet] = useState(false);
  const [interestNote, setInterestNote] = useState('');

  useEffect(() => {
    loadProperties();
    loadSavedProperties();
    loadHostProfiles();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, filters, viewMode, saved, searchQuery, activeCity, activeQuickFilters]);

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
    }, [loadInterestCards])
  );

  useEffect(() => {
    const viewListingId = route.params?.viewListingId;
    if (viewListingId && properties.length > 0) {
      const listing = properties.find(p => p.id === viewListingId);
      if (listing) {
        setSelectedProperty(listing);
        setShowPropertyDetail(true);
      }
      navigation.setParams({ viewListingId: undefined } as any);
    }
  }, [route.params?.viewListingId, properties]);

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
      Alert.alert('Error', 'Failed to send. Please try again.');
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
      filtered = filtered.filter(p => p.city === activeCity);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query) ||
        p.neighborhood?.toLowerCase().includes(query)
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

    if (activeQuickFilters.has('under2k')) {
      filtered = filtered.filter(p => p.price < 2000);
    }
    if (activeQuickFilters.has('privateRoom')) {
      filtered = filtered.filter(p => p.roomType === 'room');
    }
    if (activeQuickFilters.has('petFriendly')) {
      filtered = filtered.filter(p => p.amenities?.some(a => a.toLowerCase().includes('pet')));
    }
    if (activeQuickFilters.has('availableNow')) {
      filtered = filtered.filter(p => p.available);
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

    filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      const aFeatured = isFeaturedBoosted(a);
      const bFeatured = isFeaturedBoosted(b);
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;

      const aBoosted = isPropertyBoosted(a) && !aFeatured;
      const bBoosted = isPropertyBoosted(b) && !bFeatured;
      if (aBoosted && !bBoosted) return -1;
      if (!aBoosted && bBoosted) return 1;

      const planA = getHostPlanPriority(a);
      const planB = getHostPlanPriority(b);
      if (planA !== planB) return planB - planA;

      if (activeQuickFilters.has('bestMatch') && user) {
        const hostA = a.hostProfileId ? hostProfiles.get(a.hostProfileId) : null;
        const hostB = b.hostProfileId ? hostProfiles.get(b.hostProfileId) : null;
        const profileA = hostA ? getUserAsRoommateProfile(hostA) : null;
        const profileB = hostB ? getUserAsRoommateProfile(hostB) : null;
        const compA = profileA ? calculateCompatibility(user, profileA) : 0;
        const compB = profileB ? calculateCompatibility(user, profileB) : 0;
        return compB - compA;
      }
      return 0;
    });

    setFilteredProperties(filtered);
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
      setTempFilters({ ...filters });
      setShowFilterModal(true);
    }
  };

  const handleApplyFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFilters(tempFilters);
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters({});
    setFilters({});
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
    return Object.keys(filters).length > 0 && Object.values(filters).some(v => 
      v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
    );
  };

  const handleClearSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
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

  const isBasic = (user?.subscription?.plan || 'basic') === 'basic';


  const renderProperty = ({ item }: { item: Property }) => {
    const hostUser = item.hostProfileId ? hostProfiles.get(item.hostProfileId) : null;
    const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
    const compatibility = hostProfile && user ? calculateCompatibility(user, hostProfile) : null;
    const hostName = hostUser?.name || item.hostName || 'Host';
    const hostInitials = getInitials(hostName);
    const avatarGradient = getAvatarGradient(item.hostProfileId || item.id);
    const isPetFriendly = item.amenities?.some(a => a.toLowerCase().includes('pet'));

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
                <Feather name="star" size={9} color="#ffd700" />
                <Text style={[styles.tagText, { color: '#ffd700', marginLeft: 3 }]}>FEATURED</Text>
              </View>
            ) : null}
            {!item.featured &&
             item.listingBoost?.isActive &&
             item.listingBoost?.includesFeaturedBadge &&
             new Date(item.listingBoost.expiresAt) > new Date() ? (
              <View style={styles.boostFeaturedBadge}>
                <Feather name="star" size={9} color="#ffd700" />
                <Text style={[styles.tagText, { color: '#ffd700', marginLeft: 3 }]}>FEATURED</Text>
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
            {compatibility !== null ? (
              <View style={styles.matchScoreBadge}>
                <Feather name="heart" size={9} color="#ff8878" />
                <Text style={styles.matchScoreText}>{compatibility}% match</Text>
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
            {isPetFriendly ? (
              <View style={styles.availBadge}>
                <Text style={styles.availBadgeText}>Pet OK</Text>
              </View>
            ) : (
              <View style={styles.availBadge}>
                <Text style={styles.availBadgeText}>Available now</Text>
              </View>
            )}
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
                <Text style={styles.hostName}>{hostName.split(' ')[0]}{hostName.split(' ')[1]?.[0] ? ` ${hostName.split(' ')[1][0]}.` : ''}</Text>
                {hostUser?.purchases?.hostVerificationBadge === true ? (
                  <View style={styles.verifiedHostBadge}>
                    <Feather name="shield" size={10} color="#3ECF8E" />
                    <Text style={styles.verifiedHostText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.hostStatus}>Member · {hostUser ? Math.max(1, (item.hostProfileId?.charCodeAt(0) || 0) % 6 + 1) : 1} listings</Text>
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
      <View style={[styles.searchBarRow, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => setShowAISheet(true)} style={styles.aiNavBtn}>
          <View style={styles.aiNavBtnInner}>
            <Feather name="cpu" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
        <View style={styles.searchInput}>
          <Feather name="search" size={15} color="rgba(255,255,255,0.3)" />
          <TextInput
            style={styles.searchInputText}
            placeholder={activeCity ? `Search in ${activeCity}...` : 'Search neighborhoods, streets...'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Feather name="x-circle" size={16} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDisplayMode(displayMode === 'list' ? 'map' : 'list');
          }}
        >
          <Feather name={displayMode === 'list' ? 'map' : 'list'} size={18} color="rgba(255,255,255,0.55)" />
        </Pressable>
        <Pressable style={styles.filterBtn} onPress={handleFilterPress}>
          <Feather name="sliders" size={17} color={ACCENT} />
          {hasActiveFilters() ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>
      <View style={styles.cityRow}>
        <CityPillButton activeCity={activeCity} onPress={() => setShowCityPicker(true)} />
        <Text style={styles.listingCount}>{filteredProperties.length} listings</Text>
      </View>

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
              <Feather name="heart" size={13} color="#fff" />
              <Text style={styles.tabActiveText}>Saved ({saved.size})</Text>
            </LinearGradient>
          ) : (
            <>
              <Feather name="heart" size={13} color="rgba(255,255,255,0.4)" />
              <Text style={styles.tabInactiveText}>Saved ({saved.size})</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.chipScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollContent}>
          {QUICK_FILTERS.map(f => {
            const active = activeQuickFilters.has(f.key);
            return (
              <Pressable key={f.key} style={active ? styles.chipSelected : styles.chipUnselected} onPress={() => toggleQuickFilter(f.key)}>
                {f.icon ? <Feather name={f.icon} size={10} color={active ? '#ff8070' : 'rgba(255,255,255,0.4)'} /> : null}
                <Text style={active ? styles.chipSelectedText : styles.chipUnselectedText}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
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
            setShowPropertyDetail(true);
          }}
          onToggleSave={toggleSave}
          bottomInset={insets.bottom}
        />
      ) : (
        <FlatList
          data={filteredProperties}
          renderItem={renderProperty}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100, paddingTop: Spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
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
                        setShowPropertyDetail(true);
                      }}
                    >
                      <Image source={{ uri: item.photos[0] }} style={styles.featuredPhoto} />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.featuredGradient}>
                        <Text style={styles.featuredPrice}>${item.price?.toLocaleString()}/mo</Text>
                        <Text style={styles.featuredName} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.featuredBadge}>
                          <Feather name="star" size={8} color="#ffd700" />
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
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={Typography.h2}>Filters</ThemedText>
            <Pressable onPress={handleClearFilters}>
              <ThemedText style={[Typography.body, { color: theme.primary, fontWeight: '600' }]}>Clear</ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Budget Range</ThemedText>
              <View style={styles.budgetInputs}>
                <View style={[styles.budgetInput, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Min</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="$0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={tempFilters.minPrice?.toString() || ''}
                    onChangeText={text => setTempFilters({ ...tempFilters, minPrice: text ? parseInt(text) : undefined })}
                  />
                </View>
                <ThemedText style={{ color: theme.textSecondary }}>—</ThemedText>
                <View style={[styles.budgetInput, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Max</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="$5000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={tempFilters.maxPrice?.toString() || ''}
                    onChangeText={text => setTempFilters({ ...tempFilters, maxPrice: text ? parseInt(text) : undefined })}
                  />
                </View>
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Rooms</ThemedText>
              <View style={styles.roomsRow}>
                <View style={styles.roomInput}>
                  <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>Bedrooms</ThemedText>
                  <View style={styles.counterRow}>
                    <Pressable
                      style={[styles.counterButton, { backgroundColor: theme.backgroundDefault }]}
                      onPress={() => setTempFilters({ ...tempFilters, minBedrooms: Math.max(0, (tempFilters.minBedrooms || 0) - 1) })}
                    >
                      <Feather name="minus" size={20} color={theme.text} />
                    </Pressable>
                    <ThemedText style={[Typography.h3, { marginHorizontal: Spacing.lg }]}>
                      {tempFilters.minBedrooms || 0}+
                    </ThemedText>
                    <Pressable
                      style={[styles.counterButton, { backgroundColor: theme.backgroundDefault }]}
                      onPress={() => setTempFilters({ ...tempFilters, minBedrooms: (tempFilters.minBedrooms || 0) + 1 })}
                    >
                      <Feather name="plus" size={20} color={theme.text} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.roomInput}>
                  <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>Bathrooms</ThemedText>
                  <View style={styles.counterRow}>
                    <Pressable
                      style={[styles.counterButton, { backgroundColor: theme.backgroundDefault }]}
                      onPress={() => setTempFilters({ ...tempFilters, minBathrooms: Math.max(0, (tempFilters.minBathrooms || 0) - 0.5) })}
                    >
                      <Feather name="minus" size={20} color={theme.text} />
                    </Pressable>
                    <ThemedText style={[Typography.h3, { marginHorizontal: Spacing.lg }]}>
                      {tempFilters.minBathrooms || 0}+
                    </ThemedText>
                    <Pressable
                      style={[styles.counterButton, { backgroundColor: theme.backgroundDefault }]}
                      onPress={() => setTempFilters({ ...tempFilters, minBathrooms: (tempFilters.minBathrooms || 0) + 0.5 })}
                    >
                      <Feather name="plus" size={20} color={theme.text} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Amenities</ThemedText>
              <View style={styles.amenitiesGrid}>
                {COMMON_AMENITIES.map(amenity => {
                  const isSelected = tempFilters.amenities?.includes(amenity) || false;
                  return (
                    <Pressable
                      key={amenity}
                      style={[
                        styles.amenityChip,
                        { 
                          backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                          borderColor: isSelected ? theme.primary : theme.border,
                        }
                      ]}
                      onPress={() => toggleAmenity(amenity)}
                    >
                      <ThemedText
                        style={[
                          Typography.small,
                          { color: isSelected ? '#FFFFFF' : theme.text }
                        ]}
                      >
                        {amenity}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.lg }]}>
            <Pressable
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={handleApplyFilters}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Apply Filters
              </ThemedText>
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
          (navigation as any).navigate('Profile', { screen: 'Payment' });
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
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.detailHeader}>
              <ThemedText style={[Typography.h2]}>Property Details</ThemedText>
              <Pressable onPress={() => setShowPropertyDetail(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
              {selectedProperty ? (
                <>
                  <Image source={{ uri: selectedProperty.photos[0] }} style={styles.detailImage} />
                  
                  <View style={styles.detailSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText style={[Typography.h1]}>${selectedProperty.price}/mo</ThemedText>
                      {selectedProperty.featured ? (
                        <View style={[styles.featuredBadge, { backgroundColor: theme.primary }]}>
                          <Feather name="star" size={12} color="#FFFFFF" />
                          <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700', marginLeft: 4 }]}>
                            FEATURED
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={[Typography.h3, { marginTop: Spacing.sm }]}>
                      {selectedProperty.title}
                    </ThemedText>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      {(() => {
                        const hostUser = selectedProperty.hostProfileId ? hostProfiles.get(selectedProperty.hostProfileId) : null;
                        const hostPhoto = hostUser?.profilePicture;
                        return hostPhoto ? (
                          <Image 
                            source={{ uri: hostPhoto }} 
                            style={{ width: 48, height: 48, borderRadius: 24 }} 
                          />
                        ) : (
                          <View style={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: 24, 
                            backgroundColor: theme.backgroundSecondary, 
                            justifyContent: 'center', 
                            alignItems: 'center' 
                          }}>
                            <Feather name="user" size={24} color={theme.textSecondary} />
                          </View>
                        );
                      })()}
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                          Host
                        </ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                          {(() => {
                            if (selectedProperty.hostProfileId) {
                              const hostUser = hostProfiles.get(selectedProperty.hostProfileId);
                              const age = hostUser?.age;
                              const zodiacSign = hostUser?.zodiacSign;
                              const ageText = age ? `, ${age}` : '';
                              const zodiacText = zodiacSign ? ` ${getZodiacSymbol(zodiacSign)}` : '';
                              return `${selectedProperty.hostName}${ageText}${zodiacText}`;
                            }
                            return selectedProperty.hostName;
                          })()}
                        </ThemedText>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                          {(() => {
                            if (selectedProperty.hostProfileId) {
                              const hostUser = hostProfiles.get(selectedProperty.hostProfileId);
                              return hostUser?.profileData?.gender ? getGenderSymbol(hostUser.profileData.gender) : '';
                            }
                            return '';
                          })()}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Description</ThemedText>
                    <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                      {selectedProperty.description}
                    </ThemedText>
                  </View>

                  <View style={styles.detailSection}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Details</ThemedText>
                    {selectedProperty.propertyType ? (
                      <View style={styles.detailRow}>
                        <Feather name="file-text" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Property Type</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600', textTransform: 'capitalize' }]}>
                            {selectedProperty.propertyType}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Feather name="grid" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Room Type</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600', textTransform: 'capitalize' }]}>
                          {selectedProperty.roomType === 'room' ? 'Room' : 'Entire Apartment'}
                        </ThemedText>
                      </View>
                    </View>
                    {selectedProperty.roomType === 'room' && selectedProperty.existingRoommates && selectedProperty.existingRoommates.filter(rm => rm.onApp && rm.userId).length > 0 ? (
                      <View style={styles.detailRow}>
                        <Feather name="users" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Roommates on App</ThemedText>
                          {selectedProperty.existingRoommates.filter(rm => rm.onApp && rm.userId).map((rm, idx) => {
                            const roommateUser = hostProfiles.get(rm.userId!);
                            return (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: idx > 0 ? Spacing.md : Spacing.sm }}>
                                {roommateUser?.profilePicture ? (
                                  <Image 
                                    source={{ uri: roommateUser.profilePicture }} 
                                    style={styles.roommateProfilePicture} 
                                  />
                                ) : (
                                  <View style={[styles.roommateProfilePicture, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Feather name="user" size={20} color={theme.textSecondary} />
                                  </View>
                                )}
                                <View style={{ marginLeft: Spacing.md }}>
                                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                                    {roommateUser?.name || 'User'}
                                  </ThemedText>
                                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                                    {getGenderSymbol(rm.gender)}
                                  </ThemedText>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    {selectedProperty.roomType === 'room' && selectedProperty.existingRoommates && selectedProperty.existingRoommates.filter(rm => !rm.onApp).length > 0 ? (
                      <View style={styles.detailRow}>
                        <Feather name="user-x" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Other Roommates</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                            {selectedProperty.existingRoommates.filter(rm => !rm.onApp).map((rm) => getGenderSymbol(rm.gender)).join('')}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                    {selectedProperty.roomType === 'room' && selectedProperty.hostProfileId && hostProfiles.get(selectedProperty.hostProfileId) ? (
                      <View style={styles.detailRow}>
                        <Feather name="target" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Compatibility</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                            {(() => {
                              const hostUser = hostProfiles.get(selectedProperty.hostProfileId!);
                              const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
                              return hostProfile && user ? calculateCompatibility(user, hostProfile) : 0;
                            })()}% Match
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Feather name={selectedProperty.roomType === 'entire' ? 'home' : 'key'} size={20} color={selectedProperty.roomType === 'entire' ? '#a78bfa' : '#60a5fa'} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Listing Type</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600', color: selectedProperty.roomType === 'entire' ? '#a78bfa' : '#60a5fa' }]}>
                          {selectedProperty.roomType === 'entire' ? 'Entire Place' : 'Private Room'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="home" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Bedrooms</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{selectedProperty.bedrooms}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="droplet" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Bathrooms</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{selectedProperty.bathrooms}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="maximize" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Square Feet</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{selectedProperty.sqft} sqft</ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Location</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                          {formatLocation(selectedProperty)}
                        </ThemedText>
                      </View>
                    </View>
                    {selectedProperty.walkScore ? (
                      (() => {
                        const userPlan = user?.subscription?.plan || 'basic';
                        const hasWalkScoreAccess = userPlan === 'plus' || userPlan === 'elite';
                        
                        return hasWalkScoreAccess ? (
                          <View style={styles.detailRow}>
                            <WalkScoreBadge score={selectedProperty.walkScore} size="large" />
                            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
                              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                                {
                                  selectedProperty.walkScore >= 90 ? "Walker's Paradise" :
                                  selectedProperty.walkScore >= 70 ? "Very Walkable" :
                                  selectedProperty.walkScore >= 50 ? "Somewhat Walkable" :
                                  "Car-Dependent"
                                }
                              </ThemedText>
                              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                                Daily errands do not require a car
                              </ThemedText>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            style={styles.detailRow}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setShowPropertyDetail(false);
                              setPaywallFeature('Walk Score');
                              setPaywallPlan('plus');
                              setShowPaywall(true);
                            }}
                          >
                            <View style={{
                              width: 80,
                              height: 80,
                              borderRadius: 40,
                              borderWidth: 4,
                              borderColor: theme.textSecondary + '40',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}>
                              <Feather name="lock" size={32} color={theme.textSecondary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
                              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Walk Score</ThemedText>
                              <ThemedText style={[Typography.caption, { color: theme.primary, marginTop: Spacing.xs }]}>
                                Upgrade to Plus to see walkability ratings
                              </ThemedText>
                            </View>
                          </Pressable>
                        );
                      })()
                    ) : null}
                    {selectedProperty.transitInfo ? (
                      <View style={styles.transitSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                          <Feather name="navigation" size={16} color={theme.primary} />
                          <ThemedText style={[Typography.body, { fontWeight: '600', marginLeft: Spacing.sm }]}>Nearby Transit</ThemedText>
                        </View>
                        {selectedProperty.transitInfo.manualOverride ? (
                          <ThemedText style={[Typography.body, { color: theme.textSecondary, fontStyle: 'italic', lineHeight: 20 }]}>
                            {selectedProperty.transitInfo.manualOverride}
                          </ThemedText>
                        ) : selectedProperty.transitInfo.stops.length > 0 ? (
                          selectedProperty.transitInfo.stops.slice(0, 3).map((stop, index) => (
                            <View key={index} style={styles.transitItem}>
                              <ThemedText style={{ fontSize: 16, width: 24 }}>
                                {stop.type === 'subway' ? '\u{1F687}' : stop.type === 'bus' ? '\u{1F68C}' : stop.type === 'train' ? '\u{1F686}' : stop.type === 'tram' ? '\u{1F68A}' : stop.type === 'ferry' ? '\u{26F4}' : '\u{1F68F}'}
                              </ThemedText>
                              <ThemedText style={[Typography.body, { flex: 1 }]} numberOfLines={1}>{stop.name}</ThemedText>
                              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.sm }]}>
                                {stop.distanceMiles} mi
                              </ThemedText>
                            </View>
                          ))
                        ) : (
                          <View style={styles.transitItem}>
                            <Feather name="info" size={14} color={theme.textSecondary} />
                            <ThemedText style={[Typography.caption, { color: theme.textSecondary, fontStyle: 'italic', marginLeft: Spacing.sm }]}>
                              No public transit nearby
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    ) : null}
                    {selectedProperty.availableDate ? (
                      <View style={styles.detailRow}>
                        <Feather name="calendar" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Available Date</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                            {formatMoveInDate(selectedProperty.availableDate.toString())}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.detailSection}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Amenities</ThemedText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                      {selectedProperty.amenities.map((amenity, index) => (
                        <View
                          key={index}
                          style={[styles.amenityChip, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
                        >
                          <ThemedText style={[Typography.small, { color: theme.primary }]}>{amenity}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.detailSection, { paddingBottom: Spacing.xl }]}>
                    {(() => {
                      const interest = interestMap.get(selectedProperty.id);
                      if (interest?.status === 'pending') {
                        return (
                          <View style={[styles.interestStatusBadge, { backgroundColor: '#FFA50020', borderColor: '#FFA500' }]}>
                            <Feather name="clock" size={18} color="#FFA500" />
                            <ThemedText style={{ color: '#FFA500', fontWeight: '700', marginLeft: Spacing.sm, fontSize: 15 }}>
                              Pending Response
                            </ThemedText>
                          </View>
                        );
                      }
                      if (interest?.status === 'accepted') {
                        return (
                          <Pressable
                            style={[styles.interestButton, { backgroundColor: '#22c55e' }]}
                            onPress={() => {
                              setShowPropertyDetail(false);
                              navigation.navigate('Messages' as never);
                            }}
                          >
                            <Feather name="message-circle" size={18} color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.sm, fontSize: 15 }}>
                              Accepted — Chat Now
                            </ThemedText>
                          </Pressable>
                        );
                      }
                      if (interest?.status === 'passed') {
                        return (
                          <View style={[styles.interestStatusBadge, { backgroundColor: '#66666620', borderColor: '#666' }]}>
                            <Feather name="x-circle" size={18} color="#666" />
                            <ThemedText style={{ color: '#666', fontWeight: '700', marginLeft: Spacing.sm, fontSize: 15 }}>
                              Passed
                            </ThemedText>
                          </View>
                        );
                      }
                      return (
                        <View>
                          <Pressable
                            style={[styles.interestButton, { backgroundColor: isSuperInterest ? '#FFD700' : '#ff6b5b' }]}
                            onPress={handleInterestPress}
                          >
                            <Feather name={isSuperInterest ? 'star' : 'heart'} size={18} color={isSuperInterest ? '#000' : '#fff'} />
                            <ThemedText style={{ color: isSuperInterest ? '#000' : '#fff', fontWeight: '700', marginLeft: Spacing.sm, fontSize: 15 }}>
                              {isSuperInterest ? 'Super Interest' : "I'm Interested"}
                            </ThemedText>
                            {canSendSuperInterest().canSend ? (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setIsSuperInterest(!isSuperInterest);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                style={[styles.superInterestToggle, isSuperInterest ? { backgroundColor: 'rgba(0,0,0,0.2)' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                              >
                                <Feather name="star" size={14} color={isSuperInterest ? '#000' : '#fff'} />
                              </Pressable>
                            ) : null}
                          </Pressable>
                          {canSendSuperInterest().canSend ? (
                            <ThemedText style={{ color: isSuperInterest ? '#FFD700' : 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                              {isSuperInterest ? 'Super Interest — Bumped to top!' : 'Tap the star for Super Interest'}
                            </ThemedText>
                          ) : null}
                        </View>
                      );
                    })()}
                  </View>

                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CityPickerModal
        visible={showCityPicker}
        activeCity={activeCity}
        recentCities={recentCities}
        onCitySelect={(city) => { setActiveCity(city); setShowCityPicker(false); }}
        onClose={() => setShowCityPicker(false)}
      />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  aiNavBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiNavBtnInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff4d4d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInputText: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 13,
    paddingVertical: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listingCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 10,
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
  chipScrollWrapper: {
    height: 38,
    marginBottom: 8,
    overflow: 'visible',
  },
  chipScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chipSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    gap: 5,
  },
  chipUnselected: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 5,
  },
  chipSelectedText: {
    color: '#ff8070',
    fontSize: 12,
    fontWeight: '600',
  },
  chipUnselectedText: {
    color: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(255,215,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagFeatured: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
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
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
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
  },
  featuredBadgeText: {
    color: '#ffd700',
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  filterSection: {
    paddingVertical: Spacing.lg,
  },
  budgetInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  budgetInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  locationInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    fontSize: 16,
  },
  roomsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  roomInput: {
    flex: 1,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  amenityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  interestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  interestStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  superInterestToggle: {
    marginLeft: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  applyButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
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
  detailModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailContent: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: 300,
  },
  detailSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  transitSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  transitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  roommateProfilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
});
