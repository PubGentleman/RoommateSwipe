import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from './VectorIcons';
import { REVIEW_TAGS, HOST_REVIEW_TAGS, RENTER_REVIEW_TAGS } from '../services/reviewService';
import * as Haptics from 'expo-haptics';

interface WriteReviewSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; reviewText: string; tags: string[] }) => Promise<void>;
  reviewType?: 'property' | 'host' | 'renter';
}

export const WriteReviewSheet: React.FC<WriteReviewSheetProps> = ({
  visible,
  onClose,
  onSubmit,
  reviewType = 'property',
}) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (star: number) => {
    setRating(star);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ rating, reviewText: reviewText.trim(), tags: selectedTags });
      setRating(0);
      setReviewText('');
      setSelectedTags([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setRating(0);
    setReviewText('');
    setSelectedTags([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.keyboardView}
      >
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{reviewType === 'host' ? 'Review this Host' : reviewType === 'renter' ? 'Review this Renter' : 'Write a Review'}</Text>

          <Text style={s.label}>Rating</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable key={star} onPress={() => handleStarPress(star)} hitSlop={8}>
                <Feather
                  name="star"
                  size={36}
                  color={star <= rating ? '#ff6b5b' : 'rgba(255,255,255,0.15)'}
                  fill={star <= rating ? '#ff6b5b' : 'none'}
                />
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>Your Experience (optional)</Text>
          <TextInput
            style={s.textInput}
            placeholder={reviewType === 'host' ? 'How was your experience working with this host/agent?' : reviewType === 'renter' ? 'How was your experience with this renter/tenant?' : 'Share your experience living here...'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={reviewText}
            onChangeText={t => setReviewText(t.slice(0, 500))}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{reviewText.length}/500</Text>

          <Text style={s.label}>Tags (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tagsScroll}>
            <View style={s.tagsRow}>
              {(reviewType === 'renter' ? RENTER_REVIEW_TAGS : reviewType === 'host' ? HOST_REVIEW_TAGS : REVIEW_TAGS).map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[s.tagChip, active ? s.tagChipActive : null]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[s.tagText, active ? s.tagTextActive : null]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            style={[s.submitBtn, rating === 0 ? s.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.submitBtnText}>Submit Review</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 100,
    maxHeight: 150,
  },
  charCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  tagsScroll: {
    marginBottom: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
  },
  tagText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  tagTextActive: {
    color: '#ff6b5b',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
