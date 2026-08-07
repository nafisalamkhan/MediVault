import { View, Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiquidGlass } from "@/components/ui";
import { colors } from "@/lib/theme";

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  index: { focused: "home", default: "home" },
  documents: { focused: "description", default: "description" },
  settings: { focused: "settings", default: "settings" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  documents: "Documents",
  settings: "Settings",
};

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarContainer,
        { bottom: insets.bottom > 0 ? insets.bottom + 4 : 16 },
      ]}
    >
      <LiquidGlass
        blurIntensity={50}
        surfaceColor="rgba(255,255,255,0.85)"
        baseTint="rgba(255,255,255,0.3)"
        style={styles.tabBar}
      >
        {state.routes.map((route: any) => {
          const isFocused = state.index === state.routes.indexOf(route);
          const icons = TAB_ICONS[route.name] || TAB_ICONS.index;
          const iconName = isFocused ? icons.focused : icons.default;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityLabel={TAB_LABELS[route.name] || route.name}
              accessibilityState={{ selected: isFocused }}
            >
              {isFocused ? (
                <View style={styles.activePill}>
                  <MaterialIcons name={iconName as any} size={22} color={colors.primary} />
                </View>
              ) : (
                <MaterialIcons name={iconName as any} size={22} color={colors.inkMuted48} />
              )}
            </Pressable>
          );
        })}
      </LiquidGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    width: 64,
  },
  activePill: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar state={props.state} navigation={props.navigation} />
      )}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="documents" options={{ title: "Documents" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
