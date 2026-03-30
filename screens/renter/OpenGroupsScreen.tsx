import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getOpenGroups } from '../../services/groupJoinService';
import { OpenGroupListing } from '../../types/models';
import { Image } from 'expo-image';
import { Spacing } from '../../constants/theme';
import { needsRoommates } from '../../utils/renterIntentUtils';

export default function OpenGroupsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  const isRoommateSeeker = needsRoommates(user?.profileData?.apartment_search_type);

  const [groups, setGroups] = useState<OpenGroupListing[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getOpenGroups(user.id, {
      city: user.profileData?.city,
    });
    setGroups(data);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  const renderGroupCard = ({ item }: { item: OpenGroupListing }) => {
    const typeBadge = item.groupType === 'pi_auto'
      ? { label: 'Pi Matched', color: '#8B5CF6' }
      : { label: 'Friends', color: '#22C55E' };

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() =>
          navigation.navigate('GroupRequest' as never, {
            group: item,
          } as never)
        }
      >
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeBadge.color + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
              {typeBadge.label}
            </Text>
          </View>
          <Text style={[styles.spotsText, { color: theme.primary }]}>
            {item.spotsOpen} spot{item.spotsOpen !== 1 ? 's' : ''} open
          </Text>
        </View>

        <View style={styles.membersRow}>
          {item.members.slice(0, 4).map((m, i) => (
            <View key={m.user_id} style={styles.memberAvatar}>
              {m.photo ? (
                <Image source={{ uri: m.photo }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
                  <Feather name="user" size={14} color={theme.textSecondary} />
                </View>
              )}
            </View>
          ))}
          <View style={styles.memberNames}>
            <Text style={[styles.memberNameText, { color: theme.text }]} numberOfLines={1}>
              {item.members.map(m => m.name.split(' ')[0]).join(', ')}
            </Text>
            {item.members.some(m => m.occupation) ? (
              <Text style={[styles.memberOccupation, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.members.filter(m => m.occupation).map(m => m.occupation).join(' / ')}
              </Text>
            ) : null}
          </View>
        </View>

        {item.compatibility ? (
          <View style={styles.compatRow}>
            <Feather name="zap" size={14} color="#F59E0B" />
            <Text style={[styles.compatText, { color: '#F59E0B' }]}>
              {Math.round(item.compatibility)}% compatible
            </Text>
          </View>
        ) : null}

        <View style={styles.detailsRow}>
          {item.city ? (
            <View style={styles.detailChip}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.neighborhoods?.join(', ') || item.city}
              </Text>
            </View>
          ) : null}
          {item.budgetMin || item.budgetMax ? (
            <View style={styles.detailChip}>
              <Feather name="dollar-sign" size={12} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                ${item.budgetMin?.toLocaleString() || '?'}-${item.budgetMax?.toLocaleString() || '?'}/mo
              </Text>
            </View>
          ) : null}
          {item.desiredBedrooms ? (
            <View style={styles.detailChip}>
              <Feather name="home" size={12} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.desiredBedrooms} BR
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.requestBtn, { backgroundColor: theme.primary }]}
          onPress={() =>
            navigation.navigate('GroupRequest' as never, {
              group: item,
            } as never)
          }
        >
          <Text style={styles.requestBtnText}>View & Request to Join</Text>
        </Pressable>
      </Pressable>
    );
  };

  if (!isRoommateSeeker) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Find a Group</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="info" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Not available</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Group browsing is only for renters looking for roommates. Update your search intent in Settings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Find a Group</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No open groups right now
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Pi is always assembling new ones — check back soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={renderGroupCard}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.xl },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  spotsText: { fontSize: 13, fontWeight: '600' },
  membersRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  memberAvatar: { marginRight: -4 },
  avatarImage: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#111' },
  avatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  memberNames: { flex: 1, marginLeft: 8 },
  memberNameText: { fontSize: 15, fontWeight: '600' },
  memberOccupation: { fontSize: 12, marginTop: 2 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  compatText: { fontSize: 13, fontWeight: '600' },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12 },
  requestBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  requestBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
