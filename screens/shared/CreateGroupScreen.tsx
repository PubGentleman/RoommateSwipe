import React, { useState } from 'react';
import {
  View, StyleSheet, Pressable, TextInput, ActivityIndicator, Switch, ScrollView, Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Spacing, Typography } from '../../constants/theme';
import { createGroup as createGroupSupabase, getGroupLimit, getMemberLimit, sendGroupInvites, GroupInviteInput } from '../../services/groupService';
import { StorageService } from '../../utils/storage';
import { requireVerification } from '../../utils/verificationGating';
import { supabase } from '../../lib/supabase';
import { Image } from 'expo-image';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader, HeaderActionButton } from '../../components/AppHeader';

const ACCENT = '#ff6b5b';

interface InviteEntry {
  id: string;
  type: 'email' | 'phone';
  value: string;
  isCouple: boolean;
}

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
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [matchedIsCouple, setMatchedIsCouple] = useState(false);

  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [newInviteType, setNewInviteType] = useState<'email' | 'phone'>('email');
  const [newInviteValue, setNewInviteValue] = useState('');
  const [newInviteCouple, setNewInviteCouple] = useState(false);
  const [inviteFocused, setInviteFocused] = useState(false);

  const matchedUserId = route.params?.matchedUserId;
  const matchedUserName = route.params?.matchedUserName;
  const canCreate = name.trim().length > 0;
  const memberLimit = getMemberLimit((user as any)?.subscription?.plan || 'basic', selectedListing?.bedrooms || null);

  const addInvite = () => {
    const val = newInviteValue.trim();
    if (!val) return;
    if (newInviteType === 'email' && !val.includes('@')) return;
    if (invites.some(i => i.value === val)) return;
    setInvites(prev => [...prev, {
      id: `inv_${Date.now()}`,
      type: newInviteType,
      value: val,
      isCouple: newInviteCouple,
    }]);
    setNewInviteValue('');
    setNewInviteCouple(false);
  };

  const removeInvite = (id: string) => {
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const handleCreate = async () => {
    if (!user) return;

    if (!requireVerification(user.emailVerified, 'creating groups')) return;

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
        const group = await createGroupSupabase(user!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          listing_id: selectedListingId || undefined,
        });

        if (matchedUserId) {
          try {
            const { addMemberToGroup } = await import('../../services/groupService');
            await addMemberToGroup(group.id, matchedUserId, 'renter', { isCouple: matchedIsCouple });
          } catch {}
        }

        if (invites.length > 0) {
          try {
            const inviteInputs: GroupInviteInput[] = invites.map(inv => ({
              email: inv.type === 'email' ? inv.value : undefined,
              phone: inv.type === 'phone' ? inv.value : undefined,
              isCouple: inv.isCouple,
            }));
            await sendGroupInvites(group.id, inviteInputs);
          } catch (invErr) {
            console.warn('[CreateGroupScreen] Failed to send some invites:', invErr);
          }
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
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error creating group:', error);
      await alert({ title: 'Error', message: 'Failed to create group. Please try again.', variant: 'warning' });
    } finally {
      setCreating(false);
    }
  };

  const ScrollComponent = Platform.OS === 'web' ? ScrollView : KeyboardAwareScrollView;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <AppHeader
        title="New Group"
        mode="tab"
        role="renter"
        hideSeparator
        rightActions={
          creating ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <HeaderActionButton
              label="Create"
              onPress={handleCreate}
              variant="primary"
              disabled={!canCreate}
            />
          )
        }
      />
      <ScrollComponent
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >

      <View style={styles.heroSection}>
        <View style={styles.heroIconWrap}>
          <LinearGradient
            colors={['rgba(255,107,91,0.25)', 'rgba(255,107,91,0.08)']}
            style={styles.heroIconGradient}
          >
            <Feather name="users" size={28} color={ACCENT} />
          </LinearGradient>
        </View>
        <ThemedText style={styles.heroTitle}>Start your search together</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Create a group to find roommates and browse listings as a team
        </ThemedText>
      </View>

      {matchedUserName ? (
        <View style={styles.matchBanner}>
          <View style={styles.matchAvatarPlaceholder}>
            <Feather name="user-plus" size={16} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.matchBannerTitle}>
              Starting with {matchedUserName}
            </ThemedText>
            <ThemedText style={styles.matchBannerSub}>
              They'll be added as the first member
            </ThemedText>
          </View>
          <Feather name="check-circle" size={18} color={ACCENT} />
        </View>
      ) : null}

      {matchedUserName ? (
        <Pressable
          style={[styles.coupleToggle, matchedIsCouple ? styles.coupleToggleActive : undefined]}
          onPress={() => setMatchedIsCouple(!matchedIsCouple)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Feather name="heart" size={16} color={matchedIsCouple ? '#ec4899' : theme.textSecondary} />
            <View>
              <ThemedText style={{ fontWeight: '600', fontSize: 14 }}>Adding as a couple?</ThemedText>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
                Couples share 1 bedroom and count as 1 unit
              </ThemedText>
            </View>
          </View>
          <View style={[styles.coupleCheck, matchedIsCouple ? { backgroundColor: '#ec4899', borderColor: '#ec4899' } : { borderColor: theme.border }]}>
            {matchedIsCouple ? <Feather name="check" size={12} color="#fff" /> : null}
          </View>
        </Pressable>
      ) : null}

      <View style={[styles.field, nameFocused && styles.fieldFocused]}>
        <View style={styles.labelRow}>
          <View style={styles.labelIcon}>
            <Feather name="edit-3" size={12} color={nameFocused ? ACCENT : 'rgba(255,255,255,0.4)'} />
          </View>
          <ThemedText style={[styles.label, nameFocused && { color: ACCENT }]}>GROUP NAME</ThemedText>
          <ThemedText style={styles.required}>Required</ThemedText>
        </View>
        <TextInput
          style={styles.input}
          placeholder="e.g. Looking for 2BR Downtown"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={name}
          onChangeText={setName}
          maxLength={60}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
        />
        <View style={styles.inputFooter}>
          <ThemedText style={styles.charCount}>{name.length}/60</ThemedText>
        </View>
      </View>

      <View style={[styles.field, descFocused && styles.fieldFocused]}>
        <View style={styles.labelRow}>
          <View style={styles.labelIcon}>
            <Feather name="align-left" size={12} color={descFocused ? ACCENT : 'rgba(255,255,255,0.4)'} />
          </View>
          <ThemedText style={[styles.label, descFocused && { color: ACCENT }]}>DESCRIPTION</ThemedText>
          <ThemedText style={styles.optional}>Optional</ThemedText>
        </View>
        <TextInput
          style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
          placeholder="What is this group looking for?"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
        />
        <View style={styles.inputFooter}>
          <ThemedText style={styles.charCount}>{description.length}/200</ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Feather name="mail" size={15} color="rgba(255,255,255,0.5)" />
        <ThemedText style={styles.sectionTitle}>Invite Your Crew</ThemedText>
        <ThemedText style={styles.optional}>Optional</ThemedText>
      </View>
      <ThemedText style={styles.sectionHint}>
        Add friends by email or phone number
      </ThemedText>

      <View style={styles.inviteTypeToggle}>
        <Pressable
          style={[styles.inviteTypeBtn, newInviteType === 'email' && styles.inviteTypeBtnActive]}
          onPress={() => setNewInviteType('email')}
        >
          <Feather name="mail" size={13} color={newInviteType === 'email' ? '#fff' : '#888'} />
          <ThemedText style={[styles.inviteTypeBtnText, newInviteType === 'email' && { color: '#fff' }]}>Email</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.inviteTypeBtn, newInviteType === 'phone' && styles.inviteTypeBtnActive]}
          onPress={() => setNewInviteType('phone')}
        >
          <Feather name="phone" size={13} color={newInviteType === 'phone' ? '#fff' : '#888'} />
          <ThemedText style={[styles.inviteTypeBtnText, newInviteType === 'phone' && { color: '#fff' }]}>Phone</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.inviteInputRow, inviteFocused && { borderColor: ACCENT }]}>
        <TextInput
          style={styles.inviteInput}
          placeholder={newInviteType === 'email' ? 'friend@email.com' : '+1 (555) 123-4567'}
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={newInviteValue}
          onChangeText={setNewInviteValue}
          keyboardType={newInviteType === 'email' ? 'email-address' : 'phone-pad'}
          autoCapitalize="none"
          onFocus={() => setInviteFocused(true)}
          onBlur={() => setInviteFocused(false)}
          onSubmitEditing={addInvite}
        />
        <Pressable style={styles.addInviteBtn} onPress={addInvite}>
          <Feather name="plus" size={16} color={ACCENT} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.inviteCoupleRow, newInviteCouple && { borderColor: '#ec4899' + '40' }]}
        onPress={() => setNewInviteCouple(!newInviteCouple)}
      >
        <Feather name="heart" size={13} color={newInviteCouple ? '#ec4899' : '#666'} />
        <ThemedText style={{ color: newInviteCouple ? '#ec4899' : '#888', fontSize: 12, flex: 1 }}>
          Joining as a couple?
        </ThemedText>
        <View style={[styles.coupleCheck, newInviteCouple ? { backgroundColor: '#ec4899', borderColor: '#ec4899' } : { borderColor: '#444' }]}>
          {newInviteCouple ? <Feather name="check" size={10} color="#fff" /> : null}
        </View>
      </Pressable>

      {invites.length > 0 ? (
        <View style={styles.inviteList}>
          {invites.map(inv => (
            <View key={inv.id} style={styles.inviteItem}>
              <Feather name={inv.type === 'email' ? 'mail' : 'phone'} size={13} color="#888" />
              <ThemedText style={styles.inviteItemText} numberOfLines={1}>{inv.value}</ThemedText>
              {inv.isCouple ? (
                <View style={styles.inviteCoupleBadge}>
                  <Feather name="heart" size={8} color="#ec4899" />
                  <ThemedText style={{ color: '#ec4899', fontSize: 9 }}>Couple</ThemedText>
                </View>
              ) : null}
              <Pressable onPress={() => removeInvite(inv.id)} hitSlop={8}>
                <Feather name="x" size={14} color="#666" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Feather name="home" size={15} color="rgba(255,255,255,0.5)" />
        <ThemedText style={styles.sectionTitle}>Link a Property</ThemedText>
        <ThemedText style={styles.optional}>Optional</ThemedText>
      </View>
      <ThemedText style={styles.sectionHint}>
        Pin a listing to the group so everyone can see the property details
      </ThemedText>

      {selectedListing ? (
        <Pressable
          style={styles.selectedListing}
          onPress={() => setShowPropertySearch(true)}
        >
          {selectedListing.photos?.[0] ? (
            <Image source={{ uri: selectedListing.photos[0] }} style={styles.selectedListingThumb} />
          ) : (
            <View style={[styles.selectedListingThumb, { backgroundColor: 'rgba(255,107,91,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
              <Feather name="home" size={20} color={ACCENT} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
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
          <View style={styles.searchIconWrap}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.5)" />
          </View>
          <ThemedText style={styles.searchTriggerText}>
            Search for a listing to link...
          </ThemedText>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
        </Pressable>
      )}

      <View style={styles.memberCapNote}>
        <View style={[styles.memberCapIconWrap, selectedListing?.bedrooms ? styles.memberCapIconActive : null]}>
          <Feather
            name="users"
            size={14}
            color={selectedListing?.bedrooms ? ACCENT : 'rgba(255,255,255,0.4)'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[
            styles.memberCapLabel,
            { color: selectedListing?.bedrooms ? '#fff' : 'rgba(255,255,255,0.5)' },
          ]}>
            {selectedListing?.bedrooms
              ? `Up to ${selectedListing.bedrooms + 1} members`
              : `Up to ${memberLimit} members`
            }
          </ThemedText>
          <ThemedText style={styles.memberCapSub}>
            {selectedListing?.bedrooms
              ? `Based on ${selectedListing.bedrooms} bedroom${selectedListing.bedrooms > 1 ? 's' : ''}`
              : 'Link a listing to adjust the limit'
            }
          </ThemedText>
        </View>
      </View>

      <Pressable
        style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={creating || !canCreate}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : canCreate ? (
          <LinearGradient
            colors={[ACCENT, '#ff8a7a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <Feather name="plus-circle" size={18} color="#fff" />
            <ThemedText style={styles.createButtonText}>Create Group</ThemedText>
          </LinearGradient>
        ) : (
          <View style={styles.createButtonGradient}>
            <Feather name="plus-circle" size={18} color="rgba(255,255,255,0.3)" />
            <ThemedText style={[styles.createButtonText, { color: 'rgba(255,255,255,0.3)' }]}>Create Group</ThemedText>
          </View>
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
      </ScrollComponent>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 8,
    paddingBottom: 28,
  },
  heroIconWrap: {
    marginBottom: 14,
  },
  heroIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
  },
  matchAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  matchBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  matchBannerSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 1,
  },
  coupleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  coupleToggleActive: {
    borderColor: 'rgba(236,72,153,0.3)',
    backgroundColor: 'rgba(236,72,153,0.06)',
  },
  coupleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldFocused: {
    borderColor: 'rgba(255,107,91,0.35)',
    backgroundColor: 'rgba(255,107,91,0.03)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  labelIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  required: {
    fontSize: 10,
    fontWeight: '600',
    color: ACCENT,
    letterSpacing: 0.3,
  },
  optional: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.3,
  },
  input: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.15)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  sectionHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 20,
    marginBottom: 14,
    lineHeight: 18,
  },
  selectedListing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ACCENT,
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
    color: ACCENT,
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  searchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTriggerText: {
    flex: 1,
    marginLeft: 12,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  memberCapNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  memberCapIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCapIconActive: {
    backgroundColor: 'rgba(255,107,91,0.12)',
  },
  memberCapLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberCapSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 1,
  },
  createButton: {
    marginHorizontal: 20,
    marginTop: 32,
    borderRadius: 28,
    overflow: 'hidden',
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  inviteTypeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    gap: 8,
  },
  inviteTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inviteTypeBtnActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  inviteTypeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  inviteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingRight: 6,
  },
  inviteInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addInviteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCoupleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inviteList: {
    marginHorizontal: 20,
    marginTop: 10,
    gap: 6,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inviteItemText: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  inviteCoupleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
});
