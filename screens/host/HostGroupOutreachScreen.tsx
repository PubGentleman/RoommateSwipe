import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, TextInput, Pressable,
  ActivityIndicator, Alert, StyleSheet, Platform,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  getGroupsForListing,
  createOutreachPayment,
  getContactedGroupIds,
  OUTREACH_PACKAGES,
  OutreachPackage,
} from '../../services/groupService';
import { getOutreachStatus } from '../../services/listingService';
import { useOutreachPayment } from '../../hooks/useOutreachPayment';

interface Props {
  route: { params: { listingId: string; listingTitle: string } };
  navigation: any;
}

export function HostGroupOutreachScreen({ route, navigation }: Props) {
  const { listingId, listingTitle } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { presentOutreachPayment } = useOutreachPayment();

  const [groups, setGroups] = useState<any[]>([]);
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());
  const [outreachStatus, setOutreachStatus] = useState<{
    unlocked: boolean; hoursRemaining: number;
  }>({ unlocked: false, hoursRemaining: 48 });

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedPackage, setSelectedPackage] = useState<OutreachPackage | null>(null);
  const [message, setMessage] = useState('');
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [groupData, status, contacted] = await Promise.all([
          getGroupsForListing(listingId),
          getOutreachStatus(listingId),
          getContactedGroupIds(listingId),
        ]);
        setGroups(groupData);
        setOutreachStatus(status);
        setContactedIds(new Set(contacted));
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [listingId]);

  useEffect(() => {
    const count = selectedGroupIds.size;
    if (count === 0) { setSelectedPackage(null); return; }
    const available = OUTREACH_PACKAGES.filter(
      p => p.groupCount === null || p.groupCount >= count
    );
    setSelectedPackage(available[0] || OUTREACH_PACKAGES[OUTREACH_PACKAGES.length - 1]);
  }, [selectedGroupIds]);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) { next.delete(groupId); } else { next.add(groupId); }
      return next;
    });
  }

  async function handlePayAndSend() {
    if (!selectedPackage) return;
    if (!message.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Write your message first');
      } else {
        Alert.alert('Write your message first');
      }
      return;
    }
    if (selectedGroupIds.size === 0) {
      if (Platform.OS === 'web') {
        window.alert('Select at least one group');
      } else {
        Alert.alert('Select at least one group');
      }
      return;
    }

    setPaying(true);
    try {
      const groupIds = Array.from(selectedGroupIds);
      const { clientSecret } = await createOutreachPayment(
        listingId,
        selectedPackage.id,
        groupIds,
        message.trim()
      );

      const { success } = await presentOutreachPayment(clientSecret);
      if (!success) return;

      Alert.alert(
        'Messages Sent!',
        `Your message is on its way to ${groupIds.length} group${groupIds.length > 1 ? 's' : ''}.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );

      setContactedIds(prev => new Set([...prev, ...groupIds]));
      setSelectedGroupIds(new Set());
      setMessage('');
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'web') {
        window.alert(e.message || 'Something went wrong. Please try again.');
      } else {
        Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  const availableGroups = groups.filter(g => !contactedIds.has(g.id));
  const allSelected = availableGroups.length > 0 &&
    availableGroups.every(g => selectedGroupIds.has(g.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(availableGroups.map(g => g.id)));
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
    >
      <ThemedText style={[Typography.h2, { marginBottom: 4 }]}>Group Outreach</ThemedText>
      <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
        {listingTitle} · Rented
      </ThemedText>

      {!outreachStatus.unlocked ? (
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="clock" size={16} color={theme.textSecondary} />
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 8, flex: 1 }]}>
            Outreach unlocks in{' '}
            <ThemedText style={{ fontWeight: '700', color: theme.text }}>
              {outreachStatus.hoursRemaining}h
            </ThemedText>
            . This 48-hour window ensures the listing is genuinely rented.
          </ThemedText>
        </View>
      ) : null}

      {outreachStatus.unlocked ? (
        <>
          <View style={[styles.composerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[Typography.body, { fontWeight: '600', marginBottom: 4 }]}>
              Your message
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              One message sent to each group you select below.
            </ThemedText>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              placeholder="Hi! Your group was interested in my listing — I have a similar property available that might be a great fit..."
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.messageInput,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }
              ]}
              maxLength={500}
            />
            <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'right', marginTop: 4 }]}>
              {message.length}/500
            </ThemedText>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
              Select groups to contact
            </ThemedText>
            {availableGroups.length > 1 ? (
              <Pressable onPress={toggleSelectAll}>
                <ThemedText style={[Typography.small, { color: theme.primary }]}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {availableGroups.length === 0 ? (
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              All groups have already been contacted.
            </ThemedText>
          ) : null}

          {availableGroups.map(group => {
            const isSelected = selectedGroupIds.has(group.id);
            return (
              <Pressable
                key={group.id}
                style={[
                  styles.groupRow,
                  {
                    backgroundColor: isSelected ? theme.primary + '15' : theme.card,
                    borderColor: isSelected ? theme.primary : theme.border,
                  }
                ]}
                onPress={() => toggleGroup(group.id)}
              >
                <View style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? theme.primary : 'transparent',
                    borderColor: isSelected ? theme.primary : theme.border,
                  }
                ]}>
                  {isSelected ? <Feather name="check" size={12} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                    {group.name}
                  </ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} ·{' '}
                    {group.members.slice(0, 3).map((m: any) => m.name.split(' ')[0]).join(', ')}
                    {group.members.length > 3 ? ` +${group.members.length - 3}` : ''}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}

          {groups.filter(g => contactedIds.has(g.id)).map(group => (
            <View
              key={group.id}
              style={[styles.groupRow, { backgroundColor: theme.card, borderColor: theme.border, opacity: 0.5 }]}
            >
              <View style={[styles.checkbox, { backgroundColor: '#22C55E', borderColor: '#22C55E' }]}>
                <Feather name="check" size={12} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                  {group.name}
                </ThemedText>
                <ThemedText style={[Typography.small, { color: '#22C55E' }]}>
                  Already contacted
                </ThemedText>
              </View>
            </View>
          ))}

          {selectedGroupIds.size > 0 && selectedPackage ? (
            <View style={[styles.ctaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ThemedText style={[Typography.body, { fontWeight: '700', marginBottom: Spacing.sm }]}>
                Pricing
              </ThemedText>

              {OUTREACH_PACKAGES.map(pkg => {
                const covers = pkg.groupCount === null || pkg.groupCount >= selectedGroupIds.size;
                const isSelected = pkg.id === selectedPackage.id;
                return (
                  <Pressable
                    key={pkg.id}
                    style={[
                      styles.packageRow,
                      {
                        backgroundColor: isSelected ? theme.primary + '15' : 'transparent',
                        borderColor: isSelected ? theme.primary : theme.border,
                        opacity: covers ? 1 : 0.4,
                      }
                    ]}
                    onPress={() => { if (covers) setSelectedPackage(pkg); }}
                    disabled={!covers}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                        {pkg.label}
                      </ThemedText>
                      <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                        {pkg.description}
                      </ThemedText>
                    </View>
                    <ThemedText style={[Typography.h3, { color: isSelected ? theme.primary : theme.text }]}>
                      ${(pkg.priceCents / 100).toFixed(2)}
                    </ThemedText>
                    {isSelected ? (
                      <Feather name="check-circle" size={16} color={theme.primary} style={{ marginLeft: 8 }} />
                    ) : null}
                  </Pressable>
                );
              })}

              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.md }]}>
                {selectedGroupIds.size} group{selectedGroupIds.size > 1 ? 's' : ''} selected ·{' '}
                ${(selectedPackage.priceCents / 100).toFixed(2)} total
              </ThemedText>

              <Pressable
                style={[styles.payBtn, { backgroundColor: paying ? theme.border : theme.primary }]}
                onPress={handlePayAndSend}
                disabled={paying}
              >
                {paying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '700', marginLeft: 8 }]}>
                      Pay ${(selectedPackage.priceCents / 100).toFixed(2)} & Send
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  composerCard: {
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCard: {
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
});
