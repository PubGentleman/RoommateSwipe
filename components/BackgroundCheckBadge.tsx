import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Feather } from './VectorIcons'
import { ThemedText } from './ThemedText'
import { BackgroundCheckBadge as BadgeType } from '../services/backgroundCheckService'

interface Props {
  badge: BadgeType | null
  size?: 'small' | 'large'
}

export const BackgroundCheckBadge: React.FC<Props> = ({ badge, size = 'small' }) => {
  if (!badge || badge.status !== 'approved') return null

  const isLarge = size === 'large'

  return (
    <View style={[styles.container, isLarge ? styles.containerLarge : undefined]}>
      {badge.identityVerified ? (
        <View style={styles.pill}>
          <Feather name="user-check" size={isLarge ? 16 : 12} color="#4CAF50" />
          <ThemedText style={[styles.pillText, isLarge ? styles.pillTextLarge : undefined]}>ID Verified</ThemedText>
        </View>
      ) : null}

      {badge.criminalClear ? (
        <View style={styles.pill}>
          <Feather name="shield" size={isLarge ? 16 : 12} color="#2196F3" />
          <ThemedText style={[styles.pillText, isLarge ? styles.pillTextLarge : undefined]}>Background Clear</ThemedText>
        </View>
      ) : null}

      {badge.creditScoreRange && badge.checkType === 'premium' ? (
        <View style={styles.pill}>
          <Feather name="credit-card" size={isLarge ? 16 : 12} color="#FF9800" />
          <ThemedText style={[styles.pillText, isLarge ? styles.pillTextLarge : undefined]}>
            Credit: {badge.creditScoreRange}
          </ThemedText>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  containerLarge: {
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  pillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  pillTextLarge: {
    fontSize: 13,
  },
})
