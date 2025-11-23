import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export const MyListingsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<Property[]>([]);

  useEffect(() => {
    loadListings();
  }, [user]);

  const loadListings = async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    const allProperties = await StorageService.getProperties();
    const myListings = allProperties.filter(p => p.hostId === user.id);
    setListings(myListings);
  };

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
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;

    await StorageService.markPropertyAsRented(propertyId);
    await loadListings();
  };

  const markAsAvailable = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;

    await StorageService.markPropertyAsAvailable(propertyId);
    await loadListings();
  };

  const isPriority = user?.subscription?.plan === 'priority' && user?.subscription?.status === 'active';

  const renderListing = (listing: Property) => (
    <Pressable
      key={listing.id}
      style={[styles.listingCard, { backgroundColor: theme.backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: listing.photos[0] }} style={styles.listingImage} />
      <View style={[styles.statusBadge, { backgroundColor: listing.available ? theme.success : theme.warning }]}>
        <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
          {listing.available ? 'Active' : 'Inactive'}
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
              {listing.bedrooms} bd • {listing.bathrooms} ba
            </ThemedText>
          </View>
          {listing.walkScore ? (
            <View style={styles.detail}>
              <Feather name="navigation" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                Walk Score {listing.walkScore}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <Feather name="edit-2" size={16} color={theme.text} />
            <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Edit</ThemedText>
          </Pressable>
          {isPriority ? (
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
          <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <Feather name="users" size={16} color={theme.text} />
            <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Apps</ThemedText>
          </Pressable>
          {listing.available ? (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.warning }]} 
              onPress={() => markAsRented(listing.id)}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>Rented</ThemedText>
            </Pressable>
          ) : (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.success }]} 
              onPress={() => markAsAvailable(listing.id)}
            >
              <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>Available</ThemedText>
            </Pressable>
          )}
          <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]} onPress={() => {}}>
            <Feather name="share-2" size={16} color={theme.text} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScreenScrollView>
        <View style={styles.container}>
          {listings.map(listing => renderListing(listing))}
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
        onPress={() => {}}
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
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
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
