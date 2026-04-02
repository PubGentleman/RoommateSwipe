import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from './VectorIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

interface InquiryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    moveInDate: string;
    message: string;
    leaseDuration: string;
    groupSize: number;
  }) => Promise<void>;
  listingTitle: string;
  listingPrice?: number;
  hasGroup?: boolean;
  groupName?: string;
  groupSize?: number;
}

const LEASE_OPTIONS = ['Month-to-month', '3 months', '6 months', '1 year', 'Flexible'];

export const InquiryModal: React.FC<InquiryModalProps> = ({
  visible,
  onClose,
  onSubmit,
  listingTitle,
  listingPrice,
  hasGroup,
  groupName,
  groupSize = 1,
}) => {
  const [moveInDate, setMoveInDate] = useState<Date>(new Date(Date.now() + 14 * 86400000));
  const [message, setMessage] = useState('');
  const [leaseDuration, setLeaseDuration] = useState('1 year');
  const [inquiryGroupSize, setInquiryGroupSize] = useState(groupSize);
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      await onSubmit({
        moveInDate: moveInDate.toISOString().split('T')[0],
        message: message.trim() || `Hi, I'm interested in "${listingTitle}". I'd love to learn more about the space.`,
        leaseDuration,
        groupSize: inquiryGroupSize,
      });
      setMessage('');
      onClose();
    } catch {}
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Send Inquiry</Text>
              <Text style={s.subtitle} numberOfLines={1}>{listingTitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {listingPrice ? (
            <View style={s.priceRow}>
              <Feather name="dollar-sign" size={14} color="#ff6b5b" />
              <Text style={s.priceText}>${listingPrice.toLocaleString()}/mo</Text>
            </View>
          ) : null}

          <Text style={s.label}>Desired Move-in Date</Text>
          {Platform.OS === 'android' && !showDatePicker ? (
            <Pressable style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Feather name="calendar" size={16} color="#ff6b5b" />
              <Text style={s.dateBtnText}>{moveInDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </Pressable>
          ) : null}
          {showDatePicker ? (
            <DateTimePicker
              value={moveInDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_, d) => { if (d) setMoveInDate(d); if (Platform.OS === 'android') setShowDatePicker(false); }}
              themeVariant="dark"
            />
          ) : null}

          <Text style={s.label}>Lease Duration</Text>
          <View style={s.chipRow}>
            {LEASE_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[s.chip, leaseDuration === opt && s.chipActive]}
                onPress={() => { setLeaseDuration(opt); Haptics.selectionAsync(); }}
              >
                <Text style={[s.chipText, leaseDuration === opt && s.chipTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>

          {!hasGroup ? (
            <>
              <Text style={s.label}>Number of Tenants</Text>
              <View style={s.counterRow}>
                <Pressable style={s.counterBtn} onPress={() => setInquiryGroupSize(Math.max(1, inquiryGroupSize - 1))}>
                  <Feather name="minus" size={16} color="#fff" />
                </Pressable>
                <Text style={s.counterValue}>{inquiryGroupSize}</Text>
                <Pressable style={s.counterBtn} onPress={() => setInquiryGroupSize(Math.min(10, inquiryGroupSize + 1))}>
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.groupBadge}>
              <Feather name="users" size={14} color="#ff6b5b" />
              <Text style={s.groupBadgeText}>Inquiring as {groupName || 'your group'} ({groupSize} member{groupSize !== 1 ? 's' : ''})</Text>
            </View>
          )}

          <Text style={s.label}>Message to Host</Text>
          <TextInput
            style={s.textInput}
            placeholder="Introduce yourself, mention your situation, ask questions..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            maxLength={500}
          />
          <Text style={s.charCount}>{message.length}/500</Text>

          <Pressable
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={s.submitText}>Send Inquiry</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingHorizontal: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,107,91,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  priceText: { color: '#ff6b5b', fontSize: 16, fontWeight: '700' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dateBtnText: { color: '#fff', fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(255,107,91,0.15)', borderColor: '#ff6b5b' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  chipTextActive: { color: '#ff6b5b', fontWeight: '600' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20, alignSelf: 'flex-start' },
  counterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  counterValue: { color: '#fff', fontSize: 20, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  groupBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,91,0.08)', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)' },
  groupBadgeText: { color: '#ff6b5b', fontSize: 13, fontWeight: '500' },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'right', marginTop: 4 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
