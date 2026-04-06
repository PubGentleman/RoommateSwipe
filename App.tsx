import React, { useEffect, useRef } from "react";
import { AppState, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "./navigation/navigationRef";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";

import { RootNavigator } from "./navigation/RootNavigator";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { FeedBadgeProvider } from "./contexts/FeedBadgeContext";
import { CityProvider } from "./contexts/CityContext";
import { ProfileReminderProvider } from "./contexts/ProfileReminderContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { StripeWrapper } from "./components/StripeWrapper";
import { RevenueCatProvider } from "./contexts/RevenueCatContext";
import { TourProvider } from "./contexts/TourContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageService } from "./utils/storage";
import { isDev } from "./utils/dataUtils";
import { checkDailyTrigger } from "./utils/insightRefresh";
import { useResponseTracking } from "./hooks/useResponseTracking";
import { supabase } from "./lib/supabase";
import { addNotificationResponseListener } from "./services/pushNotificationService";
import { joinGlobalPresence, leaveGlobalPresence, startPresenceHeartbeat, stopPresenceHeartbeat } from "./services/presenceService";

SplashScreen.preventAutoHideAsync();


function ResponseTracker() {
  useResponseTracking();
  return null;
}

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const handleInitialDeepLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl) return;

        if (initialUrl.includes('auth/verify') || initialUrl.includes('auth/reset-password')) {
          return;
        }

        const match = initialUrl.match(/join\/([A-Za-z0-9]+)/);
        if (match && match[1]) {
          const inviteCode = match[1];
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            await AsyncStorage.setItem('pending_invite_code', inviteCode);
          }
        }

        const referralMatch = initialUrl.match(/invite\/(RHOME-[A-Za-z0-9]+)/i);
        if (referralMatch && referralMatch[1]) {
          await AsyncStorage.setItem('pending_referral_code', referralMatch[1].toUpperCase());
        }
      } catch {}
    };

    handleInitialDeepLink();

    const subscription = Linking.addEventListener('url', async (event: { url: string }) => {
      try {
        const rm = event.url.match(/invite\/(RHOME-[A-Za-z0-9]+)/i);
        if (rm && rm[1]) {
          await AsyncStorage.setItem('pending_referral_code', rm[1].toUpperCase());
        }
      } catch {}
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let currentUserId: string | null = null;

    const initPresence = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
          joinGlobalPresence(user.id);
          startPresenceHeartbeat(user.id);
        }
      } catch {}
    };

    initPresence();

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            currentUserId = user.id;
            await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id);
            joinGlobalPresence(user.id);
            startPresenceHeartbeat(user.id);
          }
        } catch {}
      } else if (nextState === 'background' || nextState === 'inactive') {
        if (currentUserId) {
          stopPresenceHeartbeat(currentUserId);
          leaveGlobalPresence();
        }
      }
      appState.current = nextState;
    });
    return () => {
      sub.remove();
      if (currentUserId) {
        stopPresenceHeartbeat(currentUserId);
        leaveGlobalPresence();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDev) {
        (window as any).reloadMockData = async () => {
          await StorageService.forceReloadMockData();
          console.log('Mock data reloaded! Please refresh the page to see changes.');
        };
        console.log('[App] Dev mode — mock data enabled. Run: window.reloadMockData()');
      } else {
        console.log('[App] Production mode — mock data disabled');
      }
      (window as any).resetApp = async () => {
        await StorageService.clearAllData();
        console.log('All app data cleared! Refreshing...');
        window.location.reload();
      };
    }
    checkDailyTrigger();
  }, []);

  useEffect(() => {
    const cleanup = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.type === 'new_message' && data?.matchId) {
        navigationRef.current?.navigate('Main', {
          screen: 'Messages',
          params: {
            screen: 'Chat',
            params: {
              conversationId: data.matchId,
            },
          },
        });
      } else if (data?.type === 'new_group_message' && data?.groupId) {
        navigationRef.current?.navigate('Main', {
          screen: 'Messages',
          params: {
            screen: 'Chat',
            params: {
              conversationId: `inquiry_${data.groupId}`,
              inquiryGroup: { id: data.groupId },
            },
          },
        });
      }
    });

    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <StripeWrapper>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AuthProvider>
                <CityProvider>
                  <ProfileReminderProvider>
                    <NotificationProvider>
                      <FeedBadgeProvider>
                      <ConfirmProvider>
                        <RevenueCatProvider>
                          <TourProvider>
                          <NavigationContainer
                            ref={navigationRef}
                            linking={{
                              prefixes: [Linking.createURL('/'), 'rhome://'],
                              config: {
                                screens: {
                                  Main: {
                                    screens: {
                                      Groups: {
                                        screens: {
                                          GroupInviteAccept: 'join/:inviteCode',
                                          PiGroupInvite: 'pi-group-invite/:groupId',
                                          PiReplacementVote: 'pi-replacement-vote/:groupId',
                                        },
                                      },
                                    },
                                  },
                                  JoinTeam: 'join-team/:inviteId',
                                },
                              },
                            }}
                          >
                            <RootNavigator />
                            <ResponseTracker />
                          </NavigationContainer>
                          <StatusBar style="light" />
                          </TourProvider>
                        </RevenueCatProvider>
                      </ConfirmProvider>
                      </FeedBadgeProvider>
                    </NotificationProvider>
                  </ProfileReminderProvider>
                </CityProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </StripeWrapper>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
