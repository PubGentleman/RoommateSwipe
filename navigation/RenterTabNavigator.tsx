import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExploreScreen } from '../screens/renter/ExploreScreen';
import { RoommatesStackNavigator } from './RoommatesStackNavigator';
import { GroupsScreen } from '../screens/renter/GroupsScreen';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
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
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Roommates"
      safeAreaInsets={{ left: 0, right: 0 }}
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
          paddingHorizontal: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null,
        headerShown: false,
        sceneStyle: { flex: 1 },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="search" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Roommates"
        component={RoommatesStackNavigator}
        options={{
          tabBarLabel: 'Match',
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
