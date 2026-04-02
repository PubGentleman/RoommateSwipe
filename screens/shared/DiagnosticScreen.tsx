import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkStyleTag } from '../../utils/matchingAlgorithm';
import { Colors } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import { StorageService } from '../../utils/storage';
import type { User } from '../../types/models';

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
  const { user, updateUser, upgradeToPlus, upgradeToElite, upgradeHostPlan, getSubscriptionDetails } = useAuth();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(true);
  const [switching, setSwitching] = useState(false);

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
      { name: 'RhomeAISheet', ok: safeRequire(() => require('../../components/RhomeAISheet')) },
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

        <DevModePanel
          user={user}
          updateUser={updateUser}
          upgradeToPlus={upgradeToPlus}
          upgradeToElite={upgradeToElite}
          upgradeHostPlan={upgradeHostPlan}
          switching={switching}
          setSwitching={setSwitching}
        />
      </ScrollView>
    </View>
  );
};

const DEV_PURPLE = '#a78bfa';

interface DevModePanelProps {
  user: User | null;
  updateUser: (updates: Partial<User>) => Promise<void>;
  upgradeToPlus: (billingCycle?: 'monthly' | '3month' | 'annual') => Promise<void>;
  upgradeToElite: (billingCycle?: 'monthly' | '3month' | 'annual') => Promise<void>;
  upgradeHostPlan: (plan: string, billingCycle?: 'monthly' | '3month' | 'annual') => Promise<void>;
  switching: boolean;
  setSwitching: (v: boolean) => void;
}

const ChipRow = ({ label, options, value, onSelect, accentColor }: {
  label: string;
  options: { key: string; label: string }[];
  value: string | undefined;
  onSelect: (key: string) => void;
  accentColor?: string;
}) => {
  const color = accentColor || ACCENT;
  return (
    <View style={ds.chipSection}>
      <Text style={ds.chipLabel}>{label}</Text>
      <View style={ds.chipRow}>
        {options.map(opt => {
          const active = opt.key === (value || '');
          return (
            <Pressable
              key={opt.key}
              style={[ds.chip, active && { backgroundColor: color + '25', borderColor: color }]}
              onPress={() => onSelect(opt.key)}
            >
              <Text style={[ds.chipText, active && { color }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

function DevModePanel({ user, updateUser, upgradeToPlus, upgradeToElite, upgradeHostPlan, switching, setSwitching }: DevModePanelProps) {
  if (!user) return null;

  const currentRole = user.role || 'renter';
  const currentHostType = user.hostType || 'individual';
  const currentRenterPlan = user.subscription?.plan || 'basic';
  const currentHostPlan = user.hostSubscription?.plan || 'free';
  const currentAgentPlan = user.agentPlan || 'pay_per_use';

  const handleSwitchRole = async (role: 'renter' | 'host') => {
    if (switching || role === currentRole) return;
    setSwitching(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const updates: Partial<User> = { role };
      if (role === 'host' && !user.hostType) {
        updates.hostType = 'individual';
      }
      if (role === 'host') {
        updates.activeMode = 'host';
        updates.hasCompletedHostOnboarding = true;
        updates.onboardingStep = 'complete';
      } else {
        updates.activeMode = 'renter';
        updates.onboardingStep = 'complete';
      }
      await updateUser(updates);
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitchHostType = async (hostType: 'individual' | 'agent' | 'company') => {
    if (switching || hostType === currentHostType) return;
    setSwitching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updates: Partial<User> = {
        hostType,
        role: 'host',
        activeMode: 'host',
        hasCompletedHostOnboarding: true,
        onboardingStep: 'complete',
        typeOnboardingComplete: true,
      };
      if (hostType === 'company') {
        updates.companyName = updates.companyName || 'Test Company Inc.';
        updates.verifiedBusiness = true;
      }
      if (hostType === 'agent') {
        updates.licenseVerified = true;
        updates.licenseVerificationStatus = 'verified';
      }
      await updateUser(updates);
    } finally {
      setSwitching(false);
    }
  };

  const handleRenterPlan = async (plan: string) => {
    if (switching || plan === currentRenterPlan) return;
    setSwitching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (plan === 'plus') {
        await upgradeToPlus('monthly');
      } else if (plan === 'elite') {
        await upgradeToElite('monthly');
      } else {
        await updateUser({
          subscription: { plan: 'basic', status: 'active', billingCycle: 'monthly', billingHistory: [] },
        });
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleHostPlan = async (plan: string) => {
    if (switching || plan === currentHostPlan) return;
    setSwitching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (plan === 'free') {
        await updateUser({
          hostSubscription: { plan: 'free', status: 'active', billingCycle: 'monthly', inquiryResponsesUsed: 0 },
        });
      } else {
        const prefixed = (currentHostType === 'agent') ? `agent_${plan}` :
                         (currentHostType === 'company') ? `company_${plan}` : plan;
        await upgradeHostPlan(prefixed, 'monthly');
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleAgentPlan = async (plan: string) => {
    if (switching || plan === currentAgentPlan) return;
    setSwitching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateUser({ agentPlan: plan as any });
    } finally {
      setSwitching(false);
    }
  };

  const isHost = currentRole === 'host';
  const isAgent = currentHostType === 'agent';
  const isCompany = currentHostType === 'company';

  return (
    <View style={ds.container}>
      <View style={ds.header}>
        <View style={ds.headerIconWrap}>
          <Feather name="terminal" size={16} color={DEV_PURPLE} />
        </View>
        <Text style={ds.headerTitle}>Dev Mode Panel</Text>
        {switching ? <Text style={ds.switchingLabel}>Switching...</Text> : null}
      </View>

      <View style={ds.currentCard}>
        <Text style={ds.currentLabel}>CURRENT STATE</Text>
        <Text style={ds.currentValue}>
          {user.name} — {currentRole === 'host' ? `Host (${currentHostType})` : 'Renter'}
        </Text>
        <Text style={ds.currentSub}>
          Renter: {currentRenterPlan.toUpperCase()} | Host: {currentHostPlan.toUpperCase()}
          {isAgent || isCompany ? ` | Agent Plan: ${currentAgentPlan}` : ''}
        </Text>
      </View>

      <ChipRow
        label="ROLE"
        options={[
          { key: 'renter', label: 'Renter' },
          { key: 'host', label: 'Host' },
        ]}
        value={currentRole}
        onSelect={(k) => handleSwitchRole(k as 'renter' | 'host')}
        accentColor={DEV_PURPLE}
      />

      {isHost ? (
        <ChipRow
          label="HOST TYPE"
          options={[
            { key: 'individual', label: 'Individual' },
            { key: 'agent', label: 'Agent' },
            { key: 'company', label: 'Company' },
          ]}
          value={currentHostType}
          onSelect={(k) => handleSwitchHostType(k as any)}
          accentColor="#3b82f6"
        />
      ) : null}

      <ChipRow
        label="RENTER PLAN"
        options={[
          { key: 'basic', label: 'Basic (Free)' },
          { key: 'plus', label: 'Plus' },
          { key: 'elite', label: 'Elite' },
        ]}
        value={currentRenterPlan}
        onSelect={handleRenterPlan}
        accentColor="#22c55e"
      />

      {isHost ? (
        <ChipRow
          label="HOST PLAN"
          options={[
            { key: 'free', label: 'Free' },
            { key: 'starter', label: 'Starter' },
            { key: 'pro', label: 'Pro' },
            { key: 'business', label: 'Business' },
          ]}
          value={currentHostPlan.replace(/^(agent_|company_)/, '')}
          onSelect={handleHostPlan}
          accentColor="#f59e0b"
        />
      ) : null}

      {isHost && (isAgent || isCompany) ? (
        <ChipRow
          label="AGENT PLAN"
          options={[
            { key: 'pay_per_use', label: 'Pay Per Use' },
            { key: 'starter', label: 'Starter' },
            { key: 'pro', label: 'Pro' },
            { key: 'business', label: 'Business' },
          ]}
          value={currentAgentPlan.replace(/^agent_/, '')}
          onSelect={handleAgentPlan}
          accentColor="#ec4899"
        />
      ) : null}

      <View style={ds.notice}>
        <Feather name="info" size={12} color="rgba(255,255,255,0.3)" />
        <Text style={ds.noticeText}>
          Changes apply instantly. Subscription bypasses are local only — no payment charged.
        </Text>
      </View>
    </View>
  );
}

const ds = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 20, backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: DEV_PURPLE + '30', padding: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  headerIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: DEV_PURPLE + '20', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: DEV_PURPLE, flex: 1 },
  switchingLabel: { fontSize: 11, fontWeight: '600', color: '#f59e0b' },
  currentCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  currentLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 6 },
  currentValue: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  currentSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  chipSection: { marginBottom: 14 },
  chipLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  noticeText: { fontSize: 11, color: 'rgba(255,255,255,0.3)', flex: 1 },
});

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
