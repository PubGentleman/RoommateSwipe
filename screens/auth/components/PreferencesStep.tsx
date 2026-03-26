import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '../../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';

const PRICE_OPTIONS = [
  { label: '$500', value: 500 },
  { label: '$600', value: 600 },
  { label: '$700', value: 700 },
  { label: '$800', value: 800 },
  { label: '$900', value: 900 },
  { label: '$1,000', value: 1000 },
  { label: '$1,100', value: 1100 },
  { label: '$1,200', value: 1200 },
  { label: '$1,300', value: 1300 },
  { label: '$1,400', value: 1400 },
  { label: '$1,500', value: 1500 },
  { label: '$1,600', value: 1600 },
  { label: '$1,700', value: 1700 },
  { label: '$1,800', value: 1800 },
  { label: '$1,900', value: 1900 },
  { label: '$2,000', value: 2000 },
  { label: '$2,200', value: 2200 },
  { label: '$2,500', value: 2500 },
  { label: '$2,800', value: 2800 },
  { label: '$3,000', value: 3000 },
  { label: '$3,500', value: 3500 },
  { label: '$4,000', value: 4000 },
  { label: '$4,500', value: 4500 },
  { label: '$5,000+', value: 5000 },
];

const ROOM_TYPES = [
  { id: 'private', icon: 'lock' as const, label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users' as const, label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home' as const, label: 'Full Apartment', desc: 'An entire place to yourself' },
];

interface PreferencesStepProps {
  onSubmit: (prefs: { budgetMin: number; budgetMax: number; roomTypes: string[] }) => void;
}

function getNextStep(value: number): number {
  const idx = PRICE_OPTIONS.findIndex(o => o.value === value);
  if (idx >= 0 && idx < PRICE_OPTIONS.length - 1) {
    return PRICE_OPTIONS[idx + 1].value;
  }
  return value;
}

export const PreferencesStep: React.FC<PreferencesStepProps> = ({ onSubmit }) => {
  const [budgetMin, setBudgetMin] = useState(800);
  const [budgetMax, setBudgetMax] = useState(2000);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);

  const minOptions = PRICE_OPTIONS.slice(0, -1);
  const maxOptions = PRICE_OPTIONS.filter(o => o.value > budgetMin);

  const handleMinChange = useCallback((val: number) => {
    setBudgetMin(val);
    setBudgetMax(prev => {
      const next = getNextStep(val);
      return prev <= val ? next : prev;
    });
  }, []);

  const handleMaxChange = useCallback((val: number) => {
    setBudgetMax(val);
  }, []);

  const toggleRoomType = useCallback((id: string) => {
    setRoomTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }, []);

  const handleContinue = useCallback(() => {
    onSubmit({ budgetMin, budgetMax, roomTypes });
  }, [budgetMin, budgetMax, roomTypes, onSubmit]);

  return (
    <View style={s.container}>
      <Text style={s.headline}>Your preferences</Text>
      <Text style={s.subheadline}>Help us find your perfect match</Text>

      <View style={s.section}>
        <Text style={s.fieldLabel}>MONTHLY BUDGET</Text>
        <View style={s.pickerRow}>
          <View style={s.pickerColumn}>
            <Text style={s.pickerLabel}>Min</Text>
            <View style={s.pickerWrap}>
              <Picker
                selectedValue={budgetMin}
                onValueChange={handleMinChange}
                style={s.picker}
                itemStyle={s.pickerItem}
              >
                {minOptions.map(opt => (
                  <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={Platform.OS === 'web' ? '#ffffff' : undefined} />
                ))}
              </Picker>
              <View style={s.selectionBand} pointerEvents="none" />
            </View>
          </View>

          <View style={s.dashSeparator}>
            <Text style={s.dashText}>{'\u2014'}</Text>
          </View>

          <View style={s.pickerColumn}>
            <Text style={s.pickerLabel}>Max</Text>
            <View style={s.pickerWrap}>
              <Picker
                selectedValue={budgetMax}
                onValueChange={handleMaxChange}
                style={s.picker}
                itemStyle={s.pickerItem}
              >
                {maxOptions.map(opt => (
                  <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={Platform.OS === 'web' ? '#ffffff' : undefined} />
                ))}
              </Picker>
              <View style={s.selectionBand} pointerEvents="none" />
            </View>
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.fieldLabel}>ROOM TYPE (SELECT ALL THAT APPLY)</Text>
        <View style={s.roomCards}>
          {ROOM_TYPES.map((rt) => {
            const isActive = roomTypes.includes(rt.id);
            return (
              <Pressable
                key={rt.id}
                style={[s.roomCard, isActive ? s.roomCardActive : null]}
                onPress={() => toggleRoomType(rt.id)}
              >
                <View style={[s.roomIconWrap, isActive ? s.roomIconWrapActive : null]}>
                  <Feather name={rt.icon} size={20} color={isActive ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
                </View>
                <View style={s.roomTextWrap}>
                  <Text style={[s.roomLabel, isActive ? s.roomLabelActive : null]}>
                    {rt.label}
                  </Text>
                  <Text style={s.roomDesc}>{rt.desc}</Text>
                </View>
                {isActive ? (
                  <View style={s.roomCheck}>
                    <Feather name="check" size={16} color="#ff6b5b" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={handleContinue}>
        <LinearGradient
          colors={['#ff6b5b', '#e83a2a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.continueBtn}
        >
          <Text style={s.continueBtnText}>Continue</Text>
          <Feather name="arrow-right" size={16} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerWrap: {
    backgroundColor: '#111111',
    borderRadius: 14,
    overflow: 'hidden',
    height: 160,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 160,
    backgroundColor: 'transparent',
    color: '#ffffff',
  },
  pickerItem: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 36,
    marginTop: -18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
  },
  dashSeparator: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 22,
  },
  dashText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  roomCards: {
    gap: 12,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  roomCardActive: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderColor: '#ff6b5b',
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomIconWrapActive: {
    backgroundColor: 'rgba(255,107,91,0.2)',
  },
  roomTextWrap: {
    flex: 1,
    gap: 2,
  },
  roomLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  roomLabelActive: {
    color: '#FFFFFF',
  },
  roomDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 16,
  },
  roomCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
