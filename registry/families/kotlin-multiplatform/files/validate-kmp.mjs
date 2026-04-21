// Structural validator for the kotlin-multiplatform starter. Does NOT invoke
// Gradle (which needs the full Kotlin + Android + Xcode toolchain). Confirms
// the shared module wires expect/actual correctly and Compose Multiplatform
// is declared in the right places.

import fs from "node:fs/promises";

const [settings, sharedBuild, rootBuild, appKt, platformAndroid, platformIos] = await Promise.all([
  fs.readFile("settings.gradle.kts", "utf8"),
  fs.readFile("shared/build.gradle.kts", "utf8"),
  fs.readFile("build.gradle.kts", "utf8"),
  fs.readFile("shared/src/commonMain/kotlin/App.kt", "utf8"),
  fs.readFile("shared/src/androidMain/kotlin/Platform.android.kt", "utf8"),
  fs.readFile("shared/src/iosMain/kotlin/Platform.ios.kt", "utf8"),
]);

if (!settings.includes('include(":shared")')) {
  throw new Error("settings.gradle.kts must include the :shared module");
}

if (!sharedBuild.includes('kotlin("multiplatform")')) {
  throw new Error("shared/build.gradle.kts must apply the kotlin multiplatform plugin");
}
if (!sharedBuild.includes("org.jetbrains.compose")) {
  throw new Error("shared/build.gradle.kts must apply the Compose Multiplatform plugin");
}
if (!sharedBuild.includes("iosArm64()") || !sharedBuild.includes("iosSimulatorArm64()")) {
  throw new Error("shared/build.gradle.kts must declare iosArm64 + iosSimulatorArm64 targets");
}
if (!sharedBuild.includes("androidTarget")) {
  throw new Error("shared/build.gradle.kts must declare an androidTarget");
}

if (!rootBuild.includes('apply false')) {
  throw new Error("Root build.gradle.kts must declare plugins with `apply false` so subprojects apply them");
}

if (!appKt.includes("@Composable")) {
  throw new Error("commonMain/App.kt must export a @Composable App() surface");
}
if (!appKt.includes("expect ") && !appKt.includes("expect\n")) {
  throw new Error("commonMain/App.kt must declare at least one `expect` platform function");
}

if (!platformAndroid.includes("actual ")) {
  throw new Error("androidMain/Platform.android.kt must provide `actual` implementations");
}
if (!platformIos.includes("actual ")) {
  throw new Error("iosMain/Platform.ios.kt must provide `actual` implementations");
}

console.log("kotlin-multiplatform starter ok");
