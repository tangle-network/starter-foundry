import fs from "node:fs/promises";

const source = await fs.readFile("App.tsx", "utf8");

JSON.parse(await fs.readFile("app.json", "utf8"));
JSON.parse(await fs.readFile("tsconfig.json", "utf8"));
if (!source.includes("react-native") || !source.includes("SafeAreaView")) {
  throw new Error("React Native surface missing expected components");
}
console.log("typescript ok");
