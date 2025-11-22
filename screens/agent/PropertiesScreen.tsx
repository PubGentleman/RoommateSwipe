import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockProperties } from '../../utils/mockData';

export const PropertiesScreen = () => {
  const { theme } = useTheme();
  const [properties, setProperties] = useState(mockProperties);

  const renderProperty = (property: any) => (
    <Pressable
      key={property.id}
      style={[styles.propertyCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <Image source={{ uri: property.photos[0] }} style={styles.propertyImage} />
      <View style={styles.propertyInfo}>
        <View style={styles.propertyHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[Typography.h3]} numberOfLines={1}>{property.title}</ThemedText>
            <ThemedText style={[Typography.body, { color: Colors[theme].primary, marginTop: Spacing.xs }]}>
              ${property.price}/mo
            </ThemedText>
          </View>
          <View style={[styles.verificationBadge, { backgroundColor: Colors[theme].success }]}>
            <Feather name="check-circle" size={16} color="#FFFFFF" />
            <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
              Verified
            </ThemedText>
          </View>
        </View>
        <View style={styles.propertyStats}>
          <View style={styles.stat}>
            <Feather name="eye" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              124 views
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <Feather name="users" size={16} color={Colors[theme].textSecondary} />
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginLeft: Spacing.xs }]}>
              8 applications
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.statsOverview}>
          <View style={[styles.statCard, { backgroundColor: Colors[theme].backgroundDefault }]}>
            <ThemedText style={[Typography.h1]}>{properties.length}</ThemedText>
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary }]}>
              Total Properties
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors[theme].backgroundDefault }]}>
            <ThemedText style={[Typography.h1]}>16</ThemedText>
            <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary }]}>
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
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
