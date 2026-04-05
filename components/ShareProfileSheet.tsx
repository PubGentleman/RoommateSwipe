import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Switch, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { Feather } from './VectorIcons';
import { ProfileShareCard } from './ProfileShareCard';
import { supabase } from '../lib/supabase';
import { getProfileShareLink, trackProfileShare, togglePublicProfile, type PublicProfile } from '../services/socialProfileService';
import { generateResumeText } from '../utils/roommateResume';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: PublicProfile;
  userId: string;
}

const SHARE_OPTIONS = [
  { key: 'copy', icon: 'copy', label: 'Copy Link', color: '#3b82f6' },
  { key: 'card', icon: 'image', label: 'Share Card', color: '#ff6b5b' },
  { key: 'message', icon: 'message-circle', label: 'Message', color: '#22C55E' },
  { key: 'resume', icon: 'file-text', label: 'Resume', color: '#6C5CE7' },
];

export function ShareProfileSheet({ visible, onClose, profile, userId }: Props) {
  const [publicEnabled, setPublicEnabled] = useState(false);

  React.useEffect(() => {
    if (visible) {
      supabase.from('users').select('public_profile_enabled').eq('id', userId).single().then(({ data }) => {
        if (data) setPublicEnabled(!!data.public_profile_enabled);
      });
    }
  }, [visible, userId]);
  const cardRef = useRef<View>(null);
  const shareLink = getProfileShareLink(profile.slug);

  const handleCopyLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(shareLink);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackProfileShare(userId, 'link', 'copy_link').catch(() => {});
      Alert.alert('Copied!', 'Profile link copied to clipboard');
    } catch {
      Alert.alert('Error', 'Failed to copy link');
    }
  }, [shareLink, userId]);

  const handleShareCard = useCallback(async () => {
    try {
      if (!cardRef.current) return;
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.9 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        trackProfileShare(userId, 'card_image').catch(() => {});
      }
    } catch {
      Alert.alert('Error', 'Failed to generate share card');
    }
  }, [userId]);

  const handleShareMessage = useCallback(async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const text = `Check out my roommate profile on Rhome: ${shareLink}`;
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Copied!', 'Message with link copied to clipboard');
        trackProfileShare(userId, 'link', 'sms').catch(() => {});
      }
    } catch {
      Alert.alert('Error', 'Failed to share');
    }
  }, [shareLink, userId]);

  const handleShareResume = useCallback(async () => {
    try {
      const resumeText = generateResumeText(profile);
      await Clipboard.setStringAsync(resumeText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      trackProfileShare(userId, 'link', 'resume_text').catch(() => {});
      Alert.alert('Copied!', 'Roommate resume copied to clipboard');
    } catch {
      Alert.alert('Error', 'Failed to generate resume');
    }
  }, [profile, userId]);

  const handleTogglePublic = async (val: boolean) => {
    setPublicEnabled(val);
    try {
      await togglePublicProfile(userId, val);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      setPublicEnabled(!val);
    }
  };

  const handleOptionPress = (key: string) => {
    switch (key) {
      case 'copy': handleCopyLink(); break;
      case 'card': handleShareCard(); break;
      case 'message': handleShareMessage(); break;
      case 'resume': handleShareResume(); break;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Share Your Profile</Text>

          <ProfileShareCard profile={profile} compact />

          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>{shareLink}</Text>
            <Pressable onPress={handleCopyLink} style={styles.copyBtn}>
              <Feather name="copy" size={14} color="#ff6b5b" />
            </Pressable>
          </View>

          <View style={styles.optionsGrid}>
            {SHARE_OPTIONS.map(opt => (
              <Pressable key={opt.key} style={styles.optionItem} onPress={() => handleOptionPress(opt.key)}>
                <View style={[styles.optionIcon, { backgroundColor: `${opt.color}20` }]}>
                  <Feather name={opt.icon} size={20} color={opt.color} />
                </View>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Public Profile</Text>
              <Text style={styles.toggleDesc}>Anyone with the link can see your profile</Text>
            </View>
            <Switch
              value={publicEnabled}
              onValueChange={handleTogglePublic}
              trackColor={{ false: '#333', true: 'rgba(255,107,91,0.4)' }}
              thumbColor={publicEnabled ? '#ff6b5b' : '#666'}
            />
          </View>

          <View style={{ position: 'absolute', left: -9999 }}>
            <ProfileShareCard ref={cardRef} profile={profile} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#A0A0A0',
  },
  copyBtn: {
    padding: 6,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 12,
  },
  optionItem: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 11,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 2,
  },
});
