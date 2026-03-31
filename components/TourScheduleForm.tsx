import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from './VectorIcons';

const ACCENT = '#ff6b5b';

interface TourScheduleFormProps {
  listingAddress?: string;
  onSubmit: (data: {
    tourDate: string;
    tourTime: string;
    durationMinutes: number;
    location: string;
    notes: string;
  }) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function TourScheduleForm({ listingAddress, onSubmit, onCancel, submitting }: TourScheduleFormProps) {
  const [date, setDate] = useState(new Date(Date.now() + 86400000));
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(14, 0, 0, 0);
    return d;
  });
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState(listingAddress || '');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSubmit = () => {
    const tourDate = date.toISOString().split('T')[0];
    const hours = time.getHours().toString().padStart(2, '0');
    const mins = time.getMinutes().toString().padStart(2, '0');
    onSubmit({
      tourDate,
      tourTime: `${hours}:${mins}`,
      durationMinutes: duration,
      location,
      notes,
    });
  };

  const dateDisplay = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeDisplay = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="calendar" size={18} color={ACCENT} />
        <Text style={styles.title}>Schedule a Tour</Text>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Feather name="x" size={18} color="#999" />
        </Pressable>
      </View>

      <Pressable style={styles.fieldBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.fieldLabel}>Date</Text>
        <View style={styles.fieldValue}>
          <Text style={styles.fieldValueText}>{dateDisplay}</Text>
          <Feather name="chevron-right" size={16} color="#666" />
        </View>
      </Pressable>

      {showDatePicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (d) setDate(d);
          }}
          themeVariant="dark"
        />
      ) : null}

      <Pressable style={styles.fieldBtn} onPress={() => setShowTimePicker(true)}>
        <Text style={styles.fieldLabel}>Time</Text>
        <View style={styles.fieldValue}>
          <Text style={styles.fieldValueText}>{timeDisplay}</Text>
          <Feather name="chevron-right" size={16} color="#666" />
        </View>
      </Pressable>

      {showTimePicker ? (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, t) => {
            setShowTimePicker(Platform.OS === 'ios');
            if (t) setTime(t);
          }}
          themeVariant="dark"
        />
      ) : null}

      <View style={styles.fieldBtn}>
        <Text style={styles.fieldLabel}>Duration</Text>
        <View style={styles.durationRow}>
          {[15, 30, 45, 60].map(d => (
            <Pressable
              key={d}
              style={[styles.durationChip, duration === d && styles.durationChipActive]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>
                {d}m
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Meeting address"
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { height: 60 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Buzzer code, parking info, etc."
          placeholderTextColor="#555"
          multiline
        />
      </View>

      <Pressable
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Feather name="check" size={16} color="#fff" />
        <Text style={styles.submitText}>
          {submitting ? 'Scheduling...' : 'Schedule Tour'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  fieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  fieldLabel: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldValueText: {
    color: '#fff',
    fontSize: 14,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#222',
  },
  durationChipActive: {
    backgroundColor: ACCENT + '25',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  durationText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  durationTextActive: {
    color: ACCENT,
  },
  inputGroup: {
    gap: 6,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
