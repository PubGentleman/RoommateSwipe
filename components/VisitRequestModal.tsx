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

interface VisitRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    proposedDate: string;
    proposedTime: string;
    note: string;
  }) => Promise<void>;
  address: string;
  prefillDate?: Date;
  prefillTime?: string;
}

export const VisitRequestModal: React.FC<VisitRequestModalProps> = ({
  visible,
  onClose,
  onSubmit,
  address,
  prefillDate,
  prefillTime,
}) => {
  const [date, setDate] = useState<Date>(prefillDate || new Date(Date.now() + 86400000));
  const [time, setTime] = useState<Date>(() => {
    if (prefillTime) {
      const [h, m] = prefillTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    const d = new Date();
    d.setHours(14, 0, 0, 0);
    return d;
  });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onSubmit({
        proposedDate: date.toISOString().split('T')[0],
        proposedTime: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
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
        <Text style={s.title}>Schedule a Visit</Text>

        <Text style={s.label}>Address</Text>
        <View style={s.readOnlyField}>
          <Feather name="map-pin" size={14} color="rgba(255,255,255,0.4)" />
          <Text style={s.readOnlyText} numberOfLines={2}>{address || 'Listing address'}</Text>
        </View>

        <Text style={s.label}>Date</Text>
        <Pressable style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <Feather name="calendar" size={16} color="#ff6b5b" />
          <Text style={s.pickerBtnText}>{formatDate(date)}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            onChange={(_, d) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (d) setDate(d);
            }}
          />
        ) : null}

        <Text style={s.label}>Time</Text>
        <Pressable style={s.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <Feather name="clock" size={16} color="#ff6b5b" />
          <Text style={s.pickerBtnText}>{formatTime(time)}</Text>
        </Pressable>
        {showTimePicker ? (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            minuteInterval={15}
            onChange={(_, t) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (t) setTime(t);
            }}
          />
        ) : null}

        <Text style={s.label}>Note (optional)</Text>
        <TextInput
          style={s.textInput}
          placeholder="Any special requests or questions..."
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
            <Text style={s.submitBtnText}>Send Visit Request</Text>
          )}
        </Pressable>
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
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 12,
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
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 60,
  },
  submitBtn: {
    backgroundColor: '#ff6b5b', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
