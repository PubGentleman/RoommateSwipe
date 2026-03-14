import React from 'react';
import { View, StyleSheet, Text, Pressable, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { Spacing } from '../../constants/theme';

const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';
const BG = '#111111';
const CARD_BG = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#ffffff';
const TEXT_BODY = 'rgba(255,255,255,0.75)';
const TEXT_DIM = 'rgba(255,255,255,0.4)';
const TEXT_BULLET = 'rgba(255,255,255,0.7)';

const TOC_ITEMS = [
  { num: '01', label: 'Eligibility' },
  { num: '09', label: 'Third-Party Services' },
  { num: '02', label: 'Account Registration' },
  { num: '10', label: 'Termination' },
  { num: '03', label: 'Use of Services' },
  { num: '11', label: 'Disclaimers' },
  { num: '04', label: 'Messaging & Interactions' },
  { num: '12', label: 'Limitation of Liability' },
  { num: '05', label: 'Location-Based Features' },
  { num: '13', label: 'Indemnification' },
  { num: '06', label: 'Paid Features & Subscriptions' },
  { num: '14', label: 'Governing Law' },
  { num: '07', label: 'User Content' },
  { num: '15', label: 'Changes to Terms' },
  { num: '08', label: 'No Guarantees or Housing Liability' },
  { num: '16', label: 'Contact Us' },
];

function BulletItem({ children }: { children: string }) {
  return (
    <View style={s.bulletItem}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function HighlightBox({ children }: { children: string }) {
  return (
    <View style={s.highlightBox}>
      <Text style={s.highlightText}>{children}</Text>
    </View>
  );
}

function SubLabel({ children }: { children: string }) {
  return <Text style={s.subLabel}>{children}</Text>;
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.sectionNum}>
          <Text style={s.sectionNumText}>{num}</Text>
        </LinearGradient>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function P({ children }: { children: string }) {
  return <Text style={s.paragraph}>{children}</Text>;
}

export default function TermsOfServiceScreen() {
  return (
    <ScreenScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={s.hero}>
        <View style={s.heroLabel}>
          <Text style={s.heroLabelText}>LEGAL</Text>
        </View>
        <Text style={s.heroTitle}>Terms of Service</Text>
        <Text style={s.heroSub}>Please read these terms carefully. By using Roomdr, you agree to be bound by these Terms of Service.</Text>
      </View>

      <View style={s.tocWrapper}>
        <View style={s.toc}>
          <Text style={s.tocTitle}>CONTENTS</Text>
          <View style={s.tocGrid}>
            {TOC_ITEMS.map((item) => (
              <View key={item.num} style={s.tocItem}>
                <Text style={s.tocNum}>{item.num}</Text>
                <Text style={s.tocLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={s.main}>
        <HighlightBox>Welcome to Roomdr ("Roomdr," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Roomdr mobile application, website, and related services (collectively, the "Services"). By creating an account or using the Services, you agree to be bound by these Terms. If you do not agree, do not use Roomdr.</HighlightBox>

        <Section num="01" title="Eligibility">
          <P>To use Roomdr, you must:</P>
          <BulletItem>Be at least 18 years old</BulletItem>
          <BulletItem>Have the legal capacity to enter into a binding agreement</BulletItem>
          <BulletItem>Use the Services in compliance with these Terms and all applicable laws</BulletItem>
          <P>Roomdr is not intended for minors under any circumstances.</P>
        </Section>

        <Section num="02" title="Account Registration">
          <P>When creating a Roomdr account, you must provide accurate and current information. You are responsible for:</P>
          <BulletItem>Maintaining the confidentiality of your login credentials</BulletItem>
          <BulletItem>All activity that occurs under your account</BulletItem>
          <BulletItem>Updating your profile information as needed</BulletItem>
          <P>We may suspend or terminate accounts that contain false, misleading, or inappropriate information.</P>
        </Section>

        <Section num="03" title="Use of the Services">
          <P>You agree to use Roomdr only for lawful purposes, including:</P>
          <BulletItem>Creating a housing profile</BulletItem>
          <BulletItem>Matching with potential roommates</BulletItem>
          <BulletItem>Searching for rooms, sublets, or leases</BulletItem>
          <BulletItem>Messaging with users you match with</BulletItem>
          <BulletItem>Interacting in a respectful and non-abusive manner</BulletItem>
          <SubLabel>You may not use Roomdr to:</SubLabel>
          <BulletItem>Harass, intimidate, or harm other users</BulletItem>
          <BulletItem>Post discriminatory, hateful, or explicit content</BulletItem>
          <BulletItem>Spam, solicit, or advertise unauthorized products</BulletItem>
          <BulletItem>Create fake profiles or misrepresent yourself</BulletItem>
          <BulletItem>Collect data or scrape content</BulletItem>
          <BulletItem>Engage in fraud, scams, or illegal activity</BulletItem>
          <P>We reserve the right to remove content or suspend accounts that violate these rules.</P>
        </Section>

        <Section num="04" title="Messaging and Interactions">
          <P>Roomdr allows messaging between users who have matched. By sending or receiving messages, you agree to:</P>
          <BulletItem>Communicate respectfully</BulletItem>
          <BulletItem>Not share harmful, explicit, or abusive content</BulletItem>
          <BulletItem>Understand that we do not screen messages</BulletItem>
          <BulletItem>Use caution when interacting with others, both online and offline</BulletItem>
          <P>Roomdr is not responsible for user conduct or offline interactions.</P>
        </Section>

        <Section num="05" title="Location-Based Features">
          <P>Roomdr uses location data to match users by neighborhood and city. By using Roomdr, you consent to:</P>
          <BulletItem>Sharing your chosen neighborhood</BulletItem>
          <BulletItem>Allowing the app to infer your city</BulletItem>
          <BulletItem>Optional GPS-based location if you enable it</BulletItem>
          <BulletItem>Showing your profile to users searching within your location</BulletItem>
          <BulletItem>Seeing profiles based on your set or searched location</BulletItem>
          <P>You may disable GPS access at any time.</P>
        </Section>

        <Section num="06" title="Paid Features & Subscriptions">
          <P>Roomdr may offer premium features such as:</P>
          <BulletItem>Unlimited rewinds</BulletItem>
          <BulletItem>Viewing who liked your profile</BulletItem>
          <BulletItem>Boosted visibility</BulletItem>
          <BulletItem>Increased messaging or chat limits</BulletItem>
          <SubLabel>By purchasing any feature, you agree to:</SubLabel>
          <BulletItem>Pay the posted price</BulletItem>
          <BulletItem>Authorize the payment method on file</BulletItem>
          <BulletItem>Understand that all purchases are final and non-refundable, except where required by law</BulletItem>
          <BulletItem>Manage your subscription through your Apple, Google, or relevant platform account</BulletItem>
          <P>Roomdr reserves the right to modify prices or features at any time.</P>
        </Section>

        <Section num="07" title="User Content">
          <P>You retain ownership of content you upload, such as:</P>
          <BulletItem>Photos</BulletItem>
          <BulletItem>Profile descriptions</BulletItem>
          <BulletItem>Messages</BulletItem>
          <BulletItem>Matching answers</BulletItem>
          <P>However, by posting content, you grant Roomdr a non-exclusive, worldwide, royalty-free license to host, display, modify, and distribute your content solely to operate the Services.</P>
          <SubLabel>Roomdr may remove any content that:</SubLabel>
          <BulletItem>Violates these Terms</BulletItem>
          <BulletItem>Is harmful or misleading</BulletItem>
          <BulletItem>Is reported by another user</BulletItem>
          <BulletItem>We deem inappropriate</BulletItem>
        </Section>

        <Section num="08" title="No Guarantees or Housing Liability">
          <P>Roomdr is not a real estate broker, housing agency, or property manager. We do not verify:</P>
          <BulletItem>The accuracy of user profiles</BulletItem>
          <BulletItem>The safety of potential roommates</BulletItem>
          <BulletItem>The condition of housing listings</BulletItem>
          <BulletItem>The background, intentions, or reliability of any user</BulletItem>
          <HighlightBox>Roomdr is a platform only. All housing decisions and interactions are made at your own risk.</HighlightBox>
          <SubLabel>We strongly recommend:</SubLabel>
          <BulletItem>Background checks</BulletItem>
          <BulletItem>Meeting in public places</BulletItem>
          <BulletItem>Conducting due diligence before signing any agreement</BulletItem>
          <P>Roomdr is not responsible for disputes between users.</P>
        </Section>

        <Section num="09" title="Third-Party Services">
          <P>Roomdr may integrate with third-party tools (e.g., analytics, payment processors, location services). Your use of such services is subject to their terms and privacy policies.</P>
          <P>Roomdr is not responsible for third-party actions or data handling.</P>
        </Section>

        <Section num="10" title="Termination">
          <P>We may suspend or terminate your account at any time if:</P>
          <BulletItem>You violate these Terms</BulletItem>
          <BulletItem>Your behavior is harmful or unsafe</BulletItem>
          <BulletItem>You misuse the platform</BulletItem>
          <BulletItem>We believe your actions put others at risk</BulletItem>
          <P>You may delete your account at any time through the app or by contacting support.</P>
          <P>Termination does not relieve you of any owed payments.</P>
        </Section>

        <Section num="11" title="Disclaimers">
          <P>The Services are provided "as is" and "as available," without warranties of any kind.</P>
          <P>Roomdr does not guarantee:</P>
          <BulletItem>Matches</BulletItem>
          <BulletItem>Housing outcomes</BulletItem>
          <BulletItem>Message delivery</BulletItem>
          <BulletItem>App availability or uptime</BulletItem>
          <BulletItem>Accuracy of content or information</BulletItem>
          <BulletItem>Safety or compatibility of users</BulletItem>
          <P>Use Roomdr at your own risk.</P>
        </Section>

        <Section num="12" title="Limitation of Liability">
          <P>To the maximum extent permitted by law, Roomdr and its owners, employees, and affiliates are not liable for:</P>
          <BulletItem>Damages resulting from user interactions</BulletItem>
          <BulletItem>Housing disputes</BulletItem>
          <BulletItem>Lost data or unauthorized access</BulletItem>
          <BulletItem>Personal injury or property loss</BulletItem>
          <BulletItem>Financial losses related to rentals or agreements</BulletItem>
          <BulletItem>Any indirect, incidental, or consequential damages</BulletItem>
          <HighlightBox>Our total liability to you will not exceed $100 or the amount you paid to Roomdr in the past 12 months, whichever is lower.</HighlightBox>
        </Section>

        <Section num="13" title="Indemnification">
          <P>You agree to indemnify and hold Roomdr harmless from any claims, losses, damages, liabilities, or expenses arising from:</P>
          <BulletItem>Your use of the Services</BulletItem>
          <BulletItem>Your interactions with other users</BulletItem>
          <BulletItem>Your violation of these Terms</BulletItem>
        </Section>

        <Section num="14" title="Governing Law">
          <P>These Terms are governed by the laws of the State of New York, without regard to conflicts of law principles.</P>
          <P>Any dispute must be resolved in New York courts.</P>
        </Section>

        <Section num="15" title="Changes to These Terms">
          <P>We may update these Terms occasionally. If material changes occur, we will notify you via the app or email.</P>
          <P>Continued use of Roomdr means you accept the updated Terms.</P>
        </Section>

        <Section num="16" title="Contact Us">
          <P>For questions about these Terms, contact:</P>
          <Pressable style={s.contactCard} onPress={() => Linking.openURL('mailto:support@roomdr.app')}>
            <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.contactIcon}>
              <Feather name="mail" size={22} color="#fff" />
            </LinearGradient>
            <View style={s.contactInfo}>
              <Text style={s.contactName}>Roomdr Support</Text>
              <Text style={s.contactEmail}>support@roomdr.app</Text>
            </View>
          </Pressable>
        </Section>

        <View style={{ height: Spacing.xxl }} />
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>
          2025 Roomdr. All rights reserved.
        </Text>
      </View>
    </ScreenScrollView>
  );
}

const s = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  heroLabel: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  heroLabelText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -1,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 15,
    color: TEXT_DIM,
    lineHeight: 22,
  },
  tocWrapper: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  toc: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
  },
  tocTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: TEXT_DIM,
    marginBottom: 14,
  },
  tocGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '50%',
    paddingVertical: 4,
  },
  tocNum: {
    fontSize: 11,
    color: ACCENT,
    fontWeight: '700',
    width: 20,
  },
  tocLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  main: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 44,
    paddingBottom: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  sectionNum: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionNumText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    flex: 1,
    lineHeight: 28,
  },
  sectionBody: {
    paddingLeft: 44,
  },
  paragraph: {
    color: TEXT_BODY,
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  bulletDot: {
    width: 6,
    height: 6,
    backgroundColor: ACCENT,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    color: TEXT_BULLET,
    fontSize: 14,
    lineHeight: 22,
  },
  highlightBox: {
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  highlightText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 20,
    marginBottom: 8,
  },
  contactCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 3,
  },
  contactEmail: {
    fontSize: 14,
    color: ACCENT,
  },
  footer: {
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
});
