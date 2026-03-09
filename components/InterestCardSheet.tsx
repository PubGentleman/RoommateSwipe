import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useAuth } from '../contexts/AuthContext';
import { Property } from '../types/models';
import { Spacing, BorderRadius } from '../constants/theme';

interface InterestCardSheetProps {
  visible: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
  property: Property;
  compatibilityScore: number;
  isSuperInterest?: boolean;
  sending?: boolean;
}

const mapLifestyleTags = (profileData: any): string[] => {
  const tags: string[] = [];
  if (!profileData?.preferences) return tags;

  const prefs = profileData.preferences;

  if (prefs.cleanliness === 'very_tidy') tags.push('Very Tidy');
  else if (prefs.cleanliness === 'moderately_tidy') tags.push('Tidy');
  else if (prefs.cleanliness === 'relaxed') tags.push('Relaxed');

  if (prefs.smoking === 'no') tags.push('Non-Smoker');
  else if (prefs.smoking === 'yes') tags.push('Smoker');
  else if (prefs.smoking === 'only_outside') tags.push('Outdoor Smoker');

  if (prefs.pets === 'have_pets') tags.push('Pet Owner');
  else if (prefs.pets === 'open_to_pets') tags.push('Pet Friendly');
  else if (prefs.pets === 'no_pets') tags.push('No Pets');

  if (prefs.workLocation === 'wfh_fulltime') tags.push('Remote Worker');
  else if (prefs.workLocation === 'hybrid') tags.push('Hybrid Worker');
  else if (prefs.workLocation === 'office_fulltime') tags.push('Office Worker');

  if (prefs.sleepSchedule === 'early_sleeper') tags.push('Early Bird');
  else if (prefs.sleepSchedule === 'late_sleeper') tags.push('Night Owl');

  if (prefs.lifestyle && Array.isArray(prefs.lifestyle)) {
    prefs.lifestyle.forEach((l: string) => {
      if (l === 'active_gym') tags.push('Active');
      else if (l === 'homebody') tags.push('Homebody');
      else if (l === 'nightlife_social') tags.push('Social');
      else if (l === 'quiet_introverted') tags.push('Introvert');
      else if (l === 'creative_artistic') tags.push('Creative');
      else if (l === 'professional_focused') tags.push('Professional');
    });
  }

  return tags;
};

export default function InterestCardSheet({
  visible,
  onClose,
  onSend,
  property,
  compatibilityScore,
  isSuperInterest = false,
  sending = false,
}: InterestCardSheetProps) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const MAX_NOTE_LENGTH = 150;

  const budgetRange = (() => {
    const budget = user?.profileData?.budget;
    if (budget) return `$${budget}/mo`;
    return 'Not set';
  })();

  const moveInDate = user?.profileData?.preferences?.moveInDate || 'Flexible';
  const lifestyleTags = mapLifestyleTags(user?.profileData);

  const handleSend = () => {
    if (!sending) {
      onSend(note.trim());
      setNote('');
    }
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>Send Interest</ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          {isSuperInterest ? (
            <View style={styles.superBadge}>
              <Feather name="star" size={14} color="#FFD700" />
              <ThemedText style={styles.superBadgeText}>Super Interest</ThemedText>
            </View>
          ) : null}

          <View style={styles.profileRow}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                <Feather name="user" size={24} color="#888" />
              </View>
            )}
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{user?.name || 'You'}</ThemedText>
              <View style={styles.compatBadge}>
                <ThemedText style={styles.compatText}>{compatibilityScore}% Match</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Feather name="dollar-sign" size={14} color="#aaa" />
              <ThemedText style={styles.detailLabel}>Budget</ThemedText>
              <ThemedText style={styles.detailValue}>{budgetRange}</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="calendar" size={14} color="#aaa" />
              <ThemedText style={styles.detailLabel}>Move-in</ThemedText>
              <ThemedText style={styles.detailValue}>{moveInDate}</ThemedText>
            </View>
          </View>

          {lifestyleTags.length > 0 ? (
            <View style={styles.tagsContainer}>
              {lifestyleTags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <ThemedText style={styles.tagText}>{tag}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.noteInput}
              placeholder="Why I'd be a great fit..."
              placeholderTextColor="#666"
              value={note}
              onChangeText={(text) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
              multiline
              maxLength={MAX_NOTE_LENGTH}
            />
            <ThemedText style={styles.charCount}>
              {note.length}/{MAX_NOTE_LENGTH}
            </ThemedText>
          </View>

          <Pressable
            style={[
              styles.sendButton,
              isSuperInterest ? styles.sendButtonSuper : null,
              sending ? styles.sendButtonDisabled : null,
            ]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                {isSuperInterest ? (
                  <Feather name="star" size={18} color="#fff" style={{ marginRight: 8 }} />
                ) : null}
                <ThemedText style={styles.sendButtonText}>
                  {isSuperInterest ? 'Send Super Interest' : 'Send Interest'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl + 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  superBadgeText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  profilePhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profilePhotoPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  compatBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff6b5b',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  compatText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    alignItems: 'center',
  },
  detailLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  detailValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  tag: {
    backgroundColor: '#2a2a2a',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  tagText: {
    color: '#ccc',
    fontSize: 13,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  noteInput: {
    backgroundColor: '#222',
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  sendButton: {
    backgroundColor: '#ff6b5b',
    borderRadius: BorderRadius.medium,
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sendButtonSuper: {
    backgroundColor: '#FFD700',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
