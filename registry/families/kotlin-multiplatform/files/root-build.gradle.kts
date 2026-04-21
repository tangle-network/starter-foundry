// Top-level build file. Plugin versions are declared in each subproject's
// build.gradle.kts via plugin DSL (e.g. shared/build.gradle.kts). This keeps
// root config minimal so subprojects can evolve independently.

plugins {
    // Declared but not applied — subprojects apply what they need.
    kotlin("multiplatform") version "2.0.21" apply false
    id("com.android.application") version "8.5.2" apply false
    id("com.android.library") version "8.5.2" apply false
    id("org.jetbrains.compose") version "1.7.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
