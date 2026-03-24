import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';

interface InstagramBadgeProps {
  verified: boolean;
  handle?: string;
  isBlurred?: boolean;
  onUpgradePress?: () => void;
}

export const InstagramBadge: React.FC<InstagramBadgeProps> = ({
  verified,
  handle,
  isBlurred = false,
  onUpgradePress,
}) => {
  if (!verified) return null;

  const openInstagram = () => {
    if (handle) Linking.openURL(`https://instagram.com/${handle}`);
  };

  if (handle && !isBlurred) {
    return (
      <Pressable style={styles.badge} onPress={openInstagram}>
        <View style={styles.igIcon}>
          <Feather name="instagram" size={14} color="#E1306C" />
        </View>
        <Text style={styles.handle}>@{handle}</Text>
        <Feather name="external-link" size={11} color="#999" />
      </Pressable>
    );
  }

  if (isBlurred && onUpgradePress) {
    return (
      <Pressable style={styles.badge} onPress={onUpgradePress}>
        <View style={styles.igIcon}>
          <Feather name="instagram" size={14} color="#E1306C" />
        </View>
        <Text style={[styles.handle, styles.blurred]}>@--------</Text>
        <View style={styles.lockBadge}>
          <Feather name="lock" size={10} color="#fff" />
          <Text style={styles.lockText}>Upgrade</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.badge}>
      <View style={styles.igIcon}>
        <Feather name="instagram" size={14} color="#E1306C" />
      </View>
      <Text style={styles.verifiedText}>Instagram Verified</Text>
      <Feather name="check-circle" size={13} color="#4CAF50" />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  igIcon: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  blurred: {
    color: '#aaa',
    letterSpacing: 2,
  },
  verifiedText: {
    color: '#ccc',
    fontSize: 12,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  lockText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
