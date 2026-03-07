import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

interface RoomdrLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  darkText?: boolean;
}

const SIZES = {
  sm: { icon: 32, iconRadius: 8, svgSize: 18, wordmarkSize: 20, taglineSize: 8, gap: 8 },
  md: { icon: 52, iconRadius: 16, svgSize: 28, wordmarkSize: 28, taglineSize: 10, gap: 12 },
  lg: { icon: 72, iconRadius: 22, svgSize: 38, wordmarkSize: 24, taglineSize: 10, gap: 10 },
};

const HouseIcon = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 38 38" fill="none">
    <Path
      d="M5 17L19 4L33 17V34C33 34.6 32.5 35 32 35H25V25H13V35H6C5.5 35 5 34.6 5 34V17Z"
      fill="white"
    />
    <Rect x="15" y="25" width="8" height="10" rx={1.5} fill="rgba(255,107,91,0.5)" />
  </Svg>
);

export const RoomdrLogo = ({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  darkText = false,
}: RoomdrLogoProps) => {
  const s = SIZES[size];
  const textColor = darkText ? '#111111' : '#FFFFFF';
  const accentColor = darkText ? '#ff4040' : '#ff6b5b';

  const IconBox = (
    <LinearGradient
      colors={['#ff6b5b', '#e83a2a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.iconBox, { width: s.icon, height: s.icon, borderRadius: s.iconRadius }]}
    >
      <HouseIcon size={s.svgSize} />
    </LinearGradient>
  );

  if (variant === 'icon-only') {
    return IconBox;
  }

  if (variant === 'stacked') {
    return (
      <View style={styles.stackedContainer}>
        {IconBox}
        <Text style={[styles.wordmark, { fontSize: s.wordmarkSize, color: textColor, marginTop: s.gap }]}>
          room<Text style={{ color: accentColor }}>dr</Text>
        </Text>
        {showTagline ? (
          <Text style={[styles.tagline, { fontSize: s.taglineSize }]}>FIND YOUR MATCH</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.horizontalContainer, { gap: s.gap }]}>
      {IconBox}
      <Text style={[styles.wordmark, { fontSize: s.wordmarkSize, color: textColor }]}>
        room<Text style={{ color: accentColor }}>dr</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedContainer: {
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
    marginTop: -2,
  },
});
