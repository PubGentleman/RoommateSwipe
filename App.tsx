import React, { useEffect, useCallback } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";

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

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

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
