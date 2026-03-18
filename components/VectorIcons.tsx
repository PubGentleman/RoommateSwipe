import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

const glyphMap: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json');

interface FeatherProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

function FeatherIcon({ name, size = 24, color = '#FFFFFF', style }: FeatherProps) {
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

export { FeatherIcon as Feather };
