import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { RootNavigator } from "./navigation/RootNavigator";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { CityProvider } from "./contexts/CityContext";
import { ProfileReminderProvider } from "./contexts/ProfileReminderContext";
import { StripeWrapper } from "./components/StripeWrapper";
import { StorageService } from "./utils/storage";
import { isDev } from "./utils/dataUtils";
import { checkDailyTrigger } from "./utils/insightRefresh";

export default function App() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDev) {
        (window as any).reloadMockData = async () => {
          await StorageService.forceReloadMockData();
          alert('Mock data reloaded! Please refresh the page to see changes.');
        };
        console.log('[App] Dev mode — mock data enabled. Run: window.reloadMockData()');
      } else {
        console.log('[App] Production mode — mock data disabled');
      }
      (window as any).resetApp = async () => {
        await StorageService.clearAllData();
        alert('All app data cleared! Refreshing...');
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
                      <NavigationContainer>
                        <RootNavigator />
                      </NavigationContainer>
                      <StatusBar style="auto" />
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
