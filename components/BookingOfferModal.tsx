import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from './VectorIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { SinglePricePicker, RENT_OPTIONS, DEPOSIT_OPTIONS, formatPriceDisplay, normalizeToOption } from './PricePicker';

const LEASE_OPTIONS = [
  { value: 'month-to-month', label: 'Month-to-Month' },
  { value: '3 months', label: '3 Months' },
  { value: '6 months', label: '6 Months' },
  { value: '12 months', label: '12 Months' },
];

interface BookingOfferModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    moveInDate: string;
    leaseLength: string;
    monthlyRent: number;
    securityDeposit: number;
    note: string;
  }) => Promise<void>;
  address: string;
  defaultRent: number;
}

export const BookingOfferModal: React.FC<BookingOfferModalProps> = ({
  visible,
  onClose,
  onSubmit,
  address,
  defaultRent,
}) => {
  const [moveInDate, setMoveInDate] = useState<Date>(new Date(Date.now() + 30 * 86400000));
  const [leaseLength, setLeaseLength] = useState('12 months');
  const [rent, setRent] = useState(() => normalizeToOption(defaultRent || 2000, RENT_OPTIONS));
  const [deposit, setDeposit] = useState(() => normalizeToOption((defaultRent || 2000) * 2, DEPOSIT_OPTIONS));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const handleSubmit = async () => {
    if (submitting) return;
    if (!rent || rent <= 0) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onSubmit({
        moveInDate: moveInDate.toISOString().split('T')[0],
        leaseLength,
        monthlyRent: rent,
        securityDeposit: deposit,
        note: note.trim(),
      });
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>Send Booking Offer</Text>
        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>

        <Text style={s.label}>Property</Text>
        <View style={s.readOnlyField}>
          <Feather name="home" size={14} color="rgba(255,255,255,0.4)" />
          <Text style={s.readOnlyText} numberOfLines={2}>{address}</Text>
        </View>

        <Text style={s.label}>Move-in Date</Text>
        <Pressable style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <Feather name="calendar" size={16} color="#ff6b5b" />
          <Text style={s.pickerBtnText}>{formatDate(moveInDate)}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={moveInDate}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            onChange={(_, d) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (d) setMoveInDate(d);
            }}
          />
        ) : null}

        <Text style={s.label}>Lease Length</Text>
        <View style={s.leaseRow}>
          {LEASE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[s.leaseChip, leaseLength === opt.value ? s.leaseChipActive : null]}
              onPress={() => { setLeaseLength(opt.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[s.leaseChipText, leaseLength === opt.value ? s.leaseChipTextActive : null]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.moneyRow}>
          <View style={s.moneyField}>
            <Text style={s.label}>Monthly Rent</Text>
            <Text style={s.moneyDisplay}>{formatPriceDisplay(rent)}</Text>
            <SinglePricePicker
              value={rent}
              onChange={setRent}
              options={RENT_OPTIONS}
              height={120}
            />
          </View>
          <View style={s.moneyField}>
            <Text style={s.label}>Security Deposit</Text>
            <Text style={s.moneyDisplay}>{deposit === 0 ? 'None' : formatPriceDisplay(deposit)}</Text>
            <SinglePricePicker
              value={deposit}
              onChange={setDeposit}
              options={DEPOSIT_OPTIONS}
              height={120}
            />
          </View>
        </View>

        <Text style={s.label}>Note (optional)</Text>
        <TextInput
          style={s.textInput}
          placeholder="Any details for the renter..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          multiline
        />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.submitBtnText}>Send Booking Offer</Text>
          )}
        </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8,
  },
  readOnlyField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  readOnlyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', flex: 1 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  leaseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  leaseChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  leaseChipActive: { backgroundColor: 'rgba(255,107,91,0.15)', borderColor: '#ff6b5b' },
  leaseChipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  leaseChipTextActive: { color: '#ff6b5b', fontWeight: '600' },
  moneyRow: { flexDirection: 'row', gap: 12 },
  moneyField: { flex: 1 },
  moneyDisplay: {
    fontSize: 16, fontWeight: '700', color: '#FF6B6B',
    textAlign: 'center', marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 50,
  },
  submitBtn: {
    backgroundColor: '#ff6b5b', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
