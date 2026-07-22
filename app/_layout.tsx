import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * Configures the application's status bar and stack navigator.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
