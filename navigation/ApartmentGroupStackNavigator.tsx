import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ApartmentGroupScreen from '../screens/renter/ApartmentGroupScreen';
import GroupSetupScreen from '../screens/renter/GroupSetupScreen';
import InviteFriendsScreen from '../screens/renter/InviteFriendsScreen';
import { useNavigation } from '@react-navigation/native';

const Stack = createNativeStackNavigator();

function GroupSetupWrapper() {
  const navigation = useNavigation<any>();
  return (
    <GroupSetupScreen
      onComplete={(groupId, inviteCode) => {
        navigation.replace('InviteFriends', { groupId, inviteCode });
      }}
      onSkip={() => navigation.goBack()}
    />
  );
}

function InviteFriendsWrapper({ route }: any) {
  const navigation = useNavigation<any>();
  const { groupId, inviteCode, groupName } = route.params || {};
  return (
    <InviteFriendsScreen
      groupId={groupId}
      inviteCode={inviteCode}
      groupName={groupName}
      onDone={() => navigation.navigate('ApartmentGroupHome')}
    />
  );
}

export const ApartmentGroupStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ApartmentGroupHome" component={ApartmentGroupScreen} />
    <Stack.Screen name="GroupSetup" component={GroupSetupWrapper} />
    <Stack.Screen name="InviteFriends" component={InviteFriendsWrapper} />
  </Stack.Navigator>
);
