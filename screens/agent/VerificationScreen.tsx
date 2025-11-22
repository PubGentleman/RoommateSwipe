import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

export const VerificationScreen = () => {
  const theme = useTheme();

  const VerificationItem = ({ title, status, description }: any) => (
    <Pressable
      style={[styles.verificationCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{title}</ThemedText>
          <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginTop: Spacing.xs }]}>
            {description}
          </ThemedText>
        </View>
        {status === 'verified' ? (
          <Feather name="check-circle" size={24} color={Colors[theme].success} />
        ) : status === 'pending' ? (
          <Feather name="clock" size={24} color={Colors[theme].warning} />
        ) : (
          <Feather name="alert-circle" size={24} color={Colors[theme].error} />
        )}
      </View>
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={[styles.statusCard, { backgroundColor: Colors[theme].success, marginBottom: Spacing.xl }]}>
          <Feather name="shield" size={32} color="#FFFFFF" />
          <ThemedText style={[Typography.h2, { color: '#FFFFFF', marginTop: Spacing.md }]}>
            Agent Verified
          </ThemedText>
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.sm, textAlign: 'center' }]}>
            Your credentials have been verified
          </ThemedText>
        </View>

        <ThemedText style={[Typography.h2, styles.sectionTitle]}>Verification Status</ThemedText>
        
        <VerificationItem
          title="Identity Verification"
          status="verified"
          description="Government ID verified"
        />
        <VerificationItem
          title="Professional License"
          status="verified"
          description="Real estate license verified"
        />
        <VerificationItem
          title="Background Check"
          status="verified"
          description="Background check completed"
        />
        <VerificationItem
          title="Agency Affiliation"
          status="verified"
          description="Agency credentials confirmed"
        />
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  statusCard: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.large,
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  verificationCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
