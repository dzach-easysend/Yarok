import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { getReports } from "@/services/api";
import { statusLabel } from "@/utils/statusLabel";
import { colors } from "@/constants/theme";
import DragScrollView from "@/components/DragScrollView";

const DEFAULT_CENTER = { lat: 31.7683, lng: 35.2137 };

function ReportCard({
  item,
  onPress,
}: {
  item: { id: string; address?: string | null; status: string; media_count: number };
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID="report-card"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.thumb} />
      <View style={styles.cardBody}>
        <Text testID="report-card-desc" style={styles.title}>
          {item.address || "ללא כתובת"}
        </Text>
        <Text style={styles.meta}>
          {statusLabel(item.status)} · {item.media_count} תמונות
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyReportsScreen() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState(DEFAULT_CENTER);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const { data: reports = [] } = useQuery({
    queryKey: ["my-reports", userLocation.lat, userLocation.lng],
    queryFn: () =>
      getReports({ lat: userLocation.lat, lng: userLocation.lng, radius_km: 500 }),
  });

  return (
    <View style={styles.container} testID="screen-reports">
      {Platform.OS === "web" ? (
        <DragScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          testID="reports-list"
        >
          {reports.map((item) => (
            <ReportCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/report/${item.id}`)}
            />
          ))}
        </DragScrollView>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ReportCard
              item={item}
              onPress={() => router.push(`/report/${item.id}`)}
            />
          )}
        />
      )}
      <TouchableOpacity
        testID="fab-create"
        style={styles.fab}
        onPress={() => router.push("/report/create")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listScroll: { flex: 1, minHeight: 0 },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "transparent",
  },
  thumb: { height: 100, backgroundColor: colors.border },
  cardBody: { padding: 12 },
  title: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4, textAlign: "right" },
  meta: { fontSize: 12, color: colors.muted, textAlign: "right" },
  fab: {
    position: "absolute",
    bottom: 88,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: colors.white, lineHeight: 32 },
});
