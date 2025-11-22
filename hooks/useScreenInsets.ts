import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { Spacing } from "@/constants/theme";

export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  
  const parent = navigation.getParent();
  const state = parent?.getState();
  const isInsideTabNavigator = state?.type === 'tab';
  
  const tabBarHeight = isInsideTabNavigator ? 80 : insets.bottom;

  return {
    paddingTop: headerHeight + Spacing.xl,
    paddingBottom: tabBarHeight + Spacing.xl,
    scrollInsetBottom: insets.bottom + 16,
  };
}
