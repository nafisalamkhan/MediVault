import { View, Pressable, StyleSheet, Text } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows } from "@/lib/theme";

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
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
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
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <MaterialIcons
                  name={iconName as any}
                  size={24}
                  color={isFocused ? colors.white : colors.inkMuted}
                />
              </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    ...shadows.tabBar,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
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
