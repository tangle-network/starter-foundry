import fs from "node:fs/promises";

const appSource = await fs.readFile("App.tsx", "utf8");
JSON.parse(await fs.readFile("app.json", "utf8"));
JSON.parse(await fs.readFile("tsconfig.json", "utf8"));

// Must import react-native-gesture-handler FIRST — any imports before
// it boot without the gesture patch applied.
const firstImportLine = appSource.split("\n").find((line) => line.trim().startsWith("import"));
if (!firstImportLine || !firstImportLine.includes("react-native-gesture-handler")) {
  throw new Error("App.tsx must import react-native-gesture-handler as the FIRST import — gesture patches miss otherwise");
}

if (!appSource.includes("GestureHandlerRootView")) {
  throw new Error("App.tsx must wrap the tree in GestureHandlerRootView — nested gestures drop events on Android otherwise");
}

if (!appSource.includes("NavigationContainer")) {
  throw new Error("App.tsx must mount a NavigationContainer — React Navigation wiring is missing");
}

const babel = await fs.readFile("babel.config.js", "utf8");
const reanimatedIdx = babel.indexOf("react-native-reanimated/plugin");
if (reanimatedIdx === -1) {
  throw new Error("babel.config.js must include react-native-reanimated/plugin");
}
// Crude last-plugin check: nothing substantial should appear after it
// in the plugins array. Accept trailing whitespace, closing brackets,
// commas, and comments.
const trailing = babel.slice(reanimatedIdx + "react-native-reanimated/plugin".length);
if (/['"]\s*,\s*['"]/.test(trailing)) {
  throw new Error("react-native-reanimated/plugin must be the LAST plugin — Reanimated v3 worklets break silently otherwise");
}

const canvas = await fs.readFile("src/screens/CanvasScreen.tsx", "utf8");
if (!canvas.includes("@shopify/react-native-skia")) {
  throw new Error("src/screens/CanvasScreen.tsx must use @shopify/react-native-skia");
}
if (!canvas.includes("useSharedValue") && !canvas.includes("useDerivedValue")) {
  throw new Error("src/screens/CanvasScreen.tsx should drive the Skia canvas from a Reanimated shared value");
}

console.log("expo rn rich ok");
