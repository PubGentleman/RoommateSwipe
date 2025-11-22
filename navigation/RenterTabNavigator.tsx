import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { ExploreScreen } from '../screens/renter/ExploreScreen';
import { RoommatesScreen } from '../screens/renter/RoommatesScreen';
import { GroupsScreen } from '../screens/renter/GroupsScreen';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useTheme } from '../hooks/useTheme';

export type RenterTabParamList = {
  Explore: undefined;
  Roommates: undefined;
  Groups: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RenterTabParamList>();

export const RenterTabNavigator = () => {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Roommates"
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
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="search" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Roommates"
        component={RoommatesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
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
