import React, { useState } from 'react'
import { View, Pressable, StyleSheet, TextStyle, StyleProp } from 'react-native'
import { Feather } from './VectorIcons'
import { ThemedText } from './ThemedText'

interface Props {
  text: string
  safetyMode: boolean
  style?: StyleProp<TextStyle>
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

export const SafeMessageText: React.FC<Props> = ({ text, safetyMode, style }) => {
  const [revealed, setRevealed] = useState(false)

  const shouldBlur = safetyMode && containsSensitiveInfo(text) && !revealed

  if (shouldBlur) {
    return (
      <View>
        <ThemedText style={[style, styles.blurredText]}>
          {text.replace(/./g, '\u2022')}
        </ThemedText>
        <Pressable
          style={styles.revealButton}
          onPress={() => setRevealed(true)}
        >
          <Feather name="eye" size={14} color="#FF6B6B" />
          <ThemedText style={styles.revealText}>Tap to reveal contact info</ThemedText>
        </Pressable>
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
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  revealText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
})
