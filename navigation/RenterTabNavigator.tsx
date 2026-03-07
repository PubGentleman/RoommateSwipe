import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Explore: { icon: 'search', label: 'Explore' },
  Roommates: { icon: 'users', label: 'Match' },
  Groups: { icon: 'grid', label: 'Groups' },
  Messages: { icon: 'message-circle', label: 'Chat' },
  Profile: { icon: 'user', label: 'Profile' },
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrapper, { paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundRoot }]} />
      )}
      <View style={tabStyles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name] || { icon: 'circle', label: route.name };
          const color = isFocused ? theme.tabIconSelected : theme.tabIconDefault;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={tabStyles.tab}>
              <Feather name={config.icon as any} size={22} color={color} />
              <Text style={[tabStyles.label, { color }]}>{config.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export const RenterTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Roommates"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Roommates" component={RoommatesStackNavigator} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};
