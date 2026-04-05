import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isUserOnline, subscribeToPresence, getLastSeen, formatLastSeen } from '../services/presenceService';

type Props = {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showLastSeen?: boolean;
};

const SIZE_MAP = {
  sm: { dot: 8, border: 1.5 },
  md: { dot: 10, border: 2 },
  lg: { dot: 14, border: 2.5 },
};

export function OnlineDot({ userId, size = 'sm', showLastSeen = false }: Props) {
  const [online, setOnline] = useState(isUserOnline(userId));
  const [lastSeenText, setLastSeenText] = useState('');

  useEffect(() => {
    const unsub = subscribeToPresence(() => {
      setOnline(isUserOnline(userId));
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!showLastSeen || online) return;
    let mounted = true;
    getLastSeen(userId).then(val => {
      if (mounted) setLastSeenText(formatLastSeen(val));
    });
    const interval = setInterval(() => {
      getLastSeen(userId).then(val => {
        if (mounted) setLastSeenText(formatLastSeen(val));
      });
    }, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, [userId, showLastSeen, online]);

  if (showLastSeen) {
    return (
      <Text style={styles.lastSeenText}>
        {online ? 'Online' : lastSeenText}
      </Text>
    );
  }

  if (!online) return null;

  const s = SIZE_MAP[size];
  return (
    <View
      style={[
        styles.dot,
        {
          width: s.dot,
          height: s.dot,
          borderRadius: s.dot / 2,
          borderWidth: s.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#22C55E',
    borderColor: '#0d0d0d',
  },
  lastSeenText: {
    fontSize: 11,
    color: '#22C55E',
  },
});
