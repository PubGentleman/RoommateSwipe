import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '../components/VectorIcons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExploreStackNavigator } from './ExploreStackNavigator';
import { RoommatesStackNavigator } from './RoommatesStackNavigator';
import { GroupsStackNavigator } from './GroupsStackNavigator';
import { MyGroupStackNavigator } from './MyGroupStackNavigator';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import SavedListingsScreen from '../screens/renter/SavedListingsScreen';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationContext } from '../contexts/NotificationContext';
import { needsRoommates, isPreformedGroup, isFastLane } from '../utils/renterIntentUtils';
import { VerificationBanner } from '../components/VerificationBanner';

export type RenterTabParamList = {
  Explore: { viewListingId?: string } | undefined;
  Roommates: undefined;
  Groups: undefined;
  MyGroup: undefined;
  Messages: undefined;
  Profile: undefined;
  Saved: undefined;
};

const Tab = createBottomTabNavigator<RenterTabParamList>();

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Explore: { icon: 'search', label: 'Explore' },
  Roommates: { icon: 'users', label: 'Match' },
  Groups: { icon: 'grid', label: 'Groups' },
  Messages: { icon: 'message-circle', label: 'Chat' },
  Profile: { icon: 'user', label: 'Profile' },
  Saved: { icon: 'bookmark', label: 'Saved' },
  MyGroup: { icon: 'users', label: 'My Group' },
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();

  return (
    <View style={[tabStyles.wrapper, { paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]} />
      )}
      <View style={tabStyles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name] || { icon: 'circle', label: route.name };
          const color = isFocused ? '#ff6b5b' : '#A0A0A0';
          const showBadge = route.name === 'Messages' && unreadCount > 0;

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
              } else if (route.name === 'Explore' && isFocused) {
                navigation.navigate('Explore' as any, { screen: 'ExploreMain' } as any);
              } else if (!isFocused) {
                navigation.navigate(route.name);
              }
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={tabStyles.tab}>
              <View>
                <Feather name={config.icon as any} size={22} color={color} />
                {showBadge ? (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
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

export const RenterTabNavigator = () => {
  const { user } = useAuth();
  const searchType = user?.profileData?.apartment_search_type;

  const showRoommates = needsRoommates(searchType);
  const showMyGroup = isPreformedGroup(searchType);
  const showSaved = isFastLane(searchType);

  const tabKey = showRoommates ? 'full' : showMyGroup ? 'group' : 'lite';

  return (
    <>
    <VerificationBanner />
    <Tab.Navigator
      key={tabKey}
      initialRouteName={showRoommates ? 'Roommates' : 'Explore'}
      tabBar={(props) => <CustomTabBar {...props} />}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tab.Screen name="Explore" component={ExploreStackNavigator} />
      {showRoommates ? (
        <Tab.Screen name="Roommates" component={RoommatesStackNavigator} />
      ) : null}
      {showRoommates ? (
        <Tab.Screen name="Groups" component={GroupsStackNavigator} />
      ) : null}
      {showMyGroup ? (
        <Tab.Screen name="MyGroup" component={MyGroupStackNavigator} />
      ) : null}
      {(showSaved || showMyGroup) ? (
        <Tab.Screen name="Saved" component={SavedListingsScreen} />
      ) : null}
      <Tab.Screen name="Messages" component={MessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
    </>
  );
};
