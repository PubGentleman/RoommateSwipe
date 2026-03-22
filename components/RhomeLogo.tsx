import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

interface RhomeLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  darkBackground?: boolean;
}

const SIZES = {
  sm: { icon: 32, wordmarkFontSize: 18, spacing: 8 },
  md: { icon: 48, wordmarkFontSize: 26, spacing: 12 },
  lg: { icon: 64, wordmarkFontSize: 34, spacing: 16 },
};

export const RhomeLogo: React.FC<RhomeLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  darkBackground = true,
}) => {
  const { icon: iconSize, wordmarkFontSize, spacing } = SIZES[size];
  const accentColor = '#FF6B6B';
  const wordmarkColor = darkBackground ? '#FFFFFF' : '#1A1A2E';

  const PinIcon = () => (
    <LinearGradient
      colors={['#FF8E53', '#FF6B6B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: iconSize * 0.22,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Svg
        width={iconSize * 0.62}
        height={iconSize * 0.72}
        viewBox="0 0 26 30"
      >
        <Path
          d="M13 1 C7.477 1 3 5.477 3 11 C3 16.523 8.5 22.5 13 28 C17.5 22.5 23 16.523 23 11 C23 5.477 18.523 1 13 1 Z"
          fill="white"
          opacity={0.95}
        />
        <Path
          d="M8.5 11.2 L13 7 L17.5 11.2"
          stroke="#FF6B6B"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M9.5 11.2 L9.5 15.5 L16.5 15.5 L16.5 11.2"
          stroke="#FF6B6B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M11.5 13.5 L11.5 15.5 L14.5 15.5 L14.5 13.5 C14.5 12.67 13.83 12 13 12 C12.17 12 11.5 12.67 11.5 13.5 Z"
          fill="#FF6B6B"
        />
      </Svg>
    </LinearGradient>
  );

  const Wordmark = () => (
    <Text
      style={[
        styles.wordmark,
        { fontSize: wordmarkFontSize, color: wordmarkColor },
      ]}
    >
      r<Text style={{ color: accentColor }}>home</Text>
    </Text>
  );

  if (variant === 'icon-only') {
    return <PinIcon />;
  }

  if (variant === 'stacked') {
    return (
      <View style={[styles.stackedContainer, { gap: spacing * 0.6 }]}>
        <PinIcon />
        <Wordmark />
      </View>
    );
  }

  return (
    <View style={[styles.horizontalContainer, { gap: spacing }]}>
      <PinIcon />
      <Wordmark />
    </View>
  );
};

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});

export default RhomeLogo;
