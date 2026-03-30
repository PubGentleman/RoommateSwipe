import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { getGroupMembers } from '../../services/preformedGroupService';
import { PreformedGroupMember } from '../../types/models';
import * as Linking from 'expo-linking';

interface Props {
  groupId: string;
  inviteCode: string;
  groupName?: string;
  onDone: () => void;
}

export default function InviteFriendsScreen({ groupId, inviteCode, groupName, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [members, setMembers] = useState<PreformedGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [groupId]);

  const loadMembers = async () => {
    const data = await getGroupMembers(groupId);
    setMembers(data);
    setLoading(false);
  };

  const shareLink = async () => {
    const url = Linking.createURL(`join/${inviteCode}`);
    const displayName = groupName || 'our group';
    await Share.share({
      message: `Join ${displayName} on Rhome! Use invite code: ${inviteCode}\n\n${url}`,
    });
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.headline}>Invite your roommates</Text>
      {groupName ? <Text style={styles.groupNameBadge}>{groupName}</Text> : null}
      <Text style={styles.subheadline}>
        Your friends will sign up through the link and automatically join your group. You can start searching for apartments right away!
      </Text>

      <View style={styles.membersSection}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          members.map(member => (
            <View key={member.id} style={styles.memberRow}>
              <View style={[
                styles.memberIcon,
                { backgroundColor: member.status === 'joined' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)' },
              ]}>
                <Feather
                  name={member.status === 'joined' ? 'check-circle' : 'clock'}
                  size={16}
                  color={member.status === 'joined' ? '#22C55E' : '#999'}
                />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberStatus}>
                  {member.status === 'joined' ? 'Joined' : 'Invited, hasn\'t joined yet'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.shareBtn} onPress={shareLink}>
        <Feather name="send" size={18} color="#fff" />
        <Text style={styles.shareBtnText}>Share Invite Link</Text>
      </Pressable>

      <Pressable style={styles.codeBtn} onPress={copyCode}>
        <Feather name={copied ? 'check' : 'clipboard'} size={16} color="#22C55E" />
        <Text style={styles.codeBtnText}>
          {copied ? 'Copied!' : `Copy Code: ${inviteCode}`}
        </Text>
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={onDone}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupNameBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  membersSection: {
    marginBottom: 28,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  memberIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  memberStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 16,
  },
  codeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});
