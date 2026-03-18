import React, { useEffect, useCallback, useState } from "react";
import { StyleSheet, View, ActivityIndicator, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import Feather from "@expo/vector-icons/Feather";

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

SplashScreen.preventAutoHideAsync().catch(() => {});

const featherFont = Feather.font as Record<string, any>;

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync(featherFont);
      } catch (e) {
        console.warn('Font loading error:', e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ff6b5b" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StripeWrapper>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
            <KeyboardProvider>
              <AuthProvider>
                <CityProvider>
                  <ProfileReminderProvider>
                    <NotificationProvider>
                      <NavigationContainer>
                        <RootNavigator />
                      </NavigationContainer>
                      <StatusBar style="light" />
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
});
