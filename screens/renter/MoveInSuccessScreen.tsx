import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRenterPlan } from '../../constants/renterPlanLimits';

const BG = '#111';

export default function MoveInSuccessScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const plan = normalizeRenterPlan(user?.subscription?.plan);
  const hasPaidPlan = plan === 'plus' || plan === 'elite';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.iconWrap}>
        <Feather name="check-circle" size={56} color="#4CAF50" />
      </View>
      <ThemedText style={styles.title}>Congrats on your new place!</ThemedText>
      <ThemedText style={styles.subtitle}>
        Your profile is now paused — you won't appear in searches or matches.
        Come back anytime to resume your search.
      </ThemedText>

      {hasPaidPlan ? (
        <View style={styles.subscriptionNote}>
          <Feather name="zap" size={14} color="#667eea" />
          <ThemedText style={styles.subscriptionText}>
            Your {plan === 'elite' ? 'Elite' : 'Plus'} subscription stays active — your benefits are preserved.
          </ThemedText>
        </View>
      ) : null}

      <Pressable style={styles.doneButton} onPress={() => navigation.navigate('ProfileMain')}>
        <ThemedText style={styles.doneButtonText}>Go to Profile</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(76,175,80,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
    marginBottom: 24,
  },
  subscriptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  subscriptionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
