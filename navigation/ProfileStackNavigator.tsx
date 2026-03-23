import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '../components/VectorIcons';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { PlansScreen } from '../screens/shared/PlansScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { ProfileQuestionnaireScreen } from '../screens/shared/ProfileQuestionnaireScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { PrivacySecurityScreen } from '../screens/shared/PrivacySecurityScreen';
import { ProfileViewsScreen } from '../screens/renter/ProfileViewsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/shared/TermsOfServiceScreen';
import AboutScreen from '../screens/shared/AboutScreen';
import { DownloadDataScreen } from '../screens/shared/DownloadDataScreen';
import { BlockedUsersScreen } from '../screens/shared/BlockedUsersScreen';
import { NotificationPreferencesScreen } from '../screens/shared/NotificationPreferencesScreen';
import { VerificationScreen } from '../screens/shared/VerificationScreen';
import { MyInterestsScreen } from '../screens/shared/MyInterestsScreen';
import { MatchesListScreen } from '../screens/shared/MatchesListScreen';
import { WhoLikedMeScreen } from '../screens/shared/WhoLikedMeScreen';
import { HostPricingScreen } from '../screens/host/HostPricingScreen';
import { HostSubscriptionScreen } from '../screens/host/HostSubscriptionScreen';
import { ManageSubscriptionScreen } from '../screens/shared/ManageSubscriptionScreen';
import { DiagnosticScreen } from '../screens/shared/DiagnosticScreen';
import { HostTypeSelectScreen } from '../screens/host/onboarding/HostTypeSelectScreen';
import { HostCompanySetupScreen } from '../screens/host/onboarding/HostCompanySetupScreen';
import { HostAgentSetupScreen } from '../screens/host/onboarding/HostAgentSetupScreen';
import ApartmentPreferencesScreen from '../screens/shared/ApartmentPreferencesScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  HostTypeSelect: undefined;
  HostCompanySetup: undefined;
  HostAgentSetup: undefined;
  Payment: undefined;
  Plans: undefined;
  HostPricing: undefined;
  HostSubscription: undefined;
  ManageSubscription: undefined;
  Diagnostic: undefined;
  EditProfile: undefined;
  ProfileQuestionnaire: { initialStep?: string } | undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  ProfileViews: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  About: undefined;
  DownloadData: undefined;
  BlockedUsers: undefined;
  NotificationPreferences: undefined;
  Verification: { fromHostPurchase?: boolean } | undefined;
  MyInterests: undefined;
  MatchesList: undefined;
  WhoLikedMe: undefined;
  ApartmentPreferences: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const darkHeaderOptions = {
  headerStyle: { backgroundColor: '#111111' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerShadowVisible: false,
};

export const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'Payment Methods',
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
        options={() => ({
          headerShown: false,
        })}
      />
      <Stack.Screen 
        name="HostPricing" 
        component={HostPricingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostSubscription" 
        component={HostSubscriptionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ManageSubscription" 
        component={ManageSubscriptionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Diagnostic" 
        component={DiagnosticScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostTypeSelect" 
        component={HostTypeSelectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostCompanySetup" 
        component={HostCompanySetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostAgentSetup" 
        component={HostAgentSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ProfileQuestionnaire" 
        component={ProfileQuestionnaireScreen}
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
          ...darkHeaderOptions,
          headerTitle: 'Privacy & Security',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="ProfileViews" 
        component={ProfileViewsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'Who Likes You',
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
          ...darkHeaderOptions,
          headerTitle: 'Privacy Policy',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="TermsOfService" 
        component={TermsOfServiceScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'Terms of Service',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'About Rhome',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="DownloadData" 
        component={DownloadDataScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'Download My Data',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="BlockedUsers" 
        component={BlockedUsersScreen}
        options={({ navigation }) => ({
          headerShown: true,
          ...darkHeaderOptions,
          headerTitle: 'Blocked Users',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Feather name="chevron-left" size={28} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen 
        name="NotificationPreferences" 
        component={NotificationPreferencesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MyInterests" 
        component={MyInterestsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MatchesList" 
        component={MatchesListScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="WhoLikedMe" 
        component={WhoLikedMeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ApartmentPreferences"
        component={ApartmentPreferencesScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
