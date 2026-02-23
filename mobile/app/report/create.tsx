import { useState, useEffect, useRef, useCallback } from "react";
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
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReport, uploadMedia } from "@/services/api";
import ScreenHeader from "@/components/ScreenHeader";
import { railwayLog } from "@/utils/railwayLog";
import { MapView, type MapCenter } from "@/components/map";
import LocationPickerOverlay from "@/components/LocationPickerOverlay";
import { colors, radii } from "@/constants/theme";

type MediaItem = { uri: string; file?: File };

export default function CreateReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    railwayLog("CreateReportScreen mounted", { platform: Platform.OS });
  }, []);

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
      railwayLog("CreateReportScreen create success", { platform: Platform.OS });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      router.replace("/(tabs)");
    },
    onError: (e: Error) => {
      Alert.alert("שגיאה", e.message || "לא ניתן לשלוח את הדיווח");
    },
  });

  const pickFromGallery = async () => {
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

  const handleCameraInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const newItems: MediaItem[] = Array.from(files).map((file) => ({
        uri: URL.createObjectURL(file),
        file,
      }));
      setMediaItems((prev) => [...prev, ...newItems]);
      e.target.value = "";
    },
    [],
  );

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
        cameraInputRef.current.click();
      }
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("אין הרשאת מצלמה", "יש לאשר גישה למצלמה כדי לצלם.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      videoMaxDuration: 10,
    });
    if (!result.canceled && result.assets.length) {
      const asset = result.assets[0];
      setMediaItems((prev) => [
        ...prev,
        {
          uri: asset.uri,
          file: "file" in asset && asset.file instanceof File ? asset.file : undefined,
        },
      ]);
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

  function handlePickerConfirm(picked: MapCenter) {
    setLocation(picked);
    setPickerVisible(false);
  }

  function handlePickerCancel() {
    setPickerVisible(false);
  }

  function renderLocationStatus(): React.ReactNode {
    if (locationError) {
      return (
        <View style={styles.locationError}>
          <Text style={styles.error}>{locationError}</Text>
          <TouchableOpacity style={styles.adjustBtn} onPress={() => setPickerVisible(true)}>
            <Text style={styles.adjustBtnText}>בחר מיקום ידנית</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (location) {
      return (
        <TouchableOpacity
          testID="mini-map-touch"
          style={styles.miniMapTouchable}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.9}
        >
          <MapView
            key={`${location.lat},${location.lng}`}
            center={location}
            zoom={15}
            markers={[]}
            interactive={false}
            style={styles.miniMap}
          />
          <View style={[styles.miniPinOverlay, { pointerEvents: "none" }]}>
            <View style={styles.miniPinCircle} />
            <View style={styles.miniPinTip} />
          </View>
          <View style={[styles.adjustBadge, { pointerEvents: "none" }]}>
            <Text style={styles.adjustBadgeText}>✎ שנה מיקום</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.locationLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>מאתר מיקום…</Text>
      </View>
    );
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
            {Platform.OS === "web" ? (
              <View
                style={[
                  styles.addMediaBox,
                  { position: "relative", pointerEvents: "box-none" },
                ]}
              >
                <Text style={[styles.addMediaIcon, { pointerEvents: "none" }]}>
                  📷
                </Text>
                <Text style={[styles.addMediaText, { pointerEvents: "none" }]}>
                  צלם
                </Text>
                <input
                  ref={cameraInputRef as React.RefObject<HTMLInputElement>}
                  data-testid="take-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraInput}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    zIndex: 1,
                    cursor: "pointer",
                    pointerEvents: "auto",
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity
                testID="take-photo"
                style={styles.addMediaBox}
                onPress={takePhoto}
              >
                <Text style={styles.addMediaIcon}>📷</Text>
                <Text style={styles.addMediaText}>צלם</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="add-media"
              style={styles.addMediaBox}
              onPress={pickFromGallery}
            >
              <Text style={styles.addMediaIcon}>🖼️</Text>
              <Text style={styles.addMediaText}>בחר מגלריה</Text>
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

      <LocationPickerOverlay
        visible={pickerVisible}
        initialCenter={location ?? { lat: 31.7683, lng: 35.2137 }}
        onConfirm={handlePickerConfirm}
        onCancel={handlePickerCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  step: { marginBottom: 24 },
  stepLabel: { fontSize: 11, color: colors.muted, marginBottom: 6, textAlign: "right" },
  error: { fontSize: 14, color: colors.error, textAlign: "right" },
  locationError: { gap: 8 },
  locationLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { fontSize: 14, color: colors.muted, textAlign: "right" },
  adjustBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  adjustBtnText: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  miniMapTouchable: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  miniMap: { flex: 1 },
  miniPinOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateY: -11 }],
  },
  miniPinCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  miniPinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.primary,
    alignSelf: "center",
    marginTop: -1,
  },
  adjustBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustBadgeText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
  },
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
    width: 100,
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
  addMediaText: { fontSize: 12, color: colors.primary, textAlign: "center" },
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
    bottom: 24,
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
