import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Pressable, TextInput, Alert, FlatList, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { createGroup as createGroupSupabase, getGroupLimit } from '../../services/groupService';
import { getMyListings } from '../../services/listingService';
import { StorageService } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { Image } from 'expo-image';

export const CreateGroupScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    route.params?.preselectedListingId || null
  );
  const [myListings, setMyListings] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const isHost = user?.role === 'host';

  const matchedUserId = route.params?.matchedUserId;
  const matchedUserName = route.params?.matchedUserName;

  useEffect(() => {
    if (isHost) {
      getMyListings().then(setMyListings).catch(() => {});
    }
  }, [isHost]);

  const handleCreate = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your group.');
      return;
    }

    setCreating(true);
    try {
      const userPlan = (user as any)?.subscription?.plan || 'basic';
      const groupLimit = getGroupLimit(userPlan);

      try {
        const { count, error: countError } = await supabase
          .from('groups')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id);

        if (!countError && count !== null && count >= groupLimit) {
          const planLabel = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);
          Alert.alert(
            'Group Limit Reached',
            `Your ${planLabel} plan allows up to ${groupLimit} group${groupLimit === 1 ? '' : 's'}. Upgrade to create more.`,
            [
              { text: 'Upgrade', onPress: () => navigation.navigate('PlanSelection') },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          setCreating(false);
          return;
        }
      } catch {
      }

      try {
        const group = await createGroupSupabase({
          name: name.trim(),
          description: description.trim() || undefined,
          listing_id: selectedListingId || undefined,
        });

        if (matchedUserId) {
          try {
            const { addMemberToGroup } = await import('../../services/groupService');
            await addMemberToGroup(group.id, matchedUserId);
          } catch {}
        }

        navigation.goBack();
        setTimeout(() => {
          navigation.navigate('Messages', {
            screen: 'Chat',
            params: {
              conversationId: `group-${group.id}`,
              isGroupChat: true,
            },
          });
        }, 100);
      } catch (supaError) {
        console.warn('[CreateGroupScreen] Supabase failed, using local fallback:', supaError);
        const localGroup = {
          id: `group_${Date.now()}`,
          name: name.trim(),
          description: description.trim() || 'A group looking for roommates',
          members: matchedUserId ? [user.id, matchedUserId] : [user.id],
          pendingMembers: [],
          maxMembers: 10,
          budget: user?.profileData?.budget || 2000,
          preferredLocation: user?.profileData?.city || 'Your City',
          createdAt: new Date(),
          createdBy: user.id,
        };
        await StorageService.addOrUpdateGroup(localGroup as any);

        Alert.alert(
          'Group Created!',
          `${name.trim()} has been created.`,
          [{ text: 'View Groups', onPress: () => navigation.navigate('Groups') }]
        );
      }
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>New Group</ThemedText>
        <Pressable onPress={handleCreate} disabled={creating || !name.trim()}>
          {creating ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText style={[Typography.body, {
              color: name.trim() ? theme.primary : theme.textSecondary,
              fontWeight: '600',
            }]}>
              Create
            </ThemedText>
          )}
        </Pressable>
      </View>

      {matchedUserName ? (
        <View style={[styles.matchBanner, { backgroundColor: theme.primary + '15' }]}>
          <Feather name="users" size={20} color={theme.primary} />
          <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: Spacing.sm }]}>
            Starting a group with {matchedUserName}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 6 }]}>GROUP NAME *</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="e.g. Looking for 2BR Downtown"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
      </View>

      <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 6 }]}>DESCRIPTION (OPTIONAL)</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, minHeight: 70 }]}
          placeholder="What is this group for?"
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
        />
      </View>

      <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: 6 }]}>
          LINK TO A PROPERTY (OPTIONAL)
        </ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: 12 }]}>
          Attaching a listing pins the property details to the top of your group chat.
        </ThemedText>

        <Pressable
          style={[
            styles.listingOption,
            {
              borderColor: !selectedListingId ? theme.primary : theme.border,
              backgroundColor: !selectedListingId ? theme.primary + '15' : theme.background,
            },
          ]}
          onPress={() => setSelectedListingId(null)}
        >
          <Feather name="slash" size={18} color={!selectedListingId ? theme.primary : theme.textSecondary} />
          <ThemedText style={[Typography.body, {
            marginLeft: Spacing.sm,
            color: !selectedListingId ? theme.primary : theme.text,
          }]}>
            No property — standalone group
          </ThemedText>
          {!selectedListingId ? (
            <Feather name="check" size={18} color={theme.primary} style={{ marginLeft: 'auto' }} />
          ) : null}
        </Pressable>

        {isHost && myListings.length > 0 ? (
          <FlatList
            data={myListings}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.listingOption,
                  {
                    borderColor: selectedListingId === item.id ? theme.primary : theme.border,
                    backgroundColor: selectedListingId === item.id ? theme.primary + '15' : theme.background,
                  },
                ]}
                onPress={() => setSelectedListingId(item.id)}
              >
                {item.photos?.[0] ? (
                  <Image source={{ uri: item.photos[0] }} style={styles.listingThumb} />
                ) : (
                  <View style={[styles.listingThumb, { backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Feather name="home" size={18} color={theme.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>{item.title}</ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.address}, {item.city}
                  </ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
                    ${item.rent}/mo
                  </ThemedText>
                </View>
                {selectedListingId === item.id ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            )}
          />
        ) : null}

        {!isHost ? (
          <Pressable
            style={[styles.listingOption, { borderColor: theme.border }]}
            onPress={() => {
              Alert.alert(
                'Link a Listing',
                'Browse listings on the Explore tab, then use "Create Group" from a listing to link it automatically.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { marginLeft: Spacing.sm, color: theme.textSecondary }]}>
              {selectedListingId ? 'Change selected listing...' : 'Search for a listing to link...'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
  },
  field: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    fontSize: 16,
  },
  listingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  listingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
});
