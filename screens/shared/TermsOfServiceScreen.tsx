import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ThemedText } from '../../components/ThemedText';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { Typography, Spacing } from '../../constants/theme';

export default function TermsOfServiceScreen() {
  const { theme } = useTheme();

  return (
    <ScreenScrollView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.content}>
        <ThemedText style={[Typography.h1, { marginBottom: Spacing.xl }]}>
          Terms of Service
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xxl }]}>
          Last Updated: November 23, 2025
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.lg }]}>
          Welcome to Roomdr ("Roomdr," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Roomdr mobile application, website, and related services (collectively, the "Services").
        </ThemedText>

        <ThemedText style={[Typography.body, { marginBottom: Spacing.xxl }]}>
          By creating an account or using the Services, you agree to be bound by these Terms. If you do not agree, do not use Roomdr.
        </ThemedText>

        <Section title="1. Eligibility">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            To use Roomdr, you must:
          </ThemedText>
          <BulletPoint>Be at least 18 years old</BulletPoint>
          <BulletPoint>Have the legal capacity to enter into a binding agreement</BulletPoint>
          <BulletPoint>Use the Services in compliance with these Terms and all applicable laws</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Roomdr is not intended for minors under any circumstances.
          </ThemedText>
        </Section>

        <Section title="2. Account Registration">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            When creating a Roomdr account, you must provide accurate and current information. You are responsible for:
          </ThemedText>
          <BulletPoint>Maintaining the confidentiality of your login credentials</BulletPoint>
          <BulletPoint>All activity that occurs under your account</BulletPoint>
          <BulletPoint>Updating your profile information as needed</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            We may suspend or terminate accounts that contain false, misleading, or inappropriate information.
          </ThemedText>
        </Section>

        <Section title="3. Use of the Services">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            You agree to use Roomdr only for lawful purposes, including:
          </ThemedText>
          <BulletPoint>Creating a housing profile</BulletPoint>
          <BulletPoint>Matching with potential roommates</BulletPoint>
          <BulletPoint>Searching for rooms, sublets, or leases</BulletPoint>
          <BulletPoint>Messaging with users you match with</BulletPoint>
          <BulletPoint>Interacting in a respectful and non-abusive manner</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
            You may not use Roomdr to:
          </ThemedText>
          <BulletPoint>Harass, intimidate, or harm other users</BulletPoint>
          <BulletPoint>Post discriminatory, hateful, or explicit content</BulletPoint>
          <BulletPoint>Spam, solicit, or advertise unauthorized products</BulletPoint>
          <BulletPoint>Create fake profiles or misrepresent yourself</BulletPoint>
          <BulletPoint>Collect data or scrape content</BulletPoint>
          <BulletPoint>Engage in fraud, scams, or illegal activity</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            We reserve the right to remove content or suspend accounts that violate these rules.
          </ThemedText>
        </Section>

        <Section title="4. Messaging and Interactions">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr allows messaging between users who have matched. By sending or receiving messages, you agree to:
          </ThemedText>
          <BulletPoint>Communicate respectfully</BulletPoint>
          <BulletPoint>Not share harmful, explicit, or abusive content</BulletPoint>
          <BulletPoint>Understand that we do not screen messages</BulletPoint>
          <BulletPoint>Use caution when interacting with others, both online and offline</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Roomdr is not responsible for user conduct or offline interactions.
          </ThemedText>
        </Section>

        <Section title="5. Location-Based Features">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr uses location data to match users by neighborhood and city. By using Roomdr, you consent to:
          </ThemedText>
          <BulletPoint>Sharing your chosen neighborhood</BulletPoint>
          <BulletPoint>Allowing the app to infer your city</BulletPoint>
          <BulletPoint>Optional GPS-based location if you enable it</BulletPoint>
          <BulletPoint>Showing your profile to users searching within your location</BulletPoint>
          <BulletPoint>Seeing profiles based on your set or searched location</BulletPoint>
          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            You may disable GPS access at any time.
          </ThemedText>
        </Section>

        <Section title="6. Paid Features & Subscriptions">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr may offer premium features such as:
          </ThemedText>
          <BulletPoint>Unlimited rewinds</BulletPoint>
          <BulletPoint>Viewing who liked your profile</BulletPoint>
          <BulletPoint>Boosted visibility</BulletPoint>
          <BulletPoint>Increased messaging or chat limits</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
            By purchasing any feature, you agree to:
          </ThemedText>
          <BulletPoint>Pay the posted price</BulletPoint>
          <BulletPoint>Authorize the payment method on file</BulletPoint>
          <BulletPoint>Understand that all purchases are final and non-refundable, except where required by law</BulletPoint>
          <BulletPoint>Manage your subscription through your Apple, Google, or relevant platform account</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Roomdr reserves the right to modify prices or features at any time.
          </ThemedText>
        </Section>

        <Section title="7. User Content">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            You retain ownership of content you upload, such as:
          </ThemedText>
          <BulletPoint>Photos</BulletPoint>
          <BulletPoint>Profile descriptions</BulletPoint>
          <BulletPoint>Messages</BulletPoint>
          <BulletPoint>Matching answers</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
            However, by posting content, you grant Roomdr a non-exclusive, worldwide, royalty-free license to host, display, modify, and distribute your content solely to operate the Services.
          </ThemedText>

          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr may remove any content that:
          </ThemedText>
          <BulletPoint>Violates these Terms</BulletPoint>
          <BulletPoint>Is harmful or misleading</BulletPoint>
          <BulletPoint>Is reported by another user</BulletPoint>
          <BulletPoint>We deem inappropriate</BulletPoint>
        </Section>

        <Section title="8. No Guarantees or Housing Liability">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr is not a real estate broker, housing agency, or property manager. We do not verify:
          </ThemedText>
          <BulletPoint>The accuracy of user profiles</BulletPoint>
          <BulletPoint>The safety of potential roommates</BulletPoint>
          <BulletPoint>The condition of housing listings</BulletPoint>
          <BulletPoint>The background, intentions, or reliability of any user</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
            Roomdr is a platform only. All housing decisions and interactions are made at your own risk.
          </ThemedText>

          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We strongly recommend:
          </ThemedText>
          <BulletPoint>Background checks</BulletPoint>
          <BulletPoint>Meeting in public places</BulletPoint>
          <BulletPoint>Conducting due diligence before signing any agreement</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Roomdr is not responsible for disputes between users.
          </ThemedText>
        </Section>

        <Section title="9. Third-Party Services">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr may integrate with third-party tools (e.g., analytics, payment processors, location services). Your use of such services is subject to their terms and privacy policies.
          </ThemedText>
          <ThemedText style={Typography.body}>
            Roomdr is not responsible for third-party actions or data handling.
          </ThemedText>
        </Section>

        <Section title="10. Termination">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We may suspend or terminate your account at any time if:
          </ThemedText>
          <BulletPoint>You violate these Terms</BulletPoint>
          <BulletPoint>Your behavior is harmful or unsafe</BulletPoint>
          <BulletPoint>You misuse the platform</BulletPoint>
          <BulletPoint>We believe your actions put others at risk</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
            You may delete your account at any time through the app or by contacting support.
          </ThemedText>

          <ThemedText style={Typography.body}>
            Termination does not relieve you of any owed payments.
          </ThemedText>
        </Section>

        <Section title="11. Disclaimers">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            The Services are provided "as is" and "as available," without warranties of any kind.
          </ThemedText>

          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            Roomdr does not guarantee:
          </ThemedText>
          <BulletPoint>Matches</BulletPoint>
          <BulletPoint>Housing outcomes</BulletPoint>
          <BulletPoint>Message delivery</BulletPoint>
          <BulletPoint>App availability or uptime</BulletPoint>
          <BulletPoint>Accuracy of content or information</BulletPoint>
          <BulletPoint>Safety or compatibility of users</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Use Roomdr at your own risk.
          </ThemedText>
        </Section>

        <Section title="12. Limitation of Liability">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            To the maximum extent permitted by law, Roomdr and its owners, employees, and affiliates are not liable for:
          </ThemedText>
          <BulletPoint>Damages resulting from user interactions</BulletPoint>
          <BulletPoint>Housing disputes</BulletPoint>
          <BulletPoint>Lost data or unauthorized access</BulletPoint>
          <BulletPoint>Personal injury or property loss</BulletPoint>
          <BulletPoint>Financial losses related to rentals or agreements</BulletPoint>
          <BulletPoint>Any indirect, incidental, or consequential damages</BulletPoint>

          <ThemedText style={[Typography.body, { marginTop: Spacing.md }]}>
            Our total liability to you will not exceed $100 or the amount you paid to Roomdr in the past 12 months, whichever is lower.
          </ThemedText>
        </Section>

        <Section title="13. Indemnification">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            You agree to indemnify and hold Roomdr harmless from any claims, losses, damages, liabilities, or expenses arising from:
          </ThemedText>
          <BulletPoint>Your use of the Services</BulletPoint>
          <BulletPoint>Your interactions with other users</BulletPoint>
          <BulletPoint>Your violation of these Terms</BulletPoint>
        </Section>

        <Section title="14. Governing Law">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            These Terms are governed by the laws of the State of New York, without regard to conflicts of law principles.
          </ThemedText>
          <ThemedText style={Typography.body}>
            Any dispute must be resolved in New York courts.
          </ThemedText>
        </Section>

        <Section title="15. Changes to These Terms">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            We may update these Terms occasionally. If material changes occur, we will notify you via the app or email.
          </ThemedText>
          <ThemedText style={Typography.body}>
            Continued use of Roomdr means you accept the updated Terms.
          </ThemedText>
        </Section>

        <Section title="16. Contact Us">
          <ThemedText style={[Typography.body, { marginBottom: Spacing.md }]}>
            For questions about these Terms, contact:
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
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
});
