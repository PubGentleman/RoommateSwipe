import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface AdBannerProps {
  placement: 'messages_top' | 'explore_bottom' | 'groups_top' | 'chat_bottom';
  userPlan: 'basic' | 'plus' | 'elite';
}

export const AdBanner = ({ placement, userPlan }: AdBannerProps) => {
  const navigation = useNavigation<any>();

  if (userPlan !== 'basic') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.adLabel}>Ad</Text>
      <Text style={styles.adText}>Advertisement</Text>
      <Pressable
        onPress={() => (navigation as any).navigate('Payment')}
        hitSlop={8}
      >
        <Text style={styles.upgradeLink}>Remove Ads — Upgrade to Plus</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 60,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    left: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  adText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  upgradeLink: {
    fontSize: 10,
    color: '#ff6b5b',
    fontWeight: '600',
  },
});
