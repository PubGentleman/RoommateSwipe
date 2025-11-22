import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RenterTabNavigator } from './RenterTabNavigator';
import { HostTabNavigator } from './HostTabNavigator';
import { AgentTabNavigator } from './AgentTabNavigator';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
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

  const MainNavigator = () => {
    switch (user.role) {
      case 'renter':
        return <RenterTabNavigator />;
      case 'host':
        return <HostTabNavigator />;
      case 'agent':
        return <AgentTabNavigator />;
      default:
        return <RenterTabNavigator />;
    }
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainNavigator} />
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
