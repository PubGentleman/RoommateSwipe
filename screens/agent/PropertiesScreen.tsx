import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property } from '../../types/models';

export const PropertiesScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    loadProperties();
  }, [user]);

  const loadProperties = async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    const allProperties = await StorageService.getProperties();
    const myProperties = allProperties.filter(p => p.hostId === user.id);
    setProperties(myProperties);
  };

  const markAsRented = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = properties.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;

    await StorageService.markPropertyAsRented(propertyId);
    await loadProperties();
  };

  const markAsAvailable = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = properties.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;

    await StorageService.markPropertyAsAvailable(propertyId);
    await loadProperties();
  };

  const renderProperty = (property: Property) => (
    <Pressable
      key={property.id}
      style={[styles.propertyCard, { backgroundColor: theme.backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: property.photos[0] }} style={styles.propertyImage} />
      <View style={[styles.statusBadge, { backgroundColor: property.available ? theme.success : theme.warning }]}>
        <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
          {property.available ? 'Active' : 'Inactive'}
        </ThemedText>
      </View>
      <View style={styles.propertyInfo}>
        <View style={styles.propertyHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[Typography.h3]} numberOfLines={1}>{property.title}</ThemedText>
            <ThemedText style={[Typography.body, { color: theme.primary, marginTop: Spacing.xs }]}>
              ${property.price}/mo
            </ThemedText>
          </View>
          <View style={[styles.verificationBadge, { backgroundColor: theme.success }]}>
            <Feather name="check-circle" size={16} color="#FFFFFF" />
            <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
              Verified
            </ThemedText>
          </View>
        </View>
        <View style={styles.propertyStats}>
          <View style={styles.stat}>
            <Feather name="eye" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
              124 views
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <Feather name="users" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
              8 applications
            </ThemedText>
          </View>
          {property.walkScore ? (
            <View style={styles.stat}>
              <Feather name="navigation" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                Walk Score {property.walkScore}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          {property.available ? (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.warning }]} 
              onPress={() => markAsRented(property.id)}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>
                Mark as Rented
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.success }]} 
              onPress={() => markAsAvailable(property.id)}
            >
              <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs, color: '#FFFFFF' }]}>
                Mark as Available
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.statsOverview}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[Typography.h1]}>{properties.length}</ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Total Properties
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[Typography.h1]}>16</ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Applications
            </ThemedText>
          </View>
        </View>
        {properties.map(property => renderProperty(property))}
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  statsOverview: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  propertyCard: {
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  propertyImage: {
    width: '100%',
    height: 160,
  },
  propertyInfo: {
    padding: Spacing.lg,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  propertyStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.small,
  },
});
