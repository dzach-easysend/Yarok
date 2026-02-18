/**
 * Shared design tokens for the Yarok app.
 * Keep all raw colour / spacing values here so every screen
 * references a single source of truth.
 */

export const colors = {
  /** Main background (screens) */
  bg: "#f5f7fa",
  /** Elevated surface (cards, inputs, rows) */
  surface: "#ffffff",
  /** Borders, dividers, muted backgrounds */
  border: "#e2e8f0",
  /** Primary accent (green) */
  primary: "#16a34a",
  /** Body text on light backgrounds */
  text: "#0f172a",
  /** Secondary / muted text */
  muted: "#64748b",
  /** Tab-bar background */
  tabBar: "#ffffff",
  /** Error / destructive */
  error: "#dc2626",
  /** Pure white (buttons, thumbs) */
  white: "#fff",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 24,
  full: 999,
} as const;
