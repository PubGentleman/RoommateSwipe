import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExploreScreen } from '../screens/renter/ExploreScreen';
import { HostPublicProfileScreen } from '../screens/renter/HostPublicProfileScreen';
import SavedSearchesScreen from '../screens/renter/SavedSearchesScreen';
import { SavedSearchFilters } from '../services/savedSearchService';

export type ExploreStackParamList = {
  ExploreMain: { viewListingId?: string; applySavedFilters?: SavedSearchFilters; savedSearchId?: string } | undefined;
  HostPublicProfile: {
    hostId: string;
    hostName: string;
    hostType: 'individual' | 'agent' | 'company';
  };
  SavedSearches: undefined;
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export const ExploreStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExploreMain" component={ExploreScreen} />
    <Stack.Screen name="HostPublicProfile" component={HostPublicProfileScreen} />
    <Stack.Screen name="SavedSearches" component={SavedSearchesScreen} options={{ headerShown: true, headerTitle: 'Saved Searches', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#fff' }} />
  </Stack.Navigator>
);
