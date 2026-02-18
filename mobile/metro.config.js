const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Preserve class/function names in production web builds so that
// expo-modules-core's registerWebModule can read moduleImplementation.name.
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    keep_classnames: true,
    keep_fnames: true,
  },
};

// Exclude @maplibre/maplibre-react-native from web bundles — it has no web
// implementation. The web app uses react-map-gl via MapView.web.tsx instead.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "@maplibre/maplibre-react-native" ||
      moduleName.startsWith("@maplibre/maplibre-react-native/"))
  ) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
