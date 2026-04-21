// react-native-gesture-handler MUST be the first import in the entry
// file. Anything imported before it boots WITHOUT the gesture patches
// applied and silently drops events on Android.
import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";

// react-native-screens enables UIKit/Fragment-backed screen containers
// — this is a memory win for any nontrivial stack.
enableScreens(true);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
