import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { Feather } from '../../components/VectorIcons'
import { ThemedText } from '../../components/ThemedText'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Spacing, BorderRadius, Typography } from '../../constants/theme'
import { ScreenScrollView } from '../../components/ScreenScrollView'
import { startBackgroundCheck, getMyBackgroundCheck, BackgroundCheckBadge as BadgeType } from '../../services/backgroundCheckService'
import { BackgroundCheckBadge } from '../../components/BackgroundCheckBadge'
import * as WebBrowser from 'expo-web-browser'

export const BackgroundCheckScreen = ({ navigation }: any) => {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { alert, confirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [badge, setBadge] = useState<BadgeType | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'premium'>('standard')

  const isDev = __DEV__

  useEffect(() => {
    loadBadge()
  }, [])

  const loadBadge = async () => {
    setLoading(true)
    try {
      const result = await getMyBackgroundCheck()
      setBadge(result)
    } catch (_e) {}
    setLoading(false)
  }

  const handleStart = async () => {
    if (isDev) {
      const confirmed = await confirm({
        title: 'Dev Mode',
        message: `Simulate ${selectedPlan} background check approval?`,
        confirmText: 'Approve',
        variant: 'info',
      })
      if (confirmed) {
        setBadge({
          status: 'approved',
          identityVerified: true,
          criminalClear: true,
          creditScoreRange: selectedPlan === 'premium' ? 'good' : undefined,
          checkType: selectedPlan,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
      return
    }

    setStarting(true)
    try {
      const { sessionToken } = await startBackgroundCheck(selectedPlan)
      await WebBrowser.openBrowserAsync(
        `https://withpersona.com/verify?session-token=${sessionToken}`
      )
      await loadBadge()
    } catch (err: any) {
      await alert({ title: 'Error', message: err.message || 'Something went wrong', variant: 'warning' })
    }
    setStarting(false)
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    )
  }

  if (badge?.status === 'approved') {
    return (
      <ScreenScrollView>
        <View style={[styles.successCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="shield" size={60} color="#4CAF50" />
          <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.md }]}>
            You're Verified
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Your badges are showing on your profile and boosting your matches.
          </ThemedText>
          <View style={{ marginTop: Spacing.lg }}>
            <BackgroundCheckBadge badge={badge} size="large" />
          </View>
          {badge.expiresAt ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Valid until {new Date(badge.expiresAt).toLocaleDateString()}
            </ThemedText>
          ) : null}
        </View>

        {badge.checkType === 'standard' ? (
          <Pressable
            style={[styles.upgradeCard, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => {
              setSelectedPlan('premium')
              handleStart()
            }}
          >
            <Feather name="credit-card" size={24} color="#FF9800" />
            <View style={{ flex: 1 }}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Add Credit Check
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Show hosts your credit score range. Premium renters get priority.
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </ScreenScrollView>
    )
  }

  if (badge?.status === 'pending' || badge?.status === 'processing') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[Typography.h3, { color: theme.text, textAlign: 'center', marginTop: Spacing.lg }]}>
          Your background check is being processed...
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          We'll send you a notification when it's ready.
        </ThemedText>
      </View>
    )
  }

  return (
    <ScreenScrollView>
      <ThemedText style={[Typography.h2, { color: theme.text }]}>Get Verified</ThemedText>
      <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg }]}>
        Verified profiles get matched faster. Hosts trust renters who've been background checked.
      </ThemedText>

      <Pressable
        style={[
          styles.planCard,
          { backgroundColor: theme.backgroundSecondary },
          selectedPlan === 'standard' ? styles.planCardSelected : undefined,
        ]}
        onPress={() => setSelectedPlan('standard')}
      >
        <View style={styles.planHeader}>
          <ThemedText style={[Typography.h3, { color: theme.text, flex: 1 }]}>Standard Check</ThemedText>
          <ThemedText style={[Typography.h3, { color: theme.primary }]}>$15</ThemedText>
        </View>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Government ID verification</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Criminal background check</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Identity Verified badge</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Background Clear badge</ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.sm }]}>Valid for 12 months</ThemedText>
      </Pressable>

      <Pressable
        style={[
          styles.planCard,
          { backgroundColor: theme.backgroundSecondary },
          selectedPlan === 'premium' ? styles.planCardSelected : undefined,
        ]}
        onPress={() => setSelectedPlan('premium')}
      >
        <View style={styles.planHeader}>
          <ThemedText style={[Typography.h3, { color: theme.text, flex: 1 }]}>Premium Check</ThemedText>
          <ThemedText style={[Typography.h3, { color: theme.primary }]}>$29</ThemedText>
          <View style={styles.popularBadge}>
            <ThemedText style={styles.popularText}>Most Popular</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Everything in Standard</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Credit score range (no hard pull)</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Eviction history check</ThemedText>
        <ThemedText style={[styles.planFeature, { color: theme.textSecondary }]}>Credit Check badge on profile</ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.sm }]}>Valid for 12 months</ThemedText>
      </Pressable>

      <View style={styles.trustNote}>
        <Feather name="lock" size={14} color={theme.textSecondary} />
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, flex: 1, lineHeight: 18 }]}>
          Your full report is private. Only verification badges are shown to other users. FCRA compliant.
        </ThemedText>
      </View>

      <Pressable
        style={[styles.startButton, starting ? { opacity: 0.6 } : undefined]}
        onPress={handleStart}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.startButtonText}>
            Start {selectedPlan === 'premium' ? 'Premium' : 'Standard'} Check — ${selectedPlan === 'premium' ? '29' : '15'}
          </ThemedText>
        )}
      </Pressable>
    </ScreenScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  successCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  planCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: '#FF6B6B',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  popularBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: Spacing.sm,
  },
  popularText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planFeature: {
    fontSize: 14,
    marginBottom: 4,
  },
  trustNote: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  startButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
})
