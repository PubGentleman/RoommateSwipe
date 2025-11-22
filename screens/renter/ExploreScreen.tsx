import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockProperties } from '../../utils/mockData';
import { Property } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ExploreScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [saved, setSaved] = useState<Set<string>>(new Set());

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
      style={[styles.propertyCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: item.photos[0] }} style={styles.propertyImage} />
      <Pressable
        style={[styles.saveButton, { backgroundColor: Colors[theme].backgroundDefault }]}
        onPress={() => toggleSave(item.id)}
      >
        <Feather
          name={saved.has(item.id) ? 'heart' : 'heart'}
          size={20}
          color={saved.has(item.id) ? Colors[theme].error : Colors[theme].text}
          fill={saved.has(item.id) ? Colors[theme].error : 'none'}
        />
      </Pressable>
      <View style={styles.propertyInfo}>
        <ThemedText style={[Typography.h3]}>${item.price}/mo</ThemedText>
        <ThemedText style={[Typography.body, { marginTop: Spacing.xs }]} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <View style={styles.details}>
          <View style={styles.detail}>
            <Feather name="home" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              {item.bedrooms} bd
            </ThemedText>
          </View>
          <View style={styles.detail}>
            <Feather name="droplet" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              {item.bathrooms} ba
            </ThemedText>
          </View>
          <View style={styles.detail}>
            <Feather name="maximize" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              {item.sqft} sqft
            </ThemedText>
          </View>
        </View>
        <View style={styles.location}>
          <Feather name="map-pin" size={14} color={Colors[theme].textSecondary} />
          <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
            {item.city}, {item.state}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <View style={[styles.searchBar, { backgroundColor: Colors[theme].backgroundDefault }]}>
          <Feather name="search" size={20} color={Colors[theme].textSecondary} />
          <ThemedText style={[Typography.body, { color: Colors[theme].textSecondary, marginLeft: Spacing.md }]}>
            Search location...
          </ThemedText>
        </View>
        <Pressable style={styles.filterButton} onPress={() => {}}>
          <Feather name="sliders" size={24} color={Colors[theme].text} />
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
});
