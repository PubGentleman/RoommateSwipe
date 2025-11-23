import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { PlansScreen } from '../screens/shared/PlansScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Payment: undefined;
  Plans: undefined;
  EditProfile: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Payment Methods',
          headerBlurEffect: 'regular',
        }}
      />
      <Stack.Screen 
        name="Plans" 
        component={PlansScreen}
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Subscription Plans',
          headerBlurEffect: 'regular',
        }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Edit Profile',
          headerBlurEffect: 'regular',
        }}
      />
    </Stack.Navigator>
  );
};
