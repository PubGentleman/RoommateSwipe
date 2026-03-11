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
import { StorageService } from "./utils/storage";

export default function App() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).reloadMockData = async () => {
        await StorageService.forceReloadMockData();
        alert('Mock data reloaded! Please refresh the page to see changes.');
      };
      (window as any).resetApp = async () => {
        await StorageService.clearAllData();
        alert('All app data cleared! Refreshing...');
        window.location.reload();
      };
      console.log('[App] To reload all mock data, run: window.reloadMockData()');
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <AuthProvider>
              <CityProvider>
                <NotificationProvider>
                  <NavigationContainer>
                    <RootNavigator />
                  </NavigationContainer>
                  <StatusBar style="auto" />
                </NotificationProvider>
              </CityProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
