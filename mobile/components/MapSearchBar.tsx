/**
 * Shared search bar for map screens.
 * Used on the main map tab and inside LocationPickerOverlay.
 * RTL layout: clear button (or spinner) on the left, text input on the right.
 */

import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import type { ViewStyle } from "react-native";
import { colors } from "@/constants/theme";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  /** Callback for the × clear button. When omitted the clear button is hidden. */
  onClear?: () => void;
  /** When true, shows an ActivityIndicator in place of the clear button. */
  loading?: boolean;
  placeholder?: string;
  /** testID applied to the TextInput. */
  testID?: string;
  /** testID applied to the clear button (defaults to `${testID}-clear`). */
  clearTestID?: string;
  /** Extra styles applied to the container (e.g. `flex: 1` for row layouts). */
  style?: ViewStyle;
}

export default function MapSearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  loading = false,
  placeholder = "חיפוש אזור או כתובת",
  testID,
  clearTestID,
  style,
}: Props) {
  const showClear = !loading && value.length > 0 && !!onClear;

  return (
    <View style={[styles.container, style]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.leftSlot} />
      ) : showClear ? (
        <TouchableOpacity
          testID={clearTestID ?? (testID ? `${testID}-clear` : undefined)}
          style={styles.clearBtn}
          onPress={onClear}
          accessibilityLabel="נקה חיפוש"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearText}>×</Text>
        </TouchableOpacity>
      ) : null}
      <TextInput
        testID={testID}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    ...(Platform.OS === "web" && ({
      outlineStyle: "none",
    } as { outlineStyle?: "none" })),
  },
  leftSlot: {
    marginRight: 4,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  clearText: {
    fontSize: 22,
    color: colors.muted,
    lineHeight: 24,
  },
});
