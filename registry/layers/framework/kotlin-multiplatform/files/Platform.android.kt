package com.example.starter

import android.os.Build

actual fun platformName(): String = "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})"
