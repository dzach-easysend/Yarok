import { View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

function HeaderTitleRtl({ title }: { title: string }) {
  return (
    <View style={headerStyles.wrapper}>
      <Text style={headerStyles.title}>{title}</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 16,
  },
  title: { fontSize: 17, fontWeight: "600", color: colors.text, textAlign: "right" },
});

const TAB_TITLES: Record<string, string> = {
  index: "מפה",
  reports: "הדיווחים שלי",
  settings: "הגדרות",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
        headerStyle: { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.text,
        headerTitle: () => <HeaderTitleRtl title={TAB_TITLES[route.name] ?? route.name} />,
        headerTitleContainerStyle: {
          position: "absolute" as const,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_TITLES.index,
          tabBarTestID: "tab-map",
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: TAB_TITLES.reports,
          tabBarTestID: "tab-reports",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: TAB_TITLES.settings,
          tabBarTestID: "tab-settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
