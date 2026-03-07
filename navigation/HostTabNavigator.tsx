import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MyListingsScreen } from '../screens/host/MyListingsScreen';
import { ApplicationsScreen } from '../screens/host/ApplicationsScreen';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { useTheme } from '../hooks/useTheme';
import { useNotificationContext } from '../contexts/NotificationContext';

export type HostTabParamList = {
  MyListings: undefined;
  Applications: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HostTabParamList>();

const HOST_TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  MyListings: { icon: 'home', label: 'Listings' },
  Applications: { icon: 'file-text', label: 'Applications' },
  Messages: { icon: 'message-circle', label: 'Messages' },
  Profile: { icon: 'user', label: 'Profile' },
};

function HostCustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();

  return (
    <View style={[hostTabStyles.wrapper, { paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundRoot }]} />
      )}
      <View style={hostTabStyles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = HOST_TAB_CONFIG[route.name] || { icon: 'circle', label: route.name };
          const color = isFocused ? theme.tabIconSelected : theme.tabIconDefault;
          const showBadge = (route.name === 'Profile' || route.name === 'Messages') && unreadCount > 0;

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
            <Pressable key={route.key} onPress={onPress} style={hostTabStyles.tab}>
              <View>
                <Feather name={config.icon as any} size={22} color={color} />
                {showBadge ? (
                  <View style={hostTabStyles.badge}>
                    <Text style={hostTabStyles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[hostTabStyles.label, { color }]}>{config.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const hostTabStyles = StyleSheet.create({
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#FF4757',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export const HostTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="MyListings"
      tabBar={(props) => <HostCustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="MyListings" component={MyListingsScreen} />
      <Tab.Screen name="Applications" component={ApplicationsScreen} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};
