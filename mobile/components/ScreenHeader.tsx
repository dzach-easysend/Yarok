import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/theme";
import { railwayLog, emitEvent } from "@/utils/railwayLog";

interface ScreenHeaderProps {
  title: string;
}

export default function ScreenHeader({ title }: ScreenHeaderProps) {
  const router = useRouter();

  function handleBack() {
    emitEvent("back_pressed");
    railwayLog("ScreenHeader back pressed", { title });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
      <TouchableOpacity onPress={handleBack}>
        <Text style={styles.backBtn}>{"חזרה \u2190"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { color: colors.primary, fontSize: 16 },
  title: { fontSize: 17, fontWeight: "600", color: colors.text },
  spacer: { flex: 1 },
});
