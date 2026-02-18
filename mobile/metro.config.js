const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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
