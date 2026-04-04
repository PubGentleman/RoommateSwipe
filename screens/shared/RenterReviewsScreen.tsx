import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  getRenterReviews,
  submitRenterReview,
  submitRenterReply,
  incrementRenterReviewHelpful,
  reportReview,
  RenterReview,
  ReviewSummary,
} from '../../services/reviewService';
import { WriteReviewSheet } from '../../components/WriteReviewSheet';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RenterReviewsScreenProps {
  renterId: string;
  renterName: string;
  onClose: () => void;
}

export const RenterReviewsScreen: React.FC<RenterReviewsScreenProps> = ({
  renterId,
  renterName,
  onClose,
}) => {
  const { user } = useAuth();
  const { alert: showAlert } = useConfirm();
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<RenterReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [helpedIds, setHelpedIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const isRenter = user?.id === renterId;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRenterReviews(renterId);
      setReviews(result.reviews);
      setSummary(result.summary);
    } catch {
      setReviews([]);
      setSummary(null);
    }
    setLoading(false);
  }, [renterId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitReview = async (data: { rating: number; reviewText: string; tags: string[] }) => {
    if (!user) return;
    const result = await submitRenterReview(
      user.id,
      renterId,
      data.rating,
      data.reviewText || null,
      data.tags,
    );
    if (result.success) {
      setShowWriteReview(false);
      await loadData();
      await showAlert({ title: 'Review Submitted', message: 'Thank you for your review!' });
    } else {
      await showAlert({ title: 'Error', message: result.error || 'Could not submit review.' });
    }
  };

  const handleHelpful = async (reviewId: string) => {
    if (helpedIds.has(reviewId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHelpedIds(prev => new Set([...prev, reviewId]));
    setReviews(prev =>
      prev.map(r => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r)
    );
    await incrementRenterReviewHelpful(reviewId);
  };

  const handleReport = async (reviewId: string, reason: string) => {
    if (!user) return;
    const result = await reportReview(reviewId, 'renter', user.id, reason);
    if (result.success) {
      await showAlert({ title: 'Reported', message: 'Thank you for your report. We will review it.' });
    } else {
      await showAlert({ title: 'Error', message: result.error || 'Could not submit report.' });
    }
  };

  const showReportOptions = (reviewId: string) => {
    Alert.alert('Report Review', 'Why are you reporting this review?', [
      { text: 'Fake review', onPress: () => handleReport(reviewId, 'fake') },
      { text: 'Harassment', onPress: () => handleReport(reviewId, 'harassment') },
      { text: 'Inappropriate', onPress: () => handleReport(reviewId, 'inappropriate') },
      { text: 'Spam', onPress: () => handleReport(reviewId, 'spam') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmitRenterReply = async (reviewId: string) => {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    const result = await submitRenterReply(reviewId, renterId, replyText.trim());
    if (result.success) {
      setReplyingTo(null);
      setReplyText('');
      await loadData();
    } else {
      await showAlert({ title: 'Error', message: result.error || 'Could not submit reply.' });
    }
    setSubmittingReply(false);
  };

  const renderStarBar = (star: number, count: number, maxCount: number) => {
    const fillPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
    return (
      <View key={star} style={s.starBarRow}>
        <Text style={s.starBarLabel}>{star}</Text>
        <Feather name="star" size={12} color={ACCENT} />
        <View style={s.starBarTrack}>
          <View style={[s.starBarFill, { width: `${fillPct}%` }]} />
        </View>
        <Text style={s.starBarCount}>{count}</Text>
      </View>
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const maxStarCount = summary
    ? Math.max(...Object.values(summary.starBreakdown), 1)
    : 1;

  const hasReviewed = reviews.some(r => r.reviewer_id === user?.id);
  const canWrite = !!user && !isRenter && !hasReviewed;

  const tagCounts: Record<string, number> = {};
  reviews.forEach(r => {
    (r.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={s.headerTitle}>Renter Reviews</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Reviews for {renterName}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.typeBanner}>
          <Feather name="user" size={14} color={ACCENT} />
          <Text style={s.typeBannerText}>These reviews are about the renter as a tenant/roommate</Text>
        </View>

        {summary && summary.reviewCount > 0 ? (
          <View style={s.summaryCard}>
            <View style={s.summaryTop}>
              <Text style={s.avgRating}>{summary.averageRating?.toFixed(1)}</Text>
              <View>
                <View style={s.avgStars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Feather
                      key={star}
                      name="star"
                      size={18}
                      color={star <= Math.round(summary.averageRating || 0) ? ACCENT : 'rgba(255,255,255,0.15)'}
                    />
                  ))}
                </View>
                <Text style={s.reviewCountText}>{summary.reviewCount} review{summary.reviewCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={s.starBars}>
              {[5, 4, 3, 2, 1].map(star =>
                renderStarBar(star, summary.starBreakdown[star], maxStarCount)
              )}
            </View>
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Feather name="user-check" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyText}>No renter reviews yet</Text>
            <Text style={s.emptySubtext}>Be the first to share your experience with this renter</Text>
          </View>
        )}

        {topTags.length > 0 ? (
          <View style={s.tagCloudCard}>
            <Text style={s.tagCloudLabel}>Common Tags</Text>
            <View style={s.tagCloudRow}>
              {topTags.map(tag => (
                <View key={tag} style={s.tagCloudChip}>
                  <Text style={s.tagCloudText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {canWrite ? (
          <Pressable style={s.writeBtn} onPress={() => setShowWriteReview(true)}>
            <Feather name="edit-3" size={16} color={ACCENT} />
            <Text style={s.writeBtnText}>Review this Renter</Text>
          </Pressable>
        ) : null}

        {reviews.map(review => {
          const initial = (review.reviewer_name || 'U').charAt(0).toUpperCase();
          return (
            <View key={review.id} style={s.reviewCard}>
              <View style={s.reviewHeader}>
                <View style={s.reviewerAvatar}>
                  <Text style={s.reviewerInitial}>{initial}</Text>
                </View>
                <View style={s.reviewerInfo}>
                  <Text style={s.reviewerName}>{review.reviewer_name || 'Anonymous'}</Text>
                  <Text style={s.reviewDate}>{formatDate(review.created_at)}</Text>
                </View>
              </View>

              <View style={s.reviewStars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Feather
                    key={star}
                    name="star"
                    size={14}
                    color={star <= review.rating ? ACCENT : 'rgba(255,255,255,0.15)'}
                  />
                ))}
              </View>

              {review.review_text ? (
                <Text style={s.reviewText}>{review.review_text}</Text>
              ) : null}

              {review.tags && review.tags.length > 0 ? (
                <View style={s.reviewTags}>
                  {review.tags.map(tag => (
                    <View key={tag} style={s.reviewTagChip}>
                      <Text style={s.reviewTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={s.reviewActions}>
                <Pressable
                  style={[s.helpfulBtn, helpedIds.has(review.id) ? s.helpfulBtnActive : null]}
                  onPress={() => handleHelpful(review.id)}
                >
                  <Feather name="thumbs-up" size={14} color={helpedIds.has(review.id) ? ACCENT : 'rgba(255,255,255,0.4)'} />
                  <Text style={[s.helpfulText, helpedIds.has(review.id) ? { color: ACCENT } : null]}>
                    Helpful{review.helpful_count > 0 ? ` (${review.helpful_count})` : ''}
                  </Text>
                </Pressable>
                {review.reviewer_id !== user?.id ? (
                  <Pressable style={s.reportBtn} onPress={() => showReportOptions(review.id)}>
                    <Feather name="flag" size={14} color="rgba(255,255,255,0.3)" />
                    <Text style={s.reportText}>Report</Text>
                  </Pressable>
                ) : null}
              </View>

              {review.renter_reply ? (
                <View style={s.replyBox}>
                  <Text style={s.replyLabel}>Renter Reply</Text>
                  <Text style={s.replyBoxText}>{review.renter_reply}</Text>
                </View>
              ) : null}

              {isRenter && !review.renter_reply ? (
                replyingTo === review.id ? (
                  <View style={s.replyInputWrap}>
                    <TextInput
                      style={s.replyInput}
                      placeholder="Write your reply..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      maxLength={500}
                    />
                    <View style={s.replyActions}>
                      <Pressable onPress={() => { setReplyingTo(null); setReplyText(''); }}>
                        <Text style={s.replyCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[s.replySendBtn, !replyText.trim() ? { opacity: 0.4 } : null]}
                        onPress={() => handleSubmitRenterReply(review.id)}
                        disabled={!replyText.trim() || submittingReply}
                      >
                        {submittingReply ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.replySendText}>Reply</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={s.addReplyBtn} onPress={() => setReplyingTo(review.id)}>
                    <Feather name="corner-down-right" size={14} color={ACCENT} />
                    <Text style={s.addReplyText}>Reply to this review</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      <WriteReviewSheet
        visible={showWriteReview}
        onClose={() => setShowWriteReview(false)}
        onSubmit={handleSubmitReview}
        reviewType="renter"
      />
    </View>
  );
};

const ACCENT = '#3ECF8E';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  typeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(62,207,142,0.1)', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(62,207,142,0.2)',
  },
  typeBannerText: { fontSize: 12, color: ACCENT, flex: 1, lineHeight: 17 },
  summaryCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  avgRating: { fontSize: 48, fontWeight: '800', color: '#FFFFFF' },
  avgStars: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  reviewCountText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  starBars: { gap: 6 },
  starBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starBarLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', width: 12, textAlign: 'right' },
  starBarTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  starBarFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 4 },
  starBarCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 24, textAlign: 'right' },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 8, marginBottom: 16,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  tagCloudCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 16,
  },
  tagCloudLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagCloudRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagCloudChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(62,207,142,0.12)', borderWidth: 1, borderColor: 'rgba(62,207,142,0.2)',
  },
  tagCloudText: { fontSize: 13, color: ACCENT },
  writeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.3)', backgroundColor: 'rgba(62,207,142,0.08)', marginBottom: 20,
  },
  writeBtnText: { fontSize: 15, fontWeight: '600', color: ACCENT },
  reviewCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  reviewerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(62,207,142,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewerInitial: { fontSize: 16, fontWeight: '700', color: ACCENT },
  reviewerInfo: { flex: 1 },
  reviewerName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  reviewDate: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  reviewStars: { flexDirection: 'row', gap: 3, marginBottom: 10 },
  reviewText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 10 },
  reviewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  reviewTagChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(62,207,142,0.12)', borderWidth: 1, borderColor: 'rgba(62,207,142,0.2)',
  },
  reviewTagText: { fontSize: 12, color: ACCENT },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  helpfulBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  helpfulBtnActive: {},
  helpfulText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  reportText: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  replyBox: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(62,207,142,0.08)', borderLeftWidth: 3, borderLeftColor: ACCENT,
  },
  replyLabel: { fontSize: 12, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  replyBoxText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  replyInputWrap: { marginTop: 10 },
  replyInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, padding: 12, color: '#FFFFFF', fontSize: 14, minHeight: 60, maxHeight: 120,
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 8 },
  replyCancelText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  replySendBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  replySendText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  addReplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
  addReplyText: { fontSize: 13, color: ACCENT, fontWeight: '500' },
});
