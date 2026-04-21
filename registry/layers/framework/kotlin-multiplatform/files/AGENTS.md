# Kotlin Multiplatform Starter — Agent Guide

## What this scaffold is

One Kotlin codebase targeting Android and iOS with shared UI via Compose Multiplatform. The `shared/` module compiles to an Android library and a Kotlin/Native iOS framework; platform apps in `androidApp/` and `iosApp/` host it.

## Project layout

```
shared/
  src/
    commonMain/kotlin/App.kt          ← shared @Composable root (start here)
    androidMain/kotlin/Platform.android.kt   ← actual for Android
    iosMain/kotlin/Platform.ios.kt           ← actual for iOS
  build.gradle.kts                    ← KMP + Compose plugin config
settings.gradle.kts                   ← declares :shared module
build.gradle.kts                      ← root — plugins apply false
gradle.properties                     ← JVM args, Kotlin flags
validate-kmp.mjs                      ← structural validator (node)
```

## Key commands

| Task | Command |
|------|---------|
| Build shared module | `bash gradlew :shared:build` |
| Run iOS simulator tests | `bash gradlew :shared:iosSimulatorArm64Test` |
| Install Android debug APK | `bash gradlew :androidApp:installDebug` |
| Structural validation (no Gradle needed) | `node validate-kmp.mjs` |

## Extending this scaffold

### Add shared UI
Create new `@Composable` functions in `shared/src/commonMain/kotlin/` and call them from `App()` in `App.kt`.

### Add platform-specific behavior (expect/actual pattern)
1. Declare `expect fun myFn(): ReturnType` in `commonMain`.
2. Implement `actual fun myFn()` in `androidMain/kotlin/` using Android APIs.
3. Implement `actual fun myFn()` in `iosMain/kotlin/` using platform.* Kotlin/Native APIs.
4. Call `myFn()` from any composable in `commonMain`.

### Add a dependency
Gradle dependencies go in `shared/build.gradle.kts`:
- Shared (all targets): in the `commonMain` source set.
- Android-only: in the `androidMain` source set.
- iOS-only: in the `iosMain` source set.

## Package name

All three Kotlin files declare `package com.example.starter`. When renaming, update:
1. The `package` declaration in all three source files.
2. `namespace` in `shared/build.gradle.kts`.
3. `applicationId` in `androidApp/build.gradle.kts` (if present).

## Placeholders that must be replaced

| File | Token | What it becomes |
|------|-------|-----------------|
| `settings.gradle.kts` | `{{packageName}}` | kebab-case project slug (e.g. `my-app`) |
| `shared/build.gradle.kts` | `{{packageName}}` | same slug; namespace becomes `com.starterfoundry.<slug>.shared` |
| `App.kt` + actuals | `com.example.starter` | your reverse-domain package base |

## What NOT to do

- Do not mix Groovy `.gradle` and Kotlin `.gradle.kts` build files — it breaks IDE navigation.
- Do not re-enable `kotlin.native.binary.memoryModel=strict` — incompatible with coroutines and Compose.
- iOS targets require macOS + Xcode 15+; do not attempt iOS compilation on Linux/Windows CI.
