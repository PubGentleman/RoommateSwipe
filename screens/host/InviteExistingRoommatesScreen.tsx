import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  createExistingRoommateInvites,
  getExistingRoommatesForListing,
  shareRoommateLink,
  getShareableLink,
  deleteExistingRoommateInvite,
  ExistingRoommateRecord,
} from '../../services/existingRoommateService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';

export const InviteExistingRoommatesScreen = () => {
  const route = useRoute<any>();
  const { listingId, count, listingAddress } = route.params || {};
  const { user } = useAuth();
  const { alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [roommates, setRoommates] = useState<ExistingRoommateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadRoommates = useCallback(async () => {
    if (!listingId) { setLoading(false); return; }
    try {
      const existing = await getExistingRoommatesForListing(listingId);
      if (existing.length > 0) {
        setRoommates(existing);
      } else if (count > 0) {
        setCreating(true);
        const created = await createExistingRoommateInvites(listingId, count);
        setRoommates(created);
        setCreating(false);
      }
    } catch (e) {
      console.error('[InviteExistingRoommates] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [listingId, count]);

  useEffect(() => {
    loadRoommates();
  }, []);

  if (!listingId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Listing not found</Text>
      </View>
    );
  }

  const handleShare = async (roommate: ExistingRoommateRecord, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await shareRoommateLink(roommate.inviteToken, index);
      if (Platform.OS === 'web') {
        showAlert({ title: 'Link Copied', message: 'The invite link has been copied to your clipboard. Share it with your roommate.' });
      }
    } catch (e) {
      console.error('[InviteExistingRoommates] Share error:', e);
    }
  };

  const handleCopyLink = async (roommate: ExistingRoommateRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const link = getShareableLink(roommate.inviteToken);
    await Clipboard.setStringAsync(link);
    showAlert({ title: 'Copied', message: 'Link copied to clipboard.' });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadRoommates();
  };

  const completedCount = roommates.filter((r) => r.profileCompleted).length;
  const totalCount = roommates.length;

  if (loading || creating) {
    return (
      <View style={[styles.centered, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        {creating ? (
          <Text style={styles.loadingText}>Creating invite links...</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Roommate Profiles</Text>
        <Pressable onPress={handleRefresh} style={styles.backBtn}>
          <Feather name="refresh-cw" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.introCard}>
          <Feather name="link" size={24} color={ACCENT} />
          <Text style={styles.introTitle}>Invite your existing roommates</Text>
          <Text style={styles.introText}>
            Share these links with the people already living in your unit. They'll fill out a quick
            preferences form so Rhome can find someone compatible with everyone.
          </Text>
        </View>

        {listingAddress ? (
          <View style={styles.listingBadge}>
            <Feather name="home" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.listingBadgeText}>{listingAddress}</Text>
          </View>
        ) : null}

        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{totalCount} completed
          </Text>
        </View>

        {roommates.map((roommate, index) => (
          <View key={roommate.id} style={styles.roommateCard}>
            <View style={styles.roommateHeader}>
              <View style={styles.avatarCircle}>
                <Feather
                  name={roommate.profileCompleted ? 'check' : 'user'}
                  size={18}
                  color={roommate.profileCompleted ? '#4CAF50' : 'rgba(255,255,255,0.4)'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roommateName}>
                  {roommate.firstName || `Roommate ${index + 1}`}
                </Text>
                <Text
                  style={[
                    styles.roommateStatus,
                    roommate.profileCompleted ? styles.statusComplete : styles.statusPending,
                  ]}
                >
                  {roommate.profileCompleted ? 'Profile completed' : 'Waiting for response'}
                </Text>
              </View>
            </View>

            {roommate.profileCompleted ? (
              <View style={styles.prefsGrid}>
                {roommate.sleepSchedule ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>
                      {roommate.sleepSchedule === 'early_bird'
                        ? 'Early Bird'
                        : roommate.sleepSchedule === 'night_owl'
                          ? 'Night Owl'
                          : 'Flexible'}
                    </Text>
                  </View>
                ) : null}
                {roommate.cleanliness ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>Clean: {roommate.cleanliness}/5</Text>
                  </View>
                ) : null}
                {roommate.smoking ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>Smoker</Text>
                  </View>
                ) : null}
                {roommate.pets ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>Pet OK</Text>
                  </View>
                ) : null}
                {roommate.noiseLevel ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>
                      {roommate.noiseLevel.charAt(0).toUpperCase() + roommate.noiseLevel.slice(1)}
                    </Text>
                  </View>
                ) : null}
                {roommate.guestsFrequency ? (
                  <View style={styles.prefChip}>
                    <Text style={styles.prefChipText}>
                      Guests: {roommate.guestsFrequency}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => handleShare(roommate, index)}
                >
                  <Feather name="share-2" size={15} color="#fff" />
                  <Text style={styles.shareBtnText}>Share Link</Text>
                </Pressable>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => handleCopyLink(roommate)}
                >
                  <Feather name="copy" size={15} color={ACCENT} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        {completedCount === totalCount && totalCount > 0 ? (
          <View style={styles.allDoneCard}>
            <Feather name="check-circle" size={28} color="#4CAF50" />
            <Text style={styles.allDoneTitle}>All roommates responded!</Text>
            <Text style={styles.allDoneText}>
              Rhome's AI will now factor in everyone's preferences when finding new renters for your
              listing.
            </Text>
          </View>
        ) : null}

        <Pressable
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  introCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  introTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  introText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  listingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: 'center',
  },
  listingBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
  roommateCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  roommateHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roommateName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  roommateStatus: { fontSize: 12, marginTop: 2 },
  statusComplete: { color: '#4CAF50' },
  statusPending: { color: 'rgba(255,255,255,0.35)' },
  prefsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  prefChip: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  prefChipText: { color: ACCENT, fontSize: 12, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  copyBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  allDoneCard: {
    backgroundColor: 'rgba(76,175,80,0.08)',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  allDoneTitle: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },
  allDoneText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
});

export default InviteExistingRoommatesScreen;
