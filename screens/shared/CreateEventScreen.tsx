import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Switch, Alert, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { createEvent, EVENT_TYPES } from '../../services/eventService';

const TOTAL_STEPS = 4;

export function CreateEventScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const presetGroupId = route.params?.groupId;

  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() + 86400000));
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [isPublic, setIsPublic] = useState(!presetGroupId);
  const [submitting, setSubmitting] = useState(false);

  const canContinue = () => {
    switch (step) {
      case 1: return !!eventType;
      case 2: return title.trim().length > 0;
      case 3: return !!startDate;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || submitting) return;
    setSubmitting(true);
    try {
      const event = await createEvent(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        locationName: locationName.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
        startsAt: startDate.toISOString(),
        endsAt: endDate ? endDate.toISOString() : undefined,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
        isPublic,
        groupId: presetGroupId || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('EventDetail', { eventId: event.id });
    } catch (err) {
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateForDisplay = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const minStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h12}:${minStr} ${ampm}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.stepDots}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View key={i} style={[styles.dot, i + 1 <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What kind of event?</Text>
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map(t => (
                <Pressable
                  key={t.key}
                  style={[styles.typeCard, eventType === t.key && { borderColor: t.color, borderWidth: 2 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEventType(t.key);
                  }}
                >
                  <View style={[styles.typeIconCircle, { backgroundColor: t.color + '22' }]}>
                    <Feather name={t.icon} size={20} color={t.color} />
                  </View>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Event Details</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Give your event a name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
              />
              <Text style={styles.charCount}>{title.length}/80</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What should people know?"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>When & Where</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date & Time</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Feather name="calendar" size={16} color="#ff6b5b" />
                <Text style={styles.dateButtonText}>{formatDateForDisplay(startDate)}</Text>
              </Pressable>
              {showStartPicker ? (
                <DateTimePicker
                  value={startDate}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (date) setStartDate(date);
                  }}
                  themeVariant="dark"
                />
              ) : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Central Park, Joe's Coffee"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={locationName}
                onChangeText={setLocationName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Full address"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={locationAddress}
                onChangeText={setLocationAddress}
              />
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Settings</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Public Event</Text>
                <Text style={styles.settingDesc}>Anyone can discover and RSVP</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#333', true: '#ff6b5b' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Attendees (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Leave blank for no limit"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={[styles.continueBtn, !canContinue() && styles.continueBtnDisabled]}
          onPress={handleNext}
          disabled={!canContinue() || submitting}
        >
          <Text style={styles.continueBtnText}>
            {step === TOTAL_STEPS ? (submitting ? 'Creating...' : 'Create Event') : 'Continue'}
          </Text>
          {step < TOTAL_STEPS ? <Feather name="arrow-right" size={16} color="#fff" /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#ff6b5b',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  stepContainer: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  input: {
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'right',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff6b5b',
    borderRadius: 14,
    paddingVertical: 14,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
