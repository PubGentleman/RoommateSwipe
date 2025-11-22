import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ExploreScreen = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await StorageService.initializeWithMockData();
      const allProperties = await StorageService.getProperties();
      setProperties(allProperties);
    } catch (err) {
      setError('Failed to load properties');
      console.error('Error loading properties:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const renderProperty = ({ item }: { item: Property }) => (
    <Pressable
      style={[styles.propertyCard, { backgroundColor: theme.backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: item.photos[0] }} style={styles.propertyImage} />
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
        <View style={styles.location}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
            {item.city}, {item.state}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

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
            <ThemedText style={[Typography.button, { color: '#FFFFFF', marginLeft: Spacing.sm }]}>
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
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.md }]}>
            Search location...
          </ThemedText>
        </View>
        <Pressable style={styles.filterButton} onPress={() => {}}>
          <Feather name="sliders" size={24} color={theme.text} />
        </Pressable>
      </View>
      <FlatList
        data={properties}
        renderItem={renderProperty}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100, paddingTop: Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyStateInline}>
            <Feather name="home" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h2, { marginTop: Spacing.xl, textAlign: 'center' }]}>
              No Properties Available
            </ThemedText>
          </View>
        }
      />
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
  propertyInfo: {
    padding: Spacing.lg,
  },
  details: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
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
});
