import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Alert, Share, Linking, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMyReferralCode,
  getReferralLink,
  getReferralStats,
  getMyReferrals,
  getRewardMilestones,
  trackLinkShare,
  type Referral,
  type ReferralStats,
  type RewardMilestone,
} from '../../services/referralService';
import { ContactInviteSheet } from '../../components/ContactInviteSheet';
import { createErrorHandler } from '../../utils/errorLogger';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  invited: { label: 'Invited', color: '#A0A0A0', bg: 'rgba(160,160,160,0.12)' },
  signed_up: { label: 'Signed Up', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  onboarded: { label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  subscribed: { label: 'Subscribed', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

const INVITE_METHODS = [
  { key: 'contacts', icon: 'users', label: 'Contacts', color: '#ff6b5b' },
  { key: 'sms', icon: 'message-circle', label: 'SMS', color: '#22C55E' },
  { key: 'copy', icon: 'copy', label: 'Copy Link', color: '#3b82f6' },
  { key: 'whatsapp', icon: 'phone', label: 'WhatsApp', color: '#25D366' },
  { key: 'share', icon: 'share-2', label: 'Share', color: '#6C5CE7' },
  { key: 'twitter', icon: 'globe', label: 'Twitter/X', color: '#1DA1F2' },
];

const REWARD_ICONS: Record<string, { icon: string; color: string }> = {
  first_signup: { icon: 'user-plus', color: '#3b82f6' },
  first_onboarded: { icon: 'check-circle', color: '#22C55E' },
  first_subscribed: { icon: 'star', color: '#f59e0b' },
  '5_referrals': { icon: 'zap', color: '#ff6b5b' },
  '10_referrals': { icon: 'award', color: '#6C5CE7' },
  '25_referrals': { icon: 'shield', color: '#3ECF8E' },
  '50_referrals': { icon: 'gift', color: '#ec4899' },
};

export default function InviteFriendsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<RewardMilestone[]>([]);
  const [showContacts, setShowContacts] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [c, s, r, rw] = await Promise.all([
        getMyReferralCode(user.id),
        getReferralStats(user.id),
        getMyReferrals(user.id),
        getRewardMilestones(),
      ]);
      setCode(c);
      setStats(s);
      setReferrals(r);
      setRewards(rw);
    } catch (e) {
      console.warn('[InviteFriends] Load failed:', e);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const link = getReferralLink(code);
  const shareMessage = `Hey! I've been using Rhome to find roommates and it's been great. Join me and we both earn credits: ${link}`;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(createErrorHandler('InviteFriendsScreen', 'notificationAsync'));
    Alert.alert('Copied!', 'Referral link copied to clipboard');
  };

  const handleSMS = async () => {
    if (user?.id) trackLinkShare(user.id, 'sms').catch(createErrorHandler('InviteFriendsScreen', 'trackLinkShare'));
    const url = Platform.OS === 'ios'
      ? `sms:&body=${encodeURIComponent(shareMessage)}`
      : `sms:?body=${encodeURIComponent(shareMessage)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else { await Clipboard.setStringAsync(shareMessage); Alert.alert('Copied!', 'Message copied'); }
    } catch { await Clipboard.setStringAsync(shareMessage); Alert.alert('Copied!', 'Message copied'); }
  };

  const handleWhatsApp = async () => {
    if (user?.id) trackLinkShare(user.id, 'social').catch(createErrorHandler('InviteFriendsScreen', 'trackLinkShare'));
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert('Not Available', 'WhatsApp is not installed.');
    } catch { Alert.alert('Error', 'Failed to open WhatsApp'); }
  };

  const handleTwitter = async () => {
    if (user?.id) trackLinkShare(user.id, 'social').catch(createErrorHandler('InviteFriendsScreen', 'trackLinkShare'));
    const text = `I've been using @RhomeApp to find roommates. Join me:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    try { await Linking.openURL(url); } catch {}
  };

  const handleNativeShare = async () => {
    if (user?.id) trackLinkShare(user.id, 'link').catch(createErrorHandler('InviteFriendsScreen', 'trackLinkShare'));
    try { await Share.share({ message: shareMessage }); } catch {}
  };

  const handleMethod = (key: string) => {
    switch (key) {
      case 'contacts': setShowContacts(true); break;
      case 'sms': handleSMS(); break;
      case 'copy': handleCopyLink(); break;
      case 'whatsapp': handleWhatsApp(); break;
      case 'share': handleNativeShare(); break;
      case 'twitter': handleTwitter(); break;
    }
  };

  const milestoneTargets: Record<string, number> = {
    first_signup: 1, first_onboarded: 1, first_subscribed: 1,
    '5_referrals': 5, '10_referrals': 10, '25_referrals': 25, '50_referrals': 50,
  };

  const isMilestoneCompleted = (m: string): boolean => {
    const target = milestoneTargets[m] || 0;
    return (stats?.signedUp || 0) >= target;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={styles.creditsBadge}>
          <Feather name="gift" size={12} color="#ff6b5b" />
          <Text style={styles.creditsText}>${stats?.currentCredits || 0}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(255,107,91,0.2)', 'rgba(108,92,231,0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroTitle}>Give $5, Get $5</Text>
          <Text style={styles.heroSubtitle}>
            Invite friends to Rhome. When they sign up, you both earn credits toward your subscription.
          </Text>
          <Pressable style={styles.heroShareBtn} onPress={handleNativeShare}>
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.heroShareText}>Share Invite</Text>
          </Pressable>
        </LinearGradient>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code || '...'}</Text>
            <Pressable onPress={handleCopyLink} style={styles.codeCopyBtn}>
              <Feather name="copy" size={14} color="#ff6b5b" />
            </Pressable>
          </View>
          <Text style={styles.codeLinkText} numberOfLines={1}>{link}</Text>
        </View>

        <View style={styles.methodsGrid}>
          {INVITE_METHODS.map(m => (
            <Pressable key={m.key} style={styles.methodItem} onPress={() => handleMethod(m.key)}>
              <View style={[styles.methodIcon, { backgroundColor: `${m.color}20` }]}>
                <Feather name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={styles.methodLabel}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        {stats ? (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalInvited}</Text>
                <Text style={styles.statLabel}>Invited</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.signedUp}</Text>
                <Text style={styles.statLabel}>Signed Up</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#ff6b5b' }]}>${stats.totalCreditsEarned}</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
            </View>

            {stats.nextMilestone ? (
              <View style={styles.milestoneProgress}>
                <Text style={styles.milestoneLabel}>
                  {stats.nextMilestone.progress} of {stats.nextMilestone.target} for: {stats.nextMilestone.description}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${Math.min(100, (stats.nextMilestone.progress / stats.nextMilestone.target) * 100)}%`,
                  }]} />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {referrals.length > 0 ? (
          <View style={styles.referralsCard}>
            <Text style={styles.sectionTitle}>Your Referrals</Text>
            {referrals.map(r => {
              const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.invited;
              const displayName = r.referredName || r.referredEmail || r.referredPhone || 'Pending';
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <View key={r.id} style={styles.referralRow}>
                  {r.referredPhoto ? (
                    <Image source={{ uri: r.referredPhoto }} style={styles.referralAvatar} />
                  ) : (
                    <View style={[styles.referralAvatar, styles.referralAvatarFallback]}>
                      <Text style={styles.referralAvatarText}>{initial}</Text>
                    </View>
                  )}
                  <View style={styles.referralInfo}>
                    <Text style={styles.referralName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.referralMethod}>{r.inviteMethod}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  {r.rewardAmount > 0 ? (
                    <Text style={styles.rewardAmount}>+${r.rewardAmount}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {rewards.length > 0 ? (
          <View style={styles.rewardsCard}>
            <Text style={styles.sectionTitle}>Rewards Ladder</Text>
            {rewards.map((r, i) => {
              const completed = isMilestoneCompleted(r.milestone);
              const iconCfg = REWARD_ICONS[r.milestone] || { icon: 'gift', color: '#A0A0A0' };
              return (
                <View key={r.milestone} style={styles.rewardRow}>
                  <View style={styles.rewardTimeline}>
                    <View style={[styles.rewardDot, completed ? styles.rewardDotCompleted : null]}>
                      {completed ? (
                        <Feather name="check" size={10} color="#fff" />
                      ) : (
                        <Feather name={iconCfg.icon} size={10} color={iconCfg.color} />
                      )}
                    </View>
                    {i < rewards.length - 1 ? (
                      <View style={[styles.rewardLine, completed ? styles.rewardLineCompleted : null]} />
                    ) : null}
                  </View>
                  <View style={styles.rewardContent}>
                    <Text style={[styles.rewardDesc, completed ? styles.rewardDescCompleted : null]}>
                      {r.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContactInviteSheet
        visible={showContacts}
        onClose={() => setShowContacts(false)}
        referralCode={code}
        onInvitesSent={(count) => {
          setShowContacts(false);
          if (count > 0) {
            Alert.alert('Invites Sent', `${count} invite${count > 1 ? 's' : ''} sent!`);
            loadData();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  creditsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,107,91,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  creditsText: { fontSize: 13, fontWeight: '700', color: '#ff6b5b' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 4 },
  heroCard: {
    borderRadius: 20, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,107,91,0.1)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 20, marginBottom: 20 },
  heroShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ff6b5b', borderRadius: 14, padding: 14,
  },
  heroShareText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  codeCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  codeLabel: { fontSize: 12, color: '#A0A0A0', fontWeight: '600', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  codeCopyBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,107,91,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  codeLinkText: { fontSize: 12, color: '#555', marginTop: 6 },
  methodsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16,
  },
  methodItem: { width: '30%', alignItems: 'center', gap: 6, marginBottom: 4 },
  methodIcon: {
    width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  methodLabel: { fontSize: 11, color: '#A0A0A0', textAlign: 'center' },
  statsCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 14 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginBottom: 14,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#A0A0A0', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.06)' },
  milestoneProgress: { marginTop: 4 },
  milestoneLabel: { fontSize: 12, color: '#A0A0A0', marginBottom: 8 },
  progressTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#ff6b5b', borderRadius: 3 },
  referralsCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  referralRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  referralAvatar: { width: 36, height: 36, borderRadius: 18 },
  referralAvatarFallback: {
    backgroundColor: 'rgba(255,107,91,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  referralAvatarText: { fontSize: 14, fontWeight: '700', color: '#ff6b5b' },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  referralMethod: { fontSize: 11, color: '#555', marginTop: 1, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  rewardAmount: { fontSize: 13, fontWeight: '700', color: '#22C55E', marginLeft: 4 },
  rewardsCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  rewardRow: { flexDirection: 'row', minHeight: 44 },
  rewardTimeline: { width: 24, alignItems: 'center' },
  rewardDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  rewardDotCompleted: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  rewardLine: {
    flex: 1, width: 2, backgroundColor: '#333', marginVertical: 2,
  },
  rewardLineCompleted: { backgroundColor: '#22C55E' },
  rewardContent: { flex: 1, paddingLeft: 12, paddingBottom: 14 },
  rewardDesc: { fontSize: 13, color: '#A0A0A0', lineHeight: 18 },
  rewardDescCompleted: { color: '#22C55E', fontWeight: '600' },
});
