/**
 * Cross-platform MapView export.
 * Expo/Metro resolves MapView.web.tsx on web and MapView.tsx on native.
 */
export { default as MapView } from "./MapView";
export type { MapViewProps, MapMarker, MapCenter } from "./types";
