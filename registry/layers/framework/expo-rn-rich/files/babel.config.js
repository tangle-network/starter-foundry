// IMPORTANT: react-native-reanimated/plugin MUST be the LAST plugin in
// this list. Misordering produces "Reanimated 2 failed to create a
// worklet" at runtime with no indication that babel was the cause.
export default function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
}
