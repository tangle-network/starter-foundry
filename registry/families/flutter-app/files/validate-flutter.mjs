// Structural validator for the flutter-app starter. Does NOT run `flutter
// analyze` (that requires the Flutter SDK which scaffold validation runs
// without). Confirms entry files exist and reference each other correctly.

import fs from "node:fs/promises";

const [pubspec, mainDart, analysis] = await Promise.all([
  fs.readFile("pubspec.yaml", "utf8"),
  fs.readFile("lib/main.dart", "utf8"),
  fs.readFile("analysis_options.yaml", "utf8"),
]);

if (!pubspec.includes("flutter:\n    sdk: flutter")) {
  throw new Error("pubspec.yaml must declare flutter SDK dependency");
}
if (!pubspec.includes("go_router:")) {
  throw new Error("pubspec.yaml must depend on go_router");
}
if (!pubspec.includes("provider:")) {
  throw new Error("pubspec.yaml must depend on provider");
}
if (!pubspec.includes("dio:")) {
  throw new Error("pubspec.yaml must depend on dio");
}

if (!mainDart.includes("MaterialApp.router")) {
  throw new Error("lib/main.dart must bootstrap MaterialApp.router for GoRouter integration");
}
if (!mainDart.includes("GoRouter(")) {
  throw new Error("lib/main.dart must instantiate a GoRouter");
}
if (!mainDart.includes("ChangeNotifierProvider") && !mainDart.includes("MultiProvider")) {
  throw new Error("lib/main.dart must wire a Provider / ChangeNotifierProvider at the root");
}
if (!mainDart.includes("void main()")) {
  throw new Error("lib/main.dart must define a `void main()` entrypoint");
}

if (!analysis.includes("flutter_lints")) {
  throw new Error("analysis_options.yaml must include flutter_lints");
}

console.log("flutter starter ok");
