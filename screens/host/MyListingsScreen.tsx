import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockProperties } from '../../utils/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MyListingsScreen = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState(mockProperties);

  const renderListing = (listing: any) => (
    <Pressable
      key={listing.id}
      style={[styles.listingCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: listing.photos[0] }} style={styles.listingImage} />
      <View style={[styles.statusBadge, { backgroundColor: listing.available ? Colors[theme].success : Colors[theme].warning }]}>
        <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
          {listing.available ? 'Active' : 'Inactive'}
        </ThemedText>
      </View>
      <View style={styles.listingInfo}>
        <ThemedText style={[Typography.h3]} numberOfLines={1}>{listing.title}</ThemedText>
        <ThemedText style={[Typography.body, { color: Colors[theme].primary, marginTop: Spacing.xs }]}>
          ${listing.price}/mo
        </ThemedText>
        <View style={styles.listingDetails}>
          <View style={styles.detail}>
            <Feather name="home" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              {listing.bedrooms} bd • {listing.bathrooms} ba
            </ThemedText>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, { backgroundColor: Colors[theme].backgroundSecondary }]} onPress={() => {}}>
            <Feather name="edit-2" size={16} color={Colors[theme].text} />
            <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Edit</ThemedText>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: Colors[theme].backgroundSecondary }]} onPress={() => {}}>
            <Feather name="users" size={16} color={Colors[theme].text} />
            <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>Applications</ThemedText>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: Colors[theme].backgroundSecondary }]} onPress={() => {}}>
            <Feather name="share-2" size={16} color={Colors[theme].text} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors[theme].backgroundRoot }}>
      <ScreenScrollView>
        <View style={styles.container}>
          {listings.map(listing => renderListing(listing))}
        </View>
      </ScreenScrollView>
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: Colors[theme].primary,
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
