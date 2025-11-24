import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ThemedText } from '../../components/ThemedText';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { Typography, Spacing } from '../../constants/theme';

export default function AboutScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenScrollView 
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingTop: insets.top + 100 }}
    >
      <View style={styles.content}>
        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg, lineHeight: 24 }]}>
          Roomdr was built to solve one of the biggest problems in city living: finding a roommate you actually get along with. Traditional listing sites only show photos and prices. Roomdr goes deeper — matching people by lifestyle, habits, budget, neighborhood preference, and personality fit.
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg, lineHeight: 24 }]}>
          Our platform uses smart algorithms, user profiles, and neighborhood-based location matching to help renters, hosts, and landlords connect with the right people faster. No scams. No endless scrolling. No mismatches.
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xxl, lineHeight: 24 }]}>
          Roomdr isn't just another housing app. It's a smarter, safer, more human way to find where — and who — you call home.
        </ThemedText>

        <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>
          Our Mission
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg, lineHeight: 24 }]}>
          Build a safer, smarter, more human housing experience — one compatible match at a time.
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xxl, lineHeight: 24 }]}>
          Whether you're moving across the city or across the country, Roomdr helps you find the right room, the right people, and the right fit.
        </ThemedText>

        <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>
          What Makes Roomdr Different
        </ThemedText>

        <View style={styles.bulletContainer}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Lifestyle and habits</ThemedText> — Match with people who share your living style
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Rent budget</ThemedText> — Find options that fit your financial comfort zone
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Cleanliness preferences</ThemedText> — Connect with people who value the same standards
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Work hours</ThemedText> — Align schedules for a harmonious living environment
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Personality traits</ThemedText> — Match with compatible personalities
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Neighborhood preference</ThemedText> — Find homes in areas you actually want to live
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Compatibility answers</ThemedText> — Science-backed matching for better results
          </ThemedText>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md, lineHeight: 24 }]}>
            • <ThemedText style={{ fontWeight: '600' }}>Housing expectations</ThemedText> — Clear communication from the start
          </ThemedText>
        </View>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xxl, marginTop: Spacing.lg, lineHeight: 24 }]}>
          We also designed Roomdr to reflect the reality of modern housing. Cities move fast, neighborhoods shift constantly, and people need tools that understand their pace of life. Roomdr automatically sorts profiles by location, shows you people who want to live where you want to live, and keeps your matches relevant based on your preferences.
        </ThemedText>

        <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>
          Who Roomdr Is For
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg, lineHeight: 24 }]}>
          Whether you're looking for a roommate, a room, a sublet, or tenants for your listing — Roomdr brings clarity, connection, and community to the housing search.
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xl, lineHeight: 24, color: theme.textSecondary, fontStyle: 'italic' }]}>
          Finding a roommate or a place to live shouldn't feel like gambling with your peace, safety, or money. Roomdr was created to fix that.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  bulletContainer: {
    marginBottom: Spacing.lg,
  },
});
