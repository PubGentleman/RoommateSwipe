import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, ActivityIndicator, Alert, TextInput, Platform, Image } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { isFreePlan } from '../../utils/hostPricing';
import { HostSubscriptionData } from '../../types/models';
import { createListingInquiryGroup } from '../../services/groupService';
import {
  getOutreachQuotaStatus,
  sendProactiveOutreach,
  getRecentlySentGroupIds,
  addPaidCreditsLocal,
  OutreachQuotaStatus,
} from '../../services/hostOutreachService';
import { UNLOCK_PACKAGES } from '../../constants/planLimits';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const ROOMDR_PURPLE = '#7B5EA7';
const MIN_MSG_LENGTH = 50;

interface RenterGroupCard {
  groupId: string;
  name: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
  location: string;
  neighborhoods: string[];
  lifestyleTags: string[];
  occupationTypes: string[];
  memberPhotos: string[];
  createdAt: string;
}

export const BrowseRenterGroupsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [groups, setGroups] = useState<RenterGroupCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentGroupIds, setSentGroupIds] = useState<Set<string>>(new Set());
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [quota, setQuota] = useState<OutreachQuotaStatus | null>(null);

  const [composeTarget, setComposeTarget] = useState<RenterGroupCard | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [showUnlock, setShowUnlock] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const plan = hostSub?.plan ?? 'free';

  useFocusEffect(
    useCallback(() => {
      if (user) loadAll();
    }, [user])
  );

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sub = await StorageService.getHostSubscription(user.id);
      setHostSub(sub);
      if (isFreePlan(sub.plan)) {
        setLoading(false);
        return;
      }

      const [quotaData, sentIds] = await Promise.all([
        getOutreachQuotaStatus(user.id, sub.plan),
        getRecentlySentGroupIds(user.id),
      ]);
      setQuota(quotaData);
      setSentGroupIds(new Set(sentIds));
      await loadGroups();
    } catch {
      loadMockGroups();
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await StorageService.getVisibleRenterGroups();
      if (data.length > 0) {
        setGroups(data);
      } else {
        loadMockGroups();
      }
    } catch {
      loadMockGroups();
    }
  };

  const loadMockGroups = () => {
    setGroups([
      {
        groupId: 'group_mock_1',
        name: 'Creative Roommates',
        description: 'Artists, designers, and creative professionals seeking a collaborative living space',
        memberCount: 3,
        maxMembers: 4,
        budgetMin: 2000,
        budgetMax: 2800,
        moveInDate: 'April 2026',
        location: 'Williamsburg',
        neighborhoods: ['Brooklyn', 'Bushwick', 'Bed-Stuy'],
        lifestyleTags: ['Pet-friendly', 'Non-smoker', 'Remote work'],
        occupationTypes: ['Professional', 'Creative'],
        memberPhotos: [
          'https://picsum.photos/200/200?random=31',
          'https://picsum.photos/200/200?random=32',
          'https://picsum.photos/200/200?random=33',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_2',
        name: 'Young Professionals',
        description: 'Working professionals looking for a clean, quiet apartment near transit',
        memberCount: 2,
        maxMembers: 3,
        budgetMin: 1500,
        budgetMax: 2200,
        moveInDate: 'May 2026',
        location: 'Astoria',
        neighborhoods: ['Astoria', 'Long Island City'],
        lifestyleTags: ['Early riser', 'Clean', 'Social'],
        occupationTypes: ['Student', 'Professional'],
        memberPhotos: [
          'https://picsum.photos/200/200?random=34',
          'https://picsum.photos/200/200?random=35',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_3',
        name: 'Manhattan Movers',
        description: 'Finance and tech professionals seeking upscale shared living in Manhattan',
        memberCount: 4,
        maxMembers: 4,
        budgetMin: 3000,
        budgetMax: 4000,
        moveInDate: 'March 2026',
        location: 'Upper West Side',
        neighborhoods: ['Manhattan', 'Upper West Side', 'Harlem'],
        lifestyleTags: ['Quiet hours', 'Non-smoker', 'Professional'],
        occupationTypes: ['Professional', 'Finance'],
        memberPhotos: [
          'https://picsum.photos/200/200?random=36',
          'https://picsum.photos/200/200?random=37',
          'https://picsum.photos/200/200?random=38',
          'https://picsum.photos/200/200?random=39',
        ],
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const openCompose = (group: RenterGroupCard) => {
    if (sentGroupIds.has(group.groupId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComposeTarget(group);
    setMessage('');
  };

  const handleSend = async () => {
    if (!composeTarget || !user) return;

    if (message.trim().length < MIN_MSG_LENGTH) {
      const msg = `Your message must be at least ${MIN_MSG_LENGTH} characters to prevent spam.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Too Short', msg);
      return;
    }

    setSending(true);
    try {
      await sendProactiveOutreach(user.id, composeTarget.groupId, message.trim(), plan);

      const properties = await StorageService.getProperties();
      const activeListing = properties.find(p => p.hostId === user.id && p.available);
      if (activeListing) {
        try {
          const groupName = `Inquiry — ${composeTarget.location || composeTarget.neighborhoods[0] || 'Listing'}`;
          await createListingInquiryGroup(
            activeListing.id,
            user.id,
            activeListing.address || activeListing.city || 'Your listing',
            composeTarget.groupId,
            groupName,
          );
        } catch {}
      }

      setSentGroupIds(prev => new Set([...prev, composeTarget.groupId]));
      setComposeTarget(null);
      setMessage('');

      const newQuota = await getOutreachQuotaStatus(user.id, plan);
      setQuota(newQuota);

      const msg = 'Your message was delivered to the group.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Message Sent', msg);
    } catch (e: any) {
      const errMsg = e.message || '';
      if (errMsg === 'DAILY_LIMIT_REACHED') {
        setComposeTarget(null);
        setShowUnlock(true);
      } else if (errMsg === 'HOURLY_LIMIT_REACHED') {
        const msg = 'You can only send a few messages per hour. Try again shortly.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Slow Down', msg);
      } else if (errMsg === 'GROUP_COOLDOWN') {
        const msg = 'You messaged this group recently. Wait 30 days before reaching out again.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Already Contacted', msg);
      } else if (errMsg === 'MESSAGE_TOO_SHORT') {
        const msg = `Write at least ${MIN_MSG_LENGTH} characters.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Too Short', msg);
      } else if (errMsg === 'SUSPENDED') {
        const msg = 'Your outreach privileges have been suspended due to reports. Contact support to appeal.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Outreach Suspended', msg);
      } else {
        const msg = 'Could not send message. Please try again.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Error', msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleUnlock = async (packageId: string) => {
    setPurchasing(packageId);
    const pkg = UNLOCK_PACKAGES.find(p => p.id === packageId)!;
    try {
      await addPaidCreditsLocal(user!.id, pkg.credits);
      const newQuota = await getOutreachQuotaStatus(user!.id, plan);
      setQuota(newQuota);
      setShowUnlock(false);

      const msg = `${pkg.credits} additional messages added for today.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Unlocked!', msg);
    } catch (e: any) {
      const msg = e.message || 'Payment failed.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setPurchasing(null);
    }
  };

  if (hostSub && isFreePlan(hostSub.plan)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Renter Groups</Text>
            <Text style={styles.subtitle}>Groups actively looking for a place together</Text>
          </View>
        </View>
        <View style={styles.lockedContainer}>
          <LinearGradient
            colors={['rgba(123,94,167,0.15)', 'transparent']}
            style={styles.lockedGradient}
          >
            <View style={styles.lockedIconWrap}>
              <Feather name="lock" size={32} color={PURPLE} />
            </View>
            <Text style={styles.lockedTitle}>Browse Renter Groups</Text>
            <Text style={styles.lockedDesc}>
              Upgrade your host plan to see groups of renters actively looking for a place together — and message them directly with your listing.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Dashboard', { screen: 'HostSubscription' })}
              style={styles.upgradeCta}
            >
              <LinearGradient
                colors={[ROOMDR_PURPLE, '#6a4d96']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeCtaGradient}
              >
                <Feather name="zap" size={14} color="#fff" />
                <Text style={styles.upgradeCtaText}>See Plans</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    );
  }

  const quotaFill = quota && quota.dailyCap > 0 ? Math.min(1, quota.used / (quota.dailyCap + quota.paidExtra)) : 0;
  const quotaColor = quotaFill >= 1 ? '#ef4444' : quotaFill >= 0.66 ? '#f59e0b' : '#22c55e';

  const renderGroup = ({ item }: { item: RenterGroupCard }) => {
    const alreadySent = sentGroupIds.has(item.groupId);
    const spotsLeft = item.maxMembers - item.memberCount;

    const photos = item.memberPhotos || [];
    const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d'], ['#f6d365', '#fda085']];
    const avatarSlots = Array.from({ length: Math.min(item.memberCount, 3) }, (_, i) => ({
      photo: photos[i] || null,
      gradient: gradients[i % gradients.length],
      label: String.fromCharCode(65 + i),
    }));

    return (
      <Pressable style={styles.card} onPress={() => navigation.navigate('RenterGroupDetail', { group: item })}>
        <View style={styles.avatarCluster}>
          {avatarSlots.map((slot, i) => (
            <View
              key={i}
              style={[styles.avatarWrap, i > 0 && { marginLeft: -18 }, { zIndex: avatarSlots.length - i }]}
            >
              {slot.photo ? (
                <Image source={{ uri: slot.photo }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={slot.gradient} style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{slot.label}</Text>
                </LinearGradient>
              )}
            </View>
          ))}
          {spotsLeft > 0 ? (
            <View style={[styles.avatarWrap, styles.avatarEmpty, { marginLeft: -18, zIndex: 0 }]}>
              <Text style={styles.avatarPlus}>+</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.memberCountRow}>
          <Feather name="users" size={13} color="rgba(255,255,255,0.4)" />
          <Text style={styles.memberCountText}>
            {item.memberCount} of {item.maxMembers} members filled
          </Text>
          {spotsLeft > 0 ? (
            <View style={styles.spotPill}>
              <Text style={styles.spotPillText}>{spotsLeft} left</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.groupName}>{item.name}</Text>

        {item.description ? (
          <Text style={styles.groupDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
              <Feather name="dollar-sign" size={16} color={ACCENT} />
            </View>
            <View>
              <Text style={styles.statLabel}>BUDGET</Text>
              <Text style={styles.statValue}>${item.budgetMin.toLocaleString()}/mo</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
              <Feather name="map-pin" size={16} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>LOCATION</Text>
              <Text style={styles.statValue} numberOfLines={1}>{item.location || item.neighborhoods[0] || 'Flexible'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {item.lifestyleTags.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.lifestyleTags.slice(0, 4).map(t => (
              <View key={t} style={styles.lifestyleChip}>
                <Text style={styles.lifestyleText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.moveInDate ? (
          <View style={styles.moveInRow}>
            <Feather name="calendar" size={12} color="rgba(255,255,255,0.35)" />
            <Text style={styles.moveInText}>Move-in: {item.moveInDate}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.ctaButton, alreadySent ? styles.ctaButtonSent : null]}
          onPress={() => openCompose(item)}
          disabled={alreadySent || (quota?.suspended === true)}
        >
          {alreadySent ? (
            <View style={styles.ctaInner}>
              <Feather name="check-circle" size={15} color="#22c55e" />
              <Text style={[styles.ctaText, { color: '#22c55e' }]}>Message Sent</Text>
            </View>
          ) : (
            <LinearGradient
              colors={[ROOMDR_PURPLE, '#6a4d96']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Feather name="send" size={15} color="#fff" />
              <Text style={styles.ctaText}>Message This Group</Text>
            </LinearGradient>
          )}
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Renter Groups</Text>
          <Text style={styles.subtitle}>
            {groups.length > 0 ? `${groups.length} groups looking for a place` : 'Groups actively looking for a place together'}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="users" size={14} color={PURPLE} />
          <Text style={styles.headerBadgeText}>{groups.length}</Text>
        </View>
      </View>

      {quota && !quota.suspended && quota.dailyCap > 0 ? (
        <View style={styles.quotaBar}>
          <Feather name="send" size={14} color={quotaColor} />
          <Text style={styles.quotaText}>
            {quota.remaining} of {quota.dailyCap + quota.paidExtra} left today
          </Text>
          <View style={styles.quotaTrack}>
            <View style={[styles.quotaFill, { width: `${quotaFill * 100}%`, backgroundColor: quotaColor }]} />
          </View>
          {quota.hitDailyLimit ? (
            <Pressable style={styles.unlockBtn} onPress={() => setShowUnlock(true)}>
              <Feather name="unlock" size={12} color={ACCENT} />
              <Text style={styles.unlockBtnText}>Unlock</Text>
            </Pressable>
          ) : null}
          {quota.paidExtra > 0 ? (
            <View style={styles.paidPill}>
              <Text style={styles.paidPillText}>+{quota.paidExtra} paid</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {quota?.suspended ? (
        <View style={styles.suspendedBar}>
          <Feather name="alert-triangle" size={14} color="#ef4444" />
          <Text style={styles.suspendedText}>Outreach suspended due to reports. Contact support to appeal.</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
          <Text style={styles.loadingText}>Finding renter groups...</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={item => item.groupId}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No groups visible right now</Text>
              <Text style={styles.emptySubtext}>Check back soon for new renter groups.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!composeTarget} transparent animationType="slide" onRequestClose={() => setComposeTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setComposeTarget(null)}>
          <Pressable style={styles.composeSheet} onPress={() => {}}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>Message {composeTarget?.name}</Text>
              <Pressable onPress={() => setComposeTarget(null)}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>

            <Text style={styles.composeHint}>
              Introduce your listing and why it's a great fit for this group. Be specific and personal — groups respond better to tailored messages.
            </Text>

            <TextInput
              style={styles.composeInput}
              multiline
              placeholder="Hi! I have a beautiful 3-bedroom apartment in Williamsburg that I think would be perfect for your group..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={message}
              onChangeText={setMessage}
              maxLength={500}
            />

            <View style={styles.charRow}>
              <Text style={[
                styles.charCount,
                message.trim().length < MIN_MSG_LENGTH ? { color: '#ef4444' } : { color: 'rgba(255,255,255,0.3)' },
              ]}>
                {message.trim().length}/{MIN_MSG_LENGTH} min
              </Text>
              <Text style={styles.charMax}>{message.length}/500</Text>
            </View>

            {message.trim().length > 0 && message.trim().length < MIN_MSG_LENGTH ? (
              <View style={styles.warningRow}>
                <Feather name="alert-circle" size={14} color="#f59e0b" />
                <Text style={styles.warningText}>
                  {MIN_MSG_LENGTH - message.trim().length} more characters needed
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.sendBtn, { opacity: message.trim().length < MIN_MSG_LENGTH || sending ? 0.5 : 1 }]}
              onPress={handleSend}
              disabled={message.trim().length < MIN_MSG_LENGTH || sending}
            >
              <LinearGradient
                colors={[ROOMDR_PURPLE, '#6a4d96']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendBtnGradient}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={styles.sendBtnText}>Send Message</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showUnlock} transparent animationType="slide" onRequestClose={() => setShowUnlock(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowUnlock(false)}>
          <Pressable style={styles.unlockSheet} onPress={() => {}}>
            <View style={styles.unlockIconWrap}>
              <Feather name="zap" size={28} color={ACCENT} />
            </View>
            <Text style={styles.unlockTitle}>Daily Limit Reached</Text>
            <Text style={styles.unlockDesc}>
              You've used all your outreach messages for today. Purchase additional sends to keep reaching groups.
            </Text>

            {UNLOCK_PACKAGES.map(pkg => (
              <Pressable
                key={pkg.id}
                style={styles.unlockPackage}
                onPress={() => handleUnlock(pkg.id)}
                disabled={purchasing !== null}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlockPkgLabel}>{pkg.label}</Text>
                  <Text style={styles.unlockPkgNote}>Expires at midnight</Text>
                </View>
                {purchasing === pkg.id ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <View style={styles.unlockPricePill}>
                    <Text style={styles.unlockPriceText}>${(pkg.priceCents / 100).toFixed(2)}</Text>
                  </View>
                )}
              </Pressable>
            ))}

            <Pressable style={styles.cancelUnlock} onPress={() => setShowUnlock(false)}>
              <Text style={styles.cancelUnlockText}>Not Now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 3, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: PURPLE },

  quotaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
  },
  quotaText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  quotaTrack: { width: 70, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  quotaFill: { height: '100%', borderRadius: 3 },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
  },
  unlockBtnText: { fontSize: 11, fontWeight: '700', color: ACCENT },
  paidPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  paidPillText: { fontSize: 10, fontWeight: '700', color: '#22c55e' },

  suspendedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.06)',
    gap: 8,
  },
  suspendedText: { fontSize: 12, color: '#ef4444', flex: 1 },

  list: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },

  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: CARD_BG,
  },
  avatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: '#fff' },
  avatarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed' as any,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlus: { fontSize: 22, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },

  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  memberCountText: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  spotPill: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  spotPillText: { fontSize: 11, fontWeight: '700', color: '#22c55e' },

  groupName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  groupDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 1 },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  lifestyleChip: {
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lifestyleText: { fontSize: 12, fontWeight: '500', color: PURPLE },

  moveInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  moveInText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  ctaButton: { borderRadius: 14, overflow: 'hidden' },
  ctaButtonSent: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 14,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  lockedGradient: { width: '100%', borderRadius: 24, padding: 32, alignItems: 'center' },
  lockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  lockedDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  upgradeCta: { borderRadius: 14, overflow: 'hidden', width: '100%' },
  upgradeCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
  },
  upgradeCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },

  composeSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 24,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  composeTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  composeHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 19,
    marginBottom: 16,
  },
  composeInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    minHeight: 130,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  charCount: { fontSize: 11, fontWeight: '600' },
  charMax: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    backgroundColor: 'rgba(245,158,11,0.06)',
    marginBottom: 12,
  },
  warningText: { fontSize: 12, color: '#f59e0b' },
  sendBtn: { borderRadius: 14, overflow: 'hidden' },
  sendBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  unlockSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 24,
    alignItems: 'center',
  },
  unlockIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unlockTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  unlockDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  unlockPackage: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  unlockPkgLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  unlockPkgNote: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  unlockPricePill: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unlockPriceText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  cancelUnlock: { marginTop: 8, paddingVertical: 10 },
  cancelUnlockText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
});
