import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HostDashboardScreen } from '../screens/host/HostDashboardScreen';
import { MyListingsScreen } from '../screens/host/MyListingsScreen';
import { CreateEditListingScreen } from '../screens/host/CreateEditListingScreen';
import { HostInquiriesScreen } from '../screens/host/HostInquiriesScreen';
import { RoommatesScreen } from '../screens/renter/RoommatesScreen';
import { HostAnalyticsScreen } from '../screens/host/HostAnalyticsScreen';
import { HostPricingScreen } from '../screens/host/HostPricingScreen';
import { HostSubscriptionScreen } from '../screens/host/HostSubscriptionScreen';
import { ListingBoostScreen } from '../screens/host/ListingBoostScreen';
import { BrowseRenterGroupsScreen } from '../screens/host/BrowseRenterGroupsScreen';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { useTheme } from '../hooks/useTheme';
import { useNotificationContext } from '../contexts/NotificationContext';

export type HostListingsStackParamList = {
  MyListings: undefined;
  CreateEditListing: { propertyId?: string };
  ListingBoost: { listingId: string };
};

export type HostDashboardStackParamList = {
  DashboardMain: undefined;
  CreateEditListing: { propertyId?: string };
  Analytics: undefined;
  Inquiries: undefined;
  HostPricing: undefined;
  HostSubscription: undefined;
  ListingBoost: { listingId: string };
};

export type HostTabParamList = {
  Dashboard: undefined;
  Listings: undefined;
  Groups: undefined;
  Roommates: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HostTabParamList>();
const ListingsStack = createNativeStackNavigator<HostListingsStackParamList>();
const DashboardStack = createNativeStackNavigator<HostDashboardStackParamList>();

function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="DashboardMain" component={HostDashboardScreen} />
      <DashboardStack.Screen name="CreateEditListing" component={CreateEditListingScreen} />
      <DashboardStack.Screen name="Analytics" component={HostAnalyticsScreen} />
      <DashboardStack.Screen name="Inquiries" component={HostInquiriesScreen} />
      <DashboardStack.Screen name="HostPricing" component={HostPricingScreen} />
      <DashboardStack.Screen name="HostSubscription" component={HostSubscriptionScreen} />
      <DashboardStack.Screen name="ListingBoost" component={ListingBoostScreen} />
    </DashboardStack.Navigator>
  );
}

function ListingsStackNavigator() {
  return (
    <ListingsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListingsStack.Screen name="MyListings" component={MyListingsScreen} />
      <ListingsStack.Screen name="CreateEditListing" component={CreateEditListingScreen} />
      <ListingsStack.Screen name="ListingBoost" component={ListingBoostScreen} />
    </ListingsStack.Navigator>
  );
}

const HOST_TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Dashboard: { icon: 'grid', label: 'Dashboard' },
  Listings: { icon: 'home', label: 'Listings' },
  Groups: { icon: 'users', label: 'Groups' },
  Roommates: { icon: 'heart', label: 'Match' },
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
      initialRouteName="Dashboard"
      tabBar={(props) => <HostCustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackNavigator} />
      <Tab.Screen name="Listings" component={ListingsStackNavigator} />
      <Tab.Screen name="Roommates" component={RoommatesScreen} />
      <Tab.Screen name="Groups" component={BrowseRenterGroupsScreen} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};
