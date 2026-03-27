import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ThemedText } from './ThemedText';

const ACCENT = '#FF6B6B';
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

export const STANDARD_MIN_OPTIONS = [
  { label: '$500', value: 500 },
  { label: '$750', value: 750 },
  { label: '$1,000', value: 1000 },
  { label: '$1,250', value: 1250 },
  { label: '$1,500', value: 1500 },
  { label: '$1,750', value: 1750 },
  { label: '$2,000', value: 2000 },
  { label: '$2,500', value: 2500 },
  { label: '$3,000', value: 3000 },
  { label: '$3,500', value: 3500 },
  { label: '$4,000', value: 4000 },
  { label: '$4,500', value: 4500 },
  { label: '$5,000', value: 5000 },
];

export const STANDARD_MAX_OPTIONS = [
  { label: '$1,000', value: 1000 },
  { label: '$1,500', value: 1500 },
  { label: '$2,000', value: 2000 },
  { label: '$2,500', value: 2500 },
  { label: '$3,000', value: 3000 },
  { label: '$3,500', value: 3500 },
  { label: '$4,000', value: 4000 },
  { label: '$4,500', value: 4500 },
  { label: '$5,000', value: 5000 },
  { label: '$5,500', value: 5500 },
  { label: '$6,000', value: 6000 },
  { label: '$7,000', value: 7000 },
  { label: '$8,000', value: 8000 },
  { label: '$10,000+', value: 10001 },
];

export const STANDARD_MAX_VALUE = 10001;

export function formatPriceDisplay(val: number): string {
  if (val >= 10001) return '$10,000+';
  return `$${val.toLocaleString()}`;
}

export function normalizeToOption(val: number, options: { value: number }[]): number {
  let closest = options[0].value;
  let minDiff = Math.abs(val - closest);
  for (const opt of options) {
    const diff = Math.abs(val - opt.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt.value;
    }
  }
  return closest;
}

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const isWeb = Platform.OS === 'web';

interface WebSpinnerProps {
  options: { label: string; value: number }[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  height?: number;
}

const WebSpinnerPicker: React.FC<WebSpinnerProps> = ({ options, selectedValue, onValueChange, height = 150 }) => {
  const scrollRef = useRef<ScrollView>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdx = options.findIndex(o => o.value === selectedValue);
  const activeIdx = selectedIdx >= 0 ? selectedIdx : 0;
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

  useEffect(() => {
    if (!isScrollingRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: activeIdx * ITEM_HEIGHT, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeIdx, options.length]);

  const handleScrollEnd = useCallback((yOffset: number) => {
    const idx = Math.round(yOffset / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(idx, options.length - 1));
    if (options[clampedIdx] && options[clampedIdx].value !== selectedValue) {
      onValueChange(options[clampedIdx].value);
    }
    scrollRef.current?.scrollTo({ y: clampedIdx * ITEM_HEIGHT, animated: true });
    isScrollingRef.current = false;
  }, [options, selectedValue, onValueChange]);

  const handleScroll = useCallback((e: any) => {
    isScrollingRef.current = true;
    const yOffset = e.nativeEvent.contentOffset.y;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleScrollEnd(yOffset), 80);
  }, [handleScrollEnd]);

  const containerHeight = VISIBLE_ITEMS * ITEM_HEIGHT;

  return (
    <View style={[webStyles.container, { height: containerHeight }]}>
      <View style={webStyles.selectionBand} pointerEvents="none" />
      <View style={webStyles.topFade} pointerEvents="none" />
      <View style={webStyles.bottomFade} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: paddingItems * ITEM_HEIGHT,
          paddingBottom: paddingItems * ITEM_HEIGHT,
        }}
      >
        {options.map((opt, i) => {
          const isSelected = opt.value === selectedValue;
          return (
            <Pressable
              key={opt.value}
              style={webStyles.item}
              onPress={() => {
                onValueChange(opt.value);
                scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text style={[
                webStyles.itemText,
                isSelected ? webStyles.itemTextSelected : webStyles.itemTextDimmed,
              ]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const webStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    zIndex: 1,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    zIndex: 2,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    zIndex: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemTextSelected: {
    color: '#ffffff',
  },
  itemTextDimmed: {
    color: 'rgba(255,255,255,0.45)',
  },
});

interface SpinnerPickerProps {
  options: { label: string; value: number }[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  height?: number;
}

const SpinnerPicker: React.FC<SpinnerPickerProps> = ({ options, selectedValue, onValueChange, height = 150 }) => {
  if (isWeb) {
    return <WebSpinnerPicker options={options} selectedValue={selectedValue} onValueChange={onValueChange} height={height} />;
  }

  return (
    <View style={[s.wrap, { height }]}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={[
          s.picker,
          { height },
          isAndroid && s.androidPicker,
        ]}
        itemStyle={[s.item, { height: 44 }]}
        {...(isAndroid ? { mode: 'dialog' as const } : {})}
        display={'spinner' as any}
      >
        {options.map(opt => (
          <Picker.Item
            key={opt.value}
            label={opt.label}
            value={opt.value}
            color={isAndroid ? '#ffffff' : undefined}
          />
        ))}
      </Picker>
      {isIOS ? <View style={s.band} pointerEvents="none" /> : null}
    </View>
  );
};

interface PricePickerPairProps {
  minValue: number;
  maxValue: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  showDisplay?: boolean;
  height?: number;
}

export const PricePickerPair: React.FC<PricePickerPairProps> = ({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  showDisplay = true,
  height = 150,
}) => {
  const availableMaxOptions = STANDARD_MAX_OPTIONS.filter(o => o.value > minValue);

  const handleMinChange = (val: number) => {
    onMinChange(val);
    const validMax = STANDARD_MAX_OPTIONS.filter(o => o.value > val);
    if (maxValue <= val) {
      onMaxChange(validMax.length > 0 ? validMax[0].value : STANDARD_MAX_VALUE);
    }
  };

  const handleMaxChange = (val: number) => {
    onMaxChange(val);
    if (val <= minValue) {
      const validMin = STANDARD_MIN_OPTIONS.filter(o => o.value < val);
      if (validMin.length > 0) {
        onMinChange(validMin[validMin.length - 1].value);
      }
    }
  };

  return (
    <View>
      {showDisplay ? (
        <ThemedText style={s.display}>
          {formatPriceDisplay(minValue)} — {formatPriceDisplay(maxValue)}/mo
        </ThemedText>
      ) : null}
      <View style={s.row}>
        <View style={s.column}>
          <ThemedText style={s.label}>Min</ThemedText>
          <SpinnerPicker
            options={STANDARD_MIN_OPTIONS}
            selectedValue={minValue}
            onValueChange={handleMinChange}
            height={height}
          />
        </View>
        <View style={s.dash}>
          <ThemedText style={s.dashText}>{'\u2014'}</ThemedText>
        </View>
        <View style={s.column}>
          <ThemedText style={s.label}>Max</ThemedText>
          <SpinnerPicker
            options={availableMaxOptions}
            selectedValue={maxValue}
            onValueChange={handleMaxChange}
            height={height}
          />
        </View>
      </View>
    </View>
  );
};

interface SinglePricePickerProps {
  value: number;
  onChange: (val: number) => void;
  options: { label: string; value: number }[];
  label?: string;
  height?: number;
}

export const SinglePricePicker: React.FC<SinglePricePickerProps> = ({
  value,
  onChange,
  options,
  label,
  height = 150,
}) => (
  <View style={s.singleCol}>
    {label ? <ThemedText style={s.label}>{label}</ThemedText> : null}
    <SpinnerPicker
      options={options}
      selectedValue={value}
      onValueChange={onChange}
      height={height}
    />
  </View>
);

const RENT_OPTIONS: { label: string; value: number }[] = [];
for (let v = 500; v <= 10000; v += v < 3000 ? 250 : 500) {
  RENT_OPTIONS.push({ label: `$${v.toLocaleString()}`, value: v });
}
RENT_OPTIONS.push({ label: '$10,000+', value: 10001 });

const DEPOSIT_OPTIONS: { label: string; value: number }[] = [
  { label: 'None', value: 0 },
];
for (let v = 500; v <= 20000; v += v < 5000 ? 500 : 1000) {
  DEPOSIT_OPTIONS.push({ label: `$${v.toLocaleString()}`, value: v });
}

export { RENT_OPTIONS, DEPOSIT_OPTIONS };

const s = StyleSheet.create({
  display: {
    fontSize: 18,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    flex: 1,
  },
  singleCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wrap: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    backgroundColor: 'transparent',
    color: '#ffffff',
  },
  androidPicker: {
    backgroundColor: '#1C1C1E',
    color: '#ffffff',
  },
  item: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 36,
    marginTop: -18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
  },
  dash: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 22,
  },
  dashText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
});
