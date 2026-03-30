import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { StorageService } from '../../utils/storage';
import { Property } from '../../types/models';
import { Image } from 'expo-image';
import { Spacing } from '../../constants/theme';

export default function SavedListingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const savedIds = await StorageService.getSavedProperties(user.id);
      if (savedIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      const allProps = await StorageService.getProperties();
      const savedProps = allProps.filter((p: Property) => savedIds.includes(p.id));
      setListings(savedProps);
    } catch (err) {
      console.error('Error loading saved listings:', err);
    }
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadSaved(); }, [loadSaved]));

  const handleUnsave = async (propertyId: string) => {
    if (!user?.id) return;
    await StorageService.unsaveProperty(user.id, propertyId);
    setListings(prev => prev.filter(p => p.id !== propertyId));
  };

  const renderListing = ({ item }: { item: Property }) => {
    const photo = item.images?.[0] || item.imageUrl;

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: theme.border }]}>
            <Feather name="home" size={24} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title || 'Listing'}
          </Text>
          <View style={styles.cardDetails}>
            {item.neighborhood || item.city ? (
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.neighborhood || item.city}
                </Text>
              </View>
            ) : null}
            {item.rent ? (
              <Text style={[styles.cardPrice, { color: theme.primary }]}>
                ${item.rent.toLocaleString()}/mo
              </Text>
            ) : null}
          </View>
          <View style={styles.cardMeta}>
            {item.bedrooms ? (
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.bedrooms} BR
              </Text>
            ) : null}
            {item.bathrooms ? (
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.bathrooms} BA
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          style={styles.unsaveBtn}
          onPress={() => handleUnsave(item.id)}
          hitSlop={8}
        >
          <Feather name="heart" size={18} color="#EF4444" />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Saved</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="bookmark" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No saved listings yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Save listings from Explore to see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={renderListing}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImage: { width: 100, height: 100 },
  cardImagePlaceholder: {
    width: 100, height: 100, alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  detailText: { fontSize: 12 },
  cardPrice: { fontSize: 14, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { fontSize: 12 },
  unsaveBtn: { position: 'absolute', top: 10, right: 10 },
});
