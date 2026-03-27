import React, { useEffect, useRef } from "react";
import { AppState, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { RootNavigator } from "./navigation/RootNavigator";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { CityProvider } from "./contexts/CityContext";
import { ProfileReminderProvider } from "./contexts/ProfileReminderContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { StripeWrapper } from "./components/StripeWrapper";
import { RevenueCatProvider } from "./contexts/RevenueCatContext";
import { StorageService } from "./utils/storage";
import { isDev } from "./utils/dataUtils";
import { checkDailyTrigger } from "./utils/insightRefresh";
import { useResponseTracking } from "./hooks/useResponseTracking";
import { supabase } from "./lib/supabase";

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
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id);
          }
        } catch {}
      }
      appState.current = nextState;
    });
    return () => sub.remove();
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
                      <ConfirmProvider>
                        <RevenueCatProvider>
                          <NavigationContainer>
                            <RootNavigator />
                            <ResponseTracker />
                          </NavigationContainer>
                          <StatusBar style="light" />
                        </RevenueCatProvider>
                      </ConfirmProvider>
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
