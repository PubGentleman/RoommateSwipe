import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { useAuth } from '../contexts/AuthContext';
import { getPendingReviewPrompts, dismissReviewPrompt, ReviewPrompt } from '../services/reviewPromptService';

interface ReviewPromptBannerProps {
  onNavigateToReview?: (prompt: ReviewPrompt) => void;
}

export const ReviewPromptBanner: React.FC<ReviewPromptBannerProps> = ({ onNavigateToReview }) => {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<ReviewPrompt[]>([]);

  const loadPrompts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const pending = await getPendingReviewPrompts(user.id);
      setPrompts(pending);
    } catch {
      setPrompts([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  if (prompts.length === 0) return null;

  const prompt = prompts[0];

  const handleReview = () => {
    onNavigateToReview?.(prompt);
  };

  const handleDismiss = async () => {
    const key = `booking_${prompt.bookingId}_${user?.id}`;
    await dismissReviewPrompt(key);
    setPrompts(prev => prev.slice(1));
  };

  return (
    <View style={s.banner}>
      <View style={s.bannerContent}>
        <Feather name="star" size={20} color="#F39C12" />
        <View style={s.bannerText}>
          <Text style={s.bannerTitle}>
            {prompt.type === 'renter' ? 'Review your renter' : 'Leave a review'}
          </Text>
          <Text style={s.bannerSubtext} numberOfLines={1}>
            How was your experience with {prompt.targetName}?
          </Text>
        </View>
      </View>
      <View style={s.bannerActions}>
        <Pressable onPress={handleReview} style={s.reviewButton}>
          <Text style={s.reviewButtonText}>Review</Text>
        </Pressable>
        <Pressable onPress={handleDismiss} style={s.dismissButton} hitSlop={8}>
          <Feather name="x" size={18} color="#999" />
        </Pressable>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(243,156,18,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.2)',
    padding: 14,
    marginBottom: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bannerSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  reviewButton: {
    backgroundColor: '#F39C12',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    padding: 4,
  },
});
