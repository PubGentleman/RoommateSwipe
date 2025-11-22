import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Payment: undefined;
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
          headerTitle: 'Payment & Subscription',
          headerBlurEffect: 'regular',
        }}
      />
    </Stack.Navigator>
  );
};
