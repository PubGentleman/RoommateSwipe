import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Property } from '../../types/models';
import { getMyListings, mapListingToProperty, reassignListingAgent } from '../../services/listingService';
import * as Haptics from 'expo-haptics';

type RouteParams = {
  AssignListings: { agentId: string; agentName: string };
};

export function AssignListingsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'AssignListings'>>();
  const insets = useSafeAreaInsets();

  const { agentId, agentName } = route.params;

  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const raw = await getMyListings(user.id);
      const mapped = raw.map((l: any) => mapListingToProperty(l)).filter(Boolean) as Property[];
      setListings(mapped.filter(l => !l.isArchived && l.available !== false));
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { loadListings(); }, []);

  const toggleAssignment = async (listing: Property) => {
    if (!user) return;
    setUpdating(listing.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isCurrentlyAssigned = listing.assigned_agent_id === agentId;
      if (isCurrentlyAssigned) {
        await reassignListingAgent(listing.id, '', user.id);
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, assigned_agent_id: undefined } : l)
        );
      } else {
        await reassignListingAgent(listing.id, agentId, user.id);
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, assigned_agent_id: agentId } : l)
        );
      }
    } catch {}
    setUpdating(null);
  };

  const assignedCount = listings.filter(l => l.assigned_agent_id === agentId).length;

  const renderListing = ({ item }: { item: Property }) => {
    const isAssigned = item.assigned_agent_id === agentId;
    const isAssignedToOther = item.assigned_agent_id && item.assigned_agent_id !== agentId;

    return (
      <Pressable
        style={[
          styles.listingRow,
          { backgroundColor: theme.card, borderColor: isAssigned ? '#34C75940' : theme.border },
          isAssigned ? { borderWidth: 1.5 } : null,
        ]}
        onPress={() => toggleAssignment(item)}
        disabled={updating === item.id}
      >
        <View style={styles.listingPhoto}>
          {item.photos && item.photos.length > 0 ? (
            <Image source={{ uri: item.photos[0] }} style={styles.listingPhotoImg} />
          ) : (
            <View style={styles.listingPhotoPlaceholder}>
              <Feather name="home" size={16} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </View>

        <View style={styles.listingInfo}>
          <Text style={[styles.listingTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.listingLocation, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.neighborhood ? `${item.neighborhood}, ` : ''}{item.city}
          </Text>
          <Text style={[styles.listingPrice, { color: theme.textSecondary }]}>
            ${item.price?.toLocaleString()}/mo · {item.bedrooms} bd {item.bathrooms} ba
          </Text>
          {isAssignedToOther ? (
            <Text style={styles.assignedToOther}>Assigned to another agent</Text>
          ) : null}
        </View>

        <View style={styles.toggleWrap}>
          {updating === item.id ? (
            <ActivityIndicator size="small" color="#34C759" />
          ) : isAssigned ? (
            <View style={styles.toggleOn}>
              <Feather name="check" size={16} color="#FFFFFF" />
            </View>
          ) : isAssignedToOther ? (
            <View style={styles.toggleOther}>
              <Feather name="user" size={14} color="rgba(255,255,255,0.3)" />
            </View>
          ) : (
            <View style={styles.toggleOff} />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Assign Listings</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {agentName} · {assignedCount} listing{assignedCount !== 1 ? 's' : ''} assigned
          </Text>
        </View>
      </View>

      <View style={[styles.hintBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Feather name="info" size={14} color="#3B82F6" />
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          Tap a listing to assign or unassign {agentName.split(' ')[0]}. Assigned agents handle inquiries and communication for that listing.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListing}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="home" size={36} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No active listings to assign. Create a listing first.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintText: { fontSize: 12, flex: 1, lineHeight: 17 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, gap: 10 },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  listingPhoto: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
  },
  listingPhotoImg: {
    width: 56,
    height: 56,
  },
  listingPhotoPlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: { flex: 1, gap: 2 },
  listingTitle: { fontSize: 14, fontWeight: '600' },
  listingLocation: { fontSize: 12 },
  listingPrice: { fontSize: 12 },
  assignedToOther: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 2,
  },
  toggleWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOff: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  toggleOther: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 21,
  },
});
