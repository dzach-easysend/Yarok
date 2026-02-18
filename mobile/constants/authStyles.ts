/**
 * Shared styles for the login and register auth screens.
 */

import { StyleSheet } from "react-native";
import { colors } from "./theme";

export const authStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  form: { padding: 16, gap: 12 },
  input: {
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  primaryBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: colors.white, textAlign: "right" },
  errorText: { color: colors.error, fontSize: 13, textAlign: "right" },
  link: { color: colors.primary, textAlign: "right", marginTop: 16 },
});
