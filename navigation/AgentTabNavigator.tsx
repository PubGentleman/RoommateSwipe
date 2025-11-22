import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { PropertiesScreen } from '../screens/agent/PropertiesScreen';
import { VerificationScreen } from '../screens/agent/VerificationScreen';
import { DocumentsScreen } from '../screens/agent/DocumentsScreen';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useTheme } from '../hooks/useTheme';

export type AgentTabParamList = {
  Properties: undefined;
  Verification: undefined;
  Documents: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AgentTabParamList>();

export const AgentTabNavigator = () => {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Properties"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.select({
            ios: 'transparent',
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null,
        headerShown: true,
        headerTransparent: true,
        headerBlurEffect: isDark ? 'dark' : 'light',
      }}
    >
      <Tab.Screen
        name="Properties"
        component={PropertiesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Verification"
        component={VerificationScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="shield" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="folder" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
