import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { MyListingsScreen } from '../screens/host/MyListingsScreen';
import { ApplicationsScreen } from '../screens/host/ApplicationsScreen';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { useTheme } from '../hooks/useTheme';

export type HostTabParamList = {
  MyListings: undefined;
  Applications: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HostTabParamList>();

export const HostTabNavigator = () => {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="MyListings"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 9,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          minWidth: 0,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
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
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="MyListings"
        component={MyListingsScreen}
        options={{
          title: 'My Listings',
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
