import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShortlistItemWithVotes } from '../services/groupVotingService';

interface Props {
  visible: boolean;
  onClose: () => void;
  items: ShortlistItemWithVotes[];
  totalMembers: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CompareListingsModal: React.FC<Props> = ({ visible, onClose, items, totalMembers }) => {
  const insets = useSafeAreaInsets();
  if (items.length < 2) return null;

  const colWidth = (SCREEN_WIDTH - 80 - 16) / items.length;

  const compareRows = [
    { label: 'Price', key: 'price', format: (v: any) => v ? `$${v.toLocaleString()}/mo` : '—' },
    { label: 'Bedrooms', key: 'bedrooms', format: (v: any) => v ? `${v} bd` : '—' },
    { label: 'Bathrooms', key: 'bathrooms', format: (v: any) => v ? `${v} ba` : '—' },
    { label: 'Neighborhood', key: 'neighborhood', format: (v: any) => v || '—' },
    { label: 'Available', key: 'available_date', format: (v: any) => v ? new Date(v).toLocaleDateString() : 'Now' },
    { label: 'Rating', key: 'average_rating', format: (v: any) => v ? `${v.toFixed(1)} ★` : 'No reviews' },
    { label: 'Group Votes', key: '_votes', format: () => '' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Compare Apartments</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.row}>
            <View style={styles.labelCol} />
            {items.map((item) => (
              <View key={item.id} style={[styles.valueCol, { width: colWidth }]}>
                {item.listing?.photos?.[0] ? (
                  <Image source={{ uri: item.listing.photos[0] }} style={[styles.comparePhoto, { width: colWidth - 16 }]} contentFit="cover" />
                ) : (
                  <View style={[styles.comparePhoto, { width: colWidth - 16, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
                )}
                <Text style={styles.compareTitle} numberOfLines={2}>{item.listing?.title}</Text>
              </View>
            ))}
          </View>

          {compareRows.map((row, idx) => (
            <View key={row.key} style={[styles.row, idx % 2 === 0 ? styles.rowAlt : null]}>
              <View style={styles.labelCol}>
                <Text style={styles.rowLabel}>{row.label}</Text>
              </View>
              {items.map((item) => {
                if (row.key === '_votes') {
                  const pct = totalMembers > 0 ? Math.round((item.upvotes / totalMembers) * 100) : 0;
                  return (
                    <View key={item.id} style={[styles.valueCol, { width: colWidth }]}>
                      <Text style={[styles.rowValue, pct > 50 ? { color: '#3ECF8E', fontWeight: '700' } : null]}>
                        {item.upvotes}/{totalMembers} ({pct}%)
                      </Text>
                    </View>
                  );
                }

                const listingRecord = item.listing as Record<string, unknown> | undefined;
                const val = listingRecord?.[row.key] ?? (row.key === 'price' ? item.listing?.rent : undefined);
                const formatted = row.format(val);
                const isBestPrice = row.key === 'price' && val === Math.min(
                  ...items.map(i => { const r = i.listing as Record<string, unknown> | undefined; return (r?.price as number) || (r?.rent as number) || Infinity; })
                );
                const isBestRating = row.key === 'average_rating' && val && val === Math.max(
                  ...items.map(i => { const r = i.listing as Record<string, unknown> | undefined; return (r?.average_rating as number) || 0; })
                );

                return (
                  <View key={item.id} style={[styles.valueCol, { width: colWidth }]}>
                    <Text style={[
                      styles.rowValue,
                      (isBestPrice || isBestRating) ? { color: '#3ECF8E', fontWeight: '700' } : null,
                    ]}>
                      {formatted}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.amenitySection}>
            <Text style={styles.amenitySectionTitle}>Amenities</Text>
            {items.map((item) => {
              const amenities = item.listing?.amenities || [];
              return (
                <View key={item.id} style={styles.amenityRow}>
                  <Text style={styles.amenityListingName} numberOfLines={1}>{item.listing?.title}</Text>
                  <View style={styles.amenityChips}>
                    {amenities.slice(0, 6).map((a: string, i: number) => (
                      <View key={i} style={styles.amenityChip}>
                        <Text style={styles.amenityChipText}>{a}</Text>
                      </View>
                    ))}
                    {amenities.length > 6 ? (
                      <Text style={styles.amenityMore}>+{amenities.length - 6}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  labelCol: { width: 90 },
  valueCol: { alignItems: 'center', paddingHorizontal: 8 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  rowValue: { fontSize: 13, fontWeight: '500', color: '#fff', textAlign: 'center' },
  comparePhoto: { height: 80, borderRadius: 10, marginBottom: 6 },
  compareTitle: { fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center' },
  amenitySection: { padding: 16, gap: 12 },
  amenitySectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  amenityRow: { gap: 6 },
  amenityListingName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  amenityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  amenityChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  amenityChipText: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  amenityMore: { fontSize: 10, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' },
});

export default CompareListingsModal;
