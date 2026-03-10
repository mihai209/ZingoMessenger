import java.util.Properties
import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    kotlin("multiplatform") version "2.3.10"
    id("org.jetbrains.compose") version "1.10.1"
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.10"
}

repositories {
    google()
    mavenCentral()
}

val envFile = rootProject.file(".env")
val envProps = Properties().apply {
    if (envFile.exists()) {
        envFile.inputStream().use { load(it) }
    }
}

val apiBase = System.getenv("API_BASE")
    ?: envProps.getProperty("API_BASE")
    ?: "http://localhost:8080"

val generatedDir = layout.buildDirectory.dir("generated/env").get().asFile

val generateEnv = tasks.register("generateEnv") {
    outputs.dir(generatedDir)
    doLast {
        val pkgDir = file("$generatedDir/com/zingomessenger/web")
        pkgDir.mkdirs()
        val safeApiBase = apiBase
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")

        file("$pkgDir/EnvConfig.kt").writeText(
            """
            package com.zingomessenger.web

            object EnvConfig {
                const val API_BASE = \"$safeApiBase\"
            }
            """.trimIndent()
        )
    }
}

kotlin {
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        browser {
            commonWebpackConfig {
                outputFileName = "app.js"
            }
        }
        binaries.executable()
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDir(generatedDir)
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
            }
        }
    }
}

tasks.matching { it.name.startsWith("compileKotlin") }.configureEach {
    dependsOn(generateEnv)
}
