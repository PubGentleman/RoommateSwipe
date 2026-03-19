import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { CreateGroupScreen } from '../screens/shared/CreateGroupScreen';
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
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export const MessagesStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
    </Stack.Navigator>
  );
};
