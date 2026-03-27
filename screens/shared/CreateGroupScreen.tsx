import React, { useState } from 'react';
import {
  View, StyleSheet, Pressable, TextInput, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Spacing, Typography } from '../../constants/theme';
import { createGroup as createGroupSupabase, getGroupLimit, getMemberLimit } from '../../services/groupService';
import { StorageService } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { Image } from 'expo-image';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';

export const CreateGroupScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    route.params?.preselectedListingId || null
  );
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPropertySearch, setShowPropertySearch] = useState(false);

  const matchedUserId = route.params?.matchedUserId;
  const matchedUserName = route.params?.matchedUserName;

  const handleCreate = async () => {
    if (!user) return;

    if (!name.trim()) {
      await alert({ title: 'Name Required', message: 'Please enter a name for your group.', variant: 'warning' });
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
          const shouldUpgrade = await confirm({
            title: 'Group Limit Reached',
            message: `Your ${planLabel} plan allows up to ${groupLimit} group${groupLimit === 1 ? '' : 's'}. Upgrade to create more.`,
            confirmText: 'Upgrade',
            variant: 'warning',
          });
          if (shouldUpgrade) (navigation as any).navigate('Plans');
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
      } catch (supaError) {
        console.warn('[CreateGroupScreen] Supabase failed, using local fallback:', supaError);
        const userPlanForLimit = (user as any)?.subscription?.plan || 'basic';
        const localGroup = {
          id: `group_${Date.now()}`,
          name: name.trim(),
          description: description.trim() || 'A group looking for roommates',
          members: matchedUserId ? [user.id, matchedUserId] : [user.id],
          pendingMembers: [],
          maxMembers: getMemberLimit(userPlanForLimit, selectedListing?.bedrooms || null),
          budget: user?.profileData?.budget || 2000,
          preferredLocation: user?.profileData?.city || 'Your City',
          createdAt: new Date(),
          createdBy: user.id,
        };
        await StorageService.addOrUpdateGroup(localGroup as any);

        await alert({
          title: 'Group Created!',
          message: `${name.trim()} has been created.`,
          confirmText: 'View Groups',
          variant: 'success',
        });
        navigation.navigate('Groups');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      await alert({ title: 'Error', message: 'Failed to create group. Please try again.', variant: 'warning' });
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
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
          Attaching a listing pins the property details to the top of your group chat.
        </ThemedText>

        {selectedListing ? (
          <Pressable
            style={[styles.selectedListing, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
            onPress={() => setShowPropertySearch(true)}
          >
            {selectedListing.photos?.[0] ? (
              <Image source={{ uri: selectedListing.photos[0] }} style={styles.selectedListingThumb} />
            ) : null}
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                {selectedListing.title}
              </ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]} numberOfLines={1}>
                {selectedListing.address}, {selectedListing.city}
              </ThemedText>
              <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
                ${selectedListing.rent?.toLocaleString()}/mo · {selectedListing.bedrooms} BR
              </ThemedText>
            </View>
            <Pressable
              onPress={() => { setSelectedListing(null); setSelectedListingId(null); }}
              hitSlop={8}
              style={[styles.clearListingBtn, { backgroundColor: theme.border }]}
            >
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.searchTrigger, { borderColor: theme.border }]}
            onPress={() => setShowPropertySearch(true)}
          >
            <Feather name="search" size={17} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { marginLeft: 10, color: theme.textSecondary }]}>
              Search for a listing to link...
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={[styles.memberCapNote, {
        backgroundColor: selectedListing?.bedrooms ? theme.primary + '10' : theme.card,
        borderColor: selectedListing?.bedrooms ? theme.primary + '30' : theme.border,
      }]}>
        <Feather name="users" size={14} color={selectedListing?.bedrooms ? theme.primary : theme.textSecondary} />
        <ThemedText style={[Typography.small, {
          color: selectedListing?.bedrooms ? theme.primary : theme.textSecondary,
          marginLeft: 6, flex: 1,
        }]}>
          {selectedListing?.bedrooms
            ? `Up to ${selectedListing.bedrooms + 1} members (${selectedListing.bedrooms} bedrooms + 1)`
            : `Member limit: ${getMemberLimit((user as any)?.subscription?.plan || 'basic')} (no listing linked)`
          }
        </ThemedText>
      </View>

      <GroupPropertySearchModal
        visible={showPropertySearch}
        currentListingId={selectedListingId}
        memberCount={matchedUserId ? 2 : 1}
        onSelect={(listing) => {
          setSelectedListing(listing);
          setSelectedListingId(listing?.id || null);
          setShowPropertySearch(false);
        }}
        onClose={() => setShowPropertySearch(false)}
      />
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
  selectedListing: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1.5,
  },
  selectedListingThumb: { width: 52, height: 52, borderRadius: 8 },
  clearListingBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  searchTrigger: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  memberCapNote: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 10, borderWidth: 1,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
});
