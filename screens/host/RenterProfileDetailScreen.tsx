import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentRenter, addToShortlist, removeFromShortlist } from '../../services/agentMatchmakerService';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { reportUser, blockUser as blockUserRemote } from '../../services/moderationService';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const BG = '#111';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const BLUE = '#3b82f6';

export const RenterProfileDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user, blockUser: blockUserLocal } = useAuth();
  const renter: AgentRenter = route.params?.renter;
  const [showReportBlock, setShowReportBlock] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(route.params?.isShortlisted ?? false);

  if (!renter) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Renter not found</Text>
      </View>
    );
  }

  const handleReport = async (reason: string) => {
    try {
      if (renter.id) await reportUser(user!.id, renter.id, reason);
    } catch {}
  };

  const handleBlock = async () => {
    try {
      if (renter.id) {
        await blockUserRemote(user!.id, renter.id);
        await blockUserLocal(renter.id);
        navigation.goBack();
      }
    } catch {}
  };

  const handleShortlistToggle = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isShortlisted) {
      await removeFromShortlist(user.id, renter.id);
      setIsShortlisted(false);
    } else {
      const result = await addToShortlist(user.id, renter.id);
      if (result.success) {
        setIsShortlisted(true);
      }
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', {
      conversationId: `agent-${user?.id}-${renter.id}`,
      otherUser: { id: renter.id, name: renter.name, photos: renter.photos },
    });
  };

  const handleBuildGroup = () => {
    navigation.navigate('AgentGroupBuilder', {
      preselectedIds: [renter.id],
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Renter Profile</Text>
        <Pressable onPress={() => setShowReportBlock(true)} style={styles.backBtn}>
          <Feather name="more-vertical" size={22} color="#999" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}>
        {renter.photos?.[0] ? (
          <Image source={{ uri: renter.photos[0] }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.placeholder]}>
            <Feather name="user" size={48} color="#555" />
          </View>
        )}

        <Text style={styles.name}>{renter.name}, {renter.age}</Text>
        <Text style={styles.occupation}>{renter.occupation}</Text>

        {renter.bio ? <Text style={styles.bio}>{renter.bio}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget & Move-in</Text>
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={16} color={GREEN} />
            <Text style={styles.detailText}>
              {renter.budgetMin && renter.budgetMax
                ? `$${renter.budgetMin.toLocaleString()} - $${renter.budgetMax.toLocaleString()}/mo`
                : 'Not specified'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color="#888" />
            <Text style={styles.detailText}>
              {renter.moveInDate
                ? `Move-in: ${new Date(renter.moveInDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                : 'Flexible move-in'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="home" size={16} color="#888" />
            <Text style={styles.detailText}>
              Looking for: {renter.roomType === 'entire_apartment' ? 'Entire apartment' : renter.roomType === 'room' ? 'Room' : 'Either'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
          <View style={styles.tagRow}>
            {renter.cleanliness != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Cleanliness: {renter.cleanliness}/10</Text>
              </View>
            ) : null}
            {renter.sleepSchedule ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.sleepSchedule}</Text>
              </View>
            ) : null}
            {renter.smoking != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.smoking ? 'Smoker' : 'Non-smoker'}</Text>
              </View>
            ) : null}
            {renter.pets != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.pets ? 'Has pets' : 'No pets'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {renter.interests && renter.interests.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.tagRow}>
              {renter.interests.map((interest, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
                  <Text style={[styles.tagText, { color: ACCENT }]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {renter.preferredNeighborhoods && renter.preferredNeighborhoods.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferred Neighborhoods</Text>
            <View style={styles.tagRow}>
              {renter.preferredNeighborhoods.map((n, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Text style={[styles.tagText, { color: BLUE }]}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : renter.neighborhood ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color="#888" />
              <Text style={styles.detailText}>{renter.neighborhood}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.actionBtn, isShortlisted ? styles.actionBtnActive : null]}
          onPress={handleShortlistToggle}
        >
          <Feather name="heart" size={18} color={isShortlisted ? ACCENT : '#fff'} />
          <Text style={[styles.actionBtnText, isShortlisted ? { color: ACCENT } : null]}>
            {isShortlisted ? 'Shortlisted' : 'Shortlist'}
          </Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.messageBtnStyle]} onPress={handleMessage}>
          <Feather name="message-circle" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Message</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.groupBtnStyle]} onPress={handleBuildGroup}>
          <Feather name="users" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Add to Group</Text>
        </Pressable>
      </View>

      <ReportBlockModal
        visible={showReportBlock}
        onClose={() => setShowReportBlock(false)}
        userName={renter.name || 'User'}
        onReport={handleReport}
        onBlock={handleBlock}
        type="user"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroImage: { width: '100%', height: 300, borderRadius: 16, marginBottom: 16 },
  placeholder: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
  occupation: { color: '#999', fontSize: 15, marginTop: 4 },
  bio: { color: '#ccc', fontSize: 14, lineHeight: 22, marginTop: 12 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailText: { color: '#ccc', fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: '#aaa', fontSize: 12 },
  errorText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 40 },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  messageBtnStyle: { backgroundColor: BLUE },
  groupBtnStyle: { backgroundColor: ACCENT },
});
