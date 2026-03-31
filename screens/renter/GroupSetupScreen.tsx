import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Share,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { createPreformedGroup } from '../../services/preformedGroupService';
import { RhomeLogo } from '../../components/RhomeLogo';
import { Spacing } from '../../constants/theme';

const SIZE_OPTIONS = [2, 3, 4, 5];

type InviteMethod = 'email' | 'phone';

interface InviteEntry {
  method: InviteMethod;
  value: string;
  sent: boolean;
}

interface Props {
  onComplete: (groupId: string, inviteCode: string) => void;
  onSkip?: () => void;
}

export default function GroupSetupScreen({ onComplete, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [groupName, setGroupName] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [invites, setInvites] = useState<InviteEntry[]>([
    { method: 'email', value: '', sent: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [groupCreated, setGroupCreated] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [groupId, setGroupId] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingIdx, setSendingIdx] = useState<number | null>(null);

  const handleSizeChange = (size: number) => {
    setGroupSize(size);
    const othersCount = size - 1;
    const newInvites = [...invites];
    while (newInvites.length < othersCount) {
      newInvites.push({ method: 'email', value: '', sent: false });
    }
    setInvites(newInvites.slice(0, othersCount));
  };

  const updateInvite = (index: number, field: keyof InviteEntry, val: string | InviteMethod) => {
    const updated = [...invites];
    if (field === 'method') {
      updated[index] = { ...updated[index], method: val as InviteMethod, value: '', sent: false };
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setInvites(updated);
  };

  const getInviteUrl = (code: string) => {
    return Linking.createURL(`join/${code}`);
  };

  const sendInvite = async (index: number) => {
    const entry = invites[index];
    if (!entry.value.trim()) return;

    const code = inviteCode;
    const url = getInviteUrl(code);
    const message = `You're invited to join ${groupName || 'our group'} on Rhome! 🏠\n\nTap the link to join and start apartment hunting together:\n${url}\n\nOr use invite code: ${code}`;

    setSendingIdx(index);

    try {
      if (entry.method === 'email') {
        const subject = `Join ${groupName || 'our group'} on Rhome`;
        const mailUrl = `mailto:${entry.value.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(mailUrl);
        if (canOpen) {
          await Linking.openURL(mailUrl);
        } else {
          Alert.alert('Unable to open email', 'No email app found. You can share the invite link instead.');
          setSendingIdx(null);
          return;
        }
      } else {
        const smsBody = Platform.OS === 'ios'
          ? `sms:${entry.value.trim()}&body=${encodeURIComponent(message)}`
          : `sms:${entry.value.trim()}?body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(smsBody);
        if (canOpen) {
          await Linking.openURL(smsBody);
        } else {
          Alert.alert('Unable to open messages', 'No SMS app found. You can share the invite link instead.');
          setSendingIdx(null);
          return;
        }
      }

      const updated = [...invites];
      updated[index] = { ...updated[index], sent: true };
      setInvites(updated);
    } catch {
      Alert.alert('Error', 'Failed to send invite. Try sharing the link instead.');
    } finally {
      setSendingIdx(null);
    }
  };

  const handleCreateGroup = async () => {
    setSaving(true);
    try {
      const memberNames = invites.map((inv, idx) => inv.value.trim() || `Roommate ${idx + 1}`);
      const group = await createPreformedGroup({
        name: groupName.trim() || undefined,
        groupSize,
        memberNames,
      });
      if (group) {
        setGroupId(group.id);
        setInviteCode(group.invite_code);
        setGroupCreated(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleShareLink = async () => {
    const url = getInviteUrl(inviteCode);
    const displayName = groupName || 'our group';
    await Share.share({
      message: `Join ${displayName} on Rhome!\n\nTap to join: ${url}\n\nOr use invite code: ${inviteCode}`,
    });
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    onComplete(groupId, inviteCode);
  };

  if (groupCreated) {
    const sentCount = invites.filter(i => i.sent).length;
    const totalInvites = invites.length;

    return (
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 20 }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.successIcon}>
          <Feather name="check-circle" size={48} color="#22C55E" />
        </View>
        <Text style={styles.headline}>Group Created!</Text>
        {groupName ? <Text style={styles.groupNameBadge}>{groupName}</Text> : null}
        <Text style={styles.subheadline}>
          Now invite your roommates. They'll join your group, see your saved apartments, and get all notifications.
        </Text>

        <View style={styles.inviteSection}>
          <Text style={styles.label}>Send invitations</Text>
          {invites.map((entry, idx) => (
            <View key={idx} style={styles.inviteRow}>
              <View style={styles.methodToggle}>
                <Pressable
                  style={[styles.methodBtn, entry.method === 'email' && styles.methodBtnActive]}
                  onPress={() => !entry.sent && updateInvite(idx, 'method', 'email')}
                >
                  <Feather name="mail" size={14} color={entry.method === 'email' ? '#22C55E' : '#666'} />
                </Pressable>
                <Pressable
                  style={[styles.methodBtn, entry.method === 'phone' && styles.methodBtnActive]}
                  onPress={() => !entry.sent && updateInvite(idx, 'method', 'phone')}
                >
                  <Feather name="smartphone" size={14} color={entry.method === 'phone' ? '#22C55E' : '#666'} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.inviteInput, entry.sent && styles.inviteInputSent]}
                placeholder={entry.method === 'email' ? `Roommate ${idx + 1} email` : `Roommate ${idx + 1} phone`}
                placeholderTextColor="#666"
                value={entry.value}
                onChangeText={(text) => updateInvite(idx, 'value', text)}
                keyboardType={entry.method === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                editable={!entry.sent}
              />
              {entry.sent ? (
                <View style={styles.sentBadge}>
                  <Feather name="check" size={14} color="#22C55E" />
                </View>
              ) : (
                <Pressable
                  style={[styles.sendBtn, !entry.value.trim() && styles.sendBtnDisabled]}
                  onPress={() => sendInvite(idx)}
                  disabled={!entry.value.trim() || sendingIdx === idx}
                >
                  {sendingIdx === idx ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <Feather name="send" size={14} color={entry.value.trim() ? '#22C55E' : '#444'} />
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or share link</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.shareBtn} onPress={handleShareLink}>
          <Feather name="share-2" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
        </Pressable>

        <Pressable style={styles.codeBtn} onPress={handleCopyCode}>
          <Feather name={copied ? 'check' : 'clipboard'} size={16} color="#22C55E" />
          <Text style={styles.codeBtnText}>
            {copied ? 'Copied!' : `Copy Code: ${inviteCode}`}
          </Text>
        </Pressable>

        <View style={styles.featuresList}>
          <Text style={styles.featuresTitle}>Once they join, everyone can:</Text>
          <View style={styles.featureRow}>
            <Feather name="heart" size={14} color="#22C55E" />
            <Text style={styles.featureText}>Save apartments to a shared list</Text>
          </View>
          <View style={styles.featureRow}>
            <Feather name="message-circle" size={14} color="#22C55E" />
            <Text style={styles.featureText}>See chats with hosts and agents</Text>
          </View>
          <View style={styles.featureRow}>
            <Feather name="bell" size={14} color="#22C55E" />
            <Text style={styles.featureText}>Get notified about tours and bookings</Text>
          </View>
          <View style={styles.featureRow}>
            <Feather name="thumbs-up" size={14} color="#22C55E" />
            <Text style={styles.featureText}>Vote on listings together</Text>
          </View>
        </View>

        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>
            {sentCount > 0 ? 'Continue' : 'Start Searching'}
          </Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </Pressable>

        {sentCount < totalInvites && sentCount === 0 ? (
          <Text style={styles.reminderText}>
            You can always invite roommates later from your group settings
          </Text>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 20 }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoWrap}>
        <RhomeLogo size="sm" />
      </View>

      <Text style={styles.headline}>Set up your group</Text>
      <Text style={styles.subheadline}>
        You'll be the Group Lead {'\u2014'} you can start searching right away
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Group name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., The Brooklyn Crew"
          placeholderTextColor="#666"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>How many people total?</Text>
        <View style={styles.sizeRow}>
          {SIZE_OPTIONS.map(size => (
            <Pressable
              key={size}
              style={[
                styles.sizeBtn,
                groupSize === size && styles.sizeBtnActive,
              ]}
              onPress={() => handleSizeChange(size)}
            >
              <Text
                style={[
                  styles.sizeBtnText,
                  groupSize === size && styles.sizeBtnTextActive,
                ]}
              >
                {size}{size === 5 ? '+' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
        onPress={handleCreateGroup}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.continueBtnText}>Create Group</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </>
        )}
      </Pressable>

      {onSkip ? (
        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  groupNameBadge: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sizeBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: '#22C55E',
  },
  sizeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  sizeBtnTextActive: {
    color: '#22C55E',
  },
  inviteSection: {
    marginBottom: 20,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  methodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  methodBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  inviteInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inviteInputSent: {
    opacity: 0.5,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sentBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  shareBtnText: {
    fontSize: 15,
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
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 20,
  },
  codeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  featuresList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  reminderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 12,
  },
});
