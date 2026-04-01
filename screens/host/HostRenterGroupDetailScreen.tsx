import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import {
  getOutreachQuotaStatus,
  sendProactiveOutreach,
  checkGroupCooldown,
  addPaidCreditsLocal,
  OutreachQuotaStatus,
} from '../../services/hostOutreachService';
import { UNLOCK_PACKAGES } from '../../constants/planLimits';
import { createListingInquiryGroup } from '../../services/groupService';
import { isFreePlan } from '../../utils/hostPricing';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { reportUser, blockUser as blockUserRemote } from '../../services/moderationService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const ROOMDR_PURPLE = '#7B5EA7';
const MIN_MSG_LENGTH = 50;

interface MemberDetail {
  id: string;
  name: string;
  age: number;
  photo: string;
  occupation: string;
  bio: string;
  cleanliness: number;
  socialLevel: number;
  workSchedule: string;
  pets: boolean;
  smoking: boolean;
  interests: string[];
  verified: boolean;
  isCouple?: boolean;
}

export const HostRenterGroupDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user, blockUser: blockUserLocal } = useAuth();
  const { alert: showAlert } = useConfirm();
  const group = route.params?.group;

  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<OutreachQuotaStatus | null>(null);
  const [alreadySent, setAlreadySent] = useState(false);
  const [onCooldown, setOnCooldown] = useState(false);
  const [plan, setPlan] = useState('free');

  const [showCompose, setShowCompose] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [showUnlock, setShowUnlock] = useState(false);
  const [showMemberReport, setShowMemberReport] = useState(false);
  const [reportMemberTarget, setReportMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user || !group) return;
    setLoading(true);
    try {
      const sub = await StorageService.getHostSubscription(user.id);
      setPlan(sub.plan);
      const [quotaData, cooldownOk] = await Promise.all([
        getOutreachQuotaStatus(user.id, sub.plan),
        checkGroupCooldown(user.id, group.groupId),
      ]);
      setQuota(quotaData);
      setOnCooldown(!cooldownOk);
      await loadMembers();
    } catch {
      loadMockMembers();
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const profiles = await StorageService.getRoommateProfiles();
      const groups = await StorageService.getGroups();
      const fullGroup = groups.find(g => g.id === group.groupId);
      if (fullGroup && Array.isArray(fullGroup.members)) {
        const memberEntries = fullGroup.members.map((m: any) => {
          if (typeof m === 'string') return { uid: m, isCouple: false };
          return { uid: m.userId || m.id || m.user_id, isCouple: m.is_couple || m.isCouple || false };
        });
        const memberDetails: MemberDetail[] = memberEntries.map((entry: any) => {
          const profile = profiles.find(p => p.id === entry.uid || (p as any).userId === entry.uid);
          if (profile) {
            return {
              id: entry.uid,
              name: profile.name,
              age: profile.age,
              photo: profile.photos?.[0] || '',
              occupation: profile.occupation,
              bio: profile.bio,
              cleanliness: profile.lifestyle?.cleanliness ?? 3,
              socialLevel: profile.lifestyle?.socialLevel ?? 3,
              workSchedule: profile.lifestyle?.workSchedule || 'Standard',
              pets: profile.lifestyle?.pets ?? false,
              smoking: profile.lifestyle?.smoking ?? false,
              interests: profile.profileData?.interests ?? [],
              verified: !!profile.verification?.phone,
              isCouple: entry.isCouple,
            };
          }
          return null;
        }).filter(Boolean) as MemberDetail[];
        if (memberDetails.length > 0) {
          setMembers(memberDetails);
          return;
        }
      }
      loadMockMembers();
    } catch {
      loadMockMembers();
    }
  };

  const loadMockMembers = () => {
    const photos = group?.memberPhotos || [];
    const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley'];
    const occupations = ['Software Engineer', 'Graphic Designer', 'Marketing Manager', 'Data Analyst', 'Product Designer', 'Consultant'];
    const bios = [
      'Love exploring new restaurants and weekend hikes.',
      'Creative soul who enjoys cooking and movie nights.',
      'Fitness enthusiast and early morning runner.',
      'Tech nerd who also plays guitar on weekends.',
    ];
    const mockMembers: MemberDetail[] = Array.from({ length: group?.memberCount || 2 }, (_, i) => ({
      id: `mock_member_${i}`,
      name: names[i % names.length],
      age: 24 + (i * 2),
      photo: photos[i] || `https://picsum.photos/200/200?random=${40 + i}`,
      occupation: occupations[i % occupations.length],
      bio: bios[i % bios.length],
      cleanliness: 3 + (i % 3),
      socialLevel: 2 + (i % 4),
      workSchedule: i % 2 === 0 ? '9-5' : 'Flexible',
      pets: i % 3 === 0,
      smoking: false,
      interests: ['Cooking', 'Hiking', 'Music', 'Travel'].slice(0, 2 + (i % 3)),
      verified: i % 2 === 0,
    }));
    setMembers(mockMembers);
  };

  const openCompose = () => {
    if (alreadySent || onCooldown) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCompose(true);
    setMessage('');
  };

  const handleSend = async () => {
    if (!user || !group) return;
    if (message.trim().length < MIN_MSG_LENGTH) {
      await showAlert({ title: 'Too Short', message: `Your message must be at least ${MIN_MSG_LENGTH} characters.`, variant: 'warning' });
      return;
    }
    setSending(true);
    try {
      await sendProactiveOutreach(user.id, group.groupId, message.trim(), plan);
      const properties = await StorageService.getProperties();
      const activeListing = properties.find(p => p.hostId === user.id && p.available);
      if (activeListing) {
        try {
          await createListingInquiryGroup(
            activeListing.id, user.id,
            activeListing.address || activeListing.city || 'Your listing',
            group.groupId,
            `Inquiry — ${group.location || group.neighborhoods?.[0] || 'Listing'}`,
          );
        } catch {}
      }
      setAlreadySent(true);
      setShowCompose(false);
      setMessage('');
      const newQuota = await getOutreachQuotaStatus(user.id, plan);
      setQuota(newQuota);
      await showAlert({ title: 'Message Sent', message: 'Your message was delivered to the group.', variant: 'success' });
    } catch (e: any) {
      const err = e.message || '';
      if (err === 'DAILY_LIMIT_REACHED') { setShowCompose(false); setShowUnlock(true); }
      else if (err === 'HOURLY_LIMIT_REACHED') {
        await showAlert({ title: 'Rate Limit', message: 'Slow down — try again shortly.', variant: 'warning' });
      } else if (err === 'GROUP_COOLDOWN') {
        await showAlert({ title: 'Already Contacted', message: 'You messaged this group recently. Wait 30 days.', variant: 'warning' });
      } else {
        await showAlert({ title: 'Error', message: 'Could not send. Please try again.', variant: 'warning' });
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
      await showAlert({ title: 'Unlocked!', message: `${pkg.credits} additional messages added for today.`, variant: 'success' });
    } catch {
      await showAlert({ title: 'Error', message: 'Payment failed.', variant: 'warning' });
    } finally {
      setPurchasing(null);
    }
  };

  const renderLevelDots = (level: number, max: number = 5) => (
    <View style={styles.levelDots}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.dot, i < level ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );

  if (!group) return null;

  const spotsLeft = group.maxMembers - group.memberCount;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
        <Pressable
          onPress={() => {
            if (members.length > 0) {
              setReportMemberTarget({ id: members[0].id, name: members[0].name });
              setShowMemberReport(true);
            }
          }}
          style={styles.backBtn}
        >
          <Feather name="more-vertical" size={20} color="#999" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.photoRow}>
              {members.slice(0, 4).map((m, i) => (
                <View key={m.id} style={[styles.heroAvatarWrap, { zIndex: members.length - i }]}>
                  {m.photo ? (
                    <Image source={{ uri: m.photo }} style={styles.heroAvatar} />
                  ) : (
                    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.heroAvatar}>
                      <Text style={styles.heroAvatarLetter}>{m.name[0]}</Text>
                    </LinearGradient>
                  )}
                </View>
              ))}
              {spotsLeft > 0 ? (
                <View style={[styles.heroAvatarWrap, styles.heroAvatarEmpty]}>
                  <Text style={styles.heroAvatarPlus}>+{spotsLeft}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroName}>{group.name}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Feather name="users" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.heroBadgeText}>{group.memberCount}/{group.maxMembers} members</Text>
              </View>
              {spotsLeft > 0 ? (
                <View style={[styles.heroBadge, { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.08)' }]}>
                  <Text style={[styles.heroBadgeText, { color: '#22c55e' }]}>{spotsLeft} spots open</Text>
                </View>
              ) : null}
            </View>
          </View>

          {group.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About This Group</Text>
              <Text style={styles.descText}>{group.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Details</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
                  <Feather name="dollar-sign" size={18} color={ACCENT} />
                </View>
                <Text style={styles.detailLabel}>Budget Range</Text>
                <Text style={styles.detailValue}>
                  ${group.budgetMin?.toLocaleString()} — ${group.budgetMax?.toLocaleString()}/mo
                </Text>
              </View>
              <View style={styles.detailCard}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <Feather name="map-pin" size={18} color={PURPLE} />
                </View>
                <Text style={styles.detailLabel}>Preferred Area</Text>
                <Text style={styles.detailValue}>{group.location || group.neighborhoods?.[0] || 'Flexible'}</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <Feather name="calendar" size={18} color="#22c55e" />
                </View>
                <Text style={styles.detailLabel}>Move-in</Text>
                <Text style={styles.detailValue}>{group.moveInDate || 'Flexible'}</Text>
              </View>
              <View style={styles.detailCard}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Feather name="briefcase" size={18} color="#3b82f6" />
                </View>
                <Text style={styles.detailLabel}>Occupations</Text>
                <Text style={styles.detailValue}>{group.occupationTypes?.join(', ') || 'Mixed'}</Text>
              </View>
            </View>
          </View>

          {group.neighborhoods?.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Neighborhoods</Text>
              <View style={styles.chipsRow}>
                {group.neighborhoods.map((n: string) => (
                  <View key={n} style={styles.neighborhoodChip}>
                    <Feather name="map-pin" size={11} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.neighborhoodText}>{n}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {group.lifestyleTags?.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lifestyle Preferences</Text>
              <View style={styles.chipsRow}>
                {group.lifestyleTags.map((t: string) => (
                  <View key={t} style={styles.lifestyleChip}>
                    <Text style={styles.lifestyleText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Members ({members.length})
              {(() => {
                const couples = members.filter(m => m.isCouple).length;
                const singles = members.length - couples;
                const roomsNeeded = members.length;
                if (couples > 0) {
                  return ` · ${couples} couple${couples > 1 ? 's' : ''}, ${singles} single${singles !== 1 ? 's' : ''} · ${roomsNeeded} room${roomsNeeded !== 1 ? 's' : ''} needed`;
                }
                return ` · ${roomsNeeded} room${roomsNeeded !== 1 ? 's' : ''} needed`;
              })()}
            </Text>
            {members.map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberHeader}>
                  {member.photo ? (
                    <Image source={{ uri: member.photo }} style={styles.memberPhoto} />
                  ) : (
                    <View style={[styles.memberPhoto, { backgroundColor: 'rgba(123,94,167,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{member.name[0]}</Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.name}, {member.age}</Text>
                      {member.verified ? (
                        <View style={styles.verifiedBadge}>
                          <Feather name="check" size={10} color="#22c55e" />
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => { setReportMemberTarget({ id: member.id, name: member.name }); setShowMemberReport(true); }}
                        hitSlop={8}
                        style={{ marginLeft: 'auto' }}
                      >
                        <Feather name="more-vertical" size={16} color="#666" />
                      </Pressable>
                    </View>
                    <Text style={styles.memberOccupation}>{member.occupation}</Text>
                    {member.isCouple ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, backgroundColor: 'rgba(236,72,153,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' }}>
                        <Feather name="heart" size={9} color="#ec4899" />
                        <Text style={{ fontSize: 10, color: '#ec4899', fontWeight: '700' }}>Couple</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {member.bio ? (
                  <Text style={styles.memberBio}>{member.bio}</Text>
                ) : null}
                <View style={styles.memberTraits}>
                  <View style={styles.traitRow}>
                    <Text style={styles.traitLabel}>Cleanliness</Text>
                    {renderLevelDots(member.cleanliness)}
                  </View>
                  <View style={styles.traitRow}>
                    <Text style={styles.traitLabel}>Social</Text>
                    {renderLevelDots(member.socialLevel)}
                  </View>
                  <View style={styles.traitRow}>
                    <Text style={styles.traitLabel}>Schedule</Text>
                    <Text style={styles.traitValue}>{member.workSchedule}</Text>
                  </View>
                  <View style={styles.traitRow}>
                    <Text style={styles.traitLabel}>Pets</Text>
                    <Text style={styles.traitValue}>{member.pets ? 'Has pets' : 'No pets'}</Text>
                  </View>
                </View>
                {member.interests.length > 0 ? (
                  <View style={styles.interestRow}>
                    {member.interests.slice(0, 4).map(int => (
                      <View key={int} style={styles.interestChip}>
                        <Text style={styles.interestText}>{int}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={[styles.bottomBar, { paddingBottom: 80 + 14 }]}>
        {alreadySent ? (
          <View style={styles.sentBar}>
            <Feather name="check-circle" size={18} color="#22c55e" />
            <Text style={styles.sentBarText}>Message sent to this group</Text>
          </View>
        ) : onCooldown ? (
          <View style={styles.cooldownBar}>
            <Feather name="clock" size={16} color="#f59e0b" />
            <Text style={styles.cooldownText}>Recently contacted — wait 30 days</Text>
          </View>
        ) : (
          <Pressable onPress={openCompose} style={styles.messageBtn}>
            <LinearGradient
              colors={[ROOMDR_PURPLE, '#6a4d96']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.messageBtnGradient}
            >
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.messageBtnText}>Message This Group</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      <Modal visible={showCompose} transparent animationType="slide" onRequestClose={() => setShowCompose(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCompose(false)}>
          <Pressable style={styles.composeSheet} onPress={() => {}}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>Message {group.name}</Text>
              <Pressable onPress={() => setShowCompose(false)}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
            <Text style={styles.composeHint}>
              Introduce your listing and why it fits this group. Be specific — groups respond better to tailored messages.
            </Text>
            <TextInput
              style={styles.composeInput}
              multiline
              placeholder="Hi! I have a great apartment that would be perfect for your group..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={message}
              onChangeText={setMessage}
              maxLength={500}
            />
            <View style={styles.charRow}>
              <Text style={[styles.charCount, message.trim().length < MIN_MSG_LENGTH ? { color: '#ef4444' } : { color: 'rgba(255,255,255,0.3)' }]}>
                {message.trim().length}/{MIN_MSG_LENGTH} min
              </Text>
              <Text style={styles.charMax}>{message.length}/500</Text>
            </View>
            {message.trim().length > 0 && message.trim().length < MIN_MSG_LENGTH ? (
              <View style={styles.warningRow}>
                <Feather name="alert-circle" size={14} color="#f59e0b" />
                <Text style={styles.warningText}>{MIN_MSG_LENGTH - message.trim().length} more characters needed</Text>
              </View>
            ) : null}
            <Pressable
              style={[styles.sendBtn, { opacity: message.trim().length < MIN_MSG_LENGTH || sending ? 0.5 : 1 }]}
              onPress={handleSend}
              disabled={message.trim().length < MIN_MSG_LENGTH || sending}
            >
              <LinearGradient colors={[ROOMDR_PURPLE, '#6a4d96']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtnGradient}>
                {sending ? <ActivityIndicator size="small" color="#fff" /> : (
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
            <Text style={styles.unlockDesc}>Purchase additional sends to keep reaching groups.</Text>
            {UNLOCK_PACKAGES.map(pkg => (
              <Pressable key={pkg.id} style={styles.unlockPackage} onPress={() => handleUnlock(pkg.id)} disabled={purchasing !== null}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlockPkgLabel}>{pkg.label}</Text>
                  <Text style={styles.unlockPkgNote}>Expires at midnight</Text>
                </View>
                {purchasing === pkg.id ? <ActivityIndicator size="small" color={ACCENT} /> : (
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

      <ReportBlockModal
        visible={showMemberReport}
        onClose={() => { setShowMemberReport(false); setReportMemberTarget(null); }}
        userName={reportMemberTarget?.name || 'User'}
        type="user"
        onReport={async (reason) => {
          try { if (reportMemberTarget) await reportUser(reportMemberTarget.id, reason); } catch {}
        }}
        onBlock={async () => {
          try {
            if (reportMemberTarget) {
              await blockUserRemote(reportMemberTarget.id);
              await blockUserLocal(reportMemberTarget.id);
              setShowMemberReport(false);
              setReportMemberTarget(null);
              navigation.goBack();
            }
          } catch {}
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroAvatarWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: BG, marginLeft: -14 },
  heroAvatar: { width: '100%', height: '100%', borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  heroAvatarLetter: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroAvatarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed' as any,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarPlus: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  heroBadgeRow: { flexDirection: 'row', gap: 8 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  section: { paddingHorizontal: 20, marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 12 },
  descText: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22 },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailCard: {
    width: '48%' as any,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  detailIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.3, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#fff' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  neighborhoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  neighborhoodText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  lifestyleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
  },
  lifestyleText: { fontSize: 13, fontWeight: '500', color: PURPLE },

  memberCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  memberPhoto: { width: 56, height: 56, borderRadius: 28 },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 17, fontWeight: '800', color: '#fff' },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberOccupation: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  memberBio: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 12 },

  memberTraits: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  traitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  traitValue: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  levelDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotFilled: { backgroundColor: PURPLE },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.1)' },

  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  interestText: { fontSize: 11, fontWeight: '600', color: ACCENT },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  messageBtn: { borderRadius: 16, overflow: 'hidden' },
  messageBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  messageBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sentBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sentBarText: { fontSize: 15, fontWeight: '600', color: '#22c55e' },
  cooldownBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  cooldownText: { fontSize: 14, color: '#f59e0b', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  composeSheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#2a2a2a', padding: 24 },
  composeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  composeTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  composeHint: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 19, marginBottom: 16 },
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
  charRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
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
  sendBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  unlockSheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#2a2a2a', padding: 24, alignItems: 'center' },
  unlockIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,107,91,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  unlockTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  unlockDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
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
  unlockPricePill: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  unlockPriceText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  cancelUnlock: { marginTop: 8, paddingVertical: 10 },
  cancelUnlockText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
});
