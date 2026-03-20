import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { CreateGroupScreen } from '../screens/shared/CreateGroupScreen';
import { GroupInviteScreen } from '../screens/shared/GroupInviteScreen';
import { PromoteAdminScreen } from '../screens/shared/PromoteAdminScreen';
import { ListingGroupsScreen } from '../screens/shared/ListingGroupsScreen';
import { GroupInfoScreen } from '../screens/shared/GroupInfoScreen';
import { RoommateProfile } from '../types/models';

export type MessagesStackParamList = {
  MessagesList: { role?: 'host' | 'renter' };
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
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export const MessagesStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupInvite" component={GroupInviteScreen} />
      <Stack.Screen name="PromoteAdmin" component={PromoteAdminScreen} />
      <Stack.Screen name="ListingGroups" component={ListingGroupsScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
    </Stack.Navigator>
  );
};
