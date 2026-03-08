import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { WalkScoreBadge } from '../../components/WalkScoreBadge';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

type FilterStatus = 'all' | 'active' | 'paused' | 'rented';

const getListingStatus = (listing: Property): 'active' | 'paused' | 'rented' => {
  if (listing.rentedDate && !listing.available) return 'rented';
  if (!listing.available) return 'paused';
  return 'active';
};

export const MyListingsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [listings, setListings] = useState<Property[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const loadListings = useCallback(async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    await StorageService.assignPropertiesToHost(user.id, user.name);
    const allProperties = await StorageService.getProperties();
    const myListings = allProperties.filter(p => p.hostId === user.id);
    setListings(myListings);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  const filteredListings = listings.filter(listing => {
    if (filter === 'all') return true;
    return getListingStatus(listing) === filter;
  });

  const toggleFeatured = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;
    const updated = { ...property, featured: !property.featured };
    await StorageService.addOrUpdateProperty(updated);
    setListings(prev => prev.map(p => p.id === propertyId ? updated : p));
  };

  const markAsRented = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await StorageService.markPropertyAsRented(propertyId);
    await loadListings();
  };

  const markAsAvailable = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await StorageService.markPropertyAsAvailable(propertyId);
    await loadListings();
  };

  const pauseListing = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;
    const updated = { ...property, available: false, rentedDate: undefined };
    await StorageService.addOrUpdateProperty(updated);
    await loadListings();
  };

  const deleteListing = (propertyId: string) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await StorageService.deleteProperty(propertyId);
            await loadListings();
          },
        },
      ]
    );
  };

  const isElite = user?.subscription?.plan === 'elite' && user?.subscription?.status === 'active';

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'rented', label: 'Rented' },
  ];

  const getStatusBadgeColor = (listing: Property) => {
    const status = getListingStatus(listing);
    if (status === 'active') return theme.success;
    if (status === 'rented') return theme.warning;
    return theme.textSecondary;
  };

  const getStatusLabel = (listing: Property) => {
    const status = getListingStatus(listing);
    if (status === 'active') return 'Active';
    if (status === 'rented') return 'Rented';
    return 'Paused';
  };

  const renderListing = (listing: Property) => {
    const status = getListingStatus(listing);
    return (
      <Pressable
        key={listing.id}
        style={[styles.listingCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => navigation.navigate('CreateEditListing', { propertyId: listing.id })}
      >
        <Image source={{ uri: listing.photos[0] }} style={styles.listingImage} />
        <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(listing) }]}>
          <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
            {getStatusLabel(listing)}
          </ThemedText>
        </View>
        {listing.featured ? (
          <View style={[styles.featuredBadge, { backgroundColor: theme.primary }]}>
            <Feather name="star" size={12} color="#FFFFFF" />
            <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700', marginLeft: 4 }]}>
              FEATURED
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.listingInfo}>
          <ThemedText style={[Typography.h3]} numberOfLines={1}>{listing.title}</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.primary, marginTop: Spacing.xs }]}>
            ${listing.price}/mo
          </ThemedText>
          <View style={styles.listingDetails}>
            <View style={styles.detail}>
              <Feather name="home" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                {listing.bedrooms} bd {listing.bathrooms} ba
              </ThemedText>
            </View>
            {listing.walkScore ? (
              <WalkScoreBadge score={listing.walkScore} size="small" />
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => navigation.navigate('CreateEditListing', { propertyId: listing.id })}
            >
              <Feather name="edit-2" size={16} color={theme.text} />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Edit</ThemedText>
            </Pressable>
            {isElite ? (
              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: listing.featured ? theme.primary : theme.backgroundSecondary }
                ]}
                onPress={() => toggleFeatured(listing.id)}
              >
                <Feather name="star" size={16} color={listing.featured ? '#FFFFFF' : theme.text} />
                <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: listing.featured ? '#FFFFFF' : theme.text }]}>
                  {listing.featured ? 'Featured' : 'Feature'}
                </ThemedText>
              </Pressable>
            ) : null}
            {status === 'active' ? (
              <>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => pauseListing(listing.id)}
                >
                  <Feather name="pause-circle" size={16} color={theme.text} />
                  <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Pause</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.warning }]}
                  onPress={() => markAsRented(listing.id)}
                >
                  <Feather name="check-circle" size={16} color="#FFFFFF" />
                  <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>Rented</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.success }]}
                onPress={() => markAsAvailable(listing.id)}
              >
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>Available</ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.error }]}
              onPress={() => deleteListing(listing.id)}
            >
              <Feather name="trash-2" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScreenScrollView>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
            </ThemedText>
          </View>
          <View style={styles.filterRow}>
            {filterTabs.map(tab => (
              <Pressable
                key={tab.key}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filter === tab.key ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => setFilter(tab.key)}
              >
                <ThemedText
                  style={[
                    Typography.caption,
                    { color: filter === tab.key ? '#FFFFFF' : theme.text, fontWeight: filter === tab.key ? '600' : '400' },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {filteredListings.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="home" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
                No listings found
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                {filter === 'all' ? 'Tap the + button to create your first listing' : `No ${filter} listings`}
              </ThemedText>
            </View>
          ) : (
            filteredListings.map(listing => renderListing(listing))
          )}
        </View>
      </ScreenScrollView>
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: insets.bottom + 100,
          },
        ]}
        onPress={() => navigation.navigate('CreateEditListing')}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  headerRow: {
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  listingCard: {
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: 180,
  },
  statusBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  listingInfo: {
    padding: Spacing.lg,
  },
  listingDetails: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
