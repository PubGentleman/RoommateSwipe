import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ThemedText } from '../../components/ThemedText';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { Typography, Spacing } from '../../constants/theme';

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();

  return (
    <ScreenScrollView 
      style={[styles.container, { backgroundColor: '#111111' }]}
      contentContainerStyle={{ paddingTop: Spacing.xl }}
    >
      <View style={styles.content}>
        <ThemedText style={[Typography.h1, { marginBottom: Spacing.xl }]}>
          Privacy Policy
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xxl }]}>
          Last Updated: November 23, 2025
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg }]}>
          Roomdr provides a roommate-matching, housing-connection, and profile-based discovery platform. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our website, mobile app, and services.
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xxl }]}>
          By creating an account or using Roomdr, you agree to the practices described here.
        </ThemedText>

        <Section title="1. Information We Collect">
          <ThemedText style={Typography.body}>
            We collect information in the following categories:
          </ThemedText>

          <SubSection title="A. Information You Provide to Us">
            <BulletPoint>Name</BulletPoint>
            <BulletPoint>Email address</BulletPoint>
            <BulletPoint>Phone number (optional)</BulletPoint>
            <BulletPoint>Neighborhood or location preference</BulletPoint>
            <BulletPoint>Profile details (bio, occupation, lifestyle, rent budget, habits)</BulletPoint>
            <BulletPoint>Survey and matching-question answers</BulletPoint>
            <BulletPoint>Photos uploaded to your profile</BulletPoint>
            <BulletPoint>Messages and interactions with other users</BulletPoint>
            <BulletPoint>Account settings and preferences</BulletPoint>
          </SubSection>

          <SubSection title="B. Automatically Collected Information">
            <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
              When you use Roomdr, we automatically collect:
            </ThemedText>
            <BulletPoint>IP address</BulletPoint>
            <BulletPoint>Device information</BulletPoint>
            <BulletPoint>Browser type</BulletPoint>
            <BulletPoint>App usage data</BulletPoint>
            <BulletPoint>Search activity</BulletPoint>
            <BulletPoint>In-app clicks and interactions</BulletPoint>
            <BulletPoint>Approximate location (if granted permission)</BulletPoint>
          </SubSection>

          <SubSection title="C. Location Information">
            <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
              We collect location data to power matching:
            </ThemedText>
            <BulletPoint>GPS location (only if you allow it)</BulletPoint>
            <BulletPoint>Neighborhood you select</BulletPoint>
            <BulletPoint>City inferred from your neighborhood</BulletPoint>
            <BulletPoint>Location changes you enter manually</BulletPoint>
            <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
              You may disable location access at any time in your device settings.
            </ThemedText>
          </SubSection>
        </Section>

        <Section title="2. How We Use Your Information">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We use the information we collect to:
          </ThemedText>
          <BulletPoint>Create and manage your Roomdr account</BulletPoint>
          <BulletPoint>Match you with compatible roommates, hosts, groups, and properties</BulletPoint>
          <BulletPoint>Determine which profiles to show you based on city and neighborhood</BulletPoint>
          <BulletPoint>Improve our matching algorithm over time</BulletPoint>
          <BulletPoint>Enable messaging and interactions</BulletPoint>
          <BulletPoint>Provide customer support</BulletPoint>
          <BulletPoint>Process payments for premium features</BulletPoint>
          <BulletPoint>Prevent fraud or misuse</BulletPoint>
          <BulletPoint>Improve app performance and user experience</BulletPoint>
          <BulletPoint>Send updates, recommendations, or important notifications</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md, fontWeight: '600' }]}>
            We never use name or email in the matching algorithm.
          </ThemedText>
        </Section>

        <Section title="3. How We Share Your Information">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We may share your info in the following ways:
          </ThemedText>

          <SubSection title="A. With Other Users">
            <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
              When you interact on Roomdr, certain profile details become visible:
            </ThemedText>
            <BulletPoint>Name (or username)</BulletPoint>
            <BulletPoint>Photos</BulletPoint>
            <BulletPoint>Neighborhood</BulletPoint>
            <BulletPoint>Lifestyle details</BulletPoint>
            <BulletPoint>Matching answers</BulletPoint>
            <BulletPoint>Occupation (optional)</BulletPoint>
            <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
              Your email and phone number are not shared unless you choose to.
            </ThemedText>
          </SubSection>

          <SubSection title="B. Service Providers">
            <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
              We share data with trusted vendors who help us provide Roomdr, such as:
            </ThemedText>
            <BulletPoint>Hosting and cloud storage providers</BulletPoint>
            <BulletPoint>Payment processors</BulletPoint>
            <BulletPoint>Analytics tools</BulletPoint>
            <BulletPoint>Fraud prevention partners</BulletPoint>
            <BulletPoint>Email or SMS verification services</BulletPoint>
          </SubSection>

          <SubSection title="C. Legal Compliance">
            <ThemedText style={Typography.body}>
              We may disclose information if required by law, legal process, or to protect Roomdr and its users.
            </ThemedText>
          </SubSection>

          <SubSection title="D. Business Transfers">
            <ThemedText style={Typography.body}>
              If Roomdr is involved in a merger, acquisition, or sale of assets, your information may be transferred to the new entity.
            </ThemedText>
          </SubSection>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md, fontWeight: '600' }]}>
            We do not sell your personal data to third parties.
          </ThemedText>
        </Section>

        <Section title="4. Your Choices and Controls">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            You have the right to:
          </ThemedText>
          <BulletPoint>Access and update your profile information</BulletPoint>
          <BulletPoint>Change your neighborhood or city</BulletPoint>
          <BulletPoint>Disable location access</BulletPoint>
          <BulletPoint>Delete your photos</BulletPoint>
          <BulletPoint>Request deletion of your account</BulletPoint>
          <BulletPoint>Opt out of marketing emails or notifications</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            To delete your data entirely, contact: support@roomdr.app
          </ThemedText>
        </Section>

        <Section title="5. Data Retention">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We keep your information only as long as needed to:
          </ThemedText>
          <BulletPoint>Maintain your account</BulletPoint>
          <BulletPoint>Provide the Services</BulletPoint>
          <BulletPoint>Meet legal obligations</BulletPoint>
          <BulletPoint>Resolve disputes</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            You may request full deletion at any time.
          </ThemedText>
        </Section>

        <Section title="6. Security">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We employ administrative, technical, and physical safeguards to protect your data. However, no system is 100% secure, and we cannot guarantee absolute protection.
          </ThemedText>
          <ThemedText style={Typography.body}>
            You are responsible for keeping your password confidential.
          </ThemedText>
        </Section>

        <Section title="7. Children's Privacy">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr is not intended for individuals under the age of 18. We do not knowingly collect or store data from minors.
          </ThemedText>
        </Section>

        <Section title="8. International Users">
          <ThemedText style={Typography.body}>
            If you access Roomdr outside the United States, you consent to your data being transferred and processed in the U.S.
          </ThemedText>
        </Section>

        <Section title="9. Changes to This Policy">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date.
          </ThemedText>
          <ThemedText style={Typography.body}>
            Continued use of the Service means you accept the updated policy.
          </ThemedText>
        </Section>

        <Section title="10. Contact Us">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            If you have questions or concerns about this Privacy Policy, contact:
          </ThemedText>
          <ThemedText style={[Typography.body, { fontWeight: '600', marginBottom: Spacing.xs }]}>
            Roomdr Support
          </ThemedText>
          <ThemedText style={Typography.body}>
            Email: support@roomdr.app
          </ThemedText>
        </Section>

        <View style={{ height: Spacing.xl }} />
      </View>
    </ScreenScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.section}>
      <ThemedText style={[Typography.h2, { marginBottom: Spacing.lg }]}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.subsection}>
      <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function BulletPoint({ children }: { children: string }) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.bulletPoint}>
      <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
        • 
      </ThemedText>
      <ThemedText style={[Typography.body, { flex: 1, marginLeft: Spacing.sm }]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  subsection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
});
