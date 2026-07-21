import "@/global.css";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-blue-500">
        Welcome to Nativewind!
      </Text>

      <Link href="/onboarding" className="mt-4 rounded bg-black text-white p-4">
        Go to onboarding
      </Link>

      <Link
        href="/(auth)/sign-in"
        className="mt-4 rounded bg-black text-white p-4"
      >
        Go to sign in
      </Link>

      <Link
        href="/(auth)/sign-up"
        className="mt-4 rounded bg-black text-white p-4"
      >
        Go to sign up
      </Link>
    </View>
  );
}
