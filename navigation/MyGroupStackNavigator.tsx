import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyGroupScreen from '../screens/renter/MyGroupScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { GroupInviteScreen } from '../screens/shared/GroupInviteScreen';
import { GroupInfoScreen } from '../screens/shared/GroupInfoScreen';
import { InterestedUsersScreen } from '../screens/shared/InterestedUsersScreen';
import ApartmentPreferencesScreen from '../screens/shared/ApartmentPreferencesScreen';
import GroupApartmentSuggestionsScreen from '../screens/renter/GroupApartmentSuggestionsScreen';
import GroupInviteAcceptScreen from '../screens/renter/GroupInviteAcceptScreen';
import GroupSetupScreen from '../screens/renter/GroupSetupScreen';
import InviteFriendsScreen from '../screens/renter/InviteFriendsScreen';
import GroupRequestReviewScreen from '../screens/renter/GroupRequestReviewScreen';
import { EventsScreen } from '../screens/shared/EventsScreen';
import { EventDetailScreen } from '../screens/shared/EventDetailScreen';
import { CreateEventScreen } from '../screens/shared/CreateEventScreen';
import { RoommateProfile } from '../types/models';

export type MyGroupStackParamList = {
  MyGroupHome: undefined;
  Chat: {
    conversationId: string;
    otherUser?: RoommateProfile;
    inquiryGroup?: any;
  };
  GroupInvite: {
    groupId: string;
    groupName: string;
    listingId?: string | null;
  };
  GroupInfo: {
    groupId: string;
    groupName?: string;
  };
  InterestedUsers: {
    groupId: string;
    groupName: string;
  };
  ApartmentPreferences: undefined;
  GroupApartmentSuggestions: {
    groupId: string;
    isNewlyComplete?: boolean;
  };
  GroupInviteAccept: {
    inviteCode: string;
  };
  GroupSetup: undefined;
  InviteFriends: {
    groupId: string;
    inviteCode: string;
    groupName?: string;
  };
  GroupRequestReview: {
    groupId: string;
    groupType: 'pi_auto' | 'preformed';
    isLead?: boolean;
    memberCount?: number;
  };
  Events: undefined;
  EventDetail: { eventId: string };
  CreateEvent: { groupId?: string };
};

const Stack = createNativeStackNavigator<MyGroupStackParamList>();

export const MyGroupStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyGroupHome" component={MyGroupScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="GroupInvite" component={GroupInviteScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="InterestedUsers" component={InterestedUsersScreen} />
      <Stack.Screen name="ApartmentPreferences" component={ApartmentPreferencesScreen} />
      <Stack.Screen name="GroupApartmentSuggestions" component={GroupApartmentSuggestionsScreen} />
      <Stack.Screen name="GroupInviteAccept" component={GroupInviteAcceptScreen} />
      <Stack.Screen name="GroupRequestReview" component={GroupRequestReviewScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="GroupSetup">
        {({ navigation: nav }) => (
          <GroupSetupScreen
            onComplete={(groupId, inviteCode) => {
              nav.replace('InviteFriends', { groupId, inviteCode });
            }}
            onSkip={() => nav.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="InviteFriends">
        {({ route, navigation: nav }) => (
          <InviteFriendsScreen
            groupId={route.params.groupId}
            inviteCode={route.params.inviteCode}
            groupName={route.params.groupName}
            onDone={() => nav.navigate('MyGroupHome')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
