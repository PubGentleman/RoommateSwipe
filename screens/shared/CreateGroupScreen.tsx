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
  const canCreate = name.trim().length > 0;

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
      style={{ backgroundColor: '#0a0a0a' }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>New Group</ThemedText>
        <Pressable onPress={handleCreate} disabled={creating || !canCreate}>
          {creating ? (
            <ActivityIndicator size="small" color="#ff6b5b" />
          ) : (
            <ThemedText style={[styles.headerAction, {
              color: canCreate ? '#ff6b5b' : 'rgba(255,255,255,0.25)',
            }]}>
              Create
            </ThemedText>
          )}
        </Pressable>
      </View>

      {matchedUserName ? (
        <View style={styles.matchBanner}>
          <Feather name="users" size={18} color="#ff6b5b" />
          <ThemedText style={styles.matchBannerText}>
            Starting a group with {matchedUserName}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.field}>
        <ThemedText style={styles.label}>GROUP NAME *</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Looking for 2BR Downtown"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.label}>DESCRIPTION (OPTIONAL)</ThemedText>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="What is this group for?"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.label}>LINK TO A PROPERTY (OPTIONAL)</ThemedText>
        <ThemedText style={styles.fieldHint}>
          Attaching a listing pins the property details to the top of your group chat.
        </ThemedText>

        {selectedListing ? (
          <Pressable
            style={styles.selectedListing}
            onPress={() => setShowPropertySearch(true)}
          >
            {selectedListing.photos?.[0] ? (
              <Image source={{ uri: selectedListing.photos[0] }} style={styles.selectedListingThumb} />
            ) : null}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={styles.listingTitle} numberOfLines={1}>
                {selectedListing.title}
              </ThemedText>
              <ThemedText style={styles.listingAddress} numberOfLines={1}>
                {selectedListing.address}, {selectedListing.city}
              </ThemedText>
              <ThemedText style={styles.listingPrice}>
                ${selectedListing.rent?.toLocaleString()}/mo · {selectedListing.bedrooms} BR
              </ThemedText>
            </View>
            <Pressable
              onPress={() => { setSelectedListing(null); setSelectedListingId(null); }}
              hitSlop={8}
              style={styles.clearListingBtn}
            >
              <Feather name="x" size={14} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </Pressable>
        ) : (
          <Pressable
            style={styles.searchTrigger}
            onPress={() => setShowPropertySearch(true)}
          >
            <Feather name="search" size={17} color="rgba(255,255,255,0.35)" />
            <ThemedText style={styles.searchTriggerText}>
              Search for a listing to link...
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={[
        styles.memberCapNote,
        selectedListing?.bedrooms ? styles.memberCapNoteActive : styles.memberCapNoteDefault,
      ]}>
        <Feather
          name="users"
          size={14}
          color={selectedListing?.bedrooms ? '#ff6b5b' : 'rgba(255,255,255,0.4)'}
        />
        <ThemedText style={[
          styles.memberCapText,
          { color: selectedListing?.bedrooms ? '#ff6b5b' : 'rgba(255,255,255,0.4)' },
        ]}>
          {selectedListing?.bedrooms
            ? `Up to ${selectedListing.bedrooms + 1} members (${selectedListing.bedrooms} bedrooms + 1)`
            : `Member limit: ${getMemberLimit((user as any)?.subscription?.plan || 'basic')} (no listing linked)`
          }
        </ThemedText>
      </View>

      <Pressable
        style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={creating || !canCreate}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <ThemedText style={styles.createButtonText}>Create Group</ThemedText>
        )}
      </Pressable>

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
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  matchBannerText: {
    color: '#ff6b5b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  field: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  fieldHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
    lineHeight: 17,
  },
  input: {
    fontSize: 16,
    color: '#fff',
  },
  selectedListing: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.06)',
  },
  selectedListingThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  listingAddress: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  listingPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b5b',
    marginTop: 3,
  },
  clearListingBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed' as any,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a1a',
  },
  searchTriggerText: {
    marginLeft: 10,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
  },
  memberCapNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  memberCapNoteActive: {
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderColor: 'rgba(255,107,91,0.2)',
    borderWidth: 1,
    borderRadius: 12,
  },
  memberCapNoteDefault: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
  },
  memberCapText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  createButton: {
    backgroundColor: '#ff6b5b',
    borderRadius: 28,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
