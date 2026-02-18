/**
 * Shared design tokens for the Yarok app.
 * Keep all raw colour / spacing values here so every screen
 * references a single source of truth.
 */

export const colors = {
  /** Main background (screens) */
  bg: "#1a2332",
  /** Elevated surface (cards, inputs, rows) */
  surface: "#243044",
  /** Borders, dividers, muted backgrounds */
  border: "#2d3a4d",
  /** Primary accent (green) */
  primary: "#22c55e",
  /** Body text on dark backgrounds */
  text: "#e6edf3",
  /** Secondary / muted text */
  muted: "#8b9cb8",
  /** Tab-bar background */
  tabBar: "#0f1419",
  /** Error / destructive */
  error: "#ef4444",
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
