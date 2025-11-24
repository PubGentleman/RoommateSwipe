import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { PlansScreen } from '../screens/shared/PlansScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { PrivacySecurityScreen } from '../screens/shared/PrivacySecurityScreen';
import { ProfileViewsScreen } from '../screens/renter/ProfileViewsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/shared/TermsOfServiceScreen';
import AboutScreen from '../screens/shared/AboutScreen';
import { DownloadDataScreen } from '../screens/shared/DownloadDataScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Payment: undefined;
  Plans: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  ProfileViews: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  About: undefined;
  DownloadData: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Payment Methods',
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBlurEffect: 'regular',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="Plans" 
        component={PlansScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Subscription Plans',
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBlurEffect: 'regular',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="PrivacySecurity" 
        component={PrivacySecurityScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: false,
          headerTitle: 'Privacy & Security',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="ProfileViews" 
        component={ProfileViewsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Profile Views',
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBlurEffect: 'regular',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="PrivacyPolicy" 
        component={PrivacyPolicyScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: false,
          headerTitle: 'Privacy Policy',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="TermsOfService" 
        component={TermsOfServiceScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: false,
          headerTitle: 'Terms of Service',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: false,
          headerTitle: 'About Roomdr',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="DownloadData" 
        component={DownloadDataScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Download My Data',
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
          },
          headerShadowVisible: true,
          headerBlurEffect: 'regular',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
    </Stack.Navigator>
  );
};
