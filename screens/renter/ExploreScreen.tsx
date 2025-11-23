import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, FlatList, Modal, TextInput, ScrollView, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { WalkScoreBadge } from '../../components/WalkScoreBadge';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property, PropertyFilter, User, RoommateProfile } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { formatMoveInDate, calculateCompatibility, getMatchQualityColor, getGenderSymbol, formatLocation } from '../../utils/matchingAlgorithm';
import { NEIGHBORHOODS, getAllCities } from '../../utils/locationData';

const COMMON_AMENITIES = [
  'Parking', 'Gym', 'Pool', 'Laundry', 'Pet Friendly',
  'Air Conditioning', 'Dishwasher', 'Balcony',
];

export const ExploreScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [filters, setFilters] = useState<PropertyFilter>({});
  const [tempFilters, setTempFilters] = useState<PropertyFilter>({});
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showPropertyDetail, setShowPropertyDetail] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'saved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hostProfiles, setHostProfiles] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    loadProperties();
    loadSavedProperties();
    loadHostProfiles();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, filters, viewMode, saved, searchQuery]);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);
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

    const userCity = user?.profileData?.city;
    const query = searchQuery.toLowerCase().trim();
    
    const allCities = getAllCities();
    const allNeighborhoods = Object.keys(NEIGHBORHOODS);
    const allStates = ['NY'];
    const isSearchingLocation = filters.city || (query && (
      allCities.some(city => city.toLowerCase().includes(query) || query.includes(city.toLowerCase())) ||
      allNeighborhoods.some(n => n.toLowerCase().includes(query) || query.includes(n.toLowerCase())) ||
      allStates.some(state => state.toLowerCase() === query)
    ));
    
    if (userCity && !isSearchingLocation) {
      filtered = filtered.filter(p => p.city === userCity);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.city.toLowerCase().includes(query) ||
        p.state.toLowerCase().includes(query) ||
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
    if (filters.city) {
      filtered = filtered.filter(p => 
        p.city.toLowerCase().includes(filters.city!.toLowerCase())
      );
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

    filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });

    setFilteredProperties(filtered);
  };

  const handleFilterPress = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    const hasActiveSubscription = (userPlan === 'plus' || userPlan === 'priority') && userStatus === 'active';
    
    if (!hasActiveSubscription) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradePrompt(true);
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

  const renderProperty = ({ item }: { item: Property }) => {
    const hostUser = item.hostProfileId ? hostProfiles.get(item.hostProfileId) : null;
    const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
    const compatibility = hostProfile && user ? calculateCompatibility(user, hostProfile) : null;

    return (
      <Pressable
        style={[styles.propertyCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          setSelectedProperty(item);
          setShowPropertyDetail(true);
        }}
      >
        <Image source={{ uri: item.photos[0] }} style={styles.propertyImage} />
        <View style={styles.badgeContainer}>
          {item.propertyType ? (
            <View style={[
              styles.propertyTypeBadge,
              { backgroundColor: item.propertyType === 'lease' ? theme.primary : theme.success }
            ]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700' }]}>
                {item.propertyType.toUpperCase()}
              </ThemedText>
            </View>
          ) : null}
          <View style={[
            styles.roomTypeBadge,
            { backgroundColor: item.roomType === 'room' ? '#9333EA' : '#0EA5E9' }
          ]}>
            <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700' }]}>
              {item.roomType === 'room' ? 'ROOM' : 'ENTIRE'}
            </ThemedText>
          </View>
          {item.featured ? (
            <View style={[styles.featuredBadge, { backgroundColor: theme.primary }]}>
              <Feather name="star" size={12} color="#FFFFFF" />
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700', marginLeft: 4 }]}>
                FEATURED
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable
          style={[styles.saveButton, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => toggleSave(item.id)}
        >
          <Feather
            name={saved.has(item.id) ? 'heart' : 'heart'}
            size={20}
            color={saved.has(item.id) ? theme.error : theme.text}
            fill={saved.has(item.id) ? theme.error : 'none'}
          />
        </Pressable>
        <View style={styles.propertyInfo}>
          <ThemedText style={[Typography.h3]}>${item.price}/mo</ThemedText>
          <ThemedText style={[Typography.body, { marginTop: Spacing.xs }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          {item.roomType === 'room' && (hostUser || (item.existingRoommates && item.existingRoommates.length > 0)) ? (
            <View style={[styles.roommateGenderContainer, { marginTop: Spacing.sm }]}>
              <Feather 
                name="users" 
                size={14} 
                color={theme.textSecondary} 
              />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                {hostUser?.profileData?.gender ? getGenderSymbol(hostUser.profileData.gender) : ''}
                {item.existingRoommates && item.existingRoommates.length > 0 
                  ? item.existingRoommates.map((rm, idx) => getGenderSymbol(rm.gender)).join('')
                  : ''
                }
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.detailsRow}>
            <View style={styles.details}>
              <View style={styles.detail}>
                <Feather name="home" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                  {item.bedrooms} bd
                </ThemedText>
              </View>
              <View style={styles.detail}>
                <Feather name="droplet" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                  {item.bathrooms} ba
                </ThemedText>
              </View>
              <View style={styles.detail}>
                <Feather name="maximize" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                  {item.sqft} sqft
                </ThemedText>
              </View>
            </View>
            {item.walkScore ? (
              <WalkScoreBadge score={item.walkScore} size="small" />
            ) : null}
          </View>
          <View style={styles.locationRow}>
            <View style={styles.location}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                {formatLocation(item)}
              </ThemedText>
            </View>
            {compatibility !== null ? (
              <View style={[styles.matchBadge, { backgroundColor: getMatchQualityColor(compatibility) + '20' }]}>
                <ThemedText style={[Typography.caption, { color: getMatchQualityColor(compatibility), fontWeight: '700' }]}>
                  {compatibility}% Match
                </ThemedText>
              </View>
            ) : null}
          </View>
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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[
              Typography.body,
              {
                flex: 1,
                marginLeft: Spacing.md,
                color: theme.text,
                paddingVertical: 0,
              }
            ]}
            placeholder="Search location..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Feather name="x-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.filterButton} onPress={handleFilterPress}>
          <Feather name="sliders" size={24} color={theme.text} />
          {hasActiveFilters() ? (
            <View style={[styles.filterBadge, { backgroundColor: theme.primary }]} />
          ) : null}
        </Pressable>
      </View>
      
      <View style={styles.viewToggleContainer}>
        <Pressable
          style={[
            styles.viewToggleButton,
            viewMode === 'all' && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('all');
          }}
        >
          <ThemedText
            style={[
              Typography.body,
              { fontWeight: '600' },
              viewMode === 'all' ? { color: '#FFFFFF' } : { color: theme.text },
            ]}
          >
            All Properties
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.viewToggleButton,
            viewMode === 'saved' && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('saved');
          }}
        >
          <Feather
            name="heart"
            size={18}
            color={viewMode === 'saved' ? '#FFFFFF' : theme.text}
          />
          <ThemedText
            style={[
              Typography.body,
              { fontWeight: '600', marginLeft: Spacing.xs },
              viewMode === 'saved' ? { color: '#FFFFFF' } : { color: theme.text },
            ]}
          >
            Saved ({saved.size})
          </ThemedText>
        </Pressable>
      </View>

      {hasActiveFilters() ? (
        <View style={styles.filterBanner}>
          <View style={styles.filterBannerContent}>
            <Feather name="filter" size={16} color={theme.primary} />
            <ThemedText style={[Typography.small, { color: theme.primary, marginLeft: Spacing.xs }]}>
              {filteredProperties.length} properties match your filters
            </ThemedText>
          </View>
          <Pressable onPress={handleClearFilters}>
            <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
              Clear
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100, paddingTop: Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyStateInline}>
            <Feather name={viewMode === 'saved' ? 'heart' : 'home'} size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h2, { marginTop: Spacing.xl, textAlign: 'center' }]}>
              {viewMode === 'saved' ? 'No Saved Properties' : 'No Properties Available'}
            </ThemedText>
            {viewMode === 'saved' ? (
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                Save properties by tapping the heart icon
              </ThemedText>
            ) : null}
          </View>
        }
      />

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
              <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Location</ThemedText>
              <TextInput
                style={[styles.locationInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
                placeholder="Enter city..."
                placeholderTextColor={theme.textSecondary}
                value={tempFilters.city || ''}
                onChangeText={text => setTempFilters({ ...tempFilters, city: text })}
              />
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

      <Modal
        visible={showUpgradePrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradePrompt(false)}
      >
        <Pressable
          style={styles.upgradeOverlay}
          onPress={() => setShowUpgradePrompt(false)}
        >
          <Pressable
            style={[styles.upgradeModal, { backgroundColor: theme.backgroundDefault }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.upgradeIconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Feather name="filter" size={32} color={theme.primary} />
            </View>
            <ThemedText style={[Typography.h2, { textAlign: 'center', marginTop: Spacing.lg }]}>
              Advanced Filters
            </ThemedText>
            <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginTop: Spacing.sm }]}>
              Upgrade to Plus or Priority to unlock advanced property filters and find your perfect match faster.
            </ThemedText>
            <View style={styles.upgradeFeatures}>
              <View style={styles.upgradeFeature}>
                <Feather name="check" size={20} color={theme.success} />
                <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
                  Budget range filters
                </ThemedText>
              </View>
              <View style={styles.upgradeFeature}>
                <Feather name="check" size={20} color={theme.success} />
                <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
                  Bedroom & bathroom filters
                </ThemedText>
              </View>
              <View style={styles.upgradeFeature}>
                <Feather name="check" size={20} color={theme.success} />
                <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
                  Amenity preferences
                </ThemedText>
              </View>
            </View>
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setShowUpgradePrompt(false);
                (navigation as any).navigate('Profile', { screen: 'Payment' });
              }}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Upgrade Now
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowUpgradePrompt(false)} style={{ marginTop: Spacing.md }}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, fontWeight: '600' }]}>
                Maybe Later
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
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
                        console.log('[ExploreScreen] Property ID:', selectedProperty.id, 'Title:', selectedProperty.title);
                        console.log('[ExploreScreen] Property hostProfileId:', selectedProperty.hostProfileId);
                        console.log('[ExploreScreen] Host user found:', hostUser?.name, 'age:', hostUser?.age);
                        console.log('[ExploreScreen] Host photo URL:', hostPhoto);
                        console.log('[ExploreScreen] Host gender:', hostUser?.profileData?.gender);
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
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Host</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                          {(() => {
                            if (selectedProperty.hostProfileId) {
                              const hostUser = hostProfiles.get(selectedProperty.hostProfileId);
                              const age = hostUser?.age;
                              return age ? `${selectedProperty.hostName}, ${age}` : selectedProperty.hostName;
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

                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
  },
  filterButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
  },
  filterBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  propertyCard: {
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  propertyImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.medium,
  },
  saveButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  propertyTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  roomTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  roommateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  roommateGenderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compatibilityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  propertyInfo: {
    padding: Spacing.lg,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  details: {
    flexDirection: 'row',
    gap: Spacing.lg,
    flex: 1,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  matchBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
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
    resizeMode: 'cover',
  },
  detailSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
});
