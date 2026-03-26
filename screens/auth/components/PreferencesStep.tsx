import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { PricePickerPair, STANDARD_MAX_VALUE } from '../../../components/PricePicker';

const ROOM_TYPES = [
  { id: 'private', icon: 'lock' as const, label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users' as const, label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home' as const, label: 'Full Apartment', desc: 'An entire place to yourself' },
];

interface PreferencesStepProps {
  onSubmit: (prefs: { budgetMin: number; budgetMax: number; roomTypes: string[] }) => void;
}

export const PreferencesStep: React.FC<PreferencesStepProps> = ({ onSubmit }) => {
  const [budgetMin, setBudgetMin] = useState(1000);
  const [budgetMax, setBudgetMax] = useState(2500);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);

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
        <PricePickerPair
          minValue={budgetMin}
          maxValue={budgetMax}
          onMinChange={setBudgetMin}
          onMaxChange={setBudgetMax}
          height={160}
        />
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
