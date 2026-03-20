import React, { useState, useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/shared/OnboardingScreen';
import { ProfileQuestionnaireScreen } from '../screens/shared/ProfileQuestionnaireScreen';
import { PlanSelectionScreen } from '../screens/shared/PlanSelectionScreen';
import { HostTypeSelectScreen } from '../screens/host/onboarding/HostTypeSelectScreen';
import { HostCompanySetupScreen } from '../screens/host/onboarding/HostCompanySetupScreen';
import { HostAgentSetupScreen } from '../screens/host/onboarding/HostAgentSetupScreen';
import { RenterTabNavigator } from './RenterTabNavigator';
import { HostTabNavigator } from './HostTabNavigator';
import { ProfileReminderOverlay } from '../components/ProfileReminderOverlay';
import { PlansScreen } from '../screens/shared/PlansScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RenterMain() { return <RenterTabNavigator />; }
RenterMain.displayName = 'RenterMain';
function HostMain() { return <HostTabNavigator />; }
HostMain.displayName = 'HostMain';

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    StorageService.isOnboardingCompleted().then((completed) => {
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    StorageService.setOnboardingCompleted(true);
    setShowOnboarding(false);
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  const step = user.onboardingStep || 'complete';

  if (step === 'profile') {
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

  const MainComponent = user.role === 'host'
    ? HostMain
    : RenterMain;

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
