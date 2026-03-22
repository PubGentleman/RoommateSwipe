import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoommatesScreen } from '../screens/renter/RoommatesScreen';
import { AIAssistantScreen } from '../screens/renter/AIAssistantScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';

export type RoommatesStackParamList = {
  RoommatesList: undefined;
  AIAssistant: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RoommatesStackParamList>();

export const RoommatesStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoommatesList" component={RoommatesScreen} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
};
