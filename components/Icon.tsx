import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';

const glyphMap: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json');

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 24, color = '#FFFFFF', style }: IconProps) {
  const glyph = glyphMap[name];
  const char = glyph != null ? String.fromCodePoint(glyph) : '?';

  return (
    <Text
      selectable={false}
      style={[
        {
          fontSize: size,
          color,
          fontFamily: 'feather',
          fontWeight: 'normal',
          fontStyle: 'normal',
        },
        style,
      ]}
      allowFontScaling={false}
    >
      {char}
    </Text>
  );
}
