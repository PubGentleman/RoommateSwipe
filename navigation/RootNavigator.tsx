import React, { useState, useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth, getInitialRoute } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { NewPasswordScreen } from '../screens/auth/NewPasswordScreen';
import { ProfileQuestionnaireScreen } from '../screens/shared/ProfileQuestionnaireScreen';
import { PlanSelectionScreen } from '../screens/shared/PlanSelectionScreen';
import { HostTypeSelectScreen } from '../screens/host/onboarding/HostTypeSelectScreen';
import { HostCompanySetupScreen } from '../screens/host/onboarding/HostCompanySetupScreen';
import { HostAgentSetupScreen } from '../screens/host/onboarding/HostAgentSetupScreen';
import WhatAreYouLookingForScreen from '../screens/renter/WhatAreYouLookingForScreen';
import { RenterTabNavigator } from './RenterTabNavigator';
import { HostTabNavigator } from './HostTabNavigator';
import { ProfileReminderOverlay } from '../components/ProfileReminderOverlay';
import { PlansScreen } from '../screens/shared/PlansScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { ProfileCompletionScreen } from '../screens/shared/ProfileCompletionScreen';
import { OccupationPickerScreen } from '../screens/shared/OccupationPickerScreen';
import { LifestyleQuestionsScreen } from '../screens/shared/LifestyleQuestionsScreen';
import { JoinTeamScreen } from '../screens/host/JoinTeamScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { StorageService } from '../utils/storage';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  OnboardingProfile: undefined;
  OnboardingHostType: undefined;
  HostCompanySetup: undefined;
  HostAgentSetup: undefined;
  OnboardingPlan: undefined;
  Plans: undefined;
  Payment: undefined;
  Notifications: undefined;
  ProfileCompletion: undefined;
  OccupationPicker: undefined;
  LifestyleQuestions: undefined;
  JoinTeam: { inviteId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RenterMain() { return <RenterTabNavigator />; }
function HostMain() { return <HostTabNavigator />; }
HostMain.displayName = 'HostMain';

export const RootNavigator = () => {
  const { user, isLoading, passwordRecoveryMode, clearPasswordRecovery, logout, completeOnboardingStep, refreshSession } = useAuth();
  const { theme } = useTheme();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [intentCompletedForUserId, setIntentCompletedForUserId] = useState<string | null>(null);
  const [intentCheckDone, setIntentCheckDone] = useState(false);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [pendingInviteChecked, setPendingInviteChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || user.role !== 'renter') {
      setIntentCheckDone(true);
      return;
    }
    if (user.profileData?.apartment_search_type) {
      setIntentCheckDone(true);
      return;
    }
    AsyncStorage.getItem('@rhome/renter_intent').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.apartment_search_type) {
            setIntentCompletedForUserId(user.id);
          }
        } catch (_) {}
      }
      setIntentCheckDone(true);
    }).catch(() => setIntentCheckDone(true));
  }, [user?.id, user?.profileData?.apartment_search_type]);

  useEffect(() => {
    StorageService.isOnboardingCompleted().then((completed) => {
      if (!completed) {
        StorageService.setOnboardingCompleted(true);
      }
      setShowOnboarding(false);
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('pending_invite_code').then(val => {
      setHasPendingInvite(!!val);
      setPendingInviteChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!user || !pendingInviteChecked) return;
    const consumePendingInvite = async () => {
      const code = await AsyncStorage.getItem('pending_invite_code');
      if (!code) return;
      await AsyncStorage.removeItem('pending_invite_code');
      setHasPendingInvite(false);
      await AsyncStorage.setItem('pending_group_join_code', code);
    };
    consumePendingInvite();
  }, [user, pendingInviteChecked]);

  const handleOnboardingComplete = useCallback(() => {
    StorageService.setOnboardingCompleted(true);
    setShowOnboarding(false);
  }, []);

  const step = user?.onboardingStep || 'complete';
  const isHostProfessional = !!user && user.role === 'host' && (user.hostType === 'agent' || user.hostType === 'company');
  const shouldSkipProfile = false;
  const shouldSkipHostType = !!user && step === 'hostType' && user.role === 'host' && !!user.hostType;

  useEffect(() => {
    if (shouldSkipProfile) {
      completeOnboardingStep(user!.hostType ? 'plan' : 'hostType');
    } else if (shouldSkipHostType) {
      completeOnboardingStep('plan');
    }
  }, [shouldSkipProfile, shouldSkipHostType]);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (showOnboarding) {
    handleOnboardingComplete();
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (passwordRecoveryMode) {
    return (
      <NewPasswordScreen onComplete={async () => {
        clearPasswordRecovery();
        try { await logout(); } catch {}
      }} />
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  const needsRenterIntent = user.role === 'renter'
    && intentCheckDone
    && intentCompletedForUserId !== user.id
    && !user.profileData?.apartment_search_type
    && !hasPendingInvite;
  if (needsRenterIntent) {
    return (
      <WhatAreYouLookingForScreen
        onComplete={(action) => {
          if (action === 'create_group') {
            AsyncStorage.setItem('pending_group_create', 'true');
          }
          setIntentCompletedForUserId(user.id);
        }}
      />
    );
  }

  if (shouldSkipProfile || shouldSkipHostType) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (step === 'profile' && user.role === 'host') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingProfile" component={ProfileQuestionnaireScreen} />
      </Stack.Navigator>
    );
  }

  if (step === 'hostType' && user.role === 'host') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingHostType" component={HostTypeSelectScreen} />
        <Stack.Screen name="HostCompanySetup" component={HostCompanySetupScreen} />
        <Stack.Screen name="HostAgentSetup" component={HostAgentSetupScreen} />
      </Stack.Navigator>
    );
  }

  if (step === 'plan') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingPlan" component={PlanSelectionScreen} />
      </Stack.Navigator>
    );
  }

  

  const route = getInitialRoute(user);
  const MainComponent = route === 'HostTabs' ? HostMain : RenterMain;

  return (
    <>
      <Stack.Navigator key={route} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainComponent} />
        <Stack.Screen
          name="Plans"
          component={PlansScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="ProfileCompletion"
          component={ProfileCompletionScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="OccupationPicker"
          component={OccupationPickerScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="LifestyleQuestions"
          component={LifestyleQuestionsScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="JoinTeam"
          component={JoinTeamScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
      <ProfileReminderOverlay />
    </>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
