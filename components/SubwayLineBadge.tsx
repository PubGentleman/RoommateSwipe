import React from 'react';
import { View, Text } from 'react-native';
import { SUBWAY_LINE_COLORS } from '../constants/transitData';

interface SubwayLineBadgeProps {
  line: string;
  size?: 'sm' | 'md';
}

const SubwayLineBadge: React.FC<SubwayLineBadgeProps> = ({ line, size = 'md' }) => {
  const color = SUBWAY_LINE_COLORS[line] || '#808183';
  const isLight = ['N', 'Q', 'R', 'W'].includes(line);
  const diameter = size === 'sm' ? 18 : 24;
  const fontSize = size === 'sm' ? 10 : 13;

  return (
    <View style={{
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
      backgroundColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{
        fontSize,
        fontWeight: '800',
        color: isLight ? '#000000' : '#FFFFFF',
        textAlign: 'center',
      }}>
        {line}
      </Text>
    </View>
  );
};

export default SubwayLineBadge;
