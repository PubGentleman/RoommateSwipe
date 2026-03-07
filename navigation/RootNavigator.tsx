import React, { useState, useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/shared/OnboardingScreen';
import { RenterTabNavigator } from './RenterTabNavigator';
import { HostTabNavigator } from './HostTabNavigator';
import { AgentTabNavigator } from './AgentTabNavigator';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { StorageService } from '../utils/storage';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RenterMain() { return <RenterTabNavigator />; }
RenterMain.displayName = 'RenterMain';
function HostMain() { return <HostTabNavigator />; }
HostMain.displayName = 'HostMain';
function AgentMain() { return <AgentTabNavigator />; }
AgentMain.displayName = 'AgentMain';

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      StorageService.isOnboardingCompleted(user.id).then((completed) => {
        setShowOnboarding(!completed);
        setOnboardingChecked(true);
      });
    } else {
      setOnboardingChecked(true);
      setShowOnboarding(false);
    }
  }, [user]);

  const handleOnboardingComplete = useCallback(() => {
    if (user) {
      StorageService.setOnboardingCompleted(user.id, true);
    }
    setShowOnboarding(false);
  }, [user]);

  if (isLoading || (user && !onboardingChecked)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  const MainComponent = user.role === 'host'
    ? HostMain
    : user.role === 'agent'
      ? AgentMain
      : RenterMain;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainComponent} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
