import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, fonts } from "@/lib/theme";

const Onboarding = () => {
  return (
    <View style={styles.screen}>
      <View style={styles.logoTile}>
        <MaterialIcons name="local-hospital" size={44} color={colors.white} />
      </View>
      <Text style={styles.title}>Welcome to MediVault</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasParchment,
    paddingHorizontal: 32,
  },
  logoTile: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 34,
    letterSpacing: -0.374,
    color: colors.ink,
    textAlign: "center",
    fontFamily: fonts.semibold,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.inkSecondary,
    textAlign: "center",
  },
});

export default Onboarding;
