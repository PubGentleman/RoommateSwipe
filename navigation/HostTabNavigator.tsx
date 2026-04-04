import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Feather } from '../components/VectorIcons';
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
import { HostGroupOutreachScreen } from '../screens/host/HostGroupOutreachScreen';
import { BrowseRenterGroupsScreen } from '../screens/host/BrowseRenterGroupsScreen';
import { HostRenterGroupDetailScreen } from '../screens/host/HostRenterGroupDetailScreen';
import { BrowseRentersScreen } from '../screens/host/BrowseRentersScreen';
import { RenterProfileDetailScreen } from '../screens/host/RenterProfileDetailScreen';
import { RenterCompatibilityScreen } from '../screens/host/RenterCompatibilityScreen';
import { AgentGroupBuilderScreen } from '../screens/host/AgentGroupBuilderScreen';
import { AgentGroupsScreen } from '../screens/host/AgentGroupsScreen';
import { AgentGroupDetailScreen } from '../screens/host/AgentGroupDetailScreen';
import { HostGroupMatchesScreen } from '../screens/host/HostGroupMatchesScreen';
import { CompanyFillPipelineScreen } from '../screens/host/CompanyFillPipelineScreen';
import { CompanyListingAIScreen } from '../screens/host/CompanyListingAIScreen';
import { PiMatchedGroupsScreen } from '../screens/host/PiMatchedGroupsScreen';
import { PiClaimedGroupDetailScreen } from '../screens/host/PiClaimedGroupDetailScreen';
import { InviteExistingRoommatesScreen } from '../screens/host/InviteExistingRoommatesScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { HostMessagesStackNavigator } from './HostMessagesStackNavigator';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { TeamManagementScreen } from '../screens/host/TeamManagementScreen';
import { HostListingDetailScreen } from '../screens/host/HostListingDetailScreen';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationContext } from '../contexts/NotificationContext';

export type HostListingsStackParamList = {
  MyListings: undefined;
  CreateEditListing: { propertyId?: string };
  HostListingDetail: { listingId: string };
  ListingBoost: { listingId: string };
  HostGroupOutreach: { listingId: string; listingTitle: string };
  InviteExistingRoommates: { listingId: string; count: number; listingAddress?: string };
};

export type HostDashboardStackParamList = {
  DashboardMain: undefined;
  CreateEditListing: { propertyId?: string };
  HostListingDetail: { listingId: string };
  Analytics: undefined;
  Inquiries: { filter?: 'all' | 'pending' | 'accepted' | 'passed' } | undefined;
  Notifications: undefined;
  HostPricing: undefined;
  HostSubscription: undefined;
  ListingBoost: { listingId: string };
  GroupMatches: { listingId: string };
  CompanyFillPipeline: undefined;
  CompanyListingAI: { listingId: string; autoRunPairing?: boolean };
  BrowseRenters: { targetListingId?: string };
  RenterProfileDetail: { renter: any };
  InviteExistingRoommates: { listingId: string; count: number; listingAddress?: string };
  PiMatchedGroups: { listing?: any } | undefined;
  PiClaimedGroupDetail: { groupId: string };
  MyListings: undefined;
  Chat: { conversationId: string; otherUser: any };
  AgentGroupBuilder: { preselectedIds?: string[]; preselectedRenters?: any[]; listingId?: string };
};

export type HostGroupsStackParamList = {
  BrowseRenterGroups: undefined;
  RenterGroupDetail: { group: any };
};

export type AgentBrowseStackParamList = {
  BrowseRenters: undefined;
  RenterProfileDetail: { renter: any; isShortlisted?: boolean };
  RenterCompatibility: { renters: any[] };
  AgentGroupBuilder: { preselectedIds?: string[]; preselectedRenters?: any[]; listingId?: string };
  PiMatchedGroups: { listing?: any } | undefined;
  PiClaimedGroupDetail: { groupId: string };
  Chat: { conversationId: string; otherUser: any };
};

export type AgentGroupsStackParamList = {
  AgentGroupsList: undefined;
  AgentGroupDetail: { groupId: string; group: any };
  AgentGroupBuilder: { preselectedIds?: string[]; preselectedRenters?: any[]; listingId?: string };
  Chat: { conversationId: string; otherUser: any };
};

export type HostTabParamList = {
  Dashboard: undefined;
  Listings: undefined;
  Team: undefined;
  Groups: undefined;
  Roommates: undefined;
  BrowseRenters: undefined;
  AgentGroups: undefined;
  Messages: { role?: string } | undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HostTabParamList>();
const ListingsStack = createNativeStackNavigator<HostListingsStackParamList>();
const DashboardStack = createNativeStackNavigator<HostDashboardStackParamList>();
const GroupsStack = createNativeStackNavigator<HostGroupsStackParamList>();
const AgentBrowseStack = createNativeStackNavigator<AgentBrowseStackParamList>();
const AgentGroupsStack = createNativeStackNavigator<AgentGroupsStackParamList>();

function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="DashboardMain" component={HostDashboardScreen} />
      <DashboardStack.Screen name="CreateEditListing" component={CreateEditListingScreen} />
      <DashboardStack.Screen name="HostListingDetail" component={HostListingDetailScreen} />
      <DashboardStack.Screen name="Analytics" component={HostAnalyticsScreen} />
      <DashboardStack.Screen name="Inquiries" component={HostInquiriesScreen} />
      <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
      <DashboardStack.Screen name="HostPricing" component={HostPricingScreen} />
      <DashboardStack.Screen name="HostSubscription" component={HostSubscriptionScreen} />
      <DashboardStack.Screen name="ListingBoost" component={ListingBoostScreen} />
      <DashboardStack.Screen name="GroupMatches" component={HostGroupMatchesScreen} />
      <DashboardStack.Screen name="CompanyFillPipeline" component={CompanyFillPipelineScreen} />
      <DashboardStack.Screen name="CompanyListingAI" component={CompanyListingAIScreen} />
      <DashboardStack.Screen name="BrowseRenters" component={BrowseRentersScreen} />
      <DashboardStack.Screen name="RenterProfileDetail" component={RenterProfileDetailScreen} />
      <DashboardStack.Screen name="InviteExistingRoommates" component={InviteExistingRoommatesScreen} />
      <DashboardStack.Screen name="PiMatchedGroups" component={PiMatchedGroupsScreen} />
      <DashboardStack.Screen name="PiClaimedGroupDetail" component={PiClaimedGroupDetailScreen} />
      <DashboardStack.Screen name="MyListings" component={MyListingsScreen} />
      <DashboardStack.Screen name="Chat" component={ChatScreen} />
      <DashboardStack.Screen name="AgentGroupBuilder" component={AgentGroupBuilderScreen} />
    </DashboardStack.Navigator>
  );
}

function ListingsStackNavigator() {
  return (
    <ListingsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListingsStack.Screen name="MyListings" component={MyListingsScreen} />
      <ListingsStack.Screen name="CreateEditListing" component={CreateEditListingScreen} />
      <ListingsStack.Screen name="HostListingDetail" component={HostListingDetailScreen} />
      <ListingsStack.Screen name="ListingBoost" component={ListingBoostScreen} />
      <ListingsStack.Screen name="HostGroupOutreach" component={HostGroupOutreachScreen} />
      <ListingsStack.Screen name="InviteExistingRoommates" component={InviteExistingRoommatesScreen} />
    </ListingsStack.Navigator>
  );
}

function HostGroupsStackNavigator() {
  return (
    <GroupsStack.Navigator screenOptions={{ headerShown: false }}>
      <GroupsStack.Screen name="BrowseRenterGroups" component={BrowseRenterGroupsScreen} />
      <GroupsStack.Screen name="RenterGroupDetail" component={HostRenterGroupDetailScreen} />
    </GroupsStack.Navigator>
  );
}

function AgentBrowseStackNavigator() {
  return (
    <AgentBrowseStack.Navigator screenOptions={{ headerShown: false }}>
      <AgentBrowseStack.Screen name="BrowseRenters" component={BrowseRentersScreen} />
      <AgentBrowseStack.Screen name="RenterProfileDetail" component={RenterProfileDetailScreen} />
      <AgentBrowseStack.Screen name="RenterCompatibility" component={RenterCompatibilityScreen} />
      <AgentBrowseStack.Screen name="AgentGroupBuilder" component={AgentGroupBuilderScreen} />
      <AgentBrowseStack.Screen name="PiMatchedGroups" component={PiMatchedGroupsScreen} />
      <AgentBrowseStack.Screen name="PiClaimedGroupDetail" component={PiClaimedGroupDetailScreen} />
      <AgentBrowseStack.Screen name="Chat" component={ChatScreen} />
    </AgentBrowseStack.Navigator>
  );
}

function AgentGroupsStackNavigator() {
  return (
    <AgentGroupsStack.Navigator screenOptions={{ headerShown: false }}>
      <AgentGroupsStack.Screen name="AgentGroupsList" component={AgentGroupsScreen} />
      <AgentGroupsStack.Screen name="AgentGroupDetail" component={AgentGroupDetailScreen} />
      <AgentGroupsStack.Screen name="AgentGroupBuilder" component={AgentGroupBuilderScreen} />
      <AgentGroupsStack.Screen name="Chat" component={ChatScreen} />
    </AgentGroupsStack.Navigator>
  );
}

const HOST_TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Dashboard: { icon: 'grid', label: 'Dashboard' },
  Listings: { icon: 'home', label: 'Listings' },
  Groups: { icon: 'users', label: 'Groups' },
  Roommates: { icon: 'heart', label: 'Match' },
  BrowseRenters: { icon: 'search', label: 'Renters' },
  AgentGroups: { icon: 'users', label: 'My Groups' },
  Messages: { icon: 'message-circle', label: 'Messages' },
  Profile: { icon: 'user', label: 'Profile' },
};

const SCREENS_HIDE_TAB_BAR = ['CreateEditListing', 'HostListingDetail'];

function HostCustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();

  const focusedRoute = state.routes[state.index];
  const focusedChildName = getFocusedRouteNameFromRoute(focusedRoute) ?? '';
  if (SCREENS_HIDE_TAB_BAR.includes(focusedChildName)) {
    return null;
  }

  return (
    <View style={[hostTabStyles.wrapper, { paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]} />
      )}
      <View style={hostTabStyles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = HOST_TAB_CONFIG[route.name] || { icon: 'circle', label: route.name };
          const color = isFocused ? '#ff6b5b' : '#A0A0A0';
          const showBadge = (route.name === 'Profile' || route.name === 'Messages') && unreadCount > 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              if (route.name === 'Messages') {
                navigation.navigate('Messages' as any, { screen: 'MessagesList' } as any);
              } else if (route.name === 'Profile') {
                navigation.navigate('Profile' as any, { screen: 'ProfileMain' } as any);
              } else if (!isFocused) {
                navigation.navigate(route.name);
              }
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
  const { user } = useAuth();
  const hostType = user?.hostType;

  if (hostType === 'agent') {
    return (
      <Tab.Navigator
        initialRouteName="Dashboard"
        tabBar={(props) => <HostCustomTabBar {...props} />}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardStackNavigator} />
        <Tab.Screen name="BrowseRenters" component={AgentBrowseStackNavigator} />
        <Tab.Screen name="AgentGroups" component={AgentGroupsStackNavigator} />
        <Tab.Screen name="Messages" component={HostMessagesStackNavigator} initialParams={{ role: 'agent' }} />
        <Tab.Screen name="Profile" component={ProfileStackNavigator} />
      </Tab.Navigator>
    );
  }

  if (hostType === 'company') {
    return (
      <Tab.Navigator
        initialRouteName="Dashboard"
        tabBar={(props) => <HostCustomTabBar {...props} />}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardStackNavigator} />
        <Tab.Screen name="BrowseRenters" component={AgentBrowseStackNavigator} />
        <Tab.Screen name="AgentGroups" component={AgentGroupsStackNavigator} />
        <Tab.Screen name="Messages" component={HostMessagesStackNavigator} initialParams={{ role: 'company' }} />
        <Tab.Screen name="Profile" component={ProfileStackNavigator} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <HostCustomTabBar {...props} />}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackNavigator} />
      <Tab.Screen name="Listings" component={ListingsStackNavigator} />
      <Tab.Screen name="Roommates" component={RoommatesScreen} />
      <Tab.Screen name="Groups" component={HostGroupsStackNavigator} />
      <Tab.Screen name="Messages" component={HostMessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};
