import "@/global.css";
import { Link } from "expo-router";
import { Text, View } from "react-native";

const SignUp = () => {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-gray-800">Sign Up</Text>
      <Link
        href="/(auth)/sign-in"
        className="mt-4 rounded bg-black px-6 py-3 text-white"
      >
        Sign In
      </Link>
    </View>
  );
};

export default SignUp;
