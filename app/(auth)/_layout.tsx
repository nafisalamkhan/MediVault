import { Stack } from "expo-router";

/**
 * Configures the authentication route stack without navigation headers.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
