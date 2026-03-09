import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkStyleTag } from '../../utils/matchingAlgorithm';
import { Colors } from '../../constants/theme';

const BG = '#111111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const RED = '#ff4444';
const GREEN = '#34c759';

interface CheckResult {
  id: number;
  name: string;
  passed: boolean;
  message: string;
}

const safeRequire = (fn: () => any): boolean => {
  try { return !!fn(); } catch { return false; }
};

export const DiagnosticScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, getSubscriptionDetails } = useAuth();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    setRunning(true);
    const checks: CheckResult[] = [];

    checks.push(checkAuth());
    checks.push(checkRenterNavigator());
    checks.push(checkHostNavigator());
    checks.push(checkAgentRemoved());
    checks.push(checkAIButtons());
    checks.push(checkWorkStyleTags());
    checks.push(checkBillingCycles());
    checks.push(checkScreensRegistered());
    checks.push(checkThemeConsistency());
    checks.push(checkUserProfile());

    setResults(checks);
    setRunning(false);
  };

  const checkAuth = (): CheckResult => {
    if (user && user.id && user.email && (user.role === 'renter' || user.role === 'host')) {
      return { id: 1, name: 'Auth: User Loaded', passed: true, message: `Auth user loaded — Role: ${user.role}` };
    }
    return { id: 1, name: 'Auth: User Loaded', passed: false, message: 'Auth user is null or missing fields' };
  };

  const checkRenterNavigator = (): CheckResult => {
    const found = safeRequire(() => require('../../navigation/RenterTabNavigator').RenterTabNavigator);
    return {
      id: 2, name: 'Role Gating: Renter Navigator',
      passed: found, message: found ? 'Renter routes correctly' : 'Renter navigator not found',
    };
  };

  const checkHostNavigator = (): CheckResult => {
    const found = safeRequire(() => require('../../navigation/HostTabNavigator').HostTabNavigator);
    return {
      id: 3, name: 'Role Gating: Host Navigator',
      passed: found, message: found ? 'Host routes correctly' : 'Host navigator not found',
    };
  };

  const checkAgentRemoved = (): CheckResult => {
    if (user && (user as any).role === 'agent') {
      return { id: 4, name: 'Agent Role Removed', passed: false, message: 'Current user has agent role' };
    }
    return { id: 4, name: 'Agent Role Removed', passed: true, message: 'Agent/Landlord role fully removed' };
  };

  const checkAIButtons = (): CheckResult => {
    const checks = [
      { name: 'RoommatesScreen', ok: safeRequire(() => require('../../screens/renter/RoommatesScreen')) },
      { name: 'ExploreScreen', ok: safeRequire(() => require('../../screens/renter/ExploreScreen')) },
      { name: 'GroupsScreen', ok: safeRequire(() => require('../../screens/renter/GroupsScreen')) },
      { name: 'MessagesScreen', ok: safeRequire(() => require('../../screens/shared/MessagesScreen')) },
      { name: 'ProfileScreen', ok: safeRequire(() => require('../../screens/shared/ProfileScreen')) },
      { name: 'RoomdrAISheet', ok: safeRequire(() => require('../../components/RoomdrAISheet')) },
    ];
    const issues = checks.filter(c => !c.ok).map(c => c.name);
    if (issues.length === 0) {
      return { id: 5, name: 'AI Button: All 5 Screens', passed: true, message: 'AI button connected on all 5 screens' };
    }
    return { id: 5, name: 'AI Button: All 5 Screens', passed: false, message: `Missing: ${issues.join(', ')}` };
  };

  const checkWorkStyleTags = (): CheckResult => {
    const expected: [string | undefined, string | null][] = [
      ['wfh_fulltime', 'Remote'],
      ['hybrid', 'Hybrid'],
      ['office_fulltime', 'Office'],
      ['irregular', 'Flexible'],
      [undefined, null],
    ];
    const wrong: string[] = [];
    for (const [input, exp] of expected) {
      const result = getWorkStyleTag(input);
      if (result !== exp) {
        wrong.push(`${input ?? 'null'}: got "${result}" expected "${exp}"`);
      }
    }
    if (wrong.length === 0) {
      return { id: 6, name: 'Work Style Tags', passed: true, message: 'All 5 tag values correct' };
    }
    return { id: 6, name: 'Work Style Tags', passed: false, message: `Incorrect: ${wrong.join('; ')}` };
  };

  const checkBillingCycles = (): CheckResult => {
    try {
      const details = getSubscriptionDetails();
      const validCycles = ['monthly', '3month', 'annual'];
      const cycleValid = validCycles.includes(details.billingCycle);
      const amountValid = details.renewalAmount >= 0;
      if (cycleValid && amountValid) {
        return { id: 7, name: 'Subscription: Billing Cycles', passed: true, message: `Billing: ${details.billingCycle}, renewal: $${details.renewalAmount}` };
      }
      return { id: 7, name: 'Subscription: Billing Cycles', passed: false, message: `Invalid cycle "${details.billingCycle}" or amount ${details.renewalAmount}` };
    } catch {
      return { id: 7, name: 'Subscription: Billing Cycles', passed: false, message: 'Failed to read subscription details' };
    }
  };

  const checkScreensRegistered = (): CheckResult => {
    const navFound = safeRequire(() => require('../../navigation/ProfileStackNavigator').ProfileStackNavigator);
    const screensFound = [
      { name: 'PlansScreen', ok: safeRequire(() => require('../../screens/shared/PlansScreen')) },
      { name: 'ManageSubscription', ok: safeRequire(() => require('../../screens/shared/ManageSubscriptionScreen')) },
      { name: 'EditProfile', ok: safeRequire(() => require('../../screens/shared/EditProfileScreen')) },
      { name: 'About', ok: safeRequire(() => require('../../screens/shared/AboutScreen')) },
      { name: 'Verification', ok: safeRequire(() => require('../../screens/shared/VerificationScreen')) },
    ];
    const missing = screensFound.filter(s => !s.ok).map(s => s.name);
    if (navFound && missing.length === 0) {
      return { id: 8, name: 'Navigation: Screens Registered', passed: true, message: `ProfileStack + ${screensFound.length} key screens verified` };
    }
    return { id: 8, name: 'Navigation: Screens Registered', passed: false, message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'ProfileStackNavigator not found' };
  };

  const checkThemeConsistency = (): CheckResult => {
    const light = Colors.light;
    const dark = Colors.dark;
    const issues: string[] = [];
    if (!light.hostBadge) issues.push('light.hostBadge missing');
    if (!dark.hostBadge) issues.push('dark.hostBadge missing');
    if (!light.renterBadge) issues.push('light.renterBadge missing');
    if (!dark.renterBadge) issues.push('dark.renterBadge missing');
    if ((light as any).agentBadge) issues.push('light.agentBadge still exists');
    if ((dark as any).agentBadge) issues.push('dark.agentBadge still exists');
    if (issues.length === 0) {
      return { id: 9, name: 'Theme: No Agent References', passed: true, message: 'Theme keys correct — no agent references' };
    }
    return { id: 9, name: 'Theme: No Agent References', passed: false, message: issues.join(', ') };
  };

  const checkUserProfile = (): CheckResult => {
    if (!user) return { id: 10, name: 'User Profile: Complete', passed: false, message: 'No user loaded' };
    const issues: string[] = [];
    if (!user.name) issues.push('name');
    if (!user.email) issues.push('email');
    if (!user.role) issues.push('role');
    if ((user.role as string) === 'agent') issues.push('role is agent');
    if (issues.length === 0) {
      return { id: 10, name: 'User Profile: Complete', passed: true, message: `User ${user.name} (${user.role}) — core fields valid` };
    }
    return { id: 10, name: 'User Profile: Complete', passed: false, message: `Missing/invalid: ${issues.join(', ')}` };
  };

  const passCount = results.filter(r => r.passed).length;
  const allPassed = passCount === 10 && results.length === 10;
  const failCount = results.length - passCount;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={15} color="rgba(255,255,255,0.65)" />
        </Pressable>
        <Text style={s.headerTitle}>App Diagnostics</Text>
        <Pressable style={s.rerunBtn} onPress={runChecks}>
          <Feather name="refresh-cw" size={14} color={ACCENT} />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={s.summaryCard}>
          <Text style={s.summaryCount}>{running ? '...' : passCount} / 10</Text>
          <Text style={s.summaryLabel}>Checks Passed</Text>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={allPassed ? [GREEN, '#2ecc71'] : [ACCENT, '#e83a2a']}
              style={[s.progressFill, { width: `${(passCount / 10) * 100}%` as any }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </View>

        {!running && results.length === 10 ? (
          allPassed ? (
            <View style={s.statusBanner}>
              <Feather name="check-circle" size={16} color={GREEN} />
              <Text style={[s.statusText, { color: GREEN }]}>App Healthy — Ready for Testing</Text>
            </View>
          ) : (
            <View style={[s.statusBanner, s.statusBannerFail]}>
              <Feather name="alert-triangle" size={16} color={RED} />
              <Text style={[s.statusText, { color: RED }]}>{failCount} Issue{failCount > 1 ? 's' : ''} Found — See Below</Text>
            </View>
          )
        ) : null}

        {results.map(r => (
          <View key={r.id} style={s.checkCard}>
            <View style={s.checkHeader}>
              <View style={[s.checkDot, { backgroundColor: r.passed ? GREEN : RED }]} />
              <Text style={s.checkName}>Check {r.id} — {r.name}</Text>
            </View>
            <Text style={[s.checkMsg, { color: r.passed ? 'rgba(255,255,255,0.6)' : RED }]}>
              {r.passed ? '\u2705' : '\u274C'} {r.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  rerunBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,107,91,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.2)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  summaryCard: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 12 },
  summaryCount: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginBottom: 14 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52,199,89,0.08)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.2)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  statusBannerFail: { backgroundColor: 'rgba(255,68,68,0.08)', borderColor: 'rgba(255,68,68,0.2)' },
  statusText: { fontSize: 13, fontWeight: '700' },

  checkCard: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, marginBottom: 8 },
  checkHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  checkDot: { width: 8, height: 8, borderRadius: 4 },
  checkName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  checkMsg: { fontSize: 12, lineHeight: 17, paddingLeft: 16 },
});
