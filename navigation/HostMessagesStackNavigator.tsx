import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { CreateGroupScreen } from '../screens/shared/CreateGroupScreen';
import { GroupInviteScreen } from '../screens/shared/GroupInviteScreen';
import { PromoteAdminScreen } from '../screens/shared/PromoteAdminScreen';
import { ListingGroupsScreen } from '../screens/shared/ListingGroupsScreen';
import { HostGroupOutreachScreen } from '../screens/host/HostGroupOutreachScreen';
import { GroupInfoScreen } from '../screens/shared/GroupInfoScreen';
import { RoommateProfile } from '../types/models';
import ConversationMediaScreen from '../screens/shared/ConversationMediaScreen';

export type HostMessagesStackParamList = {
  MessagesList: { role: 'host' | 'agent' | 'company' };
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
  HostGroupOutreach: {
    listingId: string;
    listingTitle: string;
  };
  GroupInfo: {
    groupId: string;
    groupName?: string;
  };
  ConversationMedia: { matchId: string; title?: string };
};

const Stack = createNativeStackNavigator<HostMessagesStackParamList>();

export const HostMessagesStackNavigator = ({ route }: any) => {
  const passedRole = route?.params?.role || 'host';
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        initialParams={{ role: passedRole }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupInvite" component={GroupInviteScreen} />
      <Stack.Screen name="PromoteAdmin" component={PromoteAdminScreen} />
      <Stack.Screen name="ListingGroups" component={ListingGroupsScreen} />
      <Stack.Screen name="HostGroupOutreach" component={HostGroupOutreachScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="ConversationMedia" component={ConversationMediaScreen} />
    </Stack.Navigator>
  );
};
