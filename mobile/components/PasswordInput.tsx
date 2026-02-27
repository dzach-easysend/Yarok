/**
 * Password input with show/hide toggle (eye icon).
 * Reusable across login, register, and AuthPromptOverlay.
 */

import { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  /** Optional container style (e.g. from authStyles.input) */
  containerStyle?: object;
}

export default function PasswordInput({
  style,
  containerStyle,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        {...rest}
        style={[styles.input, style, { paddingRight: 44 }]}
        secureTextEntry={!visible}
        placeholderTextColor={rest.placeholderTextColor ?? colors.muted}
      />
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        accessibilityRole="button"
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={colors.muted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: "center",
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    paddingRight: 44,
    backgroundColor: "transparent",
    color: colors.text,
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  iconBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    padding: 4,
  },
});
