import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Image, Platform, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Property, User, RoommateProfile } from '../types/models';
import { Feather } from '@expo/vector-icons';
import { formatLocation, getMatchQualityColor, calculateCompatibility } from '../utils/matchingAlgorithm';

interface PropertyMapViewProps {
  properties: Property[];
  saved: Set<string>;
  hostProfiles: Map<string, User>;
  currentUser: User | null;
  onPropertyPress: (property: Property) => void;
  onToggleSave: (id: string) => void;
  bottomInset: number;
}

function getUserAsRoommateProfile(user: User): RoommateProfile {
  return {
    id: user.id,
    name: user.name || 'Unknown',
    age: user.age || 25,
    gender: user.profileData?.gender || 'other',
    occupation: user.profileData?.occupation || '',
    location: user.profileData?.location || { neighborhood: '', city: '', state: '' },
    budget: user.profileData?.budget || 1500,
    moveInDate: user.profileData?.moveInDate || '',
    bio: user.profileData?.bio || '',
    interests: user.profileData?.interests || '',
    profilePicture: user.profilePicture || '',
    photos: user.photos || [],
    zodiacSign: user.zodiacSign,
    preferences: user.profileData?.preferences || {
      sleepSchedule: 'flexible',
      cleanliness: 'moderate',
      guestPolicy: 'sometimes',
      noiseTolerance: 'moderate',
      smoking: 'no',
      workLocation: 'hybrid',
      roommateRelationship: 'occasional_hangouts',
      pets: 'no_pets',
    },
    matchPreferences: user.profileData?.matchPreferences,
    dateOfBirth: user.dateOfBirth,
  };
}

export const PropertyMapView = ({
  properties,
  saved,
  hostProfiles,
  currentUser,
  onPropertyPress,
  onToggleSave,
  bottomInset,
}: PropertyMapViewProps) => {
  const { theme } = useTheme();

  const propertiesWithCoords = useMemo(
    () => properties.filter(p => p.coordinates?.lat && p.coordinates?.lng),
    [properties]
  );

  const initialRegion = useMemo(() => {
    if (propertiesWithCoords.length === 0) {
      return { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }
    const lats = propertiesWithCoords.map(p => p.coordinates!.lat);
    const lngs = propertiesWithCoords.map(p => p.coordinates!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.3, 0.01);
    const padLng = Math.max((maxLng - minLng) * 0.3, 0.01);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + padLat,
      longitudeDelta: maxLng - minLng + padLng,
    };
  }, [propertiesWithCoords]);

  if (Platform.OS === 'web') {
    return (
      <ScrollView
        style={styles.webFallbackScroll}
        contentContainerStyle={[styles.webFallback, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.webBanner}>
          <Feather name="map" size={24} color={theme.primary} />
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.md, flex: 1 }]}>
            Map view is available on iOS and Android. Showing properties as a list.
          </ThemedText>
        </View>
        {properties.map(property => {
          const hostUser = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
          const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
          const compatibility = hostProfile && currentUser ? calculateCompatibility(currentUser, hostProfile) : null;

          return (
            <Pressable
              key={property.id}
              style={[styles.webPropertyCard, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
              onPress={() => onPropertyPress(property)}
            >
              <Image source={{ uri: property.photos[0] }} style={styles.webPropertyImage} />
              <View style={styles.webPropertyInfo}>
                <ThemedText style={[Typography.body, { fontWeight: '700' }]}>${property.price}/mo</ThemedText>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]} numberOfLines={1}>
                  {formatLocation(property)}
                </ThemedText>
                <View style={styles.webPropertyMeta}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    {property.bedrooms}bd {property.bathrooms}ba
                  </ThemedText>
                  {compatibility !== null ? (
                    <View style={[styles.miniMatchBadge, { backgroundColor: getMatchQualityColor(compatibility) + '20' }]}>
                      <ThemedText style={[Typography.caption, { color: getMatchQualityColor(compatibility), fontWeight: '700', fontSize: 11 }]}>
                        {compatibility}%
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
              <Pressable style={styles.webSaveBtn} onPress={() => onToggleSave(property.id)}>
                <Feather name="heart" size={16} color={saved.has(property.id) ? '#EF4444' : theme.textSecondary} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  const MapView = require('react-native-maps').default;
  const { Marker, Callout } = require('react-native-maps');

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsCompass={true}
        showsScale={true}
      >
        {propertiesWithCoords.map(property => {
          const hostUser = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
          const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
          const compatibility = hostProfile && currentUser ? calculateCompatibility(currentUser, hostProfile) : null;

          return (
            <Marker
              key={property.id}
              coordinate={{
                latitude: property.coordinates!.lat,
                longitude: property.coordinates!.lng,
              }}
              pinColor={saved.has(property.id) ? '#EF4444' : theme.primary}
            >
              <Callout tooltip onPress={() => onPropertyPress(property)}>
                <View style={[styles.callout, { backgroundColor: theme.backgroundDefault }]}>
                  <Image source={{ uri: property.photos[0] }} style={styles.calloutImage} />
                  <View style={styles.calloutInfo}>
                    <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
                      ${property.price}/mo
                    </ThemedText>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]} numberOfLines={1}>
                      {property.title}
                    </ThemedText>
                    <View style={styles.calloutMeta}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                        {property.bedrooms}bd {property.bathrooms}ba
                      </ThemedText>
                      {compatibility !== null ? (
                        <View style={[styles.miniMatchBadge, { backgroundColor: getMatchQualityColor(compatibility) + '20' }]}>
                          <ThemedText style={[Typography.caption, { color: getMatchQualityColor(compatibility), fontWeight: '700', fontSize: 11 }]}>
                            {compatibility}%
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    style={styles.calloutSave}
                    onPress={() => onToggleSave(property.id)}
                  >
                    <Feather name="heart" size={16} color={saved.has(property.id) ? '#EF4444' : theme.textSecondary} />
                  </Pressable>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
      <View style={[styles.propertyCount, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="map-pin" size={14} color={theme.primary} />
        <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.xs, fontWeight: '600' }]}>
          {propertiesWithCoords.length} {propertiesWithCoords.length === 1 ? 'property' : 'properties'}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  propertyCount: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callout: {
    width: 240,
    borderRadius: BorderRadius.medium,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutImage: {
    width: 240,
    height: 120,
    resizeMode: 'cover',
  },
  calloutInfo: {
    padding: Spacing.md,
  },
  calloutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  calloutSave: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMatchBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  webFallbackScroll: {
    flex: 1,
  },
  webFallback: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  webPropertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webPropertyImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  webPropertyInfo: {
    flex: 1,
    padding: Spacing.md,
  },
  webPropertyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  webSaveBtn: {
    padding: Spacing.md,
  },
});
