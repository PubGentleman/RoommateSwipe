import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
  FlatList,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GroupMemberCard } from '../../components/GroupMemberCard';
import {
  getUserPreformedGroup,
  getGroupMembers,
  getShortlist,
  leavePreformedGroup,
  updateGroupPreferences,
  removeMember,
  removeFromShortlist,
} from '../../services/preformedGroupService';
import { PreformedGroup, PreformedGroupMember, GroupShortlistItem } from '../../types/models';
import * as Linking from 'expo-linking';
import { Spacing } from '../../constants/theme';

type Tab = 'members' | 'shortlist' | 'settings';

export default function MyGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [group, setGroup] = useState<PreformedGroup | null>(null);
  const [members, setMembers] = useState<PreformedGroupMember[]>([]);
  const [shortlist, setShortlist] = useState<GroupShortlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [copied, setCopied] = useState(false);

  const isLead = group?.group_lead_id === user?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    const g = await getUserPreformedGroup();
    setGroup(g);
    if (g) {
      const [m, s] = await Promise.all([
        getGroupMembers(g.id),
        getShortlist(g.id),
      ]);
      setMembers(m);
      setShortlist(s);
      setGroupName(g.name || '');
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLeave = () => {
    if (!group) return;
    const message = isLead
      ? 'Leaving your group will dissolve it for everyone. Are you sure?'
      : 'Are you sure you want to leave this group?';

    Alert.alert('Leave Group', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leavePreformedGroup(group.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!group) return;
    Alert.alert('Remove Member', 'Remove this person from the group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeMember(group.id, memberId);
          loadData();
        },
      },
    ]);
  };

  const handleSaveName = async () => {
    if (!group) return;
    await updateGroupPreferences(group.id, { name: groupName.trim() || undefined });
    setEditingName(false);
    loadData();
  };

  const shareInvite = async () => {
    if (!group) return;
    const url = Linking.createURL(`join/${group.invite_code}`);
    const displayName = group.name || 'our group';
    await Share.share({
      message: `Join ${displayName} on Rhome!\n\nTap the link to join:\n${url}`,
    });
  };

  const copyCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveShortlist = async (item: GroupShortlistItem) => {
    if (!group) return;
    await removeFromShortlist(group.id, item.listing_id);
    loadData();
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Feather name="users" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>No active group</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderTab = (tab: Tab, label: string, icon: string) => (
    <Pressable
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Feather name={icon} size={14} color={activeTab === tab ? '#22C55E' : 'rgba(255,255,255,0.5)'} />
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{group.name || 'Your Group'}</Text>
        <Pressable onPress={shareInvite} style={styles.headerAction}>
          <Feather name="send" size={18} color="#22C55E" />
        </Pressable>
      </View>

      <View style={styles.inviteBanner}>
        <Pressable style={styles.inviteCodeBtn} onPress={copyCode}>
          <Feather name={copied ? 'check' : 'clipboard'} size={14} color="#22C55E" />
          <Text style={styles.inviteCodeText}>
            {copied ? 'Copied!' : `Code: ${group.invite_code}`}
          </Text>
        </Pressable>
        <Text style={styles.inviteHint}>
          {members.filter(m => m.status === 'joined').length}/{group.group_size} members joined
        </Text>
      </View>

      <View style={styles.tabRow}>
        {renderTab('members', 'Members', 'users')}
        {renderTab('shortlist', `Shortlist (${shortlist.length})`, 'heart')}
        {renderTab('settings', 'Settings', 'settings')}
      </View>

      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <GroupMemberCard
              member={item}
              isLead={item.user_id === group.group_lead_id}
              isCurrentUser={item.user_id === user?.id}
              showRemove={isLead}
              onRemove={() => handleRemoveMember(item.id)}
            />
          )}
          ListFooterComponent={
            <Pressable style={styles.inviteMemberBtn} onPress={shareInvite}>
              <Feather name="plus-circle" size={16} color="#22C55E" />
              <Text style={styles.inviteMemberText}>Invite more people</Text>
            </Pressable>
          }
        />
      ) : null}

      {activeTab === 'shortlist' ? (
        shortlist.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="heart" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No shortlisted listings yet</Text>
            <Text style={styles.emptySubtext}>
              Save listings from Explore to see them here
            </Text>
          </View>
        ) : (
          <FlatList
            data={shortlist}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.shortlistCard}>
                <View style={styles.shortlistInfo}>
                  <Text style={styles.shortlistTitle}>Listing</Text>
                  {item.notes ? (
                    <Text style={styles.shortlistNotes}>{item.notes}</Text>
                  ) : null}
                  <View style={styles.shortlistMeta}>
                    <Feather name="thumbs-up" size={12} color="#22C55E" />
                    <Text style={styles.shortlistVotes}>{item.vote_count}</Text>
                  </View>
                </View>
                <Pressable onPress={() => handleRemoveShortlist(item)}>
                  <Feather name="x" size={16} color="#EF4444" />
                </Pressable>
              </View>
            )}
          />
        )
      ) : null}

      {activeTab === 'settings' ? (
        <View style={styles.settingsContent}>
          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Group Name</Text>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Group name"
                  placeholderTextColor="#666"
                />
                <Pressable onPress={handleSaveName}>
                  <Feather name="check" size={18} color="#22C55E" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.editRow}>
                <Text style={styles.settingsValue}>{group.name || 'Unnamed'}</Text>
                {isLead ? <Feather name="edit-2" size={14} color="rgba(255,255,255,0.4)" /> : null}
              </Pressable>
            )}
          </View>

          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Status</Text>
            <Text style={styles.settingsValue}>{group.status}</Text>
          </View>

          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Group Size</Text>
            <Text style={styles.settingsValue}>{group.group_size} people</Text>
          </View>

          <Pressable style={styles.leaveBtn} onPress={handleLeave}>
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={styles.leaveBtnText}>
              {isLead ? 'Dissolve Group' : 'Leave Group'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    marginBottom: 12,
  },
  inviteCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  inviteHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#22C55E',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  inviteMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  inviteMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  shortlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  shortlistInfo: {
    flex: 1,
  },
  shortlistTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  shortlistNotes: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  shortlistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  shortlistVotes: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  settingsContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  settingsField: {
    marginBottom: 20,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  settingsValue: {
    fontSize: 15,
    color: '#fff',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  leaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  backBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
