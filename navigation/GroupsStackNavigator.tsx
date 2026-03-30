import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupsScreen } from '../screens/renter/GroupsScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { CreateGroupScreen } from '../screens/shared/CreateGroupScreen';
import { GroupInviteScreen } from '../screens/shared/GroupInviteScreen';
import { PromoteAdminScreen } from '../screens/shared/PromoteAdminScreen';
import { ListingGroupsScreen } from '../screens/shared/ListingGroupsScreen';
import { GroupInfoScreen } from '../screens/shared/GroupInfoScreen';
import { InterestedUsersScreen } from '../screens/shared/InterestedUsersScreen';
import ApartmentPreferencesScreen from '../screens/shared/ApartmentPreferencesScreen';
import GroupApartmentSuggestionsScreen from '../screens/renter/GroupApartmentSuggestionsScreen';
import { AIGroupInviteScreen } from '../screens/shared/AIGroupInviteScreen';
import { CompanyGroupInviteScreen } from '../screens/shared/CompanyGroupInviteScreen';
import { PiGroupInviteScreen } from '../screens/renter/PiGroupInviteScreen';
import { PiReplacementVoteScreen } from '../screens/renter/PiReplacementVoteScreen';
import MyGroupScreen from '../screens/renter/MyGroupScreen';
import GroupInviteAcceptScreen from '../screens/renter/GroupInviteAcceptScreen';
import GroupSetupScreen from '../screens/renter/GroupSetupScreen';
import InviteFriendsScreen from '../screens/renter/InviteFriendsScreen';
import { RoommateProfile } from '../types/models';

export type GroupsStackParamList = {
  GroupsList: undefined;
  Chat: {
    conversationId: string;
    otherUser?: RoommateProfile;
    inquiryGroup?: any;
  };
  CreateGroup: {
    matchedUserId?: string;
    matchedUserName?: string;
    preselectedListingId?: string;
  };
  GroupInvite: {
    groupId: string;
    groupName: string;
    listingId?: string | null;
  };
  PromoteAdmin: {
    groupId: string;
    groupName: string;
  };
  ListingGroups: {
    listingId: string;
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
  AIGroupInvite: {
    groupId: string;
  };
  CompanyGroupInvite: {
    listingId: string;
    groupId: string;
  };
  PiGroupInvite: {
    groupId?: string;
  };
  PiReplacementVote: {
    groupId: string;
  };
  MyGroup: undefined;
  GroupInviteAccept: {
    inviteCode: string;
  };
  GroupSetup: undefined;
  InviteFriends: {
    groupId: string;
    inviteCode: string;
    groupName?: string;
  };
};

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export const GroupsStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GroupsList" component={GroupsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupInvite" component={GroupInviteScreen} />
      <Stack.Screen name="PromoteAdmin" component={PromoteAdminScreen} />
      <Stack.Screen name="ListingGroups" component={ListingGroupsScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="InterestedUsers" component={InterestedUsersScreen} />
      <Stack.Screen name="ApartmentPreferences" component={ApartmentPreferencesScreen} />
      <Stack.Screen name="GroupApartmentSuggestions" component={GroupApartmentSuggestionsScreen} />
      <Stack.Screen name="AIGroupInvite" component={AIGroupInviteScreen} />
      <Stack.Screen name="CompanyGroupInvite" component={CompanyGroupInviteScreen} />
      <Stack.Screen name="PiGroupInvite" component={PiGroupInviteScreen} />
      <Stack.Screen name="PiReplacementVote" component={PiReplacementVoteScreen} />
      <Stack.Screen name="MyGroup" component={MyGroupScreen} />
      <Stack.Screen name="GroupInviteAccept" component={GroupInviteAcceptScreen} />
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
            onDone={() => nav.navigate('GroupsList')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
