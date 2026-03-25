import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Feather } from '../../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDER_HORIZONTAL_PADDING = 24;
const SLIDER_WIDTH = SCREEN_WIDTH - SLIDER_HORIZONTAL_PADDING * 2 - 48;

const BUDGET_MIN = 500;
const BUDGET_MAX = 5000;
const BUDGET_STEP = 50;

const ROOM_TYPES = [
  { id: 'private', icon: 'lock' as const, label: 'Private Room', desc: 'Your own space with shared common areas' },
  { id: 'shared', icon: 'users' as const, label: 'Shared Room', desc: 'Share a bedroom to save on rent' },
  { id: 'apartment', icon: 'home' as const, label: 'Full Apartment', desc: 'An entire place to yourself' },
];

interface PreferencesStepProps {
  onSubmit: (prefs: { budgetMin: number; budgetMax: number; roomTypes: string[] }) => void;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function snapToStep(val: number) {
  return Math.round(val / BUDGET_STEP) * BUDGET_STEP;
}

function formatBudget(val: number): string {
  if (val >= BUDGET_MAX) return `$${(val / 1000).toFixed(0)}k+`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return `$${val}`;
}

export const PreferencesStep: React.FC<PreferencesStepProps> = ({ onSubmit }) => {
  const [budgetMin, setBudgetMin] = useState(800);
  const [budgetMax, setBudgetMax] = useState(2000);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);

  const minRef = useRef(budgetMin);
  const maxRef = useRef(budgetMax);
  const minStartRef = useRef(budgetMin);
  const maxStartRef = useRef(budgetMax);

  const valueToPosition = useCallback((val: number) => {
    return ((val - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * SLIDER_WIDTH;
  }, []);

  const positionToValue = useCallback((pos: number) => {
    const raw = BUDGET_MIN + (pos / SLIDER_WIDTH) * (BUDGET_MAX - BUDGET_MIN);
    return snapToStep(clamp(raw, BUDGET_MIN, BUDGET_MAX));
  }, []);

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        minStartRef.current = minRef.current;
      },
      onPanResponderMove: (_, gs) => {
        const startPos = valueToPosition(minStartRef.current);
        const newVal = positionToValue(startPos + gs.dx);
        const clamped = clamp(newVal, BUDGET_MIN, maxRef.current - BUDGET_STEP);
        minRef.current = clamped;
        setBudgetMin(clamped);
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        maxStartRef.current = maxRef.current;
      },
      onPanResponderMove: (_, gs) => {
        const startPos = valueToPosition(maxStartRef.current);
        const newVal = positionToValue(startPos + gs.dx);
        const clamped = clamp(newVal, minRef.current + BUDGET_STEP, BUDGET_MAX);
        maxRef.current = clamped;
        setBudgetMax(clamped);
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const minPos = valueToPosition(budgetMin);
  const maxPos = valueToPosition(budgetMax);

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
        <View style={s.budgetDisplay}>
          <Text style={s.budgetValue}>{formatBudget(budgetMin)}</Text>
          <View style={s.budgetDash} />
          <Text style={s.budgetValue}>{formatBudget(budgetMax)}</Text>
        </View>
        <View style={s.sliderContainer}>
          <View style={s.sliderTrack} />
          <View
            style={[
              s.sliderFill,
              { left: minPos, width: maxPos - minPos },
            ]}
          />
          <View
            {...minPanResponder.panHandlers}
            style={[s.sliderThumb, { left: minPos - 12 }]}
          >
            <View style={s.thumbInner} />
          </View>
          <View
            {...maxPanResponder.panHandlers}
            style={[s.sliderThumb, { left: maxPos - 12 }]}
          >
            <View style={s.thumbInner} />
          </View>
        </View>
        <View style={s.sliderLabels}>
          <Text style={s.sliderLabel}>${BUDGET_MIN}</Text>
          <Text style={s.sliderLabel}>${BUDGET_MAX}+</Text>
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
  budgetDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  budgetValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  budgetDash: {
    width: 16,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sliderTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
  },
  sliderFill: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#ff6b5b',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff6b5b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b5b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
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
