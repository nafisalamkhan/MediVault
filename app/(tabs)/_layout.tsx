import { View, Pressable, StyleSheet, Text } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/ui";
import { colors, radius, typography, shadows } from "@/lib/theme";

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  index: { focused: "home", default: "home" },
  documents: { focused: "description", default: "description" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  documents: "Documents",
};

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarContainer, { bottom: insets.bottom }]}>
      <Card variant="elevated" style={styles.tabBar}>
        <View style={styles.tabBarInner}>
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
                style={[styles.tabItem, isFocused && styles.tabItemActive]}
                accessibilityRole="tab"
                accessibilityLabel={TAB_LABELS[route.name] || route.name}
                accessibilityState={{ selected: isFocused }}
              >
                <MaterialIcons
                  name={iconName as any}
                  size={26}
                  color={isFocused ? colors.primary : colors.inkMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused && styles.tabLabelActive,
                  ]}
                >
                  {TAB_LABELS[route.name] || route.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  tabBar: {
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    paddingBottom: 0,
    ...shadows.tabBar,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
  },
  tabItemActive: {
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.inkMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "600",
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
    </Tabs>
  );
}