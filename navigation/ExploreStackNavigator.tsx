import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExploreScreen } from '../screens/renter/ExploreScreen';
import { HostPublicProfileScreen } from '../screens/renter/HostPublicProfileScreen';

export type ExploreStackParamList = {
  ExploreMain: { viewListingId?: string } | undefined;
  HostPublicProfile: {
    hostId: string;
    hostName: string;
    hostType: 'individual' | 'agent' | 'company';
  };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export const ExploreStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExploreMain" component={ExploreScreen} />
    <Stack.Screen name="HostPublicProfile" component={HostPublicProfileScreen} />
  </Stack.Navigator>
);
