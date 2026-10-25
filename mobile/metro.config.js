// The phone app shares the website's data code in ../src (Firestore helpers,
// flashcard scheduling, types). Metro watches that folder, and packages imported
// from it resolve from this app's node_modules, so there is one copy of
// firebase and react. Files named *.native.ts(x) in ../src replace web-only parts.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const sharedSrc = path.resolve(__dirname, "../src");

config.watchFolders = [sharedSrc];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // expo-notifications 58.1.6 loads a push-only native module on Android that Expo Go
  // does not include, so the app crashes on start (https://github.com/expo/expo/issues/52175).
  // StudyPulse uses no push topics: use the package's own empty version. Remove once fixed upstream.
  if (platform === "android" && moduleName === "./TopicSubscriptionModule" && context.originModulePath.includes(`${path.sep}expo-notifications${path.sep}`)) {
    return { type: "sourceFile", filePath: path.join(__dirname, "node_modules/expo-notifications/build/TopicSubscriptionModule.js") };
  }
  const isPackage = !moduleName.startsWith(".") && !moduleName.startsWith("/") && !moduleName.startsWith("@/");
  if (isPackage && context.originModulePath.startsWith(sharedSrc + path.sep)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, "package.json") }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
