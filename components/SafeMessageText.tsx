import React from 'react'
import { View, Pressable, StyleSheet, TextStyle, StyleProp } from 'react-native'
import { Feather } from './VectorIcons'
import { ThemedText } from './ThemedText'

interface Props {
  text: string
  safetyMode: boolean
  style?: StyleProp<TextStyle>
  onUpgradePress?: () => void
  onBookShowingPress?: () => void
}

const SENSITIVE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{10}\b/g,
  /@[\w.]{2,30}\b/g,
  /\bsnapchat\s*:?\s*[\w.]+/gi,
  /\bwhatsapp\s*:?\s*[\d+\s()-]+/gi,
  /\btelegram\s*:?\s*@?[\w.]+/gi,
]

const containsSensitiveInfo = (text: string): boolean => {
  return SENSITIVE_PATTERNS.some(p => {
    p.lastIndex = 0
    return p.test(text)
  })
}

export const SafeMessageText: React.FC<Props> = ({ text, safetyMode, style, onUpgradePress, onBookShowingPress }) => {
  const shouldBlur = safetyMode && containsSensitiveInfo(text)

  if (shouldBlur) {
    return (
      <View>
        <ThemedText style={[style, styles.blurredText]}>
          {text.replace(/./g, '\u2022')}
        </ThemedText>
        <View style={styles.lockBanner}>
          <Feather name="lock" size={13} color="#FF6B6B" />
          <ThemedText style={styles.lockText}>Contact info hidden</ThemedText>
        </View>
        <View style={styles.ctaRow}>
          {onBookShowingPress ? (
            <Pressable style={styles.ctaButton} onPress={onBookShowingPress}>
              <ThemedText style={styles.ctaText}>Book a Showing</ThemedText>
            </Pressable>
          ) : null}
          {onUpgradePress ? (
            <Pressable style={[styles.ctaButton, styles.ctaUpgrade]} onPress={onUpgradePress}>
              <Feather name="zap" size={12} color="#667eea" />
              <ThemedText style={[styles.ctaText, { color: '#667eea' }]}>Upgrade</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  return <ThemedText style={style}>{text}</ThemedText>
}

const styles = StyleSheet.create({
  blurredText: {
    color: 'transparent',
    textShadowColor: '#aaa',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
    letterSpacing: 2,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  lockText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ctaUpgrade: {
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
  },
  ctaText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
})
