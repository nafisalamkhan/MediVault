import { View } from "react-native";
import { Text } from "@/components/ui";
import { MaterialIcons } from "@expo/vector-icons";

const Onboarding = () => {
  return (
    <View className="flex-1 items-center justify-center bg-[#F8FAFC] px-8">
      <MaterialIcons name="local-hospital" size={64} color="#2563EB" />
      <Text className="mt-6 text-center text-2xl font-bold text-slate-900" style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
        Welcome to MediVault
      </Text>
      <Text className="mt-2 text-center text-base text-slate-400">
        Coming soon
      </Text>
    </View>
  );
};

export default Onboarding;
