package com.example.starter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Root Compose Multiplatform composable. Shared across Android + iOS + Desktop.
 * Platform-specific wiring lives in `androidMain/`, `iosMain/`, `jvmMain/` —
 * they provide `Platform.name` via expect/actual.
 */
@Composable
fun App() {
    MaterialTheme {
        var count by remember { mutableStateOf(0) }
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(24.dp),
            ) {
                Text("Starter Foundry — Kotlin Multiplatform", style = MaterialTheme.typography.titleLarge)
                Text("Running on ${platformName()}", style = MaterialTheme.typography.bodyMedium)
                Button(onClick = { count++ }) {
                    Text("Tapped $count times")
                }
            }
        }
    }
}

/** expect/actual — each platform supplies its own value. */
expect fun platformName(): String
