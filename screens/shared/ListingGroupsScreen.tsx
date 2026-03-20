import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import {
  getDiscoverableGroupsForListing,
  requestToJoinGroup,
} from '../../services/groupService';

export function ListingGroupsScreen({ navigation, route }: any) {
  const { listingId } = route.params;
  const { theme } = useTheme();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await getDiscoverableGroupsForListing(listingId);
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async (groupId: string) => {
    setRequestingId(groupId);
    try {
      await requestToJoinGroup(groupId);
      setRequestedIds(prev => new Set(prev).add(groupId));
      Alert.alert('Request Sent', 'The group admin will review your request.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>
          Groups for this Listing
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
          These groups are looking for roommates for this property. Request to join one!
        </ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={40} color={theme.textSecondary} />
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
            No groups are currently open for this listing.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
          renderItem={({ item }) => (
            <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
                  {item.name}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Feather name="users" size={13} color={theme.textSecondary} />
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 4 }]}>
                    {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
                  </ThemedText>
                </View>
              </View>
              {requestedIds.has(item.id) ? (
                <View style={[styles.requestedBadge, { backgroundColor: theme.primary + '20' }]}>
                  <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
                    Requested
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  style={[styles.joinBtn, {
                    backgroundColor: theme.primary,
                    opacity: requestingId === item.id ? 0.6 : 1,
                  }]}
                  onPress={() => handleRequestJoin(item.id)}
                  disabled={requestingId === item.id}
                >
                  {requestingId === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '700' }]}>Request to Join</ThemedText>
                  }
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: 14, borderWidth: 1, marginBottom: Spacing.sm,
  },
  joinBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, alignItems: 'center',
  },
  requestedBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
});
