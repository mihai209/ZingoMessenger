package com.zingomessenger.config

import io.github.cdimascio.dotenv.Dotenv
import java.io.File

object Env {
    private val dotenv = run {
        val explicitPath = System.getenv("ENV_FILE") ?: System.getenv("DOTENV_PATH")
        if (explicitPath.isNullOrBlank()) {
            Dotenv.configure()
                .ignoreIfMissing()
                .load()
        } else {
            val envFile = File(explicitPath)
            val directory = envFile.parentFile?.absolutePath ?: "."
            Dotenv.configure()
                .directory(directory)
                .filename(envFile.name)
                .ignoreIfMissing()
                .load()
        }
    }

    fun get(key: String, defaultValue: String? = null): String? {
        return System.getenv(key)
            ?: dotenv[key]
            ?: defaultValue
    }
}
