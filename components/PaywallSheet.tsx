import React from 'react';
import { View, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius } from '../constants/theme';

const CORAL = '#FF6B6B';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PaywallSheetProps {
  visible: boolean;
  featureName: string;
  requiredPlan: 'plus' | 'elite' | 'pro' | 'business';
  onUpgrade: () => void;
  onDismiss: () => void;
  role: 'renter' | 'host';
}

const springConfig: WithSpringConfig = {
  damping: 20,
  mass: 0.8,
  stiffness: 120,
  overshootClamping: false,
};

const RENTER_TIERS = {
  basic: {
    name: 'Basic',
    price: 'Free',
    features: ['5 interest cards/day', '50 messages/month', 'Basic matching'],
  },
  plus: {
    name: 'Plus',
    price: '$14.99/mo',
    features: ['15 interest cards/day', 'Unlimited messages', 'See who liked you', 'Priority matching', '1 free boost/week'],
  },
  elite: {
    name: 'Elite',
    price: '$29.99/mo',
    features: ['Unlimited interest cards', 'Unlimited messages', 'See who liked you', 'Advanced filters', 'Unlimited boosts', 'Super interests'],
  },
};

const HOST_TIERS = {
  starter: {
    name: 'Starter',
    price: 'Free',
    features: ['1 listing', '5 responses/month', 'Views only'],
  },
  pro: {
    name: 'Pro',
    price: '$29.99/mo',
    features: ['5 listings', 'Unlimited responses', 'Full analytics', 'Verified badge'],
  },
  business: {
    name: 'Business',
    price: '$79.99/mo',
    features: ['Unlimited listings', 'Priority placement', 'Featured listings', 'Advanced analytics'],
  },
};

type RenterPlanKey = keyof typeof RENTER_TIERS;
type HostPlanKey = keyof typeof HOST_TIERS;

const getRequiredTierInfo = (role: 'renter' | 'host', requiredPlan: string) => {
  if (role === 'renter') {
    const key = requiredPlan as RenterPlanKey;
    return RENTER_TIERS[key] || RENTER_TIERS.plus;
  }
  const key = requiredPlan as HostPlanKey;
  return HOST_TIERS[key] || HOST_TIERS.pro;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PaywallSheet({ visible, featureName, requiredPlan, onUpgrade, onDismiss, role }: PaywallSheetProps) {
  const { theme } = useTheme();
  const upgradeScale = useSharedValue(1);
  const dismissScale = useSharedValue(1);

  const tierInfo = getRequiredTierInfo(role, requiredPlan);

  const upgradeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: upgradeScale.value }],
  }));

  const dismissAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dismissScale.value }],
  }));

  const tiers = role === 'renter'
    ? [RENTER_TIERS.basic, RENTER_TIERS.plus, RENTER_TIERS.elite]
    : [HOST_TIERS.starter, HOST_TIERS.pro, HOST_TIERS.business];

  const isRequiredTier = (tier: { name: string }) => {
    return tier.name.toLowerCase() === requiredPlan.toLowerCase();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => {}}
        >
          <View style={styles.handle} />

          <View style={styles.headerSection}>
            <View style={[styles.lockIconContainer, { backgroundColor: CORAL + '20' }]}>
              <Feather name="lock" size={28} color={CORAL} />
            </View>
            <ThemedText type="h2" style={styles.title}>
              Unlock {featureName}
            </ThemedText>
            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Upgrade to {tierInfo.name} to access this feature
            </ThemedText>
          </View>

          <View style={styles.tiersContainer}>
            {tiers.map((tier) => {
              const isRequired = isRequiredTier(tier);
              return (
                <View
                  key={tier.name}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: isRequired ? CORAL + '15' : theme.backgroundSecondary,
                      borderColor: isRequired ? CORAL : theme.border,
                      borderWidth: isRequired ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <ThemedText type="h3" style={isRequired ? { color: CORAL } : undefined}>
                      {tier.name}
                    </ThemedText>
                    <ThemedText type="body" style={[styles.tierPrice, isRequired ? { color: CORAL } : { color: theme.textSecondary }]}>
                      {tier.price}
                    </ThemedText>
                  </View>
                  {tier.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <Feather
                        name="check"
                        size={14}
                        color={isRequired ? CORAL : theme.textSecondary}
                      />
                      <ThemedText type="small" style={[styles.featureText, { color: theme.textSecondary }]}>
                        {feature}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          <View style={styles.buttonsContainer}>
            <AnimatedPressable
              onPress={onUpgrade}
              onPressIn={() => { upgradeScale.value = withSpring(0.96, springConfig); }}
              onPressOut={() => { upgradeScale.value = withSpring(1, springConfig); }}
              style={[styles.upgradeButton, { backgroundColor: CORAL }, upgradeAnimatedStyle]}
            >
              <Feather name="zap" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
              <ThemedText type="body" style={styles.upgradeButtonText}>
                Upgrade to {tierInfo.name} - {tierInfo.price}
              </ThemedText>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={onDismiss}
              onPressIn={() => { dismissScale.value = withSpring(0.96, springConfig); }}
              onPressOut={() => { dismissScale.value = withSpring(1, springConfig); }}
              style={[styles.dismissButton, { borderColor: theme.border }, dismissAnimatedStyle]}
            >
              <ThemedText type="body" style={[styles.dismissButtonText, { color: theme.textSecondary }]}>
                Maybe Later
              </ThemedText>
            </AnimatedPressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.large + 8,
    borderTopRightRadius: BorderRadius.large + 8,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl + 16,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888',
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  lockIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  tiersContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  tierCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tierPrice: {
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  buttonsContainer: {
    gap: Spacing.md,
  },
  upgradeButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dismissButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dismissButtonText: {
    fontWeight: '600',
  },
});
