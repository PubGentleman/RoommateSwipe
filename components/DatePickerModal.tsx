import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, Switch,
  Dimensions, FlatList,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeOut, SlideInUp, SlideOutUp,
} from 'react-native-reanimated';
import { Feather } from './VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAtLeast18 } from '../utils/dateUtils';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
  mode: 'moveIn' | 'birthday' | 'availability' | 'general';
  title: string;
  initialDate?: string;
  minDate?: string;
  maxDate?: string;
  showFlexible?: boolean;
  tierLimit?: 30 | 90 | 180;
  userPlan?: 'basic' | 'plus' | 'elite';
  onUpgrade?: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const parseDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};

const isSameDay = (a: string, b: string) => a === b;

const todayStr = () => {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
};

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible, onClose, onConfirm, mode, title, initialDate,
  minDate: minDateProp, maxDate: maxDateProp,
  showFlexible = false, tierLimit, userPlan, onUpgrade,
}) => {
  const insets = useSafeAreaInsets();
  const today = todayStr();

  const computedMinDate = (() => {
    if (mode === 'birthday') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 100);
      return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    if (mode === 'moveIn' || mode === 'availability') return today;
    return minDateProp || '';
  })();

  const computedMaxDate = (() => {
    if (mode === 'birthday') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 18);
      return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    if (mode === 'moveIn' && tierLimit) {
      const d = new Date();
      d.setDate(d.getDate() + tierLimit);
      return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return maxDateProp || '';
  })();

  const tierMaxDate = (() => {
    if (mode === 'moveIn' && tierLimit) {
      const d = new Date();
      d.setDate(d.getDate() + tierLimit);
      return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return '';
  })();

  const absoluteMaxDate = (() => {
    if (mode === 'moveIn') {
      const d = new Date();
      d.setDate(d.getDate() + 180);
      return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return '';
  })();

  const getInitialViewDate = () => {
    if (initialDate && initialDate !== 'flexible' && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const p = parseDate(initialDate);
      return { year: p.year, month: p.month };
    }
    if (mode === 'birthday') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 25);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  };

  const init = getInitialViewDate();
  const [viewYear, setViewYear] = useState(init.year);
  const [viewMonth, setViewMonth] = useState(init.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [isFlexible, setIsFlexible] = useState(false);
  const [ageError, setAgeError] = useState('');
  const [tooltipDate, setTooltipDate] = useState<string | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yearListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      const init = getInitialViewDate();
      setViewYear(init.year);
      setViewMonth(init.month);
      setSelectedDate(initialDate && initialDate !== 'flexible' && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null);
      setIsFlexible(initialDate === 'flexible');
      setAgeError('');
      setTooltipDate(null);
    }
  }, [visible, initialDate]);

  const currentYear = new Date().getFullYear();
  const birthdayYears = (() => {
    const years: number[] = [];
    for (let y = currentYear - 18; y >= currentYear - 100; y--) {
      years.push(y);
    }
    return years;
  })();

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDateDisabled = (dateStr: string) => {
    if (computedMinDate && dateStr < computedMinDate) return true;
    if (computedMaxDate && dateStr > computedMaxDate) return true;
    return false;
  };

  const isDateLocked = (dateStr: string) => {
    if (mode !== 'moveIn' || !tierMaxDate || !absoluteMaxDate) return false;
    return dateStr > tierMaxDate && dateStr <= absoluteMaxDate;
  };

  const handleDayPress = (dateStr: string) => {
    if (isDateDisabled(dateStr) && !isDateLocked(dateStr)) return;

    if (isDateLocked(dateStr)) {
      setTooltipDate(dateStr);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setTooltipDate(null), 2000);
      return;
    }

    if (mode === 'birthday' && !isAtLeast18(dateStr)) {
      setAgeError('You must be at least 18 to use Rhome');
      setSelectedDate(dateStr);
      return;
    }
    setAgeError('');
    setSelectedDate(dateStr);
  };

  const handleConfirm = () => {
    if (isFlexible) {
      onConfirm('flexible');
      onClose();
      return;
    }
    if (selectedDate && !ageError) {
      onConfirm(selectedDate);
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedDate(null);
    setAgeError('');
    onConfirm('');
    onClose();
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    setViewMonth(0);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length < 42) calendarDays.push(null);

  const getTooltipText = () => {
    if (userPlan === 'basic') return 'Upgrade to Plus to search up to 90 days ahead';
    if (userPlan === 'plus') return 'Upgrade to Elite to search up to 6 months ahead';
    return '';
  };

  const getUpsellText = () => {
    if (userPlan === 'basic') return 'Search up to 90 days ahead with Plus \u2014 $14.99/mo';
    if (userPlan === 'plus') return 'Search up to 6 months ahead with Elite \u2014 $29.99/mo';
    if (userPlan === 'elite') return 'Full 6-month search range unlocked';
    return '';
  };

  const showUpsell = mode === 'moveIn' && userPlan && userPlan !== 'elite';
  const canShowFlexible = showFlexible && (mode === 'moveIn' || mode === 'availability');

  const renderYearItem = useCallback(({ item }: { item: number }) => {
    const isSelected = item === viewYear;
    return (
      <Pressable
        onPress={() => handleYearSelect(item)}
        style={[
          styles.yearPill,
          isSelected ? styles.yearPillSelected : null,
        ]}
      >
        <Text style={[
          styles.yearPillText,
          isSelected ? styles.yearPillTextSelected : null,
        ]}>
          {item}
        </Text>
      </Pressable>
    );
  }, [viewYear]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}
          onPress={() => {}}
        >
          <View style={styles.dragHandle} />
          <Text style={styles.title}>{title}</Text>

          {canShowFlexible ? (
            <View style={styles.flexRow}>
              <Text style={styles.flexLabel}>I'm Flexible</Text>
              <Switch
                value={isFlexible}
                onValueChange={setIsFlexible}
                trackColor={{ false: '#333', true: '#ff6b5b' }}
                thumbColor="#fff"
              />
            </View>
          ) : null}

          {isFlexible ? (
            <View style={styles.flexContent}>
              <Feather name="calendar" size={32} color="#ff6b5b" style={{ marginBottom: 12 }} />
              <Text style={styles.flexText}>
                Showing all listings regardless of move-in date
              </Text>
            </View>
          ) : (
            <>
              {mode === 'birthday' ? (
                <FlatList
                  ref={yearListRef}
                  data={birthdayYears}
                  renderItem={renderYearItem}
                  keyExtractor={(item) => item.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.yearStrip}
                  contentContainerStyle={styles.yearStripContent}
                  initialScrollIndex={birthdayYears.indexOf(viewYear) >= 0 ? birthdayYears.indexOf(viewYear) : 0}
                  getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
                />
              ) : null}

              <View style={styles.monthNav}>
                <Pressable onPress={goToPrevMonth} hitSlop={12}>
                  <Feather name="chevron-left" size={24} color="#ff6b5b" />
                </Pressable>
                <Text style={styles.monthText}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <Pressable onPress={goToNextMonth} hitSlop={12}>
                  <Feather name="chevron-right" size={24} color="#ff6b5b" />
                </Pressable>
              </View>

              <View style={styles.dayHeaders}>
                {DAYS.map((d) => (
                  <Text key={d} style={styles.dayHeaderText}>{d}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const dateStr = toDateStr(viewYear, viewMonth, day);
                  const disabled = isDateDisabled(dateStr);
                  const locked = isDateLocked(dateStr);
                  const isToday = isSameDay(dateStr, today);
                  const isSelected = selectedDate ? isSameDay(dateStr, selectedDate) : false;
                  const showTooltip = tooltipDate === dateStr;

                  return (
                    <Pressable
                      key={dateStr}
                      style={styles.dayCell}
                      onPress={() => handleDayPress(dateStr)}
                    >
                      {showTooltip ? (
                        <View style={styles.tooltip}>
                          <Text style={styles.tooltipText}>{getTooltipText()}</Text>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.dayCircle,
                          isToday && !isSelected ? styles.dayCircleToday : null,
                          isSelected ? styles.dayCircleSelected : null,
                          (disabled || locked) ? { opacity: 0.3 } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected ? styles.dayTextSelected : null,
                          ]}
                        >
                          {day}
                        </Text>
                        {locked ? (
                          <Text style={styles.lockIcon}>
                            <Feather name="lock" size={8} color="#999" />
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {ageError ? (
                <Text style={styles.ageError}>{ageError}</Text>
              ) : null}
            </>
          )}

          {showUpsell ? (
            <View style={styles.upsellRow}>
              <Feather name="lock" size={14} color="#ff6b5b" />
              <Text style={styles.upsellText}>{getUpsellText()}</Text>
              {onUpgrade ? (
                <Pressable onPress={() => { onClose(); onUpgrade(); }}>
                  <Text style={styles.upsellLink}>Upgrade</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {mode === 'moveIn' && userPlan === 'elite' ? (
            <View style={styles.upsellRow}>
              <Feather name="check-circle" size={14} color="#4CAF50" />
              <Text style={[styles.upsellText, { color: '#4CAF50' }]}>
                Full 6-month search range unlocked
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleConfirm}
            disabled={!isFlexible && (!selectedDate || !!ageError)}
            style={{ opacity: (!isFlexible && (!selectedDate || !!ageError)) ? 0.5 : 1, marginTop: 16 }}
          >
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmBtnText}>
                {isFlexible ? 'Apply Flexible' : 'Confirm'}
              </Text>
            </LinearGradient>
          </Pressable>

          {selectedDate ? (
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const CELL_SIZE = Math.floor((width - 48) / 7);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  flexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  flexLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  flexContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  flexText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  yearStrip: {
    maxHeight: 40,
    marginBottom: 12,
  },
  yearStripContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  yearPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    width: 64,
    alignItems: 'center',
  },
  yearPillSelected: {
    backgroundColor: '#ff6b5b',
  },
  yearPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  yearPillTextSelected: {
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayHeaderText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    width: CELL_SIZE,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#ff6b5b',
  },
  dayCircleSelected: {
    backgroundColor: '#ff6b5b',
  },
  dayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  tooltip: {
    position: 'absolute',
    top: -36,
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    width: 200,
    alignItems: 'center',
  },
  tooltipText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  ageError: {
    color: '#ff4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  upsellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 10,
    marginTop: 12,
  },
  upsellText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    flex: 1,
  },
  upsellLink: {
    color: '#ff6b5b',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clearBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
});
