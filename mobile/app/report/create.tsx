import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReport, uploadMedia } from "@/services/api";
import ScreenHeader from "@/components/ScreenHeader";
import { colors } from "@/constants/theme";

type MediaItem = { uri: string; file?: File };

export default function CreateReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("אין הרשאת מיקום");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const createMutation = useMutation({
    mutationFn: async (args: {
      payload: Parameters<typeof createReport>[0];
      mediaItems: MediaItem[];
    }) => {
      const { payload, mediaItems: items } = args;
      const report = await createReport(payload);
      if (items.length > 0) {
        await Promise.all(
          items.map((item) => uploadMedia(report.id, item.uri, item.file)),
        );
      }
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      router.replace("/(tabs)");
    },
    onError: (e: Error) => {
      Alert.alert("שגיאה", e.message || "לא ניתן לשלוח את הדיווח");
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 10,
    });
    if (!result.canceled && result.assets.length) {
      const newItems: MediaItem[] = result.assets.map((a) => ({
        uri: a.uri,
        file: "file" in a && a.file instanceof File ? a.file : undefined,
      }));
      setMediaItems((prev) => [...prev, ...newItems]);
    }
  };

  const canSubmit = Boolean(location && mediaItems.length > 0);

  const handleSubmit = () => {
    if (!location) {
      Alert.alert("חסר מיקום", "נדרש מיקום GPS. אשר גישה למיקום.");
      return;
    }
    if (mediaItems.length === 0) {
      Alert.alert("חסרות תמונות", "נדרשת לפחות תמונה אחת.");
      return;
    }
    createMutation.mutate({
      payload: {
        lat: location.lat,
        lng: location.lng,
        description: description || null,
        contact_info: contactInfo || null,
      },
      mediaItems,
    });
  };

  function renderLocationStatus(): React.ReactNode {
    if (locationError) {
      return <Text style={styles.error}>{locationError}</Text>;
    }
    if (location) {
      return (
        <Text style={styles.stepValue}>
          📍{" "}
          <Text style={styles.coords}>
            {location.lat.toFixed(4)}° צפון, {location.lng.toFixed(4)}° מזרח
          </Text>{" "}
          · נשמר
        </Text>
      );
    }
    return <ActivityIndicator size="small" color={colors.primary} />;
  }

  return (
    <View style={styles.container} testID="screen-create">
      <ScreenHeader title="דיווח חדש" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.step}>
          <Text testID="location-status" style={styles.stepLabel}>מיקום (חובה)</Text>
          {renderLocationStatus()}
        </View>
        <View style={styles.step}>
          <Text style={styles.stepLabel}>תמונות / וידאו (חובה)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaStrip}
            style={styles.mediaStripScroll}
          >
            {mediaItems.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.mediaThumbBox}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.mediaThumbImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  testID="remove-media"
                  style={styles.mediaThumbRemove}
                  onPress={() =>
                    setMediaItems((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Text style={styles.mediaThumbRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              testID="add-media"
              style={styles.addMediaBox}
              onPress={pickImage}
            >
              <Text style={styles.addMediaIcon}>📷</Text>
              <Text style={styles.addMediaText}>הוסף תמונה/וידאו</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepLabel}>תיאור (אופציונלי)</Text>
          <TextInput
            testID="input-description"
            style={styles.input}
            placeholder="מה מצאת?"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>
        <View style={styles.step}>
          <Text style={styles.stepLabel}>פרטי התקשרות (אופציונלי)</Text>
          <TextInput
            testID="input-contact"
            style={styles.input}
            placeholder="אימייל או טלפון — או להשאיר אנונימי"
            placeholderTextColor={colors.muted}
            value={contactInfo}
            onChangeText={setContactInfo}
          />
        </View>
      </ScrollView>
      <TouchableOpacity
        testID="btn-submit-report"
        style={[
          styles.submit,
          (!canSubmit || createMutation.isPending) && styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit || createMutation.isPending}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>שליחת דיווח</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  step: { marginBottom: 24 },
  stepLabel: { fontSize: 11, color: colors.muted, marginBottom: 6, textAlign: "right" },
  stepValue: { fontSize: 15, color: colors.text, textAlign: "right" },
  coords: { fontVariant: ["tabular-nums"] },
  error: { fontSize: 14, color: colors.error, textAlign: "right" },
  mediaStripScroll: { marginHorizontal: -16 },
  mediaStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  mediaThumbBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    position: "relative",
  },
  mediaThumbImage: {
    width: "100%",
    height: "100%",
  },
  mediaThumbRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaThumbRemoveText: { fontSize: 18, color: colors.white, lineHeight: 22 },
  addMediaBox: {
    width: 120,
    height: 120,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addMediaIcon: { fontSize: 28, opacity: 0.8 },
  addMediaText: { fontSize: 12, color: colors.primary, textAlign: "right" },
  input: {
    minHeight: 80,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: "top",
    textAlign: "right",
    writingDirection: "rtl",
  },
  submit: {
    position: "absolute",
    bottom: 72,
    left: 16,
    right: 16,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: "600", color: colors.white },
});
